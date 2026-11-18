import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { checkStylesheets } from "../../src/build/styles/index.ts";

// `checkStylesheets(paths)` of `@ngne/editor-ui/styles/check` (SPEC §9.2): apps run it in a
// unit test over their own CSS. It passes stylesheets whose colours are tokens, and fails one
// with a raw colour outside `tokens.css` (DESIGN §3), naming the file, the line and the value.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const temp = mkdtempSync(join(tmpdir(), "ngne-canon-stylesheets-"));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

let fixtures = 0;

/** Writes `css` to a new fixture file named `name`; returns its path. */
function stylesheet(name: string, css: string): string {
    fixtures += 1;
    const path = join(temp, String(fixtures), name);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, css);
    return path;
}

/** The offences `checkStylesheets` reports for `paths`, one per line, or [] when it passes. */
function offences(paths: readonly string[]): string[] {
    try {
        checkStylesheets(paths);
        return [];
    } catch (error) {
        const [heading, ...lines] = (error as Error).message.split("\n");
        expect(heading).toBe("checkStylesheets: raw colours outside tokens.css (DESIGN §3):");
        return lines;
    }
}

/** A fixture with one declaration per line, `color: <value>;`, inside one rule. */
function oneValuePerLine(values: readonly string[]): string {
    return `.fixture {\n${values.map((value) => `    color: ${value};\n`).join("")}}\n`;
}

/** Every stylesheet of the package under src/. */
function packageStylesheets(): string[] {
    return readdirSync(join(ROOT, "src"), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".css"))
        .map((entry) => join(entry.parentPath, entry.name));
}

describe("checkStylesheets", () => {
    it("passes the package's CSS, tokens.css with its raw colours included", () => {
        const files = packageStylesheets();
        expect(files.map((file) => file.replaceAll("\\", "/"))).toEqual(
            expect.arrayContaining([
                expect.stringMatching(/\/src\/styles\/tokens\.css$/),
                expect.stringMatching(/\/src\/styles\/base\.css$/),
                expect.stringMatching(/\/src\/ui\/shell\/[\w-]+\.css$/),
            ]),
        );
        expect(offences(files)).toEqual([]);
    });

    it("passes a clean fixture: tokens, keywords that carry no colour, comments and strings", () => {
        const clean = stylesheet(
            "clean.css",
            [
                "/* A red border, #fff on black, rgb(0 0 0) in a comment. */",
                ".clean {",
                "    color: var(--text);",
                "    border: var(--border-width) solid var(--border-strong);",
                "    background: transparent;",
                "    outline-color: currentColor;",
                "    fill: inherit;",
                "    box-shadow: none;",
                "    transition: background-color var(--motion-fast) var(--motion-ease);",
                "    animation: ui-fade-in var(--motion-surface) var(--motion-ease);",
                "    border-color: var(--border-strong) transparent;",
                "    filter: brightness(1.1);",
                '    content: "red; #fff {rgb(0 0 0)}";',
                "    background-image: url(icons/red-arrow.svg);",
                "    mask-image: url('white.png');",
                "    font-family: var(--font-ui);",
                "}",
                "@media (prefers-color-scheme: dark) {",
                "    .clean:hover {",
                "        color: var(--text-muted)",
                "    }",
                "}",
                "",
            ].join("\n"),
        );
        expect(offences([clean])).toEqual([]);
    });

    it("fails hex, rgb(), hsl() and named colours outside tokens.css, naming file, line and value", () => {
        const app = stylesheet(
            "app.css",
            [
                ".panel {",
                "    color: var(--text);",
                "    border: 1px solid #2a2a2e;",
                "    /* A comment",
                "       over two lines. */",
                "    background: rgb(0 0 0 / 0.4);",
                "    outline-color: hsl(200 50% 50%);",
                "}",
                ".panel:hover { color: red }",
                "",
            ].join("\n"),
        );
        expect(offences([app])).toEqual([
            `${app}:3 border: 1px solid #2a2a2e (#2a2a2e)`,
            `${app}:6 background: rgb(0 0 0 / 0.4) (rgb()`,
            `${app}:7 outline-color: hsl(200 50% 50%) (hsl()`,
            `${app}:9 color: red (red)`,
        ]);
    });

    it("reports every file's offences in one failure, in the order given", () => {
        const first = stylesheet("first.css", ".a {\n    color: White;\n}\n");
        const clean = stylesheet("clean.css", ".b {\n    color: var(--text);\n}\n");
        const second = stylesheet("second.css", "\r\n\r\n.c { --shade: #0f0f10; }\r\n");
        expect(offences([first, clean, second])).toEqual([
            `${first}:2 color: White (White)`,
            `${second}:3 --shade: #0f0f10 (#0f0f10)`,
        ]);
    });

    it("recognises raw colour values", () => {
        const values = [
            "#fff",
            "#0f0f10",
            "1px solid #2a2a2e80",
            "rgb(0 0 0 / 0.4)",
            "rgba(255, 255, 255, 0.12)",
            "hsl(200 50% 50%)",
            "oklch(0.7 0.1 200)",
            "color-mix(in srgb, var(--accent) 20%, transparent)",
            "1px solid red",
            "White",
            "linear-gradient(to right, black, transparent)",
            "CanvasText",
            "var(--accent, teal)",
        ];
        const file = stylesheet("values.css", oneValuePerLine(values));
        const found = offences([file]);
        expect(found).toHaveLength(values.length);
        values.forEach((value, index) => {
            expect(found[index], value).toContain(`${file}:${index + 2} color: ${value} (`);
        });
    });

    it("accepts tokens and colour keywords that carry no colour", () => {
        const file = stylesheet(
            "keywords.css",
            oneValuePerLine([
                "var(--text)",
                "var(--border-width) solid var(--border-strong)",
                "transparent",
                "currentColor",
                "inherit",
                "none",
                "background-color var(--motion-fast) var(--motion-ease)",
                "ui-fade-in var(--motion-surface) var(--motion-ease)",
                "var(--border-strong) transparent",
                "brightness(1.1)",
            ]),
        );
        expect(offences([file])).toEqual([]);
    });

    it("lets tokens.css hold raw colours, by its file name", () => {
        const tokens = stylesheet("tokens.css", ":root {\n    --text: #e7e7ea;\n}\n");
        expect(offences([tokens])).toEqual([]);
        const copy = stylesheet("tokens-copy.css", ":root {\n    --text: #e7e7ea;\n}\n");
        expect(offences([tokens, copy])).toEqual([`${copy}:2 --text: #e7e7ea (#e7e7ea)`]);
    });

    it("throws on an empty list and on a file it cannot read, naming it", () => {
        expect(() => checkStylesheets([])).toThrow("checkStylesheets: no stylesheet given.");
        const missing = join(temp, "missing.css");
        expect(() => checkStylesheets([missing])).toThrow(
            `checkStylesheets: ${missing} cannot be read:`,
        );
    });
});
