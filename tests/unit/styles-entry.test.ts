import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The package's CSS entries (SPEC §4): dist/styles.css opens with tokens.css, then base.css,
// then every other stylesheet under src/ outside src/ui/gallery/ in path order; dist/gallery.css
// holds the stylesheets under src/ui/gallery/ in path order, so an app that does not mount the
// gallery ships none of its rules (SPEC §12); no module imports a CSS file.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const FIRST = ["src/styles/tokens.css", "src/styles/base.css"];
const GALLERY_DIR = "src/ui/gallery/";

/** Every file under src/ whose name matches `name`, relative to the repository, "/"-separated. */
function sources(name: RegExp): string[] {
    return readdirSync(join(ROOT, "src"), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && name.test(entry.name))
        .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)).replaceAll("\\", "/"));
}

/** Orders strings by UTF-16 code unit, whatever the machine's locale. */
function byCodeUnit(a: string, b: string): number {
    if (a === b) return 0;
    return a < b ? -1 : 1;
}

/** The stylesheets a built entry names, in order. */
function namedIn(entry: string): string[] {
    return [...entry.matchAll(/^\/\* (src\/\S+\.css) \*\/$/gm)].map((match) => match[1]!);
}

/** A gallery class in a selector: `.gallery`, `.gallery__…` or `.gallery-…`. */
const GALLERY_CLASS = /\.gallery(?:__|-|\b)/;

/** A static or dynamic import of a `.css` file. */
const CSS_IMPORT =
    /\bimport\s*(?:[^"';]*\bfrom\s*)?["'][^"']+\.css(?:\?[^"']*)?["']|\bimport\(\s*["'][^"']+\.css/;

const stylesheets = sources(/\.css$/);
const galleryStylesheets = stylesheets.filter((path) => path.startsWith(GALLERY_DIR));

describe("styles entry", () => {
    const entry = readFileSync(join(ROOT, "dist", "styles.css"), "utf8");
    /** The stylesheets dist/styles.css names, in order. */
    const named = namedIn(entry);

    it("starts with tokens.css then base.css", () => {
        expect(entry.startsWith("/* src/styles/tokens.css */\n")).toBe(true);
        expect(named.slice(0, 2)).toEqual(FIRST);
    });

    it("holds every other stylesheet under src/ outside the gallery's, in path order, each whole", () => {
        const rest = stylesheets
            .filter((path) => !FIRST.includes(path) && !path.startsWith(GALLERY_DIR))
            .sort(byCodeUnit);
        expect(rest.length).toBeGreaterThan(10);
        expect(named.slice(2)).toEqual(rest);
        for (const path of [...FIRST, ...rest]) {
            expect(entry, path).toContain(readFileSync(join(ROOT, path), "utf8").trimEnd());
        }
    });

    it("holds no gallery rule", () => {
        expect(GALLERY_CLASS.test(".gallery__entry {")).toBe(true);
        expect(GALLERY_CLASS.test(".gallery-tokens__name {")).toBe(true);
        expect(GALLERY_CLASS.test(".gallery {")).toBe(true);
        expect(GALLERY_CLASS.test(".galleryish {")).toBe(false);
        expect(named.filter((path) => path.startsWith(GALLERY_DIR))).toEqual([]);
        const offending = entry.split("\n").filter((line) => GALLERY_CLASS.test(line));
        expect(offending).toEqual([]);
    });

    it("is imported by no module under src/", () => {
        expect(CSS_IMPORT.test('import "./x.css";')).toBe(true);
        expect(CSS_IMPORT.test('import styles from "../a/b.css?inline";')).toBe(true);
        for (const path of sources(/\.(ts|tsx|js|mjs)$/)) {
            expect(CSS_IMPORT.test(readFileSync(join(ROOT, path), "utf8")), path).toBe(false);
        }
    });
});

describe("gallery styles entry", () => {
    const entry = readFileSync(join(ROOT, "dist", "gallery.css"), "utf8");

    it("holds every stylesheet under src/ui/gallery/ and no other, in path order, each whole", () => {
        expect(galleryStylesheets).toContain("src/ui/gallery/gallery.css");
        expect(namedIn(entry)).toEqual([...galleryStylesheets].sort(byCodeUnit));
        for (const path of galleryStylesheets) {
            expect(entry, path).toContain(readFileSync(join(ROOT, path), "utf8").trimEnd());
        }
    });

    it("leaves the tokens and base styles to styles.css", () => {
        for (const path of FIRST) {
            expect(entry, path).not.toContain(readFileSync(join(ROOT, path), "utf8").trimEnd());
        }
    });
});
