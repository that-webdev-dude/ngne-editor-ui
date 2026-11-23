import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
    LICENCES_FILE,
    LicenceError,
    VIRTUAL_MODULES,
    buildLicencesFile,
    buildPackageDirs,
    bundlerPackagesOf,
    excludedCodeIn,
    licencesFileMismatch,
    moduleSource,
    packageDirsOf,
    peerPackageDirs,
    runtimePackageDirs,
    strayPackages,
    unknownModules,
    unlistedPackages,
} from "./licences.js";
import type { LicencesOptions } from "./licences.js";

// The build glue of the licences file (SPEC §11): the plugins an app's vite.config.ts adds, so
// the app wires the file with one call. They are typed structurally, as far as they read the
// bundler's objects, so this module imports only `node:*`.

/** An output of a build, as far as the plugins read it. */
export type BundleOutput =
    | {
          type: "chunk";
          fileName: string;
          code: string;
          modules: Record<string, { renderedLength: number }>;
      }
    | { type: "asset"; fileName: string; source: string | Uint8Array };

/** The plugin context, as far as the plugins use it. */
export interface BundleContext {
    error(message: string): never;
    emitFile(file: { type: "asset"; fileName: string; source: string }): string;
}

/** Where a build writes, as far as the licences plugin reads it. */
export interface WriteOptions {
    dir?: string;
    file?: string;
}

/** The development server, as far as the licences plugin uses it. */
export interface DevServer {
    config: { base: string };
    middlewares: {
        use(
            handler: (
                request: { url?: string },
                response: {
                    setHeader(name: string, value: string): unknown;
                    end(text: string): unknown;
                },
                next: (error?: unknown) => void,
            ) => void,
        ): unknown;
    };
}

/**
 * The licences plugin: writes the file in the build, checks the file as written, and serves
 * it from the development server.
 */
export interface LicencesPlugin {
    name: string;
    configureServer(server: DevServer): void;
    generateBundle: {
        order: "post";
        handler(this: BundleContext, options: unknown, bundle: Record<string, BundleOutput>): void;
    };
    writeBundle(this: BundleContext, options: WriteOptions): void;
}

/** The web workers' plugin: notes their modules; the workers are built before the app's chunks. */
export interface LicencesWorkerPlugin {
    name: string;
    apply: "build";
    generateBundle(
        this: BundleContext,
        options: unknown,
        bundle: Record<string, BundleOutput>,
    ): void;
}

/**
 * The service worker's plugin: checks the service worker's own build, which the PWA plugin
 * runs after the app's, against the packages the licences file lists.
 */
export interface LicencesServiceWorkerPlugin {
    name: string;
    apply: "build";
    generateBundle(
        this: BundleContext,
        options: unknown,
        bundle: Record<string, BundleOutput>,
    ): void;
}

/** What `generateLicences` returns: the app's plugin and its workers' plugins. */
export interface LicencesPlugins {
    /** For `plugins` of the app's Vite config. */
    plugin: LicencesPlugin;
    /** For `worker.plugins` of the app's Vite config. */
    workerPlugin: LicencesWorkerPlugin;
    /** For the service worker's own build: `injectManifest.buildPlugins.vite` of the PWA plugin. */
    serviceWorkerPlugin: LicencesServiceWorkerPlugin;
}

/** The JavaScript of an output of a build: a chunk's code, a `.js` asset's text, otherwise "". */
function javaScriptOf(output: BundleOutput): string {
    if (output.type === "chunk") return output.code;
    if (output.fileName.endsWith(".js") && typeof output.source === "string") return output.source;
    return "";
}

/** The ids of the modules that render code in the chunks of `bundle`. */
function renderedModules(bundle: Record<string, BundleOutput>): string[] {
    const ids: string[] = [];
    for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue;
        for (const [id, module] of Object.entries(output.modules)) {
            if (module.renderedLength > 0) ids.push(id);
        }
    }
    return ids;
}

/** Module ids for an error message, each quoted. */
function quoted(ids: readonly string[]): string {
    return ids.map((id) => JSON.stringify(id)).join(", ");
}

/**
 * The open-source licences file of an app (SPEC §11): `licences.txt` beside `index.html`,
 * with the licence of every package whose code the build bundled, each of them a runtime
 * dependency of package-lock.json or one of the project's peer dependencies and the packages
 * they require (a library's own site), and of the build-only packages whose virtual modules
 * the build rendered. The development server answers the same address with the licences of
 * those runtime packages and every build-only one. The build fails on a package without an
 * allowed licence and its text, on bundled code of a package that is neither, on excluded
 * code found in the bundle, on a rendered module it cannot place, and when the file as
 * written does not list exactly the build's packages; the service worker's build fails on
 * code of a package the file does not list.
 */
export function generateLicences(options: LicencesOptions): LicencesPlugins {
    const { root } = options;
    const buildPackages = options.buildPackages ?? [];
    const virtualModules = options.virtualModules ?? VIRTUAL_MODULES;
    const excluded = options.excludedCode ?? [];

    /** The ids of the modules the build's chunks render, the web workers' included. */
    const bundledModules = new Set<string>();

    /** The packages the licences file lists, once the app's build has made it; null before. */
    let listedDirs: string[] | null = null;

    /** The runtime packages a build may bundle: the runtime dependencies, the peers with theirs. */
    const runtime = () => {
        const lock = readFileSync(join(root, "package-lock.json"), "utf8");
        return packageDirsOf(
            [...runtimePackageDirs(lock, root), ...peerPackageDirs(lock, root)].map(
                (dir) => `${dir}/package.json`,
            ),
        );
    };

    /** `dirs` and the build-only packages at `paths`, in order of name. */
    const withBuildPackages = (dirs: readonly string[], paths: readonly string[]) =>
        packageDirsOf(
            [...dirs, ...buildPackageDirs(root, paths)].map((dir) => `${dir}/package.json`),
        );

    /** Notes the modules of every chunk of `bundle` that renders code. */
    function noteModules(bundle: Record<string, BundleOutput>): void {
        for (const id of renderedModules(bundle)) bundledModules.add(id);
    }

    /** Fails the build when a JavaScript file of `bundle` holds excluded code. */
    function rejectExcluded(context: BundleContext, bundle: Record<string, BundleOutput>): void {
        for (const output of Object.values(bundle)) {
            const found = excludedCodeIn(javaScriptOf(output), excluded);
            if (found.length > 0) {
                context.error(
                    `The build bundles code it must leave out, in ${output.fileName}: ${found.join("; ")}.`,
                );
            }
        }
    }

    /**
     * Fails the build on a rendered module it cannot place: neither a file of the program, nor
     * a package's, nor a virtual module of `virtualModules` whose package is a build-only one.
     */
    function rejectUnplaced(context: BundleContext): void {
        const unknown = unknownModules(bundledModules, root, virtualModules);
        if (unknown.length > 0) {
            context.error(
                "The build renders code of modules that are neither the program's files nor a " +
                    `package's, which no licence covers: ${quoted(unknown)}. A virtual module ` +
                    "of the bundler goes into the virtualModules option, with its package.",
            );
        }
        const undeclared = bundlerPackagesOf(bundledModules, virtualModules).filter(
            (path) => !buildPackages.includes(path),
        );
        if (undeclared.length > 0) {
            const ids = [...bundledModules].filter((id) => {
                const source = moduleSource(id, root, virtualModules);
                return source.kind === "bundler" && undeclared.includes(source.path);
            });
            context.error(
                `The build renders virtual modules of ${undeclared.join(", ")} (${quoted(ids)}), ` +
                    "which the buildPackages option does not list.",
            );
        }
    }

    const workerPlugin: LicencesWorkerPlugin = {
        name: "ngne-licences-collect",
        apply: "build",
        generateBundle(_options, bundle) {
            noteModules(bundle);
            rejectExcluded(this, bundle);
        },
    };

    const plugin: LicencesPlugin = {
        name: "ngne-licences",
        configureServer(server) {
            server.middlewares.use((request, response, next) => {
                const path = (request.url ?? "").split("?")[0];
                if (path !== `${server.config.base}${LICENCES_FILE}`) return next();
                try {
                    const text = buildLicencesFile(
                        withBuildPackages(runtime(), buildPackages),
                        options,
                    );
                    response.setHeader("Content-Type", "text/plain; charset=utf-8");
                    response.end(text);
                } catch (error) {
                    next(error);
                }
            });
        },
        generateBundle: {
            order: "post",
            handler(_options, bundle) {
                noteModules(bundle);
                rejectExcluded(this, bundle);
                const bundled = packageDirsOf(bundledModules);
                const strays = strayPackages(bundled, runtime());
                if (strays.length > 0) {
                    this.error(
                        "The build bundles code of packages that are not runtime dependencies " +
                            `in package-lock.json: ${strays.join(", ")}.`,
                    );
                }
                rejectUnplaced(this);
                try {
                    listedDirs = withBuildPackages(
                        bundled,
                        bundlerPackagesOf(bundledModules, virtualModules),
                    );
                    this.emitFile({
                        type: "asset",
                        fileName: LICENCES_FILE,
                        source: buildLicencesFile(listedDirs, options),
                    });
                } catch (error) {
                    if (error instanceof LicenceError) this.error(error.message);
                    throw error;
                }
            },
        },
        // The file as written lists exactly the packages whose code the build rendered.
        writeBundle(writeOptions) {
            const dir =
                writeOptions.dir ??
                (writeOptions.file === undefined ? undefined : dirname(writeOptions.file));
            if (dir === undefined) this.error("The build writes to no directory.");
            const file = join(dir, LICENCES_FILE);
            try {
                const { missing, extra } = licencesFileMismatch(
                    readFileSync(file, "utf8"),
                    listedDirs ?? [],
                );
                if (missing.length > 0 || extra.length > 0) {
                    this.error(
                        `${file} does not list the build's packages. Not listed: ` +
                            `${missing.join(", ") || "none"}. Listed, not in the build: ` +
                            `${extra.join(", ") || "none"}.`,
                    );
                }
            } catch (error) {
                if (error instanceof LicenceError) this.error(error.message);
                throw error;
            }
        },
    };

    const serviceWorkerPlugin: LicencesServiceWorkerPlugin = {
        name: "ngne-licences-service-worker",
        apply: "build",
        generateBundle(_options, bundle) {
            rejectExcluded(this, bundle);
            const modules = renderedModules(bundle);
            const unknown = unknownModules(modules, root, virtualModules);
            if (unknown.length > 0) {
                this.error(
                    "The service worker renders code of modules that are neither the program's " +
                        `files nor a package's, which no licence covers: ${quoted(unknown)}.`,
                );
            }
            const unlisted = unlistedPackages(modules, listedDirs, virtualModules);
            if (unlisted.length > 0) {
                this.error(
                    `The service worker bundles code of packages that ${LICENCES_FILE} does not ` +
                        `list: ${unlisted.join(", ")}.`,
                );
            }
        },
    };

    return { plugin, workerPlugin, serviceWorkerPlugin };
}
