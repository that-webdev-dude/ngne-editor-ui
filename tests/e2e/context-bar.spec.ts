import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { audit, boxOf, THEMES, uncaughtErrors } from "./gallery-support.ts";
import { chooseDemoTheme, focus, openDemo, settle, viewport } from "./surfaces-support.ts";

// The context bar (SPEC §1.3, §8, DESIGN §2, §4) on the demo editor: the active tool's name and
// its options in the tool's order, each in its control, changing the editor's store; the
// options that do not fit, from the last one back, in a trailing overflow menu; the readouts
// slot after them, never in that menu; a `*.contextbar.tsx` module's content in the options'
// place; both themes with no WCAG 2.1 AA violation.

const AIRBRUSH = [
    "size",
    "flow",
    "spacing",
    "shape",
    "blend",
    "pressure",
    "jitter",
    "pixelPerfect",
];

const bar = (page: Page) => page.locator('[data-region="context-bar"]');
const toolName = (page: Page) => bar(page).locator("[data-context-tool]");
const inBar = (page: Page) => bar(page).locator(".context-bar > [data-tool-option]");
const trigger = (page: Page) => bar(page).getByRole("button", { name: "More options" });
const overflowMenu = (page: Page) => page.getByRole("dialog", { name: "More options" });
const readouts = (page: Page) => bar(page).locator("[data-context-readouts]");
const railButton = (page: Page, id: string) =>
    page.locator(`[data-region="tool-rail"] [data-tool="${id}"]`);

const optionKeys = (scope: ReturnType<typeof inBar>) =>
    scope.evaluateAll((items) => items.map((item) => item.getAttribute("data-tool-option") ?? ""));

async function selectAirbrush(page: Page) {
    await railButton(page, "airbrush").click();
    await expect(toolName(page)).toHaveText("Airbrush");
    await settle(page);
}

async function openOverflow(page: Page) {
    await trigger(page).click();
    await expect(overflowMenu(page)).toBeVisible();
    await settle(page);
}

test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openDemo(page);
});

test("the active tool's options render in its order, each in its control, and change the store", async ({
    page,
}) => {
    const errors = uncaughtErrors(page);
    await page.setViewportSize({ width: 1536, height: 864 });
    await selectAirbrush(page);
    // At 1536 px every option fits: no overflow menu.
    expect(await optionKeys(inBar(page))).toEqual(AIRBRUSH);
    await expect(trigger(page)).toHaveCount(0);

    const size = bar(page).getByRole("spinbutton", { name: "Size" });
    const square = bar(page).getByRole("radio", { name: "Square" });
    const pressure = bar(page).getByRole("button", { name: "Pressure" });
    const blend = bar(page).getByRole("combobox", { name: "Blend" });
    await expect(size).toHaveValue("8");
    await expect(bar(page).getByRole("radio", { name: "Round" })).toBeChecked();
    await expect(pressure).toHaveAttribute("aria-pressed", "false");
    await expect(blend).toHaveText("Normal");

    await size.fill("20");
    await page.keyboard.press("Enter");
    await expect(size).toHaveValue("20");
    await square.click();
    await expect(square).toBeChecked();
    await pressure.click();
    await expect(pressure).toHaveAttribute("aria-pressed", "true");
    await blend.click();
    await page.getByRole("option", { name: "Multiply" }).click();
    await expect(blend).toHaveText("Multiply");

    // The store keeps them: another tool, then the airbrush again.
    await focus(viewport(page));
    await page.keyboard.press("KeyB");
    await expect(toolName(page)).toHaveText("Pencil");
    expect(await optionKeys(inBar(page))).toEqual(["size", "pixelPerfect"]);
    await expect(bar(page).getByRole("spinbutton", { name: "Size" })).toHaveValue("1");
    await page.keyboard.press("KeyA");
    await expect(toolName(page)).toHaveText("Airbrush");
    await expect(size).toHaveValue("20");
    await expect(square).toBeChecked();
    await expect(pressure).toHaveAttribute("aria-pressed", "true");
    await expect(blend).toHaveText("Multiply");
    expect(errors).toEqual([]);
});

test("options that do not fit at 1280 px move, from the last back, into the overflow menu", async ({
    page,
}) => {
    const errors = uncaughtErrors(page);
    await selectAirbrush(page);
    const shown = await optionKeys(inBar(page));
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(AIRBRUSH.length);
    expect(shown).toEqual(AIRBRUSH.slice(0, shown.length));

    // Everything in the bar lies inside it, in order, the trigger after the last option.
    const region = await boxOf(bar(page));
    const items = bar(page).locator(
        ".context-bar > [data-context-tool], .context-bar > [data-tool-option], .context-bar > button, .context-bar > [data-context-readouts]",
    );
    let right = region.x;
    for (const item of await items.all()) {
        const box = await boxOf(item);
        expect(box.x).toBeGreaterThanOrEqual(right);
        expect(box.x + box.width).toBeLessThanOrEqual(region.x + region.width - 12 + 0.5);
        right = box.x + box.width;
    }
    const lastOption = await boxOf(inBar(page).last());
    expect((await boxOf(trigger(page))).x).toBeGreaterThan(lastOption.x + lastOption.width);
    // The page does not scroll sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);

    // The menu holds the rest, in order, and they change the store as in the bar.
    await openOverflow(page);
    const rest = overflowMenu(page).locator("[data-tool-option]");
    expect(await optionKeys(rest)).toEqual(AIRBRUSH.slice(shown.length));
    const perfect = overflowMenu(page).getByRole("button", { name: "Pixel perfect" });
    await expect(perfect).toHaveAttribute("aria-pressed", "true");
    await perfect.click();
    await expect(perfect).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Escape");
    await expect(overflowMenu(page)).toHaveCount(0);
    await openOverflow(page);
    await expect(overflowMenu(page).getByRole("button", { name: "Pixel perfect" })).toHaveAttribute(
        "aria-pressed",
        "false",
    );
    await page.keyboard.press("Escape");

    // A wider window: more options fit, and fewer move.
    await page.setViewportSize({ width: 1536, height: 864 });
    await expect.poll(async () => (await optionKeys(inBar(page))).length).toBe(AIRBRUSH.length);
    await expect(trigger(page)).toHaveCount(0);
    // Narrower again: back to the same fit.
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect.poll(() => optionKeys(inBar(page))).toEqual(shown);
    expect(errors).toEqual([]);
});

test("the readouts slot renders after the options and stays out of the overflow menu", async ({
    page,
}) => {
    await selectAirbrush(page);
    await expect(readouts(page)).toHaveText("Canvas64 × 64");
    const slot = await boxOf(readouts(page));
    expect(slot.x).toBeGreaterThan((await boxOf(trigger(page))).x);
    const region = await boxOf(bar(page));
    expect(slot.x + slot.width).toBeLessThanOrEqual(region.x + region.width);
    await openOverflow(page);
    await expect(overflowMenu(page).locator("[data-tool-readout]")).toHaveCount(0);
    await page.keyboard.press("Escape");

    // A tool whose options all fit: the readouts right after them.
    await railButton(page, "pencil").click();
    await expect(toolName(page)).toHaveText("Pencil");
    await expect(trigger(page)).toHaveCount(0);
    const last = await boxOf(inBar(page).last());
    expect((await boxOf(readouts(page))).x).toBeCloseTo(last.x + last.width + 12, 0);
});

test("a context-bar module's content replaces the options while it is shown", async ({ page }) => {
    const errors = uncaughtErrors(page);
    await selectAirbrush(page);
    const floating = page.getByRole("button", { name: "Floating selection" });
    await floating.click();
    await expect(bar(page).locator('[data-context-content="floating"]')).toBeVisible();
    await expect(toolName(page)).toHaveText("Airbrush");
    await expect(bar(page).getByRole("spinbutton", { name: "Offset X" })).toBeVisible();
    await expect(bar(page).locator("[data-tool-option]")).toHaveCount(0);
    await expect(trigger(page)).toHaveCount(0);
    await expect(readouts(page)).toHaveCount(0);

    await floating.click();
    await expect(bar(page).locator("[data-context-content]")).toHaveCount(0);
    await expect(inBar(page).first()).toHaveAttribute("data-tool-option", "size");
    await expect(readouts(page)).toBeVisible();
    expect(errors).toEqual([]);
});

for (const theme of THEMES) {
    test(`${theme}: the context bar and its overflow menu pass axe`, async ({ page }) => {
        if (theme === "light") await chooseDemoTheme(page, "light");
        await selectAirbrush(page);
        const closed = await audit(page, '[data-region="context-bar"]');
        expect(closed.violations).toEqual([]);
        expect(closed.contrastUndecided).toEqual([]);
        expect(closed.contrastChecked).toBeGreaterThan(0);

        await openOverflow(page);
        const open = await audit(page);
        expect(open.violations).toEqual([]);
        expect(open.contrastUndecided).toEqual([]);
    });
}
