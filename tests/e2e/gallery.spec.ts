import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { audit, entry, horizontalOverflow } from "./gallery-support.ts";

// The gallery (SPEC §12) as Pages serves it: the frame in both themes, the Tokens entry with
// every DESIGN §3.1 colour at its value, and every entry, the package's and then the site's
// own (the demo editor), at 1280×720 and at 125% browser zoom (DESIGN §9), with no WCAG 2.1 AA
// violation; the navigation to each entry by its id; the shell frame's slots, the licences
// dialog and the window-too-small notice; and the link to its licences file (SPEC §11).

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

// --- Every entry ---------------------------------------------------------------------------

/** The package's entries, in the gallery's order (src/ui/gallery/entries.ts). */
const PACKAGE_ENTRIES = [
    "tokens",
    "button",
    "icon-button",
    "tool-button",
    "toggle",
    "segmented",
    "number-field",
    "slider",
    "select",
    "popover",
    "closing-popover",
    "dialog",
    "context-menu",
    "tooltip",
    "splitter",
    "icon",
    "toast",
    "dialog-host",
    "discard-changes",
    "webgpu-required",
    "window-too-small",
    "region-boundary",
    "command-refresh",
    "command-palette",
    "shortcut-sheet",
    "about",
    "licences",
    "tab-strip",
    "app-shell",
] as const;

/** The site's own entries, which it passes to the gallery as an app does. */
const SITE_ENTRIES = ["demo-editor"] as const;

const ENTRIES: readonly string[] = [...PACKAGE_ENTRIES, ...SITE_ENTRIES];

/** The demo editor's page in the site's entry. */
const demoFrame = (page: Page) => page.frameLocator('iframe[title="NGNE Demo Editor"]');

/** The ids of the sections on the page, in the page's order. */
const sectionIds = (page: Page) =>
    page
        .locator("section[data-entry]")
        .evaluateAll((sections) => sections.map((section) => section.getAttribute("data-entry")));

for (const theme of THEMES) {
    for (const window of WINDOWS) {
        for (const id of ENTRIES) {
            test(`the ${id} entry renders in the ${theme} theme at ${window.name} with no axe violation`, async ({
                page,
            }) => {
                await page.setViewportSize({ width: window.width, height: window.height });
                await openGallery(page);
                await chooseTheme(page, theme);

                const section = entry(page, id);
                await section.scrollIntoViewIfNeeded();
                await expect(section).toBeInViewport();
                await expect(page.locator(`#gallery-entry-${id}`)).toBeVisible();
                if (id === "demo-editor") {
                    // The demo editor, in the gallery's theme, with its shell and tab strip.
                    const demo = demoFrame(page);
                    await expect(demo.getByRole("menubar", { name: "Main menu" })).toBeVisible();
                    await expect(demo.locator("html")).toHaveAttribute("data-theme", theme);
                    await expect(
                        demo.getByRole("tablist", { name: "Documents" }).getByRole("tab"),
                    ).toHaveCount(3);
                    await expect(demo.locator(".notice")).toHaveCount(0);
                }

                // Nothing scrolls sideways or reaches past the page's right edge.
                expect(await horizontalOverflow(page)).toEqual({ page: 0, gallery: 0, outside: 0 });

                // WCAG 2.1 AA on the entry, frames included, the contrast rule judging its text.
                const result = await audit(page, `section[data-entry="${id}"]`);
                expect(result.violations).toEqual([]);
                expect(result.contrastUndecided).toEqual([]);
                expect(result.contrastChecked).toBeGreaterThan(0);
                // The demo editor's page is audited in its frame, not only the entry around it.
                if (id === "demo-editor") expect(result.contrastChecked).toBeGreaterThan(20);
            });
        }
    }
}

// --- Navigation and app entries --------------------------------------------------------------

test("the site's entries render after the package's, in a group of their own", async ({ page }) => {
    await openGallery(page);
    expect(await sectionIds(page)).toEqual(ENTRIES);

    const nav = page.getByRole("navigation", { name: "Entries" });
    expect(
        await nav
            .locator("[data-group]")
            .evaluateAll((groups) => groups.map((group) => group.getAttribute("data-group"))),
    ).toEqual([
        "Tokens",
        "Primitives",
        "Messages",
        "Commands",
        "About and licences",
        "Shell",
        "App",
    ]);
    expect(
        await nav
            .getByRole("link")
            .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
    ).toEqual(ENTRIES.map((id) => `#${id}`));
    await expect(nav.getByRole("list", { name: "App" }).getByRole("link")).toHaveText([
        "Demo editor",
    ]);
});

/** Waits until the section starts at the top of the gallery's scrolled area. */
async function expectAtTop(page: Page, id: string) {
    const top = () =>
        page.evaluate(
            (entryId) =>
                document.getElementById(entryId)!.getBoundingClientRect().top -
                document.querySelector(".gallery")!.getBoundingClientRect().top,
            id,
        );
    await expect.poll(async () => Math.abs(await top()), { message: id }).toBeLessThanOrEqual(1);
}

test("the navigation and the address open an entry by its id", async ({ page }) => {
    await openGallery(page);
    const nav = page.getByRole("navigation", { name: "Entries" });

    await nav.getByRole("link", { name: "Licences dialog", exact: true }).click();
    await expect(page).toHaveURL(/\/ngne-editor-ui\/#licences$/);
    await expectAtTop(page, "licences");

    // A new fragment in the address, as the browser's history gives it.
    await page.evaluate(() => {
        window.location.hash = "window-too-small";
    });
    await expectAtTop(page, "window-too-small");

    // The gallery opened at an entry's address.
    await page.goto("about:blank");
    await page.goto("./#app-shell");
    await expect(page.getByRole("heading", { name: "Interface gallery", level: 1 })).toBeVisible();
    await expectAtTop(page, "app-shell");
});

// --- The shell frame, licences and window-too-small entries ---------------------------------

test("the shell frame shows each slot in its region, and noDocument in the viewport's place", async ({
    page,
}) => {
    await openGallery(page);
    const shell = entry(page, "app-shell");
    await shell.scrollIntoViewIfNeeded();
    const slot = (name: string) => shell.locator(`[data-slot="${name}"]`);
    const inRegion = async (name: string, region: string) => {
        const box = await slot(name).boundingBox();
        const frame = await shell.locator(region).boundingBox();
        expect(box, name).not.toBeNull();
        expect(frame, region).not.toBeNull();
        expect(box!.x, name).toBeGreaterThanOrEqual(frame!.x);
        expect(box!.y, name).toBeGreaterThanOrEqual(frame!.y);
        expect(box!.x + box!.width, name).toBeLessThanOrEqual(frame!.x + frame!.width + 0.5);
        expect(box!.y + box!.height, name).toBeLessThanOrEqual(frame!.y + frame!.height + 0.5);
    };

    await expect(
        shell.getByRole("menubar", { name: "Main menu" }).getByRole("menuitem"),
    ).toHaveText(["File", "Edit", "View", "Help"]);
    for (const [name, region] of [
        ["menuCentre", ".shell-menubar__centre"],
        ["railFooter", ".shell-rail"],
        ["viewport", '[data-region="viewport"]'],
        ["bottom", '[data-region="bottom"]'],
    ] as const) {
        await expect(slot(name), name).toHaveText(name);
        await inRegion(name, region);
    }
    await expect(slot("noDocument")).toHaveCount(0);

    // No document: its content takes the viewport's place; the bottom region stays, empty.
    const toggle = shell.getByRole("button", { name: "No document" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(slot("noDocument")).toHaveText("noDocument");
    await inRegion("noDocument", '[data-region="viewport"]');
    await expect(slot("viewport")).toHaveCount(0);
    await expect(slot("bottom")).toHaveCount(0);
    await expect(shell.locator('[data-region="bottom"]')).toBeVisible();

    // Its View menu opens the licences dialog through the gallery's dialog host.
    await shell.getByRole("menuitem", { name: "View", exact: true }).click();
    await page.getByRole("menuitem", { name: "Open Source Licences…" }).click();
    const dialog = page.getByRole("dialog", { name: "Open Source Licences" });
    await expect(dialog.getByRole("region", { name: "Licence text" })).toContainText(
        "NGNE Editor UI gallery: open source licences",
    );
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
});

test("the licences entry shows the gallery's licences.txt, and links it when it cannot be read", async ({
    page,
}) => {
    await openGallery(page);
    const licences = entry(page, "licences");
    const dialog = page.getByRole("dialog", { name: "Open Source Licences" });
    const closed = page.locator('[data-readout="licences-closed"]');

    await licences.getByRole("button", { name: "Open Source Licences…" }).click();
    await expect(dialog.getByRole("region", { name: "Licence text" })).toContainText(
        "NGNE Editor UI gallery: open source licences",
    );
    expect((await audit(page)).violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(closed).toHaveText("Closed: 1");

    await licences.getByRole("button", { name: "Open with the file unreadable" }).click();
    await expect(dialog).toContainText(
        "The licences file of NGNE Gallery Editor could not be loaded.",
    );
    await expect(dialog.getByRole("link")).toHaveAttribute(
        "href",
        /\/ngne-editor-ui\/licences\.txt$/,
    );
    await expect(dialog.getByRole("region", { name: "Licence text" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(closed).toHaveText("Closed: 2");
});

test("the window-too-small entry names the minimum and the window's size", async ({ page }) => {
    await openGallery(page);
    const notice = entry(page, "window-too-small").locator('[data-notice="window-too-small"]');
    await expect(notice.getByRole("heading", { name: "Window too small" })).toBeVisible();
    await expect(notice).toContainText(
        "The editor needs a window of at least 1280 × 720 CSS pixels; this one is 1152 × 648.",
    );
});
