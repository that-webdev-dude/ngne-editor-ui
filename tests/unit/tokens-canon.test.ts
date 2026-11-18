import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { checkStylesheets } from "../../src/build/styles/index.ts";

// The suite tokens (DESIGN §3) as CSS custom properties, checked against the canon: every
// colour of the DESIGN §3.1 table, read from docs/DESIGN.md, with its dark and light value;
// the contrast pairs of DESIGN §3.1 in both themes; and the rule that no stylesheet other than
// src/styles/tokens.css holds a raw colour (SPEC §9.2).

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const TOKENS_FILE = "src/styles/tokens.css";

function read(path: string, root = ROOT): string {
    return readFileSync(join(root, path), "utf8");
}

function stripComments(css: string): string {
    return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Every `property: value;` of a stylesheet, with its line number. */
function declarations(css: string): { property: string; value: string; line: number }[] {
    const text = stripComments(css).replace(/\r/g, "");
    const found = [];
    for (const match of text.matchAll(/([\w-]+)\s*:\s*([^;{}]+);/g)) {
        found.push({
            property: match[1] ?? "",
            value: (match[2] ?? "").trim(),
            line: text.slice(0, match.index).split("\n").length,
        });
    }
    return found;
}

/** Custom properties declared in the block that follows `selector`. */
function customProperties(css: string, selector: string): Map<string, string> {
    const text = stripComments(css);
    const start = text.indexOf(`${selector} {`);
    if (start < 0) throw new Error(`No block for ${selector}`);
    const block = text.slice(start, text.indexOf("}", start));
    return new Map(
        declarations(`${block};`)
            .filter((declaration) => declaration.property.startsWith("--"))
            .map((declaration) => [declaration.property, declaration.value]),
    );
}

const tokensCss = read(TOKENS_FILE);
const dark = customProperties(tokensCss, ":root");
const light = customProperties(tokensCss, '[data-theme="light"]');

/** DESIGN §3.1 of the canon, from its heading to the next one. */
function colourSection(): string {
    const design = read("docs/DESIGN.md");
    const start = design.indexOf("### 3.1 Colour");
    if (start < 0) throw new Error("docs/DESIGN.md has no §3.1 Colour.");
    return design.slice(start, design.indexOf("\n### ", start + 1));
}

/** The colour table of DESIGN §3.1: token, dark value, light value. */
function designColours(): { token: string; dark: string; light: string }[] {
    const rows = [];
    const row = /^\|\s*`(--[a-z-]+)`\s*\|\s*`(#[0-9a-f]{6})`\s*\|\s*`(#[0-9a-f]{6})`\s*\|/gm;
    for (const match of colourSection().matchAll(row)) {
        rows.push({ token: match[1] ?? "", dark: match[2] ?? "", light: match[3] ?? "" });
    }
    return rows;
}

describe("design tokens", () => {
    it("defines every colour of DESIGN §3.1 with its dark and light value", () => {
        const rows = designColours();
        expect(rows.map((row) => row.token)).toEqual([
            "--bg-workspace",
            "--bg-panel",
            "--bg-raised",
            "--bg-active",
            "--border",
            "--border-strong",
            "--border-input",
            "--text",
            "--text-muted",
            "--text-faint",
            "--accent",
            "--accent-contrast",
            "--danger",
            "--warn",
        ]);
        for (const row of rows) {
            expect(dark.get(row.token), `${row.token} dark`).toBe(row.dark);
            expect(light.get(row.token), `${row.token} light`).toBe(row.light);
        }
    });

    it("states the dark values the apps' manifests and brand read (DESIGN §3.1, §10)", () => {
        // `theme_color` and `background_color` are --bg-panel and --bg-workspace of the dark
        // set; the dark accent is the brand cyan.
        expect([dark.get("--bg-workspace"), dark.get("--bg-panel"), dark.get("--accent")]).toEqual([
            "#0f0f10",
            "#18181a",
            "#83e8e1",
        ]);
    });

    it("defines the transparency checkerboard of DESIGN §3.1 in both themes", () => {
        expect(colourSection()).toContain(
            "`#3a3a3a` / `#4a4a4a` (dark), `#c8c8c8` / `#ffffff` (light)",
        );
        expect([dark.get("--check-a"), dark.get("--check-b")]).toEqual(["#3a3a3a", "#4a4a4a"]);
        expect([light.get("--check-a"), light.get("--check-b")]).toEqual(["#c8c8c8", "#ffffff"]);
    });

    it("gives the light theme a value for every colour the dark theme defines", () => {
        const isColour = (value: string) => /^#[0-9a-f]{6}$/.test(value);
        const darkColours = [...dark].filter(([, value]) => isColour(value)).map(([name]) => name);
        expect(darkColours.length).toBeGreaterThanOrEqual(16);
        for (const name of darkColours) expect(light.has(name), name).toBe(true);
    });

    it("defines the type tokens of DESIGN §3.2", () => {
        expect(dark.get("--font-ui")).toBe('Inter, "Segoe UI", system-ui, sans-serif');
        expect(dark.get("--font-size")).toBe("12px");
        expect(dark.get("--font-size-label")).toBe("11px");
        expect(dark.get("--font-size-title")).toBe("13px");
        expect(dark.get("--line-height")).toBe("16px");
        expect(dark.get("--font-weight")).toBe("400");
        expect(dark.get("--font-weight-strong")).toBe("500");
    });

    it("defines the space, shape and motion tokens of DESIGN §3.3", () => {
        for (const step of [2, 4, 8, 12, 16, 24]) {
            expect(dark.get(`--space-${step}`)).toBe(`${step}px`);
        }
        expect(Object.fromEntries(dark)).toMatchObject({
            "--control-height": "24px",
            "--row-height": "28px",
            "--radius-control": "4px",
            "--radius-surface": "6px",
            "--radius-region": "0",
            "--border-width": "1px",
            "--focus-ring-width": "2px",
            "--focus-ring-offset": "1px",
            "--elevation": "0 8px 24px rgb(0 0 0 / 0.4)",
            "--motion-fast": "100ms",
            "--motion-surface": "120ms",
            "--motion-ease": "ease-out",
            "--surface-fade": "ui-fade-in var(--motion-surface) var(--motion-ease)",
            "--icon-size": "16px",
            "--icon-stroke": "1.5px",
        });
    });

    it("turns transitions and the surface fade off under prefers-reduced-motion", () => {
        const reduced = stripComments(tokensCss).split("prefers-reduced-motion: reduce")[1] ?? "";
        expect(reduced).toMatch(/--motion-fast:\s*0ms/);
        expect(reduced).toMatch(/--motion-surface:\s*0ms/);
        // `none`, not a 0 ms animation: Chrome fires no animation events for the latter, and
        // Radix then keeps a closed popover mounted while it waits for the animation to end.
        expect(reduced).toMatch(/--surface-fade:\s*none/);
    });
});

// --- Contrast (WCAG 2.1 relative luminance and contrast ratio) ------------------------------

function luminance(hex: string): number {
    const channel = (offset: number) => {
        const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
    const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
    return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
}

const BACKGROUNDS = ["--bg-workspace", "--bg-panel", "--bg-raised", "--bg-active"];

/** The contrast pairs of DESIGN §3.1: foreground, background, minimum ratio. */
const PAIRS: readonly [string, string, number][] = [
    ...["--text", "--text-muted"].flatMap((text) =>
        BACKGROUNDS.map((background): [string, string, number] => [text, background, 4.5]),
    ),
    ["--accent-contrast", "--accent", 4.5],
    ["--warn", "--bg-panel", 4.5],
    ["--danger", "--bg-panel", 4.5],
    ["--border-input", "--bg-raised", 3],
];

describe("token contrast (DESIGN §3.1, WCAG 2.1 AA)", () => {
    it("checks the pairs the canon states", () => {
        const section = colourSection();
        for (const rule of [
            "`--text` and `--text-muted` on every background ≥ 4.5:1",
            "`--accent-contrast` on `--accent` ≥ 4.5:1",
            "`--warn` and `--danger` on `--bg-panel` ≥ 4.5:1",
            "`--border-input` against `--bg-raised` ≥ 3:1",
        ]) {
            expect(section, rule).toContain(rule);
        }
        // "Every background" is the four --bg-* rows of the table.
        expect(designColours().filter((row) => row.token.startsWith("--bg-"))).toHaveLength(4);
    });

    for (const [theme, tokens] of [
        ["dark", dark],
        ["light", light],
    ] as const) {
        it(`${theme}: every pair meets its ratio`, () => {
            for (const [foreground, background, ratio] of PAIRS) {
                expect(
                    contrast(tokens.get(foreground) ?? "", tokens.get(background) ?? ""),
                    `${foreground} on ${background}`,
                ).toBeGreaterThanOrEqual(ratio);
            }
        });
    }

    it("computes the WCAG ratio", () => {
        expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
        expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    });
});

// --- Raw colours outside tokens.css (checkStylesheets, tests/unit/canon-stylesheets) --------

/** Orders strings by UTF-16 code unit, whatever the machine's locale. */
function byCodeUnit(a: string, b: string): number {
    if (a === b) return 0;
    return a < b ? -1 : 1;
}

/**
 * The stylesheets under `root`: the package's under src/ and the gallery site's under
 * gallery/ (its build output left out), "/"-separated, in path order.
 */
function stylesheets(root = ROOT): string[] {
    return ["src", "gallery"]
        .flatMap((dir) => {
            try {
                return readdirSync(join(root, dir), { recursive: true, withFileTypes: true });
            } catch {
                return [];
            }
        })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".css"))
        .map((entry) => relative(root, join(entry.parentPath, entry.name)).replaceAll("\\", "/"))
        .filter((path) => !path.startsWith("gallery/dist/"))
        .sort(byCodeUnit);
}

describe("raw colours", () => {
    const temp = mkdtempSync(join(tmpdir(), "tokens-canon-"));
    afterAll(() => rmSync(temp, { recursive: true, force: true }));

    /** A fixture tree with `tokens.css` and one more stylesheet at `path`. */
    function fixture(name: string, path: string, css: string): string {
        const root = join(temp, name);
        for (const [file, text] of [
            [TOKENS_FILE, ":root {\n    --text: #e7e7ea;\n}\n"],
            [path, css],
        ] as const) {
            mkdirSync(join(root, file, ".."), { recursive: true });
            writeFileSync(join(root, file), text);
        }
        return root;
    }

    it("lists the stylesheets of src/ and gallery/ of a tree, its build output left out", () => {
        const root = fixture(
            "tokens-only",
            "gallery/site.css",
            ".site {\n    background: var(--bg-panel);\n}\n",
        );
        mkdirSync(join(root, "gallery", "dist"), { recursive: true });
        writeFileSync(join(root, "gallery", "dist", "site.css"), ".site {\n    color: #fff;\n}\n");
        expect(stylesheets(root)).toEqual(["gallery/site.css", TOKENS_FILE]);
    });

    it("finds the package's stylesheets", () => {
        const files = stylesheets();
        expect(files).toContain(TOKENS_FILE);
        expect(files).toContain("src/styles/base.css");
        expect(files).toContain("src/ui/gallery/gallery.css");
    });

    it("finds no raw colour in any stylesheet other than tokens.css", () => {
        expect(() => checkStylesheets(stylesheets().map((file) => join(ROOT, file)))).not.toThrow();
    });

    it("fails a raw colour in a fixture stylesheet other than tokens.css", () => {
        const root = fixture(
            "raw",
            "src/ui/fixture/fixture.css",
            ".fixture {\n    color: var(--text);\n    border: 1px solid #2a2a2e;\n}\n",
        );
        const files = stylesheets(root);
        expect(files).toEqual(["src/styles/tokens.css", "src/ui/fixture/fixture.css"]);
        expect(() => checkStylesheets(files.map((file) => join(root, file)))).toThrow(
            `${join(root, "src/ui/fixture/fixture.css")}:3 border: 1px solid #2a2a2e (#2a2a2e)`,
        );
    });

    it("uses only custom properties that tokens.css defines or the runtime sets", () => {
        // Set at run time: shell sizes by AppShell, popper geometry by Radix.
        const runtime = /^--(shell|radix)-/;
        const unknown = [];
        for (const file of stylesheets()) {
            for (const { value, line } of declarations(read(file))) {
                for (const match of value.matchAll(/var\(\s*(--[\w-]+)/g)) {
                    const name = match[1] ?? "";
                    if (!dark.has(name) && !runtime.test(name)) {
                        unknown.push(`${file}:${line} ${name}`);
                    }
                }
            }
        }
        expect(unknown).toEqual([]);
    });
});
