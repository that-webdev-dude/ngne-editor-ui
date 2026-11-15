import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The copy table of docs/PROVENANCE.md §2: one row per file moved into the package, each naming
// an existing package file, an upstream of the §1 register, a source commit and a class of the
// document's list, sorted by path.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROVENANCE = readFileSync(join(ROOT, "docs", "PROVENANCE.md"), "utf8");
const CLASSES = ["independent", "behaviour-dictated", "derived and noticed", "pending"];

/** The cells of the body rows of the first table in `section`. */
function tableRows(section: string): string[][] {
    const lines = section.split("\n").filter((line) => line.startsWith("|"));
    return lines.slice(2).map((line) =>
        line
            .slice(1, -1)
            .split("|")
            .map((cell) => cell.trim()),
    );
}

const between = (from: string, to: string) =>
    PROVENANCE.slice(PROVENANCE.indexOf(from), PROVENANCE.indexOf(to, PROVENANCE.indexOf(from)));

const upstreams = tableRows(between("## 1. Upstream register", "## 2.")).map((row) => row[0]);
const rows = tableRows(between("## 2. Copies", "Rules for the rows"));
const unquote = (cell: string) => /^`([^`]+)`$/.exec(cell)?.[1] ?? null;

describe("PROVENANCE copy rows", () => {
    it("lists the files moved so far", () => {
        expect(rows.length).toBeGreaterThan(0);
    });

    it("name an existing package file, a registered upstream, a source path and commit, a class", () => {
        for (const row of rows) {
            const label = row.join(" | ");
            expect(row, label).toHaveLength(6);
            const [file, repository, sourcePath, commit, change, cls] = row as [
                string,
                string,
                string,
                string,
                string,
                string,
            ];
            const path = unquote(file);
            expect(path, label).not.toBeNull();
            expect(existsSync(join(ROOT, path!)), label).toBe(true);
            expect(
                upstreams.some((name) => name?.startsWith(repository)),
                label,
            ).toBe(true);
            expect(unquote(sourcePath), label).not.toBeNull();
            expect(unquote(commit) ?? "", label).toMatch(/^[0-9a-f]{7,40}$/);
            expect(change, label).not.toBe("");
            expect(CLASSES, label).toContain(cls);
        }
    });

    it("are sorted by path", () => {
        const paths = rows.map((row) => unquote(row[0]!) ?? "");
        const sorted = [...paths].sort((a, b) => (a === b ? 0 : a < b ? -1 : 1));
        expect(paths).toEqual(sorted);
    });
});
