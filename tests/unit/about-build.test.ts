import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { appInfoDefines } from "../../src/build/about/index.ts";

// `@ngne/editor-ui/about/build` (SPEC §11): `appInfoDefines(packageJsonPath)` reads an app's
// package.json into the build-time constants the About dialog shows, so a release that bumps
// package.json changes them with no other edit; a missing field fails with a message naming
// it. A Build module (SPEC §1.1, §4): importing it loads `node:*` modules only, never React or
// the DOM.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

const directories: string[] = [];

afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

/** Writes `contents` as a package.json of its own; returns its path. */
function packageJson(contents: unknown): string {
    const directory = mkdtempSync(join(tmpdir(), "ngne-about-build-"));
    directories.push(directory);
    const path = join(directory, "package.json");
    writeFileSync(path, typeof contents === "string" ? contents : JSON.stringify(contents));
    return path;
}

const APP = {
    name: "ngne-sprite-editor",
    version: "1.2.0",
    license: "MIT",
    dependencies: { "@ngne/core": "0.4.1", react: "19.3.0" },
    devDependencies: { vite: "8.3.4" },
};

describe("appInfoDefines", () => {
    it("defines the app's name, version and licence and the engine it pins, as JSON strings", () => {
        expect(appInfoDefines(packageJson(APP))).toEqual({
            "import.meta.env.APP_PACKAGE": '"ngne-sprite-editor"',
            "import.meta.env.APP_VERSION": '"1.2.0"',
            "import.meta.env.APP_LICENSE": '"MIT"',
            "import.meta.env.ENGINE_PACKAGE": '"@ngne/core"',
            "import.meta.env.ENGINE_VERSION": '"0.4.1"',
        });
    });

    it("follows a bump of package.json with no other edit", () => {
        const path = packageJson(APP);
        expect(appInfoDefines(path)["import.meta.env.APP_VERSION"]).toBe('"1.2.0"');
        writeFileSync(
            path,
            JSON.stringify({
                ...APP,
                version: "1.3.0",
                license: "Apache-2.0",
                dependencies: { "@ngne/core": "0.5.0" },
            }),
        );
        expect(appInfoDefines(path)).toMatchObject({
            "import.meta.env.APP_VERSION": '"1.3.0"',
            "import.meta.env.APP_LICENSE": '"Apache-2.0"',
            "import.meta.env.ENGINE_VERSION": '"0.5.0"',
        });
    });

    it("reads each app's own file: another app gives its own facts", () => {
        const tilemap = packageJson({
            name: "ngne-tilemap-editor",
            version: "0.3.0-rc.1",
            license: "MIT",
            dependencies: { "@ngne/core": "0.4.0" },
        });
        expect(appInfoDefines(tilemap)).toMatchObject({
            "import.meta.env.APP_PACKAGE": '"ngne-tilemap-editor"',
            "import.meta.env.APP_VERSION": '"0.3.0-rc.1"',
            "import.meta.env.ENGINE_VERSION": '"0.4.0"',
        });
    });

    it("fails without a @ngne/core dependency, naming the file and the field", () => {
        const engineField = 'dependencies["@ngne/core"] is not a non-empty string.';
        const withoutEngine = packageJson({ ...APP, dependencies: { react: "19.3.0" } });
        expect(() => appInfoDefines(withoutEngine)).toThrow(
            `appInfoDefines: ${withoutEngine}: ${engineField}`,
        );
        // Only `dependencies` pins the engine: a development dependency is not the app's engine.
        const devOnly = packageJson({
            ...APP,
            dependencies: undefined,
            devDependencies: { "@ngne/core": "0.4.1" },
        });
        expect(() => appInfoDefines(devOnly)).toThrow(`appInfoDefines: ${devOnly}: ${engineField}`);
        const empty = packageJson({ ...APP, dependencies: { "@ngne/core": "" } });
        expect(() => appInfoDefines(empty)).toThrow(engineField);
    });

    it("fails on a missing or empty name, version or licence, naming the field", () => {
        for (const field of ["name", "version", "license"] as const) {
            const missing = packageJson({ ...APP, [field]: undefined });
            expect(() => appInfoDefines(missing), field).toThrow(
                `appInfoDefines: ${missing}: ${field} is not a non-empty string.`,
            );
            const blank = packageJson({ ...APP, [field]: " " });
            expect(() => appInfoDefines(blank), field).toThrow(
                `${field} is not a non-empty string.`,
            );
            const notText = packageJson({ ...APP, [field]: 3 });
            expect(() => appInfoDefines(notText), field).toThrow(
                `${field} is not a non-empty string.`,
            );
        }
    });

    it("fails on a file that is missing or not a package.json object", () => {
        const absent = join(mkdtempSync(join(tmpdir(), "ngne-about-build-")), "package.json");
        directories.push(join(absent, ".."));
        expect(() => appInfoDefines(absent)).toThrow(`appInfoDefines: ${absent} cannot be read:`);
        const broken = packageJson("{ name: ");
        expect(() => appInfoDefines(broken)).toThrow(`appInfoDefines: ${broken} is not JSON:`);
        const list = packageJson([APP]);
        expect(() => appInfoDefines(list)).toThrow(
            `appInfoDefines: ${list} is not a package.json object.`,
        );
    });
});

/**
 * The specifiers Node resolves while it imports the built module at `path`, in a process of
 * its own, and what that process sees of the DOM afterwards.
 */
function importTrace(path: string): { specifiers: string[]; dom: string[] } {
    const script = `
        import { registerHooks } from "node:module";
        const specifiers = [];
        registerHooks({
            resolve(specifier, context, next) {
                specifiers.push(specifier);
                return next(specifier, context);
            },
        });
        await import(process.argv[1]);
        const dom = ["window", "document", "navigator.clipboard", "HTMLElement"].filter(
            (name) => name.split(".").reduce((value, key) => value?.[key], globalThis) !== undefined,
        );
        process.stdout.write(JSON.stringify({ specifiers: specifiers.slice(1), dom }));
    `;
    const output = execFileSync(
        process.execPath,
        ["--input-type=module", "--eval", script, pathToFileURL(path).href],
        { cwd: ROOT, encoding: "utf8" },
    );
    return JSON.parse(output) as { specifiers: string[]; dom: string[] };
}

const isNodeOrRelative = (specifier: string) =>
    specifier.startsWith("node:") || specifier.startsWith("./") || specifier.startsWith("../");

describe("importing @ngne/editor-ui/about/build", () => {
    it("loads node:* and its own modules only: no React, no peer, no DOM", () => {
        const { specifiers, dom } = importTrace(join(ROOT, "dist", "build", "about", "index.js"));
        expect(specifiers).toContain("node:fs");
        expect(specifiers.filter((specifier) => !isNodeOrRelative(specifier))).toEqual([]);
        expect(dom).toEqual([]);
    }, 30_000);

    it("would see React: the About dialog's own subpath loads it", () => {
        const { specifiers } = importTrace(join(ROOT, "dist", "ui", "about", "index.js"));
        expect(specifiers.filter((specifier) => !isNodeOrRelative(specifier))).toEqual(
            expect.arrayContaining(["react", "react/jsx-runtime"]),
        );
    }, 30_000);
});
