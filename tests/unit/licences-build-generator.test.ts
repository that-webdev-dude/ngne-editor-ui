import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
    ALLOWED_LICENCES,
    LICENCES_FILE,
    LicenceError,
    PACKAGE_STAND_IN_TEXTS,
    buildLicencesFile,
    buildPackageDirs,
    fallbackFileOf,
    generateLicences,
    licenceAllowed,
    licencesText,
    packageDirOf,
    packageDirsOf,
    readPackageLicence,
    runtimePackageDirs,
    strayPackages,
} from "../../src/build/licences/index.ts";
import { peerPackageDirs } from "../../src/build/licences/licences.ts";
import type {
    BundleContext,
    BundleOutput,
    DevServer,
    StandInTexts,
} from "../../src/build/licences/index.ts";

// The licences build helper (SPEC §11): which packages the licences file lists, which licences
// it accepts, and what it holds. The packages of the fixtures are written to a temporary
// directory; the last tests run the helper on this repository (SPEC §3).

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const MIT = "MIT License\n\nCopyright (c) 2026 Somebody\n\nPermission is hereby granted…\n";

const temp = mkdtempSync(join(tmpdir(), "licences-"));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

/** Writes a package under `<temp>/<project>/node_modules/<name>` with the given files. */
function writePackage(
    project: string,
    name: string,
    manifest: Record<string, unknown>,
    files: Record<string, string> = {},
): string {
    const dir = join(temp, project, "node_modules", ...name.split("/"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name, version: "1.0.0", ...manifest }),
    );
    for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
    return dir;
}

describe("packageDirOf", () => {
    it("is the package directory of a bundled module, scoped or nested", () => {
        expect(packageDirOf("/app/node_modules/react/cjs/react.production.js")).toBe(
            "/app/node_modules/react",
        );
        expect(packageDirOf("C:\\app\\node_modules\\@radix-ui\\react-menu\\dist\\index.mjs")).toBe(
            "C:/app/node_modules/@radix-ui/react-menu",
        );
        // A nested copy is that copy.
        expect(packageDirOf("/app/node_modules/a/node_modules/b/index.js?commonjs-es")).toBe(
            "/app/node_modules/a/node_modules/b",
        );
        expect(packageDirOf("\0/app/node_modules/gifenc/dist/gifenc.esm.js")).toBe(
            "/app/node_modules/gifenc",
        );
    });

    it("is null for the program's own modules and virtual ones", () => {
        expect(packageDirOf("/app/src/main.tsx")).toBeNull();
        expect(packageDirOf("\0vite/preload-helper.js")).toBeNull();
        expect(packageDirOf("/app/node_modules/")).toBeNull();
        expect(packageDirOf("/app/node_modules/@scope/")).toBeNull();
    });

    it("lists each package once, in order of name by code unit", () => {
        expect(
            packageDirsOf([
                "/app/node_modules/zustand/esm/vanilla.mjs",
                "/app/src/main.tsx",
                "/app/node_modules/@floating-ui/dom/dist/a.mjs",
                "/app/node_modules/zustand/esm/react.mjs",
                "/app/node_modules/react/index.js",
                "/app/node_modules/React-like/index.js",
            ]),
        ).toEqual([
            "/app/node_modules/@floating-ui/dom",
            "/app/node_modules/React-like",
            "/app/node_modules/react",
            "/app/node_modules/zustand",
        ]);
    });
});

describe("licenceAllowed", () => {
    it("allows the permissive licences of the default allowlist and nothing else", () => {
        expect(ALLOWED_LICENCES).toEqual([
            "MIT",
            "ISC",
            "0BSD",
            "BSD-2-Clause",
            "BSD-3-Clause",
            "Apache-2.0",
        ]);
        for (const licence of ALLOWED_LICENCES) expect(licenceAllowed(licence), licence).toBe(true);
        for (const licence of ["GPL-3.0", "LGPL-2.1", "MPL-2.0", "CC-BY-4.0", "UNLICENSED", ""]) {
            expect(licenceAllowed(licence), licence).toBe(false);
        }
    });

    it("reads OR as a choice and AND as both", () => {
        expect(licenceAllowed("(MIT OR GPL-3.0)")).toBe(true);
        expect(licenceAllowed("GPL-3.0 OR MPL-2.0")).toBe(false);
        expect(licenceAllowed("MIT AND ISC")).toBe(true);
        expect(licenceAllowed("MIT AND GPL-3.0")).toBe(false);
        expect(licenceAllowed("MIT OR")).toBe(false);
    });

    it("takes the app's allowlist", () => {
        expect(licenceAllowed("MIT", ["ISC"])).toBe(false);
        expect(licenceAllowed("MIT OR CC0-1.0", ["CC0-1.0"])).toBe(true);
    });
});

describe("readPackageLicence", () => {
    const fallbacks: StandInTexts = {
        dir: join(temp, "fallbacks"),
        label: "scripts/licence-texts",
    };
    mkdirSync(fallbacks.dir, { recursive: true });

    it("reads the licence and every licence, NOTICE and third-party licence file at the package's top", () => {
        const dir = writePackage(
            "read",
            "@scope/thing",
            { license: "Apache-2.0" },
            {
                "LICENSE.txt": `${MIT}\r\n`,
                NOTICE: "Notice text  \n",
                "THIRD-PARTY-LICENSE": "Bundled code\n",
                "README.md": "no",
            },
        );
        expect(readPackageLicence(dir, [fallbacks])).toEqual({
            name: "@scope/thing",
            version: "1.0.0",
            licence: "Apache-2.0",
            texts: [
                { file: "LICENSE.txt", text: MIT },
                { file: "NOTICE", text: "Notice text\n" },
                { file: "THIRD-PARTY-LICENSE", text: "Bundled code\n" },
            ],
        });
    });

    it("reads the older `licenses` list and a `license` object", () => {
        const list = writePackage(
            "read",
            "old-list",
            { licenses: [{ type: "MIT" }, { type: "GPL-2.0" }] },
            { LICENCE: MIT },
        );
        expect(readPackageLicence(list, [fallbacks]).licence).toBe("MIT OR GPL-2.0");
        const object = writePackage(
            "read",
            "old-object",
            { license: { type: "ISC" } },
            { COPYING: MIT },
        );
        expect(readPackageLicence(object, [fallbacks]).licence).toBe("ISC");
    });

    it("refuses a package with a licence outside the allowlist", () => {
        const dir = writePackage("read", "copyleft", { license: "GPL-3.0" }, { LICENSE: "GPL" });
        expect(() => readPackageLicence(dir, [fallbacks])).toThrow(LicenceError);
        expect(() => readPackageLicence(dir, [fallbacks])).toThrow(/copyleft@1\.0\.0 .*GPL-3\.0/);
        expect(readPackageLicence(dir, [fallbacks], ["GPL-3.0"]).licence).toBe("GPL-3.0");
    });

    it("refuses a package that states no licence", () => {
        const dir = writePackage("read", "silent", {}, { LICENSE: MIT });
        expect(() => readPackageLicence(dir, [fallbacks])).toThrow(/states no licence/);
    });

    it("refuses a package without a licence file, unless a stand-in directory has one", () => {
        const dir = writePackage("read", "@scope/bare", { license: "MIT" });
        expect(() => readPackageLicence(dir, [fallbacks])).toThrow(
            /@scope\/bare@1\.0\.0 \(MIT\) has no licence file.*@scope__bare\.txt/,
        );
        expect(fallbackFileOf("@scope/bare")).toBe("@scope__bare.txt");
        writeFileSync(join(fallbacks.dir, "@scope__bare.txt"), MIT);
        expect(readPackageLicence(dir, [fallbacks]).texts).toEqual([
            { file: "scripts/licence-texts/@scope__bare.txt", text: MIT },
        ]);
    });

    it("takes the stand-in of the first directory that has one", () => {
        const dir = writePackage("read", "twice", { license: "MIT" });
        const first: StandInTexts = { dir: join(temp, "first"), label: "first" };
        const second: StandInTexts = { dir: join(temp, "second"), label: "second" };
        mkdirSync(first.dir, { recursive: true });
        mkdirSync(second.dir, { recursive: true });
        writeFileSync(join(second.dir, "twice.txt"), "Second\n");
        expect(readPackageLicence(dir, [first, second]).texts).toEqual([
            { file: "second/twice.txt", text: "Second\n" },
        ]);
        writeFileSync(join(first.dir, "twice.txt"), "First\n");
        expect(readPackageLicence(dir, [first, second]).texts).toEqual([
            { file: "first/twice.txt", text: "First\n" },
        ]);
    });
});

describe("runtimePackageDirs", () => {
    it("lists the packages the lockfile does not mark dev, without type-only packages", () => {
        const project = "lock";
        writePackage(project, "runtime", { license: "MIT", main: "index.js" });
        writePackage(project, "@types/thing", { license: "MIT", types: "index.d.ts" });
        writePackage(project, "types-only", { license: "MIT", types: "index.d.ts", main: "" });
        writePackage(project, "nested", { license: "MIT", module: "index.mjs" });
        const lock = JSON.stringify({
            lockfileVersion: 3,
            packages: {
                "": { name: "app", dependencies: { runtime: "1" } },
                "node_modules/runtime": { version: "1.0.0" },
                "node_modules/@types/thing": { version: "1.0.0" },
                "node_modules/types-only": { version: "1.0.0" },
                "node_modules/tool": { version: "1.0.0", dev: true },
                "node_modules/runtime/node_modules/nested": { version: "1.0.0" },
            },
        });
        const root = join(temp, project);
        const prefix = root.replace(/\\/g, "/");
        expect(runtimePackageDirs(lock, root)).toEqual([
            `${prefix}/node_modules/runtime/node_modules/nested`,
            `${prefix}/node_modules/runtime`,
        ]);
    });

    it("needs a lockfile of version 2 or later", () => {
        expect(() => runtimePackageDirs(JSON.stringify({ dependencies: {} }), temp)).toThrow(
            LicenceError,
        );
    });
});

describe("peerPackageDirs", () => {
    it("lists the project's peers and every package they require, nested copies included", () => {
        const project = "peers";
        for (const name of ["ui", "dom", "shared", "leaf", "tool", "@types/ui"]) {
            writePackage(project, name, { license: "MIT", main: "index.js" });
        }
        writePackage(project, "dom/node_modules/shared", { license: "MIT", main: "index.js" });
        const lock = JSON.stringify({
            lockfileVersion: 3,
            packages: {
                "": {
                    name: "library",
                    peerDependencies: { ui: "1", dom: "1", absent: "1" },
                    devDependencies: { ui: "1", dom: "1", tool: "1" },
                },
                "node_modules/ui": { version: "1.0.0", dev: true, dependencies: { shared: "1" } },
                "node_modules/dom": {
                    version: "1.0.0",
                    dev: true,
                    dependencies: { shared: "2" },
                    peerDependencies: { ui: "1", "@types/ui": "1" },
                },
                "node_modules/dom/node_modules/shared": {
                    version: "2.0.0",
                    dev: true,
                    optionalDependencies: { leaf: "1" },
                },
                "node_modules/shared": { version: "1.0.0", dev: true },
                "node_modules/leaf": { version: "1.0.0", dev: true },
                "node_modules/tool": { version: "1.0.0", dev: true },
                "node_modules/@types/ui": { version: "1.0.0", dev: true },
            },
        });
        const root = join(temp, project);
        const prefix = root.replace(/\\/g, "/");
        // `absent` is an optional peer the lockfile does not install; `tool` is no peer's.
        expect(peerPackageDirs(lock, root)).toEqual([
            `${prefix}/node_modules/dom`,
            `${prefix}/node_modules/leaf`,
            `${prefix}/node_modules/dom/node_modules/shared`,
            `${prefix}/node_modules/shared`,
            `${prefix}/node_modules/ui`,
        ]);
    });

    it("is empty for a project without peers, such as an app", () => {
        const lock = JSON.stringify({
            lockfileVersion: 3,
            packages: { "": { name: "app" }, "node_modules/a": { version: "1.0.0" } },
        });
        expect(peerPackageDirs(lock, temp)).toEqual([]);
    });

    it("needs a lockfile of version 2 or later", () => {
        expect(() => peerPackageDirs(JSON.stringify({ dependencies: {} }), temp)).toThrow(
            LicenceError,
        );
    });

    it("gives this repository its peers and theirs", () => {
        const lock = readFileSync(join(ROOT, "package-lock.json"), "utf8");
        const names = peerPackageDirs(lock, ROOT).map((dir) => dir.split("/node_modules/").pop());
        expect(names).toEqual(
            expect.arrayContaining(["lucide-react", "radix-ui", "react", "react-dom", "zustand"]),
        );
        expect(names).toContain("scheduler");
        expect(names).not.toContain("vite");
        expect(names).not.toContain("fast-check");
    });
});

describe("strayPackages", () => {
    it("names the bundled packages that are not runtime dependencies", () => {
        const runtime = ["C:/app/node_modules/react", "C:/app/node_modules/a/node_modules/b"];
        expect(
            strayPackages(
                [
                    "C:\\app\\node_modules\\react",
                    "C:/app/node_modules/a/node_modules/b",
                    "C:/app/node_modules/vite",
                ],
                runtime,
            ),
        ).toEqual(["node_modules/vite"]);
    });
});

describe("buildPackageDirs", () => {
    it("places the build-only packages under the project, and needs them installed", () => {
        const prefix = ROOT.replace(/\\/g, "/").replace(/\/$/, "");
        expect(buildPackageDirs(ROOT, ["node_modules/rolldown"])).toEqual([
            `${prefix}/node_modules/rolldown`,
        ]);
        expect(buildPackageDirs(ROOT, [])).toEqual([]);
        expect(() => buildPackageDirs(join(temp, "empty"), ["node_modules/rolldown"])).toThrow(
            /node_modules\/rolldown is not installed/,
        );
    });

    it("lists a build-only package with its licence and its third-party licence", () => {
        const [rolldown] = buildPackageDirs(ROOT, ["node_modules/rolldown"]);
        // A development dependency, listed by the build-only packages alone.
        expect(strayPackages([rolldown!], [])).toEqual(["node_modules/rolldown"]);
        const entry = readPackageLicence(rolldown!, []);
        expect(entry.licence).toBe("MIT");
        expect(entry.texts.map(({ file }) => file)).toEqual(["LICENSE", "THIRD-PARTY-LICENSE"]);
    });
});

describe("licencesText", () => {
    const input = {
        title: "Example",
        licence: "MIT License\r\n\r\nCopyright (c) 2026 Owner\r\n",
        notices: "# Third-party notices\n\nPorted code.\n",
        packages: [
            {
                name: "zeta",
                version: "2.0.0",
                licence: "ISC",
                texts: [{ file: "LICENSE", text: "Z\n" }],
            },
            {
                name: "@alpha/one",
                version: "1.0.0",
                licence: "MIT",
                texts: [
                    { file: "LICENSE", text: "A\n" },
                    { file: "NOTICE", text: "N\n" },
                ],
            },
        ],
    };

    it("holds the program's licence, the notices and each package's licence, sorted by name", () => {
        const text = licencesText(input);
        expect(text.startsWith("Example: open source licences\n")).toBe(true);
        expect(text).toContain("MIT License\n\nCopyright (c) 2026 Owner\n");
        expect(text).toContain("Third-party notices (THIRD_PARTY_NOTICES.md)");
        expect(text).toContain("# Third-party notices\n\nPorted code.\n");
        expect(text).toContain("npm packages in this build (2)\n");
        const alpha = text.indexOf("@alpha/one 1.0.0 (MIT)");
        const zeta = text.indexOf("zeta 2.0.0 (ISC)");
        expect(alpha).toBeGreaterThan(0);
        expect(zeta).toBeGreaterThan(alpha);
        expect(text).toContain("[LICENSE]\n\nA\n\n[NOTICE]\n\nN\n");
        expect(text).not.toContain("\r");
        expect(text).not.toMatch(/\n{3}/);
        expect(text.endsWith("Z\n")).toBe(true);
    });

    it("gives the same text for the same input, whatever the order of the packages", () => {
        const reversed = { ...input, packages: [...input.packages].reverse() };
        expect(licencesText(reversed)).toBe(licencesText(input));
    });
});

describe("buildLicencesFile", () => {
    it("reads the licence and notices paths and the stand-ins of the options", () => {
        const project = join(temp, "options");
        mkdirSync(join(project, "legal"), { recursive: true });
        writeFileSync(join(project, "legal", "COPYING.txt"), "Project licence\n");
        writeFileSync(join(project, "legal", "NOTICES.md"), "Project notices\n");
        const bare = writePackage("options", "bare", { license: "MIT" });
        const appTexts: StandInTexts = { dir: join(project, "texts"), label: "texts" };
        mkdirSync(appTexts.dir, { recursive: true });
        writeFileSync(join(appTexts.dir, "bare.txt"), "Bare licence\n");
        const text = buildLicencesFile([bare], {
            root: project,
            title: "Options",
            licencePath: "legal/COPYING.txt",
            noticesPath: "legal/NOTICES.md",
            standInTexts: [appTexts],
        });
        expect(text).toContain("Options\n" + "=".repeat(78) + "\nProject licence\n");
        expect(text).toContain("Project notices\n");
        expect(text).toContain("[texts/bare.txt]\n\nBare licence\n");
    });

    it("applies the allowlist of the options", () => {
        const project = join(temp, "allow");
        mkdirSync(project, { recursive: true });
        writeFileSync(join(project, "LICENSE"), MIT);
        writeFileSync(join(project, "THIRD_PARTY_NOTICES.md"), "None\n");
        const isc = writePackage("allow", "isc", { license: "ISC" }, { LICENSE: "ISC text\n" });
        expect(() =>
            buildLicencesFile([isc], { root: project, title: "A", allowedLicences: ["MIT"] }),
        ).toThrow(/isc@1\.0\.0 is licensed ISC, which is not one of MIT/);
        expect(buildLicencesFile([isc], { root: project, title: "A" })).toContain(
            "isc 1.0.0 (ISC)",
        );
    });
});

describe("the package's stand-in texts", () => {
    it("ship react-remove-scroll-bar's licence, which its npm package lacks", () => {
        const dir = writePackage("stand-in", "react-remove-scroll-bar", { license: "MIT" });
        const entry = readPackageLicence(dir, [PACKAGE_STAND_IN_TEXTS]);
        expect(entry.texts.map(({ file }) => file)).toEqual([
            "@ngne/editor-ui/licence-texts/react-remove-scroll-bar.txt",
        ]);
        expect(entry.texts[0]!.text).toContain("Copyright (c) 2025 Anton Korzunov");
    });
});

describe("this repository's licences file", () => {
    const lock = readFileSync(join(ROOT, "package-lock.json"), "utf8");
    const runtime = runtimePackageDirs(lock, ROOT);
    const text = buildLicencesFile(runtime, { root: ROOT, title: "NGNE Editor UI" });

    it("is licences.txt", () => {
        expect(LICENCES_FILE).toBe("licences.txt");
    });

    it("lists no package: the package has no runtime dependencies and bundles nothing", () => {
        expect(runtime).toEqual([]);
        expect(text).toContain("npm packages in this build (0)\n");
    });

    it("holds this project's licence and its notices", () => {
        expect(text).toContain("Copyright (c) 2026 Fabio Barracano");
        expect(text).toContain(
            readFileSync(join(ROOT, "THIRD_PARTY_NOTICES.md"), "utf8").split("\n")[0],
        );
        expect(text).toContain("react-remove-scroll-bar");
    });
});

describe("generateLicences", () => {
    /** A project with a lockfile of one runtime dependency and one development package. */
    const project = join(temp, "plugin");
    const prefix = project.replace(/\\/g, "/");
    writePackage("plugin", "runtime", { license: "MIT", main: "index.js" }, { LICENSE: MIT });
    writePackage("plugin", "tool", { license: "MIT", main: "index.js" }, { LICENSE: MIT });
    writeFileSync(join(project, "LICENSE"), "Plugin licence\n");
    writeFileSync(join(project, "THIRD_PARTY_NOTICES.md"), "Plugin notices\n");
    writeFileSync(
        join(project, "package-lock.json"),
        JSON.stringify({
            lockfileVersion: 3,
            packages: {
                "": { name: "app" },
                "node_modules/runtime": { version: "1.0.0" },
                "node_modules/tool": { version: "1.0.0", dev: true },
            },
        }),
    );
    const options = { root: project, title: "Plugin", buildPackages: ["node_modules/tool"] };

    /** A context that records the emitted file and throws on an error, as the bundler does. */
    function context() {
        const emitted: { fileName: string; source: string }[] = [];
        const ctx: BundleContext = {
            error(message: string): never {
                throw new Error(message);
            },
            emitFile: (file) => {
                emitted.push(file);
                return file.fileName;
            },
        };
        return { ctx, emitted };
    }

    const chunkOf = (...modules: string[]): Record<string, BundleOutput> => ({
        "index.js": {
            type: "chunk",
            fileName: "index.js",
            code: "",
            modules: Object.fromEntries(modules.map((id) => [id, { renderedLength: 1 }])),
        },
    });

    it("writes the licences of the bundled runtime packages and the build-only ones", () => {
        const { plugin } = generateLicences(options);
        const { ctx, emitted } = context();
        plugin.generateBundle.handler.call(
            ctx,
            {},
            chunkOf(`${prefix}/node_modules/runtime/index.js`, `${prefix}/src/main.ts`),
        );
        expect(emitted.map(({ fileName }) => fileName)).toEqual(["licences.txt"]);
        const text = emitted[0]!.source;
        expect(text).toContain("Plugin licence\n");
        expect(text).toContain("npm packages in this build (2)\n");
        expect(text).toContain("\nruntime 1.0.0 (MIT)\ntool 1.0.0 (MIT)\n");
    });

    it("notes the web workers' modules for the app's file", () => {
        const { plugin, workerPlugin } = generateLicences(options);
        const { ctx, emitted } = context();
        workerPlugin.generateBundle.call(ctx, {}, chunkOf(`${prefix}/node_modules/runtime/w.js`));
        plugin.generateBundle.handler.call(ctx, {}, chunkOf(`${prefix}/src/main.ts`));
        expect(emitted[0]!.source).toContain("runtime 1.0.0 (MIT)");
    });

    it("fails a build that bundles code of a package that is not a runtime dependency", () => {
        const { plugin } = generateLicences(options);
        const { ctx } = context();
        expect(() =>
            plugin.generateBundle.handler.call(
                ctx,
                {},
                chunkOf(`${prefix}/node_modules/tool/a.js`),
            ),
        ).toThrow(/not runtime dependencies in package-lock\.json: node_modules\/tool\./);
    });

    it("fails a build whose packages have no allowed licence", () => {
        const { plugin } = generateLicences({ ...options, allowedLicences: ["ISC"] });
        const { ctx } = context();
        expect(() =>
            plugin.generateBundle.handler.call(
                ctx,
                {},
                chunkOf(`${prefix}/node_modules/runtime/a.js`),
            ),
        ).toThrow(/runtime@1\.0\.0 is licensed MIT, which is not one of ISC/);
    });

    it("serves the file of the runtime and build-only packages from the development server", () => {
        const { plugin } = generateLicences(options);
        let handler: Parameters<DevServer["middlewares"]["use"]>[0] | undefined;
        plugin.configureServer({
            config: { base: "/app/" },
            middlewares: { use: (h) => (handler = h) },
        });
        const response = { headers: {} as Record<string, string>, body: "" };
        const reply = {
            setHeader: (name: string, value: string) => (response.headers[name] = value),
            end: (text: string) => (response.body = text),
        };
        let passed = 0;
        handler!({ url: "/app/index.html" }, reply, () => passed++);
        expect(passed).toBe(1);
        handler!({ url: "/app/licences.txt?v=1" }, reply, () => passed++);
        expect(passed).toBe(1);
        expect(response.headers["Content-Type"]).toBe("text/plain; charset=utf-8");
        expect(response.body).toContain("runtime 1.0.0 (MIT)\ntool 1.0.0 (MIT)\n");
    });

    it("passes an error of the development server's file on", () => {
        const { plugin } = generateLicences({ ...options, allowedLicences: [] });
        let handler: Parameters<DevServer["middlewares"]["use"]>[0] | undefined;
        plugin.configureServer({
            config: { base: "/" },
            middlewares: { use: (h) => (handler = h) },
        });
        const errors: unknown[] = [];
        handler!({ url: "/licences.txt" }, { setHeader: () => 0, end: () => 0 }, (error) =>
            errors.push(error),
        );
        expect(errors).toHaveLength(1);
        expect(errors[0]).toBeInstanceOf(LicenceError);
    });
});
