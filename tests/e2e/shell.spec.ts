import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { audit, boxOf, tabTo, THEMES, uncaughtErrors, WINDOWS } from "./gallery-support.ts";
import { chooseDemoTheme, openPalette, palette, settle } from "./surfaces-support.ts";

// The shell (SPEC §8, DESIGN §2, §5, §7, §9) on the demo editor: `AppShell` with the demo's
// viewport, bottom and `noDocument` slot contents. The regions at their sizes at 1280×720 and
// at 125% zoom of 1920×1080, with no overlap and nothing cut off; the dock's and the bottom
// region's splitters, kept under `<id>.layout`; no bottom region without `bottomRegion`; Tab
// toggling it from the viewport; the `noDocument` gate; F6 and Shift+F6; the window-too-small
// notice; a crashed region beside usable ones; both themes with no WCAG 2.1 AA violation.

const LAYOUT_KEY = "ngne-demo-editor.layout";
const BOTTOM = "timeline";
const REGIONS = ["menu-bar", "tool-rail", "context-bar", "viewport", "dock", BOTTOM, "status-bar"];

type Box = { x: number; y: number; width: number; height: number };

const region = (page: Page, id: string) => page.locator(`[data-region="${id}"]`);
const canvas = (page: Page) => page.getByRole("application", { name: "Canvas" });
const dockSplitter = (page: Page) => page.getByRole("separator", { name: "Resize panels" });
const bottomSplitter = (page: Page) => page.getByRole("separator", { name: "Resize timeline" });
const notice = (page: Page) => page.locator('[data-notice="window-too-small"]');

async function openShell(page: Page, size?: { width: number; height: number }, query = "") {
    if (size) await page.setViewportSize(size);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`./demo/${query}`);
    await expect(region(page, "viewport")).toBeVisible();
}

async function regionBoxes(page: Page, ids: readonly string[] = REGIONS) {
    const boxes: Record<string, Box> = {};
    for (const id of ids) boxes[id] = await boxOf(region(page, id));
    return boxes;
}

function overlap(a: Box, b: Box): number {
    const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    return Math.max(0, width) * Math.max(0, height);
}

const contains = (outer: Box, inner: Box) =>
    inner.x >= outer.x - 0.5 &&
    inner.y >= outer.y - 0.5 &&
    inner.x + inner.width <= outer.x + outer.width + 0.5 &&
    inner.y + inner.height <= outer.y + outer.height + 0.5;

/** No two regions share a pixel, each lies inside the window, together they cover it. */
function expectSoundLayout(boxes: Record<string, Box>, window: { width: number; height: number }) {
    const ids = Object.keys(boxes);
    for (const id of ids) {
        expect(boxes[id]!.width, `${id} width`).toBeGreaterThan(0);
        expect(boxes[id]!.height, `${id} height`).toBeGreaterThan(0);
        expect(contains({ x: 0, y: 0, ...window }, boxes[id]!), `${id} in the window`).toBe(true);
    }
    for (const [index, first] of ids.entries()) {
        for (const second of ids.slice(index + 1)) {
            expect(overlap(boxes[first]!, boxes[second]!), `${first} overlaps ${second}`).toBe(0);
        }
    }
    const area = ids.reduce((sum, id) => sum + boxes[id]!.width * boxes[id]!.height, 0);
    expect(area).toBeCloseTo(window.width * window.height, 0);
}

/**
 * The shell's own controls (the splitters, and the bottom region's content) lie inside the
 * window, are what a press at their centre reaches, and are cut off by no ancestor; content that
 * a scrolling ancestor can bring into view is not cut off.
 */
async function cutOffControls(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const problems: string[] = [];
        const controls = document.querySelectorAll<HTMLElement>(
            '.shell [role="separator"], .shell-bottom__content button',
        );
        for (const control of controls) {
            const name = control.getAttribute("aria-label") ?? control.textContent ?? "";
            const box = control.getBoundingClientRect();
            if (
                box.left < 0 ||
                box.top < 0 ||
                box.right > window.innerWidth ||
                box.bottom > window.innerHeight
            ) {
                problems.push(`${name}: outside the window`);
                continue;
            }
            for (let parent = control.parentElement; parent; parent = parent.parentElement) {
                const style = getComputedStyle(parent);
                if (style.overflowX === "visible" && style.overflowY === "visible") continue;
                const clip = parent.getBoundingClientRect();
                const inside =
                    box.left >= clip.left - 0.5 &&
                    box.top >= clip.top - 0.5 &&
                    box.right <= clip.right + 0.5 &&
                    box.bottom <= clip.bottom + 0.5;
                if (!inside && style.overflowY !== "auto" && style.overflowY !== "scroll") {
                    problems.push(`${name}: cut off by ${parent.className}`);
                }
            }
            const hit = document.elementFromPoint(
                box.left + box.width / 2,
                box.top + box.height / 2,
            );
            if (!hit || !control.contains(hit)) problems.push(`${name}: covered`);
        }
        return problems;
    });
}

/** The expected boxes of DESIGN §2 for a window, with the default dock and bottom region. */
function designBoxes(width: number, height: number, bottom = 200): Record<string, Box> {
    const dock = 264;
    const middle = height - 36 - 24;
    return {
        "menu-bar": { x: 0, y: 0, width, height: 36 },
        "tool-rail": { x: 0, y: 36, width: 44, height: middle },
        "context-bar": { x: 44, y: 36, width: width - 44 - dock, height: 36 },
        viewport: { x: 44, y: 72, width: width - 44 - dock, height: middle - 36 - bottom },
        dock: { x: width - dock, y: 36, width: dock, height: middle - bottom },
        [BOTTOM]: { x: 44, y: height - 24 - bottom, width: width - 44, height: bottom },
        "status-bar": { x: 0, y: height - 24, width, height: 24 },
    };
}

/** Drags `handle` by (dx, dy) from its centre. */
async function dragBy(page: Page, handle: Locator, dx: number, dy: number) {
    const box = await boxOf(handle);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 4 });
    await page.mouse.up();
}

const storedLayout = (page: Page) =>
    page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null") as unknown, LAYOUT_KEY);

for (const size of WINDOWS) {
    test(`the regions take their DESIGN §2 sizes at ${size.name}, with no overlap and nothing cut off`, async ({
        page,
    }) => {
        const errors = uncaughtErrors(page);
        await openShell(page, size);
        const boxes = await regionBoxes(page);
        // min(200 px, 28% of the window height) is 200 px at both sizes.
        expect(boxes).toEqual(designBoxes(size.width, size.height));
        expectSoundLayout(boxes, size);
        expect(await cutOffControls(page)).toEqual([]);
        // The dock's and the bottom region's splitters: 8 px centred on the region's border.
        const dock = await boxOf(dockSplitter(page));
        expect([dock.x, dock.width]).toEqual([size.width - 264 - 4, 8]);
        const bottom = await boxOf(bottomSplitter(page));
        expect([bottom.y, bottom.height]).toEqual([size.height - 24 - 200 - 4, 8]);
        // The viewport's content scrolls in the region; the region itself never does.
        const viewport = await region(page, "viewport").evaluate((element) => ({
            scrolls: element.scrollHeight > element.clientHeight,
            overflow: getComputedStyle(element).overflow,
        }));
        expect(viewport).toEqual({ scrolls: false, overflow: "hidden" });
        expect(errors).toEqual([]);
    });
}

test("regions carry their landmarks and data-region, in document order", async ({ page }) => {
    await openShell(page);
    await expect(page.getByRole("banner")).toHaveAttribute("data-region", "menu-bar");
    await expect(page.getByRole("navigation", { name: "Tools" })).toHaveAttribute(
        "data-region",
        "tool-rail",
    );
    await expect(page.getByRole("region", { name: "Tool options" })).toHaveAttribute(
        "data-region",
        "context-bar",
    );
    await expect(page.getByRole("main")).toHaveAttribute("data-region", "viewport");
    await expect(page.getByRole("complementary", { name: "Panels" })).toHaveAttribute(
        "data-region",
        "dock",
    );
    await expect(page.getByRole("region", { name: "Timeline", exact: true })).toHaveAttribute(
        "data-region",
        BOTTOM,
    );
    await expect(page.getByRole("contentinfo")).toHaveAttribute("data-region", "status-bar");
    const order = await page
        .locator("[data-region]")
        .evaluateAll((elements) => elements.map((element) => element.getAttribute("data-region")));
    expect(order).toEqual(REGIONS);
});

test("the dock resizes between 220 and 360 px, resets on double-click and keeps its width", async ({
    page,
}) => {
    await openShell(page, { width: 1440, height: 900 });
    const dock = region(page, "dock");
    const width = async () => (await boxOf(dock)).width;
    const splitter = dockSplitter(page);

    await dragBy(page, splitter, -60, 0);
    expect(await width()).toBe(324);
    await expect(splitter).toHaveAttribute("aria-valuenow", "324");
    expect((await regionBoxes(page, ["viewport"])).viewport!.width).toBe(1440 - 44 - 324);
    await dragBy(page, splitter, -400, 0);
    expect(await width()).toBe(360);
    await dragBy(page, splitter, 700, 0);
    expect(await width()).toBe(220);
    expectSoundLayout(await regionBoxes(page), { width: 1440, height: 900 });

    await dragBy(page, splitter, -80, 0);
    expect(await width()).toBe(300);
    expect(await storedLayout(page)).toEqual({ dockWidth: 300, timelineHeight: null });
    await page.reload();
    await expect(dock).toBeVisible();
    expect(await width()).toBe(300);

    await splitter.dblclick();
    expect(await width()).toBe(264);
    expect(await storedLayout(page)).toEqual({ dockWidth: null, timelineHeight: null });
    await page.reload();
    await expect(dock).toBeVisible();
    expect(await width()).toBe(264);
});

test("the bottom region resizes between 120 px and half the window, resets on double-click and keeps its height", async ({
    page,
}) => {
    await openShell(page, { width: 1440, height: 900 });
    const bottom = region(page, BOTTOM);
    const height = async () => (await boxOf(bottom)).height;
    const splitter = bottomSplitter(page);

    await dragBy(page, splitter, 0, -50);
    expect(await height()).toBe(250);
    await dragBy(page, splitter, 0, -600);
    expect(await height()).toBe(450);
    await dragBy(page, splitter, 0, 800);
    expect(await height()).toBe(120);
    expectSoundLayout(await regionBoxes(page), { width: 1440, height: 900 });

    await dragBy(page, splitter, 0, -140);
    expect(await height()).toBe(260);
    // The stored field keeps the name both editors store (SPEC §5).
    expect(await storedLayout(page)).toEqual({ dockWidth: null, timelineHeight: 260 });
    await page.reload();
    await expect(bottom).toBeVisible();
    expect(await height()).toBe(260);

    // A stored height above half of a smaller window is limited when rendered.
    await dragBy(page, splitter, 0, -600);
    expect(await height()).toBe(450);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect.poll(height).toBe(360);
    expect(await storedLayout(page)).toEqual({ dockWidth: null, timelineHeight: 450 });

    await splitter.dblclick();
    expect(await height()).toBe(200);
    await page.reload();
    await expect(bottom).toBeVisible();
    expect(await height()).toBe(200);
});

test("the splitters resize with the keyboard", async ({ page }) => {
    await openShell(page, { width: 1440, height: 900 });
    const dockWidth = async () => (await boxOf(region(page, "dock"))).width;
    const bottomHeight = async () => (await boxOf(region(page, BOTTOM))).height;

    await tabTo(page, dockSplitter(page));
    await page.keyboard.press("ArrowLeft");
    expect(await dockWidth()).toBe(272);
    await page.keyboard.press("Shift+ArrowRight");
    expect(await dockWidth()).toBe(240);
    await page.keyboard.press("End");
    expect(await dockWidth()).toBe(360);
    await page.keyboard.press("Enter");
    expect(await dockWidth()).toBe(264);

    await tabTo(page, bottomSplitter(page));
    await page.keyboard.press("ArrowUp");
    expect(await bottomHeight()).toBe(208);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    expect(await bottomHeight()).toBe(192);
    await page.keyboard.press("Home");
    expect(await bottomHeight()).toBe(120);
    await page.keyboard.press("Enter");
    expect(await bottomHeight()).toBe(200);
});

test("without bottomRegion there is no bottom region, no splitter for it and no Tab toggle", async ({
    page,
}) => {
    const errors = uncaughtErrors(page);
    await openShell(page, undefined, "?bottom=none");
    await expect(page.locator(".shell-bottom")).toHaveCount(0);
    await expect(region(page, BOTTOM)).toHaveCount(0);
    await expect(page.getByRole("separator", { name: /timeline/i })).toHaveCount(0);
    // The viewport and the dock take the bottom region's row.
    const ids = REGIONS.filter((id) => id !== BOTTOM);
    const boxes = await regionBoxes(page, ids);
    const expected = designBoxes(1280, 720, 0);
    delete expected[BOTTOM];
    expect(boxes).toEqual(expected);
    expectSoundLayout(boxes, { width: 1280, height: 720 });
    // Tab on the viewport moves the focus, as it does in the browser.
    await canvas(page).focus();
    await page.keyboard.press("Tab");
    await expect(canvas(page)).not.toBeFocused();
    expect(errors).toEqual([]);
});

test("Tab toggles the bottom region while the viewport has focus, and only then", async ({
    page,
}) => {
    await openShell(page);
    const bottom = region(page, BOTTOM);
    await canvas(page).focus();
    await page.keyboard.press("Tab");
    await expect(bottom).toBeHidden();
    await expect(canvas(page)).toBeFocused();
    // Its row is empty: the viewport and the dock take it.
    const hidden = await regionBoxes(page, ["viewport", "dock"]);
    expect(hidden.viewport!.height).toBe(720 - 72 - 24);
    expect(hidden.dock!.height).toBe(720 - 36 - 24);

    await page.keyboard.press("Tab");
    await expect(bottom).toBeVisible();
    await expect(canvas(page)).toBeFocused();
    expect((await boxOf(bottom)).height).toBe(200);

    // From a control, Tab moves the focus and leaves the region as it is.
    const tool = page.getByRole("button", { name: "Tool", exact: true });
    await tool.focus();
    await page.keyboard.press("Tab");
    await expect(tool).not.toBeFocused();
    await expect(bottom).toBeVisible();

    // The palette names the toggle by what it will do, and runs it.
    await canvas(page).focus();
    await page.keyboard.press("Tab");
    await openPalette(page);
    await page.keyboard.type("timeline");
    await expect(palette(page).locator('[data-command="view.timeline"]')).toContainText(
        "Show Timeline",
    );
    await page.keyboard.press("Enter");
    await expect(palette(page)).toBeHidden();
    await expect(bottom).toBeVisible();
});

test("the noDocument slot takes the viewport's place and leaves the dock and the bottom region empty", async ({
    page,
}) => {
    await openShell(page);
    const bottomContent = region(page, BOTTOM).locator(".shell-bottom__content");
    const dockContent = region(page, "dock").locator(".shell-dock__scroll");
    await expect(bottomContent.getByRole("button", { name: "Frame 1" })).toBeVisible();
    // The dock holds its region boundary; its sections are the dock's content (SPEC §8).
    await expect(page.locator(".shell")).not.toHaveAttribute("data-document");

    await page.getByRole("button", { name: "Close document" }).click();
    const viewport = region(page, "viewport");
    await expect(viewport.getByText("No document is open.")).toBeVisible();
    await expect(viewport.getByRole("button", { name: "New document" })).toBeVisible();
    await expect(page.locator(".shell")).toHaveAttribute("data-document", "none");
    await expect(canvas(page)).toHaveCount(0);
    await expect(bottomContent).toBeEmpty();
    await expect(dockContent).toBeEmpty();
    // The frames stay where they were: the layout does not move when a document opens.
    expect(await regionBoxes(page)).toEqual(designBoxes(1280, 720));
    await expect(bottomSplitter(page)).toBeVisible();
    await expect(dockSplitter(page)).toBeVisible();

    await viewport.getByRole("button", { name: "New document" }).click();
    await expect(canvas(page)).toBeVisible();
    await expect(bottomContent.getByRole("button", { name: "Frame 1" })).toBeVisible();
    await expect(page.locator(".shell")).not.toHaveAttribute("data-document");
});

/** Where focus lands after each of `count` presses of `key`: the region and the element. */
async function lap(page: Page, key: "F6" | "Shift+F6", count: number) {
    const stops: string[] = [];
    for (let index = 0; index < count; index++) {
        await page.keyboard.press(key);
        await settle(page);
        stops.push(
            await page.evaluate(() => {
                const active = document.activeElement as HTMLElement | null;
                const region = active?.closest("[data-region]")?.getAttribute("data-region");
                const name = active?.getAttribute("aria-label") ?? active?.textContent ?? "";
                return `${region ?? "none"}: ${name.trim()}`;
            }),
        );
    }
    return stops;
}

test("F6 and Shift+F6 cycle the regions that can take focus, in shell order", async ({ page }) => {
    await openShell(page);
    // The menu bar, rail, context bar and status bar hold nothing to focus yet; the dock holds
    // only its splitter.
    const cycle = ["viewport: Preferences…", "dock: Resize panels", `${BOTTOM}: Frame 1`];
    await canvas(page).focus();
    expect(await lap(page, "F6", 4)).toEqual([cycle[1], cycle[2], cycle[0], cycle[1]]);
    expect(await lap(page, "Shift+F6", 3)).toEqual([cycle[0], cycle[2], cycle[1]]);

    // Also from a text field.
    const name = page.getByRole("textbox", { name: "Name" });
    await name.focus();
    expect(await lap(page, "F6", 1)).toEqual([cycle[1]]);
    await name.focus();
    expect(await lap(page, "Shift+F6", 1)).toEqual([cycle[2]]);

    // A hidden region is left out.
    await canvas(page).focus();
    await page.keyboard.press("Tab");
    await expect(region(page, BOTTOM)).toBeHidden();
    expect(await lap(page, "F6", 2)).toEqual([cycle[1], cycle[0]]);

    // Under an overlay F6 does nothing.
    await openPalette(page);
    await page.keyboard.press("F6");
    await page.keyboard.press("Shift+F6");
    await expect(palette(page).getByRole("combobox")).toBeFocused();
});

test("below 1280×720 the window-too-small notice stands in for the shell, which keeps its state", async ({
    page,
}) => {
    const errors = uncaughtErrors(page);
    await openShell(page);
    await canvas(page).focus();
    await page.keyboard.press("Tab");
    await expect(region(page, BOTTOM)).toBeHidden();
    await expect(notice(page)).toHaveCount(0);

    for (const size of [
        { width: 1279, height: 720 },
        { width: 1280, height: 719 },
        { width: 1024, height: 600 },
    ]) {
        await page.setViewportSize(size);
        await expect(notice(page)).toBeVisible();
        await expect(notice(page).getByRole("heading", { name: "Window too small" })).toBeVisible();
        await expect(notice(page)).toContainText(
            `at least 1280 × 720 CSS pixels; this one is ${size.width} × ${size.height}.`,
        );
        await expect(page.locator(".shell")).toBeHidden();
        await expect(page.getByRole("main")).toHaveCount(1);
        // The keyboard runs no command while the notice stands in for the editor.
        await page.keyboard.press("Control+KeyK");
        await settle(page);
        await expect(palette(page)).toHaveCount(0);
    }

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(notice(page)).toHaveCount(0);
    await expect(page.locator(".shell")).toBeVisible();
    // The shell stayed mounted: the region the user hid is still hidden.
    await expect(region(page, BOTTOM)).toBeHidden();
    expect(errors).toEqual([]);
});

test("a crashed region shows one line and Reload while the other regions stay usable", async ({
    page,
}) => {
    const errors = uncaughtErrors(page);
    await openShell(page);
    const bottom = region(page, BOTTOM);
    await bottom.getByRole("button", { name: "Fail to render" }).click();
    const alert = bottom.getByRole("alert");
    await expect(alert).toContainText("Timeline failed to render.");
    await expect(bottom.getByRole("button", { name: "Frame 1" })).toHaveCount(0);

    // The rest of the editor works: the keymap, the viewport's content, the splitters, the
    // palette.
    await canvas(page).focus();
    await page.keyboard.press("J");
    await expect(
        page.getByRole("list", { name: "Commands run" }).getByRole("listitem").last(),
    ).toHaveText("canvas J");
    await tabTo(page, dockSplitter(page));
    await page.keyboard.press("ArrowLeft");
    expect((await boxOf(region(page, "dock"))).width).toBe(272);
    await openPalette(page);
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    // Radix returns the focus to the opener after the palette is gone; wait for it before the
    // next focus move, or it lands after that move.
    await settle(page);
    await expect(dockSplitter(page)).toBeFocused();
    // The bottom region's splitter still resizes it.
    await tabTo(page, bottomSplitter(page));
    await page.keyboard.press("ArrowUp");
    expect((await boxOf(bottom)).height).toBe(208);

    await alert.getByRole("button", { name: "Reload" }).click();
    await expect(bottom.getByRole("button", { name: "Frame 1" })).toBeVisible();
    await expect(bottom.getByRole("alert")).toHaveCount(0);
    expect(errors).toEqual([]);
});

for (const theme of THEMES) {
    for (const size of WINDOWS) {
        test(`${theme} at ${size.name}: no WCAG 2.1 AA violation, with and without a document`, async ({
            page,
        }) => {
            await openShell(page, size);
            await chooseDemoTheme(page, theme);
            const open = await audit(page);
            expect(open.violations).toEqual([]);
            expect(open.contrastUndecided).toEqual([]);
            expect(open.contrastChecked).toBeGreaterThan(0);

            await page.getByRole("button", { name: "Close document" }).click();
            await expect(page.getByRole("button", { name: "New document" })).toBeVisible();
            const empty = await audit(page);
            expect(empty.violations).toEqual([]);
            expect(empty.contrastUndecided).toEqual([]);
            expect(empty.contrastChecked).toBeGreaterThan(0);
        });
    }
}
