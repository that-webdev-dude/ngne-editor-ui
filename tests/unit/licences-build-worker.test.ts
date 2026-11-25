import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import type { Plugin } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import { generateLicences, unlistedPackages } from "../../src/build/licences/index.ts";
import type {
    BundleOutput,
    ExcludedCode,
    LicencesPlugins,
    LicencesServiceWorkerPlugin,
} from "../../src/build/licences/index.ts";
import { buildEntry, bundleContext, chunkOf, withNodeEnv } from "./support/licences.ts";

// The service worker's licence check (SPEC §11): the PWA plugin builds the service worker on
// its own, after the app's build has written licences.txt, so the worker's bundle is checked
// against the packages that file lists. The fixture is a library project whose two peers are
// installed in a temporary directory; the app's build bundles one of them.

const MIT =
    "MIT License\n\nCopyright (c) 2026 Somebody\n\nPermission is hereby granted, free of charge, " +
    "to any person obtaining a copy…\n";

const temp = mkdtempSync(join(tmpdir(), "licences-worker-"));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

const root = join(temp, "app");
const prefix = root.replaceAll("\\", "/");
for (const name of ["listed", "other"]) {
    const dir = join(root, "node_modules", name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name, version: "1.0.0", license: "MIT", main: "index.js" }),
    );
    writeFileSync(join(dir, "index.js"), `export const ${name} = "${name}";\n`);
    writeFileSync(join(dir, "LICENSE"), MIT);
}
writeFileSync(join(root, "LICENSE"), "Fixture licence\n");
writeFileSync(join(root, "THIRD_PARTY_NOTICES.md"), "Fixture notices\n");
writeFileSync(
    join(root, "package-lock.json"),
    JSON.stringify({
        lockfileVersion: 3,
        packages: {
            "": { name: "app", peerDependencies: { listed: "1", other: "1" } },
            "node_modules/listed": { version: "1.0.0", dev: true },
            "node_modules/other": { version: "1.0.0", dev: true },
        },
    }),
);

const QUANTIZER: ExcludedCode = { what: "the fixture's quantizer", markers: [/"rgb565"/] };

/** A context that throws on an error, as the bundler does. */
const { ctx: context } = bundleContext();

/** The plugins of the fixture, after the app's build bundled `listed` and rolldown's runtime. */
function afterAppBuild(): LicencesPlugins {
    const plugins = generateLicences({
        root,
        title: "Fixture",
        buildPackages: ["node_modules/listed"],
        virtualModules: { "\0bundler/runtime.js": "node_modules/listed" },
        excludedCode: [QUANTIZER],
    });
    plugins.plugin.generateBundle.handler.call(
        context,
        {},
        chunkOf(`${prefix}/src/main.ts`, `${prefix}/node_modules/listed/index.js`),
    );
    return plugins;
}

describe("the service worker's bundle", () => {
    it("passes with the program's code and packages licences.txt lists", () => {
        const { serviceWorkerPlugin } = afterAppBuild();
        expect(serviceWorkerPlugin.name).toBe("ngne-licences-service-worker");
        expect(serviceWorkerPlugin.apply).toBe("build");
        expect(() =>
            serviceWorkerPlugin.generateBundle.call(
                context,
                {},
                chunkOf(
                    `${prefix}/src/sw.ts`,
                    `${prefix}/node_modules/listed/index.js`,
                    "\0bundler/runtime.js",
                ),
            ),
        ).not.toThrow();
    });

    it("fails with a package licences.txt does not list, naming it", () => {
        const { serviceWorkerPlugin } = afterAppBuild();
        expect(() =>
            serviceWorkerPlugin.generateBundle.call(
                context,
                {},
                chunkOf(`${prefix}/src/sw.ts`, `${prefix}/node_modules/other/index.js`),
            ),
        ).toThrow(
            /The service worker bundles code of packages that licences\.txt does not list: node_modules\/other\./,
        );
    });

    it("fails with no list before the app's build has made licences.txt, naming no package", () => {
        const { serviceWorkerPlugin } = generateLicences({ root, title: "Fixture" });
        const check = () =>
            serviceWorkerPlugin.generateBundle.call(
                context,
                {},
                chunkOf(`${prefix}/node_modules/listed/index.js`),
            );
        expect(check).toThrow(
            /has no list of the app build's packages .*: no app build of this generateLicences call made licences\.txt, and the service worker's build writes to no directory/,
        );
        expect(check).not.toThrow(/does not list: /);
    });

    it("fails with a module it cannot place, naming it", () => {
        const { serviceWorkerPlugin } = afterAppBuild();
        expect(() =>
            serviceWorkerPlugin.generateBundle.call(
                context,
                {},
                chunkOf(`${prefix}/src/sw.ts`, "\0virtual:probe"),
            ),
        ).toThrow(/The service worker renders code of modules .*"\\u0000virtual:probe"/);
    });

    it("fails with code the build must leave out", () => {
        const { serviceWorkerPlugin } = afterAppBuild();
        const bundle: Record<string, BundleOutput> = {
            "sw.js": { type: "chunk", fileName: "sw.js", code: 'x("rgb565")', modules: {} },
        };
        expect(() => serviceWorkerPlugin.generateBundle.call(context, {}, bundle)).toThrow(
            /in sw\.js: the fixture's quantizer/,
        );
    });
});

describe("unlistedPackages", () => {
    it("names the packages of the modules that the listed packages leave out, bundler code included", () => {
        const listed = [`${prefix}/node_modules/listed`];
        expect(
            unlistedPackages(
                [
                    `${prefix}/src/sw.ts`,
                    `${prefix}/node_modules/listed/index.js`,
                    `${prefix}/node_modules/other/a.js`,
                    `${prefix}/node_modules/other/b.js`,
                    "\0rolldown/runtime.js",
                ],
                listed,
            ),
        ).toEqual(["node_modules/other", "node_modules/rolldown"]);
        expect(unlistedPackages([`${prefix}/node_modules/listed/index.js`], listed)).toEqual([]);
        expect(unlistedPackages([`${prefix}/node_modules/listed/index.js`], null)).toEqual([
            "node_modules/listed",
        ]);
    });
});

describe("a service worker built after the app", () => {
    it("passes with a package the app's licences.txt lists, and fails with one it does not", async () => {
        const licences = generateLicences({ root, title: "Fixture" });
        const app = await buildEntry(
            root,
            'import { listed } from "listed";\nglobalThis.listed = listed;\n',
            [licences.plugin],
        );
        expect(app.map(({ fileName }) => fileName)).toContain("licences.txt");
        await expect(
            buildEntry(root, 'import { listed } from "listed";\nglobalThis.sw = listed;\n', [
                licences.serviceWorkerPlugin,
            ]),
        ).resolves.toBeDefined();
        await expect(
            buildEntry(root, 'import { other } from "other";\nglobalThis.sw = other;\n', [
                licences.serviceWorkerPlugin,
            ]),
        ).rejects.toThrow(/licences\.txt does not list: node_modules\/other\./);
    }, 60_000);
});

// The service worker built as vite-plugin-pwa builds it (`injectManifest`): from the app
// build's `closeBundle`, by Vite's `build()` with no config file, into the app's output
// directory, with `injectManifest.buildPlugins.vite`. Rolldown runs `closeBundle` after a
// failed build too, so the service worker's build follows an app build that stopped before it
// made licences.txt, and its error is the one `build()` rejects with. The app builds in
// development mode through `build()`, with NODE_ENV=development, as an E2E support's
// in-process build with test hooks does.

/** Resolves `virtual:<name>` to the project file `<root>/src/<name>.js`, holding `source`. */
function entryPlugin(name: string, source: string): Plugin {
    const id = `${prefix}/src/${name}.js`;
    return {
        name: `entry-${name}`,
        resolveId: (spec) => (spec === `virtual:${name}` ? id : null),
        load: (spec) => (spec === id ? source : null),
    };
}

/** Serves `virtual:probe` as a virtual module no option declares, as a bundler's helper. */
const probe: Plugin = {
    name: "probe",
    resolveId: (id) => (id === "virtual:probe" ? "\0virtual:probe" : null),
    load: (id) => (id === "\0virtual:probe" ? "export const probe = 'probe';\n" : null),
};

/** Builds `virtual:<name>` (`source`) into `outDir` in `mode`, written to disk. */
function buildToDisk(
    outDir: string,
    name: string,
    source: string,
    plugins: readonly Plugin[],
    mode: string,
    emptyOutDir: boolean,
): Promise<unknown> {
    return build({
        configFile: false,
        root,
        mode,
        logLevel: "silent",
        plugins: [entryPlugin(name, source), ...plugins],
        build: {
            outDir,
            emptyOutDir,
            minify: false,
            rollupOptions: { input: `virtual:${name}`, output: { entryFileNames: `${name}.js` } },
        },
    });
}

/** The PWA plugin's step: builds the service worker (`source`) after the app's build. */
function serviceWorkerBuild(
    outDir: string,
    source: string,
    buildPlugins: readonly Plugin[],
    mode: string,
): Plugin {
    return {
        name: "service-worker-build",
        apply: "build",
        closeBundle: {
            sequential: true,
            async handler() {
                await buildToDisk(outDir, "sw", source, buildPlugins, mode, false);
            },
        },
    };
}

/** An empty output directory of its own. */
function outputDir(): string {
    return mkdtempSync(join(temp, "out-"));
}

const LISTED_SW = 'import { listed } from "listed";\nglobalThis.sw = listed;\n';
const OTHER_SW = 'import { other } from "other";\nglobalThis.sw = other;\n';
const LISTED_APP = 'import { listed } from "listed";\nglobalThis.listed = listed;\n';

describe("a service worker built from the app build's closeBundle, in development mode", () => {
    const mode = "development";

    /** The app's build with `licences.plugin` and the service worker's step after it. */
    function buildApp(
        outDir: string,
        appSource: string,
        swSource: string,
        licences: LicencesPlugins,
        serviceWorkerPlugin: LicencesServiceWorkerPlugin = licences.serviceWorkerPlugin,
        extra: readonly Plugin[] = [],
    ): Promise<unknown> {
        return withNodeEnv(mode, () =>
            buildToDisk(
                outDir,
                "app",
                appSource,
                [
                    ...extra,
                    licences.plugin as unknown as Plugin,
                    serviceWorkerBuild(
                        outDir,
                        swSource,
                        [serviceWorkerPlugin as unknown as Plugin],
                        mode,
                    ),
                ],
                mode,
                true,
            ),
        );
    }

    it("passes with a package the app's licences.txt lists, and fails with one it does not", async () => {
        const passing = outputDir();
        await expect(
            buildApp(passing, LISTED_APP, LISTED_SW, generateLicences({ root, title: "Fixture" })),
        ).resolves.toBeDefined();
        expect(existsSync(join(passing, "licences.txt"))).toBe(true);
        expect(existsSync(join(passing, "sw.js"))).toBe(true);
        await expect(
            buildApp(
                outputDir(),
                LISTED_APP,
                OTHER_SW,
                generateLicences({ root, title: "Fixture" }),
            ),
        ).rejects.toThrow(/licences\.txt does not list: node_modules\/other\./);
    }, 60_000);

    it("fails with no list when the app's build failed before it made licences.txt, naming its error", async () => {
        const failing = buildApp(
            outputDir(),
            'import { probe } from "virtual:probe";\nimport { listed } from "listed";\n' +
                "globalThis.app = [probe, listed];\n",
            LISTED_SW,
            generateLicences({ root, title: "Fixture" }),
            undefined,
            [probe],
        );
        await expect(failing).rejects.toThrow(
            /has no list of the app build's packages .*: the app's build of this generateLicences call failed before it made licences\.txt: The build renders code of modules .*\\u0000virtual:probe/,
        );
        await expect(failing).rejects.not.toThrow(/does not list: /);
    }, 60_000);

    it("checks against the written licences.txt when the config module is evaluated again for the worker", async () => {
        // The service worker's plugin comes from another generateLicences call than the app's.
        const passing = outputDir();
        await expect(
            buildApp(
                passing,
                LISTED_APP,
                LISTED_SW,
                generateLicences({ root, title: "Fixture" }),
                generateLicences({ root, title: "Fixture" }).serviceWorkerPlugin,
            ),
        ).resolves.toBeDefined();
        expect(existsSync(join(passing, "sw.js"))).toBe(true);
        await expect(
            buildApp(
                outputDir(),
                LISTED_APP,
                OTHER_SW,
                generateLicences({ root, title: "Fixture" }),
                generateLicences({ root, title: "Fixture" }).serviceWorkerPlugin,
            ),
        ).rejects.toThrow(/licences\.txt does not list: node_modules\/other\./);
    }, 60_000);

    it("fails with no list, naming the file it looked for, when no app build made licences.txt", async () => {
        const outDir = outputDir();
        const { serviceWorkerPlugin } = generateLicences({ root, title: "Fixture" });
        const failing = withNodeEnv(mode, () =>
            buildToDisk(
                outDir,
                "sw",
                LISTED_SW,
                [serviceWorkerPlugin as unknown as Plugin],
                mode,
                false,
            ),
        );
        await expect(failing).rejects.toThrow(
            /has no list of the app build's packages .*: no app build of this generateLicences call made licences\.txt, and there is no .*licences\.txt\./,
        );
        await expect(failing).rejects.toThrow(join(outDir, "licences.txt"));
        await expect(failing).rejects.not.toThrow(/does not list: /);
    }, 60_000);
});
