import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { audit, boxOf, THEMES, uncaughtErrors } from "./gallery-support.ts";
import { chooseDemoTheme, focus, openDemo, ran, settle, viewport } from "./surfaces-support.ts";

// The context bar (SPEC §1.3, §8, DESIGN §2, §4) on the demo editor: the active tool's name and
// its options in the tool's order, each in its control, changing the editor's store; its
// command buttons after the options, each running its command and disabled while the command
// is; the options and buttons that do not fit, from the last button back, in a trailing
// overflow menu; the readouts slot after them, the editor's variant choice among the readouts,
// never in that menu; a `*.contextbar.tsx` module's content in the options' place; the options
// of a tool registered at run time (the demo's probe tool); both themes with no WCAG 2.1 AA
// violation.

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

/**
 * The marquee's command buttons, in its order: three icon buttons, then three text buttons. At
 * 1280 px some fit and the rest move, whatever the font (select.tools.ts).
 */
const MARQUEE_ACTIONS = [
    "demo.select.all",
    "demo.select.deselect",
    "demo.select.invert",
    "demo.select.crop",
    "demo.select.fill",
    "demo.select.stroke",
];
const MARQUEE_OPTIONS = ["mode", "feather"];

const actionsIn = (scope: Locator) => scope.locator("[data-tool-action]");
const barActions = (page: Page) => bar(page).locator(".context-bar > .context-actions");
const action = (scope: Locator, command: string) =>
    scope.locator(`[data-tool-action="${command}"]`);
const actionIds = (scope: Locator) =>
    actionsIn(scope).evaluateAll((items) =>
        items.map((item) => item.getAttribute("data-tool-action") ?? ""),
    );

const optionKeys = (scope: ReturnType<typeof inBar>) =>
    scope.evaluateAll((items) => items.map((item) => item.getAttribute("data-tool-option") ?? ""));

async function selectAirbrush(page: Page) {
    await railButton(page, "airbrush").click();
    await expect(toolName(page)).toHaveText("Airbrush");
    await settle(page);
}

async function selectMarquee(page: Page) {
    await page
        .getByRole("radiogroup", { name: "Tool set" })
        .getByRole("radio", { name: "Select" })
        .click();
    await railButton(page, "marquee").click();
    await expect(toolName(page)).toHaveText("Rectangular marquee");
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

test("the copies the bar measures carry no option hook and nothing is inert: an editor's locators find each shown option once", async ({
    page,
}) => {
    const errors = uncaughtErrors(page);
    await selectAirbrush(page);
    const shown = await optionKeys(inBar(page));
    expect(shown.length).toBeLessThan(AIRBRUSH.length);
    // Every option hook in the bar is a shown option's, each once.
    expect(await optionKeys(bar(page).locator("[data-tool-option]"))).toEqual(shown);
    for (const key of shown) {
        await expect(bar(page).locator(`[data-tool-option="${key}"]`)).toHaveCount(1);
    }
    // Nothing on the page is inert while no modal layer is open (DESIGN §9).
    await expect(page.locator("[inert]")).toHaveCount(0);
    expect(errors).toEqual([]);
});

test("the copies the bar measures lie outside every region: each control in the bar is a shown one", async ({
    page,
}) => {
    const errors = uncaughtErrors(page);
    await selectAirbrush(page);
    expect((await optionKeys(inBar(page))).length).toBeLessThan(AIRBRUSH.length);
    await expect(page.locator(".context-bar__measure")).toHaveCount(1);
    await expect(page.locator("[data-region] .context-bar__measure")).toHaveCount(0);
    // An editor's query for the bar's controls finds no hidden copy.
    const hidden = await bar(page)
        .locator("button, input, [role='combobox']")
        .evaluateAll(
            (controls) =>
                controls.filter((control) => !control.checkVisibility({ visibilityProperty: true }))
                    .length,
        );
    expect(hidden).toBe(0);
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

test("a tool registered at run time shows its options while it is active", async ({ page }) => {
    const errors = uncaughtErrors(page);
    const toggle = page.getByRole("button", { name: "Probe tool" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await railButton(page, "probe").click();
    await expect(toolName(page)).toHaveText("Probe");
    expect(await optionKeys(inBar(page))).toEqual(["radius", "snap"]);

    const radius = bar(page).getByRole("spinbutton", { name: "Radius" });
    const snap = bar(page).getByRole("button", { name: "Snap to pixel" });
    await expect(radius).toHaveValue("4");
    await expect(snap).toHaveAttribute("aria-pressed", "true");
    await radius.fill("10");
    await page.keyboard.press("Enter");
    await expect(radius).toHaveValue("10");
    await snap.click();
    await expect(snap).toHaveAttribute("aria-pressed", "false");

    // Removed while active: the bar shows the pencil the demo selects again.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(toolName(page)).toHaveText("Pencil");
    expect(await optionKeys(inBar(page))).toEqual(["size", "pixelPerfect"]);
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

// --- Command buttons ------------------------------------------------------------------------

test("a tool's command buttons render after its options and before the readouts, the variant choice among the readouts", async ({
    page,
}) => {
    const errors = uncaughtErrors(page);
    await page.setViewportSize({ width: 1536, height: 864 });
    await selectMarquee(page);
    // At 1536 px everything fits: the options, then the buttons in the tool's order.
    expect(await optionKeys(inBar(page))).toEqual(MARQUEE_OPTIONS);
    expect(await actionIds(bar(page))).toEqual(MARQUEE_ACTIONS);
    await expect(trigger(page)).toHaveCount(0);
    // Icon buttons named by their label, text buttons showing it.
    await expect(actionsIn(bar(page))).toHaveText([
        "",
        "",
        "",
        "Crop to selection",
        "Fill selection",
        "Stroke selection",
    ]);
    await expect(action(bar(page), "demo.select.all")).toHaveAccessibleName("Select All");
    await expect(action(bar(page), "demo.select.deselect")).toHaveAccessibleName("Deselect");

    // Name, options, the buttons' group, the readouts: left to right, inside the bar.
    const lastOption = await boxOf(inBar(page).last());
    const group = await boxOf(barActions(page));
    const slot = await boxOf(readouts(page));
    expect(group.x).toBeCloseTo(lastOption.x + lastOption.width + 12, 0);
    expect(slot.x).toBeGreaterThan(group.x + group.width);
    const region = await boxOf(bar(page));
    expect(slot.x + slot.width).toBeLessThanOrEqual(region.x + region.width);

    // The editor's variant choice is in the readouts slot, and selects the slot's variant.
    const choice = readouts(page).locator('[data-tool-variant-choice="marquee"]');
    await expect(choice.getByRole("radio")).toHaveText(["Rectangle", "Ellipse"]);
    await expect(choice.getByRole("radio", { name: "Rectangle" })).toBeChecked();
    await choice.getByRole("radio", { name: "Ellipse" }).click();
    await expect(toolName(page)).toHaveText("Elliptical marquee");
    await expect(railButton(page, "marquee")).toHaveAttribute(
        "data-tool-variant",
        "ellipse-marquee",
    );
    expect(await actionIds(bar(page))).toEqual(MARQUEE_ACTIONS);
    await expect(
        readouts(page)
            .locator("[data-tool-variant-choice]")
            .getByRole("radio", { name: "Ellipse" }),
    ).toBeChecked();

    // A tool without buttons shows none.
    await railButton(page, "wand").click();
    await expect(toolName(page)).toHaveText("Magic wand");
    await expect(actionsIn(bar(page))).toHaveCount(0);
    await expect(barActions(page)).toHaveCount(0);
    expect(errors).toEqual([]);
});

test("at 1280 px the last command buttons move into the overflow menu first, before any option", async ({
    page,
}) => {
    const errors = uncaughtErrors(page);
    await selectMarquee(page);
    // Every option stays in the bar; the first buttons stay, the rest move, in order.
    expect(await optionKeys(inBar(page))).toEqual(MARQUEE_OPTIONS);
    const shown = await actionIds(bar(page));
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(MARQUEE_ACTIONS.length);
    expect(shown).toEqual(MARQUEE_ACTIONS.slice(0, shown.length));
    // The page has each shown button once: the measured copies carry no hook.
    await expect(page.locator("[data-tool-action]")).toHaveCount(shown.length);

    // The trigger after the buttons, the readouts after the trigger, all inside the bar.
    const group = await boxOf(barActions(page));
    const more = await boxOf(trigger(page));
    expect(more.x).toBeGreaterThan(group.x + group.width);
    expect((await boxOf(readouts(page))).x).toBeGreaterThan(more.x + more.width);
    const region = await boxOf(bar(page));
    expect(group.x + group.width).toBeLessThanOrEqual(region.x + region.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);

    // The menu holds the rest, the readouts none of them.
    await openOverflow(page);
    expect(await optionKeys(overflowMenu(page).locator("[data-tool-option]"))).toEqual([]);
    expect(await actionIds(overflowMenu(page))).toEqual(MARQUEE_ACTIONS.slice(shown.length));
    await expect(
        overflowMenu(page).locator("[data-tool-readout], [data-tool-variant-choice]"),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(overflowMenu(page)).toHaveCount(0);

    // Wider: every button fits; narrower again: the same fit.
    await page.setViewportSize({ width: 1536, height: 864 });
    await expect.poll(() => actionIds(bar(page))).toEqual(MARQUEE_ACTIONS);
    await expect(trigger(page)).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect.poll(() => actionIds(bar(page))).toEqual(shown);
    expect(await optionKeys(inBar(page))).toEqual(MARQUEE_OPTIONS);
    expect(errors).toEqual([]);
});

test("a command button runs its command and is disabled while its command is", async ({ page }) => {
    const errors = uncaughtErrors(page);
    await page.setViewportSize({ width: 1536, height: 864 });
    await selectMarquee(page);
    const enabled = () =>
        actionsIn(bar(page)).evaluateAll((items) =>
            items.map((item) => !(item as HTMLButtonElement).disabled),
        );
    const none = [true, false, false, false, false, false];
    const all = [true, true, true, true, true, true];

    // Nothing selected: only Select All is enabled.
    expect(await enabled()).toEqual(none);
    await expect(action(bar(page), "demo.select.crop")).toBeDisabled();

    // Each button runs its command; the others follow the state it leaves.
    const before = (await ran(page)).length;
    await action(bar(page), "demo.select.all").click();
    await expect.poll(enabled).toEqual(all);
    await action(bar(page), "demo.select.invert").click();
    await action(bar(page), "demo.select.fill").click();
    await action(bar(page), "demo.select.deselect").click();
    await expect.poll(enabled).toEqual(none);
    await expect
        .poll(async () => (await ran(page)).slice(before))
        .toEqual(["Select All", "Invert Selection", "Fill Selection", "Deselect"]);

    // A disabled button runs nothing.
    await action(bar(page), "demo.select.crop").click({ force: true });
    expect((await ran(page)).slice(before)).toHaveLength(4);

    // In the overflow menu too: the last button, disabled with its command, and run from there.
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect
        .poll(async () => (await actionIds(bar(page))).length)
        .toBeLessThan(MARQUEE_ACTIONS.length);
    await openOverflow(page);
    const stroke = action(overflowMenu(page), "demo.select.stroke");
    await expect(stroke).toBeDisabled();
    await page.keyboard.press("Escape");
    await action(bar(page), "demo.select.all").click();
    await expect(action(bar(page), "demo.select.deselect")).toBeEnabled();
    await openOverflow(page);
    await expect(stroke).toBeEnabled();
    await stroke.click();
    await expect.poll(async () => (await ran(page)).slice(-1)).toEqual(["Stroke Selection"]);
    expect(errors).toEqual([]);
});

for (const theme of THEMES) {
    test(`${theme}: the context bar with command buttons and its overflow menu pass axe`, async ({
        page,
    }) => {
        if (theme === "light") await chooseDemoTheme(page, "light");
        await selectMarquee(page);
        await action(bar(page), "demo.select.all").click();
        await expect(action(bar(page), "demo.select.deselect")).toBeEnabled();
        const closed = await audit(page, '[data-region="context-bar"]');
        expect(closed.violations).toEqual([]);
        expect(closed.contrastUndecided).toEqual([]);
        expect(closed.contrastChecked).toBeGreaterThan(0);

        await openOverflow(page);
        await expect(actionsIn(overflowMenu(page)).first()).toBeVisible();
        const open = await audit(page);
        expect(open.violations).toEqual([]);
        expect(open.contrastUndecided).toEqual([]);
    });
}
