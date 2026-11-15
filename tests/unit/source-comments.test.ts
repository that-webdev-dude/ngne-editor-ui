import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Source comments cite this package's docs (BRIEF D20): no file under src/ or tests/ carries
// an editor's ticket or issue ID or names an editor's review notes.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** The references an editor's code carries and this package's must not. */
const APP_REFERENCES: readonly RegExp[] = [
    /\bSE-0\d\d\b/i,
    /\bTE-0\d\d\b/i,
    /\bgh-\d+\b/i,
    /\bREVIEW\.md\b/i,
];

function filesUnder(dir: string): string[] {
    return readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)).replaceAll("\\", "/"));
}

describe("source comments", () => {
    it("name no app ticket, issue or review document", () => {
        const found: string[] = [];
        for (const path of [...filesUnder("src"), ...filesUnder("tests")]) {
            const lines = readFileSync(join(ROOT, path), "utf8").split("\n");
            lines.forEach((line, index) => {
                for (const pattern of APP_REFERENCES) {
                    if (pattern.test(line)) found.push(`${path}:${index + 1}: ${line.trim()}`);
                }
            });
        }
        expect(found).toEqual([]);
    });

    it("finds each reference it looks for", () => {
        // Assembled here, so this file holds none of them.
        const samples = [
            ["S", "E-012"],
            ["T", "E-004"],
            ["g", "h-17"],
            ["REVIEW", ".md"],
        ].map((parts) => parts.join(""));
        APP_REFERENCES.forEach((pattern, index) => {
            expect(pattern.test(`see ${samples[index]} here`), String(pattern)).toBe(true);
        });
    });
});
