import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// The gallery (SPEC §12) as Pages serves it: the frame in both themes, the Tokens entry with
// every DESIGN §3.1 colour at its value, at 1280×720 and at 125% browser zoom (DESIGN §9),
// with no WCAG 2.1 AA violation; and the link to its licences file (SPEC §11).

type Theme = "dark" | "light";
const THEMES: readonly Theme[] = ["dark", "light"];

/** The window sizes of DESIGN §9: the minimum window, and 1920 × 1080 at 125% browser zoom. */
const WINDOWS = [
    { name: "1280×720", width: 1280, height: 720 },
    // 125% zoom of a 1920 × 1080 window lays the page out in 1536 × 864 CSS pixels, at a
    // device pixel ratio of 1.25; the test lays it out at DPR 1 (the boxes are CSS pixels).
    { name: "1536×864 (125% of 1920×1080)", width: 1536, height: 864 },
] as const;

/** The colours of DESIGN §3.1, read from the canon: token, dark value, light value. */
function canonColours(): { token: string; dark: string; light: string }[] {
    const design = readFileSync(
        fileURLToPath(new URL("../../docs/DESIGN.md", import.meta.url)),
        "utf8",
    );
    const section = design.slice(design.indexOf("### 3.1 Colour"), design.indexOf("### 3.2"));
    const row = /^\|\s*`(--[a-z-]+)`\s*\|\s*`(#[0-9a-f]{6})`\s*\|\s*`(#[0-9a-f]{6})`\s*\|/gm;
    return [...section.matchAll(row)].map((match) => ({
        token: match[1]!,
        dark: match[2]!,
        light: match[3]!,
    }));
}

const COLOURS = [
    ...canonColours(),
    { token: "--check-a", dark: "#3a3a3a", light: "#c8c8c8" },
    { token: "--check-b", dark: "#4a4a4a", light: "#ffffff" },
];

/** `#rrggbb` as getComputedStyle gives it. */
function rgb(hex: string): string {
    const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
    return `rgb(${r}, ${g}, ${b})`;
}

async function openGallery(page: Page) {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await expect(page.getByRole("heading", { name: "Interface gallery", level: 1 })).toBeVisible();
}

async function chooseTheme(page: Page, theme: Theme) {
    const radio = page.getByRole("radio", { name: theme === "dark" ? "Dark" : "Light" });
    await radio.check();
    await expect(radio).toBeChecked();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

// --- WCAG 2.1 AA --------------------------------------------------------------------------

const AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** Whether any part of the element lies inside the visible box of its scrolling ancestors. */
function isOnScreen(page: Page, selector: string): Promise<boolean> {
    return page.locator(selector).evaluate((element) => {
        let { left, top, right, bottom } = element.getBoundingClientRect();
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            if (style.overflowX === "visible" && style.overflowY === "visible") continue;
            const clip = parent.getBoundingClientRect();
            left = Math.max(left, clip.left);
            top = Math.max(top, clip.top);
            right = Math.min(right, clip.right);
            bottom = Math.min(bottom, clip.bottom);
        }
        return right > left && bottom > top;
    });
}

/**
 * Runs axe (WCAG 2.1 A and AA) on the page and returns the violations together with what the
 * contrast rule covered: nodes it judged, and nodes on screen it could not decide on (those
 * would hide a failure, so the tests accept none).
 */
async function audit(page: Page) {
    const results = await new AxeBuilder({ page }).withTags(AA_TAGS).analyze();
    const contrast = (list: typeof results.passes) =>
        list.filter((rule) => rule.id === "color-contrast").flatMap((rule) => rule.nodes);
    const contrastUndecided = [];
    for (const node of contrast(results.incomplete)) {
        const selector = node.target.join(" ");
        if (await isOnScreen(page, selector)) contrastUndecided.push(selector);
    }
    return {
        violations: results.violations.flatMap((rule) =>
            rule.nodes.map(
                (node) => `${rule.id}: ${node.target.join(" ")} — ${node.failureSummary}`,
            ),
        ),
        contrastChecked: contrast(results.passes).length,
        contrastUndecided,
    };
}

// --- The Tokens entry ----------------------------------------------------------------------

for (const theme of THEMES) {
    for (const window of WINDOWS) {
        test(`the Tokens entry renders in the ${theme} theme at ${window.name}`, async ({
            page,
        }) => {
            await page.setViewportSize({ width: window.width, height: window.height });
            await openGallery(page);
            await chooseTheme(page, theme);

            const entry = page.locator('section[data-entry="tokens"]');
            await expect(entry.getByRole("heading", { name: "Tokens", level: 2 })).toBeVisible();
            expect(
                await page.locator(".gallery").evaluate((e) => getComputedStyle(e).backgroundColor),
            ).toBe(rgb(COLOURS.find(({ token }) => token === "--bg-panel")![theme]));

            // Every colour of the canon, named, at its value, and painted in its swatch.
            expect(COLOURS).toHaveLength(16);
            for (const colour of COLOURS) {
                const row = entry.locator(`[data-token="${colour.token}"]`);
                await expect(row.locator(".gallery-tokens__name"), colour.token).toHaveText(
                    colour.token,
                );
                await expect(row.locator("[data-token-value]"), colour.token).toHaveText(
                    colour[theme],
                );
                expect(
                    await row
                        .locator(".gallery-tokens__swatch")
                        .evaluate((swatch) => getComputedStyle(swatch).backgroundColor),
                    colour.token,
                ).toBe(rgb(colour[theme]));
            }

            // Type, spacing, radius, elevation and focus ring, with their values.
            for (const [token, value] of [
                ["--font-size", "12px"],
                ["--font-size-label", "11px"],
                ["--font-size-title", "13px"],
                ["--font-ui", 'Inter, "Segoe UI", system-ui, sans-serif'],
                ["--line-height", "16px"],
                ["--font-weight", "400"],
                ["--font-weight-strong", "500"],
                ["--space-2", "2px"],
                ["--space-24", "24px"],
                ["--radius-control", "4px"],
                ["--radius-surface", "6px"],
                ["--radius-region", "0"],
                ["--elevation", "0 8px 24px rgb(0 0 0 / 0.4)"],
                ["--focus-ring-width", "2px"],
                ["--focus-ring-offset", "1px"],
            ] as const) {
                await expect(entry.locator(`[data-token-value="${token}"]`), token).toHaveText(
                    value,
                );
            }
            for (const group of [
                "Colour",
                "Type",
                "Spacing",
                "Radius",
                "Elevation",
                "Focus ring",
            ]) {
                await expect(entry.getByRole("heading", { name: group, level: 3 })).toBeVisible();
            }

            // Nothing is clipped or scrolls sideways.
            const overflow = await page.evaluate(() => {
                const gallery = document.querySelector(".gallery")!;
                const width = document.documentElement.clientWidth;
                const outside = [...document.querySelectorAll("[data-token]")].filter(
                    (element) => element.getBoundingClientRect().right > width,
                );
                return {
                    page: document.documentElement.scrollWidth - width,
                    gallery: gallery.scrollWidth - gallery.clientWidth,
                    outside: outside.map((element) => element.getAttribute("data-token")),
                };
            });
            expect(overflow).toEqual({ page: 0, gallery: 0, outside: [] });

            // WCAG 2.1 AA, with the contrast rule judging the text rather than skipping it.
            const result = await audit(page);
            expect(result.violations).toEqual([]);
            expect(result.contrastUndecided).toEqual([]);
            expect(result.contrastChecked).toBeGreaterThan(40);
        });
    }
}

// --- Frame -------------------------------------------------------------------------------

test("the theme switch works from the keyboard, with the focus ring on keyboard focus only", async ({
    page,
}) => {
    await openGallery(page);
    const dark = page.getByRole("radio", { name: "Dark" });
    const light = page.getByRole("radio", { name: "Light" });
    const ring = (theme: Theme) =>
        `2px solid ${rgb(COLOURS.find(({ token }) => token === "--accent")![theme])}`;
    const outline = (radio: typeof dark) =>
        radio.evaluate((element) => {
            const style = getComputedStyle(element);
            return style.outlineStyle === "none"
                ? "none"
                : `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`;
        });

    await expect(dark).toBeChecked();
    await dark.click();
    await expect(dark).toBeFocused();
    expect(await outline(dark)).toBe("none");

    await page.keyboard.press("ArrowRight");
    await expect(light).toBeChecked();
    await expect(light).toBeFocused();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await outline(light)).toBe(ring("light"));
    await expect(page.locator('[data-token="--accent"] [data-token-value]')).toHaveText(
        COLOURS.find(({ token }) => token === "--accent")!.light,
    );
});

test("the licences.txt link opens the file", async ({ page }) => {
    await openGallery(page);
    const link = page.getByRole("link", { name: "Open source licences" });
    await expect(link).toHaveAttribute("href", "licences.txt");

    const response = page.waitForResponse((answer) => answer.url().endsWith("/licences.txt"));
    await link.click();
    const answer = await response;
    expect(answer.status()).toBe(200);
    expect(answer.headers()["content-type"]).toMatch(/^text\/plain/);
    await expect(page).toHaveURL(/\/ngne-editor-ui\/licences\.txt$/);
    const text = await page.locator("body").innerText();
    expect(text.startsWith("NGNE Editor UI gallery: open source licences")).toBe(true);
    expect(text).toContain("Copyright (c) 2026 Fabio Barracano");
    expect(text).toMatch(/^react \d+\.\d+\.\d+ \(MIT\)$/m);
});
