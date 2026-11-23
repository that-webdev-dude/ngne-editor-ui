import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { generateLicences, unlistedPackages } from "../../src/build/licences/index.ts";
import type {
    BundleOutput,
    ExcludedCode,
    LicencesPlugins,
} from "../../src/build/licences/index.ts";
import { buildEntry, bundleContext, chunkOf } from "./support/licences.ts";

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

    it("fails with every package before the app's build has made licences.txt", () => {
        const { serviceWorkerPlugin } = generateLicences({ root, title: "Fixture" });
        expect(() =>
            serviceWorkerPlugin.generateBundle.call(
                context,
                {},
                chunkOf(`${prefix}/node_modules/listed/index.js`),
            ),
        ).toThrow(/does not list: node_modules\/listed\./);
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
