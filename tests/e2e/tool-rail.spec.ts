import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { audit, boxOf, THEMES, uncaughtErrors, WINDOWS } from "./gallery-support.ts";
import {
    chooseDemoTheme,
    focus,
    nameField,
    openDemo,
    settle,
    viewport,
} from "./surfaces-support.ts";

// The tool rail (SPEC §8, DESIGN §2, §4, §9) on the demo editor: the `*.tools.ts` slots in the
// registry's groups with separators, planned slots disabled, the footer slot in the height the
// configuration reserves; one column, or two when one does not fit, never clipped; the editor's
// filter (the demo's tool set) choosing the slots shown; a key or a click selecting a tool, the
// focus going to the target the editor passes; the variants of a slot; the tooltip with name
// and key after 400 ms; a tool registered at run time (the demo's probe tool) joining and
// leaving the rail; both themes with no WCAG 2.1 AA violation.

const FOOTER_HEIGHT = 58;
const PAINT = ["pencil", "airbrush", "eraser", "fill", "eyedropper", "smudge"];
const SHAPES = ["line", "rectangle", "polygon", "curve"];
const TEXT = ["text", "note"];
const SELECT = ["marquee", "lasso", "wand", "move"];
const NAVIGATE = ["hand", "magnifier", "rotate", "ruler"];
const PLANNED = ["smudge", "curve", "note", "ruler"];

const rail = (page: Page) => page.locator('[data-region="tool-rail"]');
const slot = (page: Page, id: string) => rail(page).locator(`[data-tool="${id}"]`);
const contextTool = (page: Page) => page.locator('[data-region="context-bar"] [data-context-tool]');
const variantsMenu = (page: Page, id: string) =>
    page.locator(`[role="menu"][data-tool-variants="${id}"]`);
const variantItem = (page: Page, id: string, tool: string) =>
    variantsMenu(page, id).locator(`[data-variant="${tool}"]`);

/** The ids of the rail's slots, group by group. */
function railGroups(page: Page): Promise<string[][]> {
    return rail(page)
        .locator("[data-rail-group]")
        .evaluateAll((groups) =>
            groups.map((group) =>
                [...group.querySelectorAll("[data-tool]")].map(
                    (button) => button.getAttribute("data-tool") ?? "",
                ),
            ),
        );
}

async function chooseToolSet(page: Page, set: "Paint" | "Select" | "All") {
    const radio = page
        .getByRole("radiogroup", { name: "Tool set" })
        .getByRole("radio", { name: set });
    await radio.click();
    await expect(radio).toBeChecked();
    await settle(page);
}

/** The rail's slots and footer that lie outside it, outside the window or under another element. */
function clippedInRail(page: Page): Promise<string[]> {
    return rail(page).evaluate((element) => {
        const problems: string[] = [];
        const frame = element.getBoundingClientRect();
        const items = element.querySelectorAll<HTMLElement>("[data-tool], [data-rail-footer] > *");
        for (const item of items) {
            const name = item.getAttribute("data-tool") ?? item.getAttribute("aria-label") ?? "?";
            const box = item.getBoundingClientRect();
            const inside =
                box.left >= frame.left - 0.5 &&
                box.top >= frame.top - 0.5 &&
                box.right <= frame.right + 0.5 &&
                box.bottom <= frame.bottom + 0.5 &&
                box.bottom <= window.innerHeight;
            if (!inside) problems.push(`${name}: outside the rail`);
            const hit = document.elementFromPoint(
                box.left + box.width / 2,
                box.top + box.height / 2,
            );
            if (!hit || !item.contains(hit)) problems.push(`${name}: covered`);
        }
        return problems;
    });
}

/** Presses `target` and holds it until `opened` shows, then releases it where it is. */
async function holdUntil(page: Page, target: Locator, opened: Locator) {
    const box = await boxOf(target);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(opened).toBeVisible();
    await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openDemo(page);
});

test("the slots in the registry's groups with separators, planned slots disabled, the footer at its height", async ({
    page,
}) => {
    const errors = uncaughtErrors(page);
    // The demo starts with the Paint tool set: its groups and the navigation group.
    expect(await railGroups(page)).toEqual([PAINT, SHAPES, TEXT, NAVIGATE]);
    for (const id of [...PAINT, ...SHAPES, ...TEXT, ...NAVIGATE]) {
        if (PLANNED.includes(id)) await expect(slot(page, id), id).toBeDisabled();
        else await expect(slot(page, id), id).toBeEnabled();
    }
    // A separator before every group but the first: a 1 px line, 4 px above and below.
    const separators = await rail(page)
        .locator("[data-rail-group]")
        .evaluateAll((groups) =>
            groups.map((group) => {
                const line = getComputedStyle(group, "::before");
                return line.content === "none" ? null : `${line.height} ${line.marginTop}`;
            }),
        );
    expect(separators).toEqual([null, "1px 4px", "1px 4px", "1px 4px"]);

    // The selected tool, the pencil, is the one pressed button, and the context bar shows it.
    await expect(rail(page).locator('[aria-pressed="true"]')).toHaveCount(1);
    await expect(slot(page, "pencil")).toHaveAttribute("aria-pressed", "true");
    await expect(contextTool(page)).toHaveText("Pencil");

    // The footer: pinned to the bottom of the rail, inside its padding, in the reserved height.
    const frame = await boxOf(rail(page));
    const footer = await boxOf(rail(page).locator("[data-rail-footer]"));
    expect(footer.height).toBe(FOOTER_HEIGHT);
    expect(footer.y + footer.height).toBeCloseTo(frame.y + frame.height - 8, 0);
    await expect(rail(page).getByRole("button", { name: "Primary colour" })).toBeVisible();
    expect(await clippedInRail(page)).toEqual([]);
    expect(errors).toEqual([]);
});

for (const window of WINDOWS) {
    test(`${window.name}: one column while the slots fit, two when they do not, never clipped`, async ({
        page,
    }) => {
        await page.setViewportSize({ width: window.width, height: window.height });
        await chooseToolSet(page, "All");
        expect(await railGroups(page)).toEqual([SELECT, PAINT, SHAPES, TEXT, NAVIGATE]);
        // 20 slots in 5 groups and the footer take 718 px in one column: more than the rail's
        // 660 px at 720 px, less than its 804 px at 864 px.
        const two = window.height < 800;
        await expect(rail(page)).toHaveAttribute("data-columns", two ? "2" : "1");
        expect((await boxOf(rail(page))).width).toBe(two ? 72 : 44);
        expect(await clippedInRail(page)).toEqual([]);
        expect((await boxOf(rail(page).locator("[data-rail-footer]"))).height).toBe(FOOTER_HEIGHT);
        // Two columns: the footer's chips side by side.
        const chips = rail(page).locator("[data-rail-footer] > *");
        const first = await boxOf(chips.nth(0));
        const second = await boxOf(chips.nth(1));
        expect(second.y === first.y).toBe(two);
        // Nothing scrolls.
        const scrolls = await rail(page).evaluate(
            (element) => element.scrollHeight > element.clientHeight,
        );
        expect(scrolls).toBe(false);
    });
}

test("with a filter only the chosen slots show and the columns recompute; a new input updates the rail", async ({
    page,
}) => {
    await expect(rail(page)).toHaveAttribute("data-columns", "1");
    await chooseToolSet(page, "All");
    await expect(rail(page)).toHaveAttribute("data-columns", "2");
    await expect(rail(page).locator("[data-tool]")).toHaveCount(20);

    await chooseToolSet(page, "Select");
    expect(await railGroups(page)).toEqual([SELECT, NAVIGATE]);
    await expect(rail(page)).toHaveAttribute("data-columns", "1");
    expect((await boxOf(rail(page))).width).toBe(44);
    // The selected tool is outside the set: no slot is pressed; the context bar still shows it.
    await expect(rail(page).locator('[aria-pressed="true"]')).toHaveCount(0);
    await expect(contextTool(page)).toHaveText("Pencil");

    await chooseToolSet(page, "Paint");
    expect(await railGroups(page)).toEqual([PAINT, SHAPES, TEXT, NAVIGATE]);
    await expect(rail(page)).toHaveAttribute("data-columns", "1");
    await expect(slot(page, "pencil")).toHaveAttribute("aria-pressed", "true");
});

test("a key and a click select a tool; the pointer sends the focus to the editor's target, the keyboard keeps it", async ({
    page,
}) => {
    const errors = uncaughtErrors(page);
    await focus(viewport(page));
    await page.keyboard.press("KeyE");
    await expect(slot(page, "eraser")).toHaveAttribute("aria-pressed", "true");
    await expect(slot(page, "pencil")).toHaveAttribute("aria-pressed", "false");
    await expect(contextTool(page)).toHaveText("Eraser");

    await slot(page, "magnifier").click();
    await expect(slot(page, "magnifier")).toHaveAttribute("aria-pressed", "true");
    await expect(contextTool(page)).toHaveText("Magnifier");
    await expect(viewport(page)).toBeFocused();
    await page.keyboard.press("KeyH");
    await expect(slot(page, "hand")).toHaveAttribute("aria-pressed", "true");

    // A planned slot selects nothing.
    await slot(page, "ruler").click({ force: true });
    await expect(slot(page, "hand")).toHaveAttribute("aria-pressed", "true");

    // From the keyboard the focus stays on the button.
    await focus(slot(page, "line"));
    await page.keyboard.press("Enter");
    await expect(slot(page, "line")).toHaveAttribute("aria-pressed", "true");
    await settle(page);
    await expect(slot(page, "line")).toBeFocused();
    expect(errors).toEqual([]);
});

test("the focus goes to the target the editor passes", async ({ page }) => {
    await page.goto("./demo/?tool-focus=name");
    await expect(rail(page)).toBeVisible();
    await slot(page, "eraser").click();
    await expect(slot(page, "eraser")).toHaveAttribute("aria-pressed", "true");
    await expect(nameField(page)).toBeFocused();

    // A variant chosen from its menu with the pointer.
    await slot(page, "rectangle").click({ button: "right" });
    await variantItem(page, "rectangle", "ellipse").click();
    await expect(variantsMenu(page, "rectangle")).toHaveCount(0);
    await expect(slot(page, "rectangle")).toHaveAttribute("data-tool-variant", "ellipse");
    await expect(nameField(page)).toBeFocused();
});

test("a slot with variants shows the one the store names; holding it, a right click or the Menu key opens them", async ({
    page,
}) => {
    const errors = uncaughtErrors(page);
    const rectangle = slot(page, "rectangle");
    // The corner mark exactly on the slots with variants.
    for (const id of await rail(page)
        .locator("[data-tool]")
        .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-tool")!))) {
        await expect(slot(page, id).locator(".tool-rail__corner"), id).toHaveCount(
            id === "rectangle" ? 1 : 0,
        );
    }
    await expect(rectangle).toHaveAttribute("data-tool-variant", "rectangle");
    await expect(rectangle).toHaveAccessibleName("Rectangle");

    // The variant's key: the slot shows it, pressed.
    await focus(viewport(page));
    await page.keyboard.press("Shift+KeyU");
    await expect(rectangle).toHaveAttribute("data-tool-variant", "ellipse");
    await expect(rectangle).toHaveAccessibleName("Ellipse");
    await expect(rectangle).toHaveAttribute("aria-pressed", "true");
    await expect(contextTool(page)).toHaveText("Ellipse");

    // Another tool: the slot keeps showing the variant selected last, and a click selects it.
    await page.keyboard.press("KeyB");
    await expect(rectangle).toHaveAttribute("aria-pressed", "false");
    await expect(rectangle).toHaveAttribute("data-tool-variant", "ellipse");
    await rectangle.click();
    await expect(contextTool(page)).toHaveText("Ellipse");
    await expect(viewport(page)).toBeFocused();

    // Held: the menu opens, the shown variant checked, and the release selects nothing more.
    await holdUntil(page, rectangle, variantsMenu(page, "rectangle"));
    await expect(variantsMenu(page, "rectangle")).toBeVisible();
    await expect(variantItem(page, "rectangle", "ellipse")).toHaveAttribute("aria-checked", "true");
    await expect(variantItem(page, "rectangle", "rectangle")).toHaveText(/Rectangle\s*U/);
    await expect(variantItem(page, "rectangle", "ellipse")).toHaveText(/Ellipse\s*Shift\+U/);
    await settle(page);
    await variantItem(page, "rectangle", "rectangle").click();
    await expect(variantsMenu(page, "rectangle")).toHaveCount(0);
    await expect(rectangle).toHaveAttribute("data-tool-variant", "rectangle");
    await expect(contextTool(page)).toHaveText("Rectangle");
    await expect(viewport(page)).toBeFocused();

    // A right click opens it too; Escape closes it and selects nothing.
    await rectangle.click({ button: "right" });
    await expect(variantsMenu(page, "rectangle")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(variantsMenu(page, "rectangle")).toHaveCount(0);
    await expect(contextTool(page)).toHaveText("Rectangle");

    // From the keyboard: Shift+F10, then the Menu key; the focus comes back to the button.
    await focus(rectangle);
    await page.keyboard.press("Shift+F10");
    await expect(variantItem(page, "rectangle", "rectangle")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(variantItem(page, "rectangle", "ellipse")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(variantsMenu(page, "rectangle")).toHaveCount(0);
    await expect(contextTool(page)).toHaveText("Ellipse");
    await settle(page);
    await expect(rectangle).toBeFocused();
    await page.keyboard.press("ContextMenu");
    await expect(variantItem(page, "rectangle", "rectangle")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(contextTool(page)).toHaveText("Rectangle");
    await settle(page);
    await expect(rectangle).toBeFocused();
    expect(errors).toEqual([]);
});

test("a tool button's tooltip shows its name and key after 400 ms", async ({ page }) => {
    const tooltip = page.locator(".ui-tooltip");
    const button = slot(page, "airbrush");
    const box = await boxOf(button);
    // Timed in the page: when the pointer comes over the button, when the tooltip appears.
    await button.evaluate((element) => {
        const times: { hover?: number; shown?: number } = {};
        (window as unknown as { __tooltipTimes: typeof times }).__tooltipTimes = times;
        element.addEventListener("pointerover", (event) => (times.hover ??= event.timeStamp));
        new MutationObserver((_, observer) => {
            if (!document.querySelector(".ui-tooltip")) return;
            times.shown = performance.now();
            observer.disconnect();
        }).observe(document.body, { childList: true, subtree: true });
    });
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(tooltip).toBeVisible();
    const times = await page.evaluate(
        () =>
            (window as unknown as { __tooltipTimes: { hover?: number; shown?: number } })
                .__tooltipTimes,
    );
    expect(times.hover).toBeDefined();
    expect(times.shown! - times.hover!).toBeGreaterThanOrEqual(400);
    await expect(tooltip).toHaveText(/^Airbrush\s*A$/);
    // Away from the button and its tooltip, onto the canvas: the tooltip closes.
    await page.mouse.move(box.x + 600, box.y + 300, { steps: 4 });
    await expect(tooltip).toHaveCount(0);
});

test("a tool registered at run time shows in the rail with its key and tooltip, and the columns recompute", async ({
    page,
}) => {
    const errors = uncaughtErrors(page);
    // A rail 15 px taller than the 718 px the "All" set takes in one column: one more slot,
    // 30 px, does not fit. The rail is 60 px shorter than the window.
    await page.setViewportSize({ width: 1280, height: 718 + 15 + 60 });
    await chooseToolSet(page, "All");
    expect((await boxOf(rail(page))).height).toBe(733);
    await expect(rail(page)).toHaveAttribute("data-columns", "1");
    await expect(slot(page, "probe")).toHaveCount(0);

    const toggle = page.getByRole("button", { name: "Probe tool" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(await railGroups(page)).toEqual([SELECT, PAINT, SHAPES, [...TEXT, "probe"], NAVIGATE]);
    await expect(slot(page, "probe")).toBeEnabled();
    await expect(slot(page, "probe")).toHaveAccessibleName("Probe");
    await expect(rail(page)).toHaveAttribute("data-columns", "2");
    expect((await boxOf(rail(page))).width).toBe(72);
    expect(await clippedInRail(page)).toEqual([]);

    // Its tooltip has its name and key, and the key selects it.
    const box = await boxOf(slot(page, "probe"));
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator(".ui-tooltip")).toHaveText(/^Probe\s*K$/);
    await page.mouse.move(box.x + 600, box.y, { steps: 4 });
    await expect(page.locator(".ui-tooltip")).toHaveCount(0);
    await focus(viewport(page));
    await page.keyboard.press("KeyK");
    await expect(slot(page, "probe")).toHaveAttribute("aria-pressed", "true");
    await expect(contextTool(page)).toHaveText("Probe");

    // Removed: the slot goes, the rail takes one column again, and the pencil is selected.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(slot(page, "probe")).toHaveCount(0);
    expect(await railGroups(page)).toEqual([SELECT, PAINT, SHAPES, TEXT, NAVIGATE]);
    await expect(rail(page)).toHaveAttribute("data-columns", "1");
    await expect(slot(page, "pencil")).toHaveAttribute("aria-pressed", "true");
    // Its key is gone with it.
    await focus(viewport(page));
    await page.keyboard.press("KeyK");
    await expect(slot(page, "pencil")).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
});

for (const theme of THEMES) {
    test(`${theme}: the rail, in one column and two, and its variants menu pass axe`, async ({
        page,
    }) => {
        if (theme === "light") await chooseDemoTheme(page, "light");
        const one = await audit(page, '[data-region="tool-rail"]');
        expect(one.violations).toEqual([]);
        expect(one.contrastUndecided).toEqual([]);

        await chooseToolSet(page, "All");
        await expect(rail(page)).toHaveAttribute("data-columns", "2");
        const two = await audit(page, '[data-region="tool-rail"]');
        expect(two.violations).toEqual([]);
        expect(two.contrastUndecided).toEqual([]);

        await slot(page, "marquee").click({ button: "right" });
        await expect(variantsMenu(page, "marquee")).toBeVisible();
        await settle(page);
        const menu = await audit(page);
        expect(menu.violations).toEqual([]);
        expect(menu.contrastUndecided).toEqual([]);
        expect(menu.contrastChecked).toBeGreaterThan(0);
    });
}
