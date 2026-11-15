import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// The gallery site (SPEC §12) uses the package as an app does: no file under gallery/ imports
// from src/ or from anywhere else outside gallery/ other than through a public subpath of the
// package (the `exports` map) or another package. Its typecheck resolves each subpath it uses
// to the source of that subpath's export (tsconfig.json `paths`).

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const GALLERY = join(ROOT, "gallery");

type Target = string | { types: string; default: string };
const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    name: string;
    exports: Record<string, Target>;
};

/** The `exports` key of a specifier of the package, or null for another specifier. */
function exportKey(specifier: string): string | null {
    if (specifier === manifest.name) return ".";
    if (specifier.startsWith(`${manifest.name}/`)) {
        return `./${specifier.slice(manifest.name.length + 1)}`;
    }
    return null;
}

/** The source files of the site: everything under gallery/ but its build output. */
function siteFiles(): string[] {
    return readdirSync(GALLERY, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.(ts|tsx|js|mjs|html|css)$/.test(entry.name))
        .map((entry) => join(entry.parentPath, entry.name))
        .filter((file) => !relative(GALLERY, file).replaceAll("\\", "/").startsWith("dist/"));
}

/** The specifiers a file imports: modules, side-effect and dynamic imports, scripts, CSS. */
function specifiersOf(file: string, text: string): string[] {
    if (file.endsWith(".html")) {
        return [...text.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map(
            (match) => match[1]!,
        );
    }
    if (file.endsWith(".css")) {
        return [...text.matchAll(/@import\s+(?:url\()?["']([^"']+)["']/g)].map(
            (match) => match[1]!,
        );
    }
    return ts.preProcessFile(text, true, true).importedFiles.map(({ fileName }) => fileName);
}

/** Why `specifier`, imported by `file`, breaks the rule, or null. */
function problem(file: string, specifier: string): string | null {
    const key = exportKey(specifier);
    if (key !== null) {
        return key in manifest.exports ? null : `${specifier} is not a public subpath`;
    }
    if (specifier.startsWith(".") || specifier.startsWith("/") || /^[a-z]:/i.test(specifier)) {
        const target = resolve(dirname(file), specifier);
        const inside = relative(GALLERY, target);
        if (inside.startsWith("..") || resolve(GALLERY, inside) !== target) {
            return `${specifier} reaches outside gallery/`;
        }
        return null;
    }
    if (/(^|\/)src\//.test(specifier)) return `${specifier} names a source path`;
    return null;
}

/** Every import of the site that breaks the rule, as "file: specifier (why)". */
function offences(files: readonly { file: string; text: string }[]): string[] {
    return files.flatMap(({ file, text }) =>
        specifiersOf(file, text)
            .map((specifier) => [specifier, problem(file, specifier)] as const)
            .filter(([, why]) => why !== null)
            .map(([specifier, why]) => `${relative(ROOT, file)}: ${specifier} (${why})`),
    );
}

const site = siteFiles().map((file) => ({ file, text: readFileSync(file, "utf8") }));

describe("gallery imports", () => {
    it("finds the site's entry, its page and its config", () => {
        const names = site.map(({ file }) => relative(GALLERY, file).replaceAll("\\", "/"));
        expect(names).toEqual(expect.arrayContaining(["index.html", "main.tsx", "vite.config.ts"]));
    });

    it("reach the package only through its public subpaths", () => {
        expect(offences(site)).toEqual([]);
        const used = site.flatMap(({ file, text }) => specifiersOf(file, text));
        expect(used).toEqual(
            expect.arrayContaining([
                "@ngne/editor-ui/gallery",
                "@ngne/editor-ui/styles.css",
                "@ngne/editor-ui/licences/build",
            ]),
        );
    });

    it("fail an import of src/, outside gallery/, or of a subpath the package does not export", () => {
        const file = join(GALLERY, "fixture.tsx");
        const text = [
            'import { Gallery } from "../src/ui/gallery/index.js";',
            'import "../src/styles/tokens.css";',
            'import { x } from "@ngne/editor-ui/src/ui/gallery/Gallery.js";',
            'import { y } from "@ngne/editor-ui/gallery/Gallery";',
            'const z = await import("../scripts/clean.ts");',
            'import { ok } from "@ngne/editor-ui/gallery";',
            'import "./local.css";',
            'import { createRoot } from "react-dom/client";',
            'import other from "some-package/src/index.js";',
        ].join("\n");
        expect(offences([{ file, text }])).toEqual([
            `${join("gallery", "fixture.tsx")}: ../src/ui/gallery/index.js (../src/ui/gallery/index.js reaches outside gallery/)`,
            `${join("gallery", "fixture.tsx")}: ../src/styles/tokens.css (../src/styles/tokens.css reaches outside gallery/)`,
            `${join("gallery", "fixture.tsx")}: @ngne/editor-ui/src/ui/gallery/Gallery.js (@ngne/editor-ui/src/ui/gallery/Gallery.js is not a public subpath)`,
            `${join("gallery", "fixture.tsx")}: @ngne/editor-ui/gallery/Gallery (@ngne/editor-ui/gallery/Gallery is not a public subpath)`,
            `${join("gallery", "fixture.tsx")}: ../scripts/clean.ts (../scripts/clean.ts reaches outside gallery/)`,
            `${join("gallery", "fixture.tsx")}: some-package/src/index.js (some-package/src/index.js names a source path)`,
        ]);
        const html = { file: join(GALLERY, "fixture.html"), text: '<script src="../src/x.ts">' };
        expect(offences([html])).toHaveLength(1);
    });

    it("typecheck each typed subpath they use against the source of its export", () => {
        const config = ts.readConfigFile(join(ROOT, "tsconfig.json"), ts.sys.readFile).config as {
            compilerOptions: { paths?: Record<string, string[]> };
            include: string[];
        };
        expect(config.include).toContain("gallery");
        const paths = config.compilerOptions.paths ?? {};
        const used = new Set(site.flatMap(({ file, text }) => specifiersOf(file, text)));
        for (const specifier of used) {
            const target = manifest.exports[exportKey(specifier) ?? ""];
            if (typeof target !== "object") continue;
            const source = target.default.replace(/^\.\/dist\//, "./src/").replace(/\.js$/, ".ts");
            expect(paths[specifier], specifier).toEqual([source]);
        }
        for (const [specifier, [source]] of Object.entries(paths) as [string, string[]][]) {
            expect(exportKey(specifier), specifier).not.toBeNull();
            expect(readFileSync(join(ROOT, source), "utf8"), source).toMatch(/export/);
        }
    });
});
