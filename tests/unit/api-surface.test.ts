import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// The public API of the package (SPEC §3, §4): every subpath of the built `exports` map and
// every name each one exports, types included, read from its declarations in dist/. A change
// to these lists is a deliberate edit, with a CHANGELOG entry once the package is released.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** Every subpath, in the order of SPEC §4, and its exported names, sorted by code unit. */
const API: Record<string, readonly string[]> = {
    "@ngne/editor-ui": [],
    "@ngne/editor-ui/styles.css": [],
    "@ngne/editor-ui/styles/check": [],
    "@ngne/editor-ui/primitives": [],
    "@ngne/editor-ui/focus": [],
    "@ngne/editor-ui/messages": [],
    "@ngne/editor-ui/shell": [],
    "@ngne/editor-ui/commands": [],
    "@ngne/editor-ui/overlay": [],
    "@ngne/editor-ui/platform": [],
    "@ngne/editor-ui/pwa": [],
    "@ngne/editor-ui/pwa/worker": [],
    "@ngne/editor-ui/about": [],
    "@ngne/editor-ui/about/build": [],
    "@ngne/editor-ui/licences": [],
    "@ngne/editor-ui/licences/build": [
        "ALLOWED_LICENCES",
        "BundleContext",
        "BundleOutput",
        "DevServer",
        "ExcludedCode",
        "LICENCES_FILE",
        "LicenceError",
        "LicenceText",
        "LicencesInput",
        "LicencesOptions",
        "LicencesPlugin",
        "LicencesPlugins",
        "LicencesWorkerPlugin",
        "PACKAGE_STAND_IN_TEXTS",
        "PackageLicence",
        "StandInTexts",
        "buildLicencesFile",
        "buildPackageDirs",
        "excludedCodeIn",
        "fallbackFileOf",
        "generateLicences",
        "licenceAllowed",
        "licencesText",
        "packageDirOf",
        "packageDirsOf",
        "readPackageLicence",
        "runtimePackageDirs",
        "strayPackages",
    ],
    "@ngne/editor-ui/colour": [],
    "@ngne/editor-ui/gallery": [],
};

type Target = string | { types: string; default: string };
const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    name: string;
    exports: Record<string, Target>;
};

/** Orders strings by UTF-16 code unit, whatever the machine's locale. */
function byCodeUnit(a: string, b: string): number {
    if (a === b) return 0;
    return a < b ? -1 : 1;
}

/** The subpath an `exports` key names: "." is the package itself. */
const subpathOf = (key: string) =>
    key === "." ? manifest.name : `${manifest.name}/${key.slice(2)}`;

/** The subpaths of the SPEC §4 table, in its order. */
function specSubpaths(): string[] {
    const spec = readFileSync(join(ROOT, "docs", "SPEC.md"), "utf8");
    const section = spec.slice(spec.indexOf("## 4. Packaging"), spec.indexOf("## 5."));
    return [...section.matchAll(/^\| `(@ngne\/editor-ui[^`]*)` \|/gm)].map((match) => match[1]!);
}

/** The names a declaration file exports, values and types, sorted by code unit. */
function exportedNames(file: string): string[] {
    const program = ts.createProgram([file], { strict: true, skipLibCheck: true, noEmit: true });
    const checker = program.getTypeChecker();
    const source = program.getSourceFile(file)!;
    const symbol = checker.getSymbolAtLocation(source);
    if (!symbol) return [];
    return checker
        .getExportsOfModule(symbol)
        .map((entry) => entry.name)
        .sort(byCodeUnit);
}

describe("API surface", () => {
    const keys = Object.keys(manifest.exports);

    it("lists exactly the subpaths of SPEC §4", () => {
        expect(keys.map(subpathOf)).toEqual(Object.keys(API));
        expect(keys.map(subpathOf)).toEqual(specSubpaths());
    });

    it("resolves every subpath to files in dist/", () => {
        for (const key of keys) {
            const target = manifest.exports[key]!;
            const files = typeof target === "string" ? [target] : [target.types, target.default];
            for (const file of files) {
                expect(file.startsWith("./dist/"), file).toBe(true);
                expect(existsSync(join(ROOT, file)), file).toBe(true);
            }
        }
    });

    it("exports exactly the listed names from each subpath", () => {
        for (const key of keys) {
            const target = manifest.exports[key]!;
            const names = typeof target === "string" ? [] : exportedNames(join(ROOT, target.types));
            expect(names, subpathOf(key)).toEqual([...API[subpathOf(key)]!].sort(byCodeUnit));
        }
    }, 60_000);
});
