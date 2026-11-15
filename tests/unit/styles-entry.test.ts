import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The package's one CSS entry (SPEC §4): dist/styles.css opens with tokens.css, then base.css,
// then every other stylesheet under src/ in path order; no module imports a CSS file.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const FIRST = ["src/styles/tokens.css", "src/styles/base.css"];

/** Every file under src/ whose name matches `name`, relative to the repository, "/"-separated. */
function sources(name: RegExp): string[] {
    return readdirSync(join(ROOT, "src"), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && name.test(entry.name))
        .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)).replaceAll("\\", "/"));
}

const byCodeUnit = (a: string, b: string) => (a === b ? 0 : a < b ? -1 : 1);

/** A static or dynamic import of a `.css` file. */
const CSS_IMPORT =
    /\bimport\s*(?:[^"';]*\bfrom\s*)?["'][^"']+\.css(?:\?[^"']*)?["']|\bimport\(\s*["'][^"']+\.css/;

describe("styles entry", () => {
    const entry = readFileSync(join(ROOT, "dist", "styles.css"), "utf8");
    const stylesheets = sources(/\.css$/);
    /** The stylesheets dist/styles.css names, in order. */
    const named = [...entry.matchAll(/^\/\* (src\/\S+\.css) \*\/$/gm)].map((match) => match[1]);

    it("starts with tokens.css then base.css", () => {
        expect(entry.startsWith("/* src/styles/tokens.css */\n")).toBe(true);
        expect(named.slice(0, 2)).toEqual(FIRST);
    });

    it("holds every other stylesheet under src/, in path order, each whole", () => {
        const rest = stylesheets.filter((path) => !FIRST.includes(path)).sort(byCodeUnit);
        expect(named.slice(2)).toEqual(rest);
        for (const path of stylesheets) {
            expect(entry, path).toContain(readFileSync(join(ROOT, path), "utf8").trimEnd());
        }
    });

    it("is imported by no module under src/", () => {
        expect(CSS_IMPORT.test('import "./x.css";')).toBe(true);
        expect(CSS_IMPORT.test('import styles from "../a/b.css?inline";')).toBe(true);
        for (const path of sources(/\.(ts|tsx|js|mjs)$/)) {
            expect(CSS_IMPORT.test(readFileSync(join(ROOT, path), "utf8")), path).toBe(false);
        }
    });
});
