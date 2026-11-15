import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
    LICENCES_FILE,
    LicenceError,
    buildLicencesFile,
    buildPackageDirs,
    excludedCodeIn,
    packageDirsOf,
    runtimePackageDirs,
    strayPackages,
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

/** The licences plugin: writes the file in the build, serves it from the development server. */
export interface LicencesPlugin {
    name: string;
    configureServer(server: DevServer): void;
    generateBundle: {
        order: "post";
        handler(this: BundleContext, options: unknown, bundle: Record<string, BundleOutput>): void;
    };
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

/** What `generateLicences` returns: the app's plugin and its web workers' plugin. */
export interface LicencesPlugins {
    /** For `plugins` of the app's Vite config. */
    plugin: LicencesPlugin;
    /** For `worker.plugins` of the app's Vite config. */
    workerPlugin: LicencesWorkerPlugin;
}

/** The JavaScript of an output of a build: a chunk's code, a `.js` asset's text, otherwise "". */
function javaScriptOf(output: BundleOutput): string {
    if (output.type === "chunk") return output.code;
    if (output.fileName.endsWith(".js") && typeof output.source === "string") return output.source;
    return "";
}

/**
 * The open-source licences file of an app (SPEC §11): `licences.txt` beside `index.html`,
 * with the licence of every package whose code the build bundled, each of them a runtime
 * dependency of package-lock.json, and of the build-only packages. The development server
 * answers the same address with the runtime dependencies' licences and the build-only ones.
 * The build fails on a package without an allowed licence or a licence text, on bundled code
 * of a package that is not a runtime dependency, and on excluded code found in the bundle.
 */
export function generateLicences(options: LicencesOptions): LicencesPlugins {
    const { root } = options;
    const buildPackages = options.buildPackages ?? [];
    const excluded = options.excludedCode ?? [];

    /** The ids of the modules the build's chunks render, the web workers' included. */
    const bundledModules = new Set<string>();

    const runtime = () =>
        runtimePackageDirs(readFileSync(join(root, "package-lock.json"), "utf8"), root);

    /** `dirs` and the build-only packages, in order of name. */
    const withBuildPackages = (dirs: readonly string[]) =>
        packageDirsOf(
            [...dirs, ...buildPackageDirs(root, buildPackages)].map((dir) => `${dir}/package.json`),
        );

    /** Notes the modules of every chunk of `bundle` that renders code. */
    function noteModules(bundle: Record<string, BundleOutput>): void {
        for (const output of Object.values(bundle)) {
            if (output.type !== "chunk") continue;
            for (const [id, module] of Object.entries(output.modules)) {
                if (module.renderedLength > 0) bundledModules.add(id);
            }
        }
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
                    const text = buildLicencesFile(withBuildPackages(runtime()), options);
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
                try {
                    this.emitFile({
                        type: "asset",
                        fileName: LICENCES_FILE,
                        source: buildLicencesFile(withBuildPackages(bundled), options),
                    });
                } catch (error) {
                    if (error instanceof LicenceError) this.error(error.message);
                    throw error;
                }
            },
        },
    };

    return { plugin, workerPlugin };
}
