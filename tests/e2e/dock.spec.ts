import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { boxOf, uncaughtErrors, WINDOWS } from "./gallery-support.ts";
import { focus, settle } from "./surfaces-support.ts";

// The dock (SPEC §1.3, §8, DESIGN §2) on the demo editor: one section per `*.dock.tsx` module
// in registry order (History, then Properties); each collapses and expands from its header by
// pointer and keyboard; at 1280×720 the dock scrolls as one column with every header still
// clickable; Properties starts collapsed in a window lower than its named height (800 px).

const PANELS = ["history", "properties"];

const dock = (page: Page) => page.locator('[data-region="dock"]');
const scroller = (page: Page) => dock(page).locator(".shell-dock__scroll");
const section = (page: Page, id: string) => dock(page).locator(`[data-dock-panel="${id}"]`);
const toggle = (page: Page, id: string) => section(page, id).locator(".dock-section__toggle");
const body = (page: Page, id: string) => section(page, id).locator(".dock-section__body");

async function openDock(page: Page, size: { width: number; height: number }) {
    await page.setViewportSize(size);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./demo/");
    await expect(section(page, "history")).toBeVisible();
}

async function expectExpanded(page: Page, id: string, expanded: boolean) {
    await expect(toggle(page, id)).toHaveAttribute("aria-expanded", String(expanded));
    if (expanded) {
        await expect(body(page, id)).toBeVisible();
        await expect(body(page, id)).not.toBeEmpty();
    } else {
        await expect(body(page, id)).toBeHidden();
        // A collapsed section's panel is not mounted.
        await expect(body(page, id)).toBeEmpty();
    }
}

/** Whether a press at the centre of the header's toggle reaches it. */
function hitsToggle(page: Page, id: string): Promise<boolean> {
    return toggle(page, id).evaluate((element) => {
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return hit !== null && element.contains(hit);
    });
}

test("the sections follow the registry order, each with its header", async ({ page }) => {
    const errors = uncaughtErrors(page);
    await openDock(page, WINDOWS[1]);
    const ids = await dock(page)
        .locator("[data-dock-panel]")
        .evaluateAll((sections) => sections.map((each) => each.getAttribute("data-dock-panel")));
    expect(ids).toEqual(PANELS);
    await expect(dock(page).getByRole("heading", { level: 2 })).toHaveText([
        "History",
        "Properties3",
    ]);
    await expect(toggle(page, "history")).toHaveAccessibleName("History");
    await expect(toggle(page, "properties")).toHaveAccessibleName("Properties");
    // The toggle names the body it shows and hides.
    const controls = await toggle(page, "history").getAttribute("aria-controls");
    expect(await body(page, "history").getAttribute("id")).toBe(controls);
    // The header's extra content sits at its right end.
    const header = await boxOf(section(page, "properties").locator(".dock-section__header"));
    const extra = await boxOf(section(page, "properties").locator(".dock-section__extra"));
    expect(Math.round(header.x + header.width - (extra.x + extra.width))).toBe(12);
    expect(errors).toEqual([]);
});

test("a section collapses and expands by pointer and by keyboard", async ({ page }) => {
    await openDock(page, WINDOWS[1]);
    await expectExpanded(page, "history", true);

    await toggle(page, "history").click();
    await expectExpanded(page, "history", false);
    await toggle(page, "history").click();
    await expectExpanded(page, "history", true);

    await focus(toggle(page, "properties"));
    await page.keyboard.press("Enter");
    await expectExpanded(page, "properties", false);
    await page.keyboard.press("Space");
    await expectExpanded(page, "properties", true);
    await expect(toggle(page, "properties")).toBeFocused();
    // The headers are in the tab order; History's body holds no control.
    await focus(toggle(page, "history"));
    await page.keyboard.press("Tab");
    await expect(toggle(page, "properties")).toBeFocused();
});

test("at 1280×720 the dock scrolls as one column and every header stays clickable", async ({
    page,
}) => {
    await openDock(page, WINDOWS[0]);
    await expectExpanded(page, "history", true);
    // The History section alone is taller than the dock.
    const sizes = await scroller(page).evaluate((element) => ({
        scroll: element.scrollHeight,
        client: element.clientHeight,
        overflow: getComputedStyle(element).overflowY,
    }));
    expect(sizes.overflow).toBe("auto");
    expect(sizes.scroll).toBeGreaterThan(sizes.client);
    // The dock region itself does not scroll; its scroller does.
    expect(
        await dock(page).evaluate((element) => element.scrollHeight <= element.clientHeight),
    ).toBe(true);

    // The Properties header is below the dock's edge until the column scrolls.
    const area = await boxOf(scroller(page));
    expect((await boxOf(toggle(page, "properties"))).y).toBeGreaterThan(area.y + area.height);
    await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
    await page.mouse.wheel(0, 2000);
    await expect
        .poll(() => scroller(page).evaluate((element) => element.scrollTop))
        .toBe(sizes.scroll - sizes.client);
    const header = await boxOf(toggle(page, "properties"));
    expect(header.y).toBeGreaterThanOrEqual(area.y);
    expect(header.y + header.height).toBeLessThanOrEqual(area.y + area.height);
    expect(await hitsToggle(page, "properties")).toBe(true);
    await page.mouse.click(header.x + header.width / 2, header.y + header.height / 2);
    await expectExpanded(page, "properties", true);

    // Back at the top, the first header takes a press as well.
    await page.mouse.wheel(0, -4000);
    await expect.poll(() => scroller(page).evaluate((element) => element.scrollTop)).toBe(0);
    expect(await hitsToggle(page, "history")).toBe(true);
    const first = await boxOf(toggle(page, "history"));
    await page.mouse.click(first.x + first.width / 2, first.y + first.height / 2);
    await expectExpanded(page, "history", false);
    // With History collapsed the column fits.
    await expect
        .poll(() =>
            scroller(page).evaluate((element) => element.scrollHeight <= element.clientHeight),
        )
        .toBe(true);
});

test("a section starts collapsed under the height its editor names, and the user's choice holds", async ({
    page,
}) => {
    // 720 px is under the Properties section's 800 px.
    await openDock(page, WINDOWS[0]);
    await expectExpanded(page, "history", true);
    await expectExpanded(page, "properties", false);

    // 864 px is not: the default follows the window while the user has not chosen.
    await page.setViewportSize(WINDOWS[1]);
    await expectExpanded(page, "properties", true);
    await page.setViewportSize(WINDOWS[0]);
    await expectExpanded(page, "properties", false);

    // A section the user toggled keeps its state whatever the height.
    await toggle(page, "properties").click();
    await expectExpanded(page, "properties", true);
    await page.setViewportSize(WINDOWS[1]);
    await settle(page);
    await page.setViewportSize(WINDOWS[0]);
    await settle(page);
    await expectExpanded(page, "properties", true);

    await openDock(page, WINDOWS[1]);
    await expectExpanded(page, "history", true);
    await expectExpanded(page, "properties", true);
});
