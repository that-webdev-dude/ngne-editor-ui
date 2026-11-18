import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

// The primitive entries of the gallery (SPEC §9.1, §12; DESIGN §4): every entry in both
// themes, at 1280×720 and at 125% browser zoom (DESIGN §9), with no WCAG 2.1 AA violation at
// rest or with a surface open; and their keyboard operation: number field arrows, slider,
// select typeahead, splitter arrows and double-click reset, dialog focus trap and Escape.

type Theme = "dark" | "light";
const THEMES: readonly Theme[] = ["dark", "light"];

/** The window sizes of DESIGN §9: the minimum window, and 1920 × 1080 at 125% browser zoom. */
const WINDOWS = [
    { name: "1280×720", width: 1280, height: 720 },
    // 125% zoom of a 1920 × 1080 window lays the page out in 1536 × 864 CSS pixels.
    { name: "1536×864 (125% of 1920×1080)", width: 1536, height: 864 },
] as const;

/** The primitive entries, in the gallery's order. */
const ENTRIES = [
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
] as const;

const entry = (page: Page, id: string) => page.locator(`section[data-entry="${id}"]`);
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const readout = (page: Page, name: string) => page.locator(`[data-readout="${name}"]`);

async function openGallery(page: Page) {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await expect(page.getByRole("heading", { name: "Interface gallery", level: 1 })).toBeVisible();
}

async function chooseTheme(page: Page, theme: Theme) {
    const radio = page.getByRole("radio", { name: theme === "dark" ? "Dark" : "Light" });
    await radio.check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

/** Focuses `target` from the keyboard: Tab onto it from the control before it. */
async function tabTo(page: Page, target: Locator) {
    await target.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(target).toBeFocused();
}

async function boxOf(locator: Locator) {
    const box = await locator.boundingBox();
    if (!box) throw new Error("The element has no box.");
    return box;
}

/** Lets Radix's deferred listeners (outside press) and focus moves run. */
async function settleTimers(page: Page) {
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
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
 * Runs axe (WCAG 2.1 A and AA) on the page, or on the subtree under `scope`, and returns the
 * violations together with what the contrast rule covered: nodes it judged, and nodes on
 * screen it could not decide on (those would hide a failure, so the tests accept none).
 */
async function audit(page: Page, scope?: string) {
    const builder = new AxeBuilder({ page }).withTags(AA_TAGS);
    const results = await (scope ? builder.include(scope) : builder).analyze();
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

interface Surface {
    name: string;
    /** Selector of the surface while it is open. */
    selector: string;
    open(): Promise<unknown>;
    /** Selector of a scrolling part: it is audited again scrolled to its end. */
    scroller?: string;
}

function surfaces(page: Page): Surface[] {
    return [
        {
            name: "tooltip",
            selector: ".ui-tooltip",
            // Keyboard focus opens it (a focus that is not visible does not).
            open: () => tabTo(page, button(page, "Hover or focus")),
        },
        {
            name: "select list",
            selector: ".ui-menu--select",
            open: () => entry(page, "select").getByRole("combobox", { name: "Ink" }).click(),
        },
        {
            name: "popover",
            selector: ".ui-popover",
            open: () => button(page, "Open popover").click(),
        },
        {
            name: "popover that applies on close",
            selector: ".ui-popover",
            open: () => button(page, "Edit opacity").click(),
        },
        {
            name: "context menu",
            selector: ".ui-menu",
            open: () => page.getByRole("group", { name: "Layer" }).click({ button: "right" }),
        },
        {
            name: "dialog",
            selector: ".ui-dialog--standard",
            open: () => button(page, "Open dialog").click(),
        },
        {
            name: "large dialog",
            selector: ".ui-dialog--large",
            open: () => button(page, "Open large dialog").click(),
            scroller: ".ui-dialog--large .ui-dialog__body",
        },
    ];
}

for (const theme of THEMES) {
    for (const window of WINDOWS) {
        test(`every primitive entry renders in the ${theme} theme at ${window.name} with no AA violation`, async ({
            page,
        }) => {
            // Many audits in one test.
            test.setTimeout(180_000);
            await page.setViewportSize({ width: window.width, height: window.height });
            await openGallery(page);
            await chooseTheme(page, theme);

            for (const id of ENTRIES) {
                await expect(entry(page, id), id).toHaveCount(1);
            }

            // Nothing scrolls sideways or reaches past the page's right edge.
            const overflow = await page.evaluate(() => {
                const gallery = document.querySelector(".gallery")!;
                const width = document.documentElement.clientWidth;
                const outside = [...document.querySelectorAll("section[data-entry] *")].filter(
                    (element) => element.getBoundingClientRect().right > width,
                );
                return {
                    page: document.documentElement.scrollWidth - width,
                    gallery: gallery.scrollWidth - gallery.clientWidth,
                    outside: outside.length,
                };
            });
            expect(overflow).toEqual({ page: 0, gallery: 0, outside: 0 });

            // Every entry at rest; the contrast rule must have judged the text.
            const rest = await audit(page);
            expect(rest.violations).toEqual([]);
            expect(rest.contrastUndecided).toEqual([]);
            expect(rest.contrastChecked).toBeGreaterThan(80);

            // Surfaces that exist only while open.
            for (const { name, selector, open, scroller } of surfaces(page)) {
                await open();
                await expect(page.locator(selector), name).toBeVisible();

                const whole = await audit(page);
                expect(whole.violations, name).toEqual([]);
                const own = await audit(page, selector);
                expect(own.violations, name).toEqual([]);
                expect(own.contrastUndecided, name).toEqual([]);
                expect(own.contrastChecked, name).toBeGreaterThan(0);

                if (scroller) {
                    await page
                        .locator(scroller)
                        .evaluate((element) => element.scrollTo(0, element.scrollHeight));
                    const scrolled = await audit(page, selector);
                    expect(scrolled.violations, `${name}, scrolled`).toEqual([]);
                    expect(scrolled.contrastUndecided, `${name}, scrolled`).toEqual([]);
                }

                await page.keyboard.press("Escape");
                await expect(page.locator(selector), name).toHaveCount(0);
            }
        });
    }
}

// --- Keyboard operation --------------------------------------------------------------------

test.describe("keyboard operation", () => {
    test.beforeEach(async ({ page }) => {
        await openGallery(page);
    });

    test("number field: arrows step by 1, Shift by 10, typed values apply on Enter", async ({
        page,
    }) => {
        const size = page.getByRole("spinbutton", { name: "Size" });
        await expect(size).toHaveValue("1");
        await expect(size).toHaveAttribute("aria-valuemin", "1");
        await expect(size).toHaveAttribute("aria-valuemax", "64");

        await tabTo(page, size);
        await page.keyboard.press("ArrowUp");
        await expect(size).toHaveValue("2");
        await page.keyboard.press("Shift+ArrowUp");
        await expect(size).toHaveValue("12");
        await page.keyboard.press("ArrowDown");
        await expect(size).toHaveValue("11");
        await page.keyboard.press("Shift+ArrowDown");
        await expect(size).toHaveValue("1");
        await page.keyboard.press("ArrowDown");
        await expect(size).toHaveValue("1");
        await expect(size).toHaveAttribute("aria-valuenow", "1");

        await page.keyboard.press("Control+A");
        await page.keyboard.type("40");
        await expect(size).toHaveAttribute("aria-valuenow", "1");
        await page.keyboard.press("Enter");
        await expect(size).toHaveAttribute("aria-valuenow", "40");

        await page.keyboard.press("Control+A");
        await page.keyboard.type("999");
        await page.keyboard.press("Enter");
        await expect(size).toHaveValue("64");

        // Escape drops what was typed; so does text that is not a number.
        await page.keyboard.press("Control+A");
        await page.keyboard.type("7");
        await page.keyboard.press("Escape");
        await expect(size).toHaveValue("64");
        await page.keyboard.press("Control+A");
        await page.keyboard.type("wide");
        await page.keyboard.press("Tab");
        await expect(size).toHaveValue("64");

        // The unit follows the value, muted, and is not part of it.
        const unit = entry(page, "number-field").locator(".ui-number__unit").first();
        await expect(unit).toHaveText("px");
        expect(await unit.evaluate((element) => getComputedStyle(element).color)).toBe(
            "rgb(154, 154, 162)",
        );
    });

    test("slider: arrow keys, Home and End move the thumb; the number field follows", async ({
        page,
    }) => {
        const thumb = page.getByRole("slider", { name: "Tolerance" });
        const field = page.getByRole("spinbutton", { name: "Tolerance" });
        await expect(thumb).toHaveAttribute("aria-valuenow", "32");
        await expect(field).toHaveValue("32");

        await tabTo(page, thumb);
        await page.keyboard.press("ArrowRight");
        await expect(thumb).toHaveAttribute("aria-valuenow", "33");
        await expect(field).toHaveValue("33");
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("ArrowLeft");
        await expect(field).toHaveValue("31");
        await page.keyboard.press("End");
        await expect(field).toHaveValue("255");
        await page.keyboard.press("Home");
        await expect(field).toHaveValue("0");

        // The adjacent number field drives the thumb as well.
        await page.keyboard.press("Tab");
        await expect(field).toBeFocused();
        await page.keyboard.press("Shift+ArrowUp");
        await expect(thumb).toHaveAttribute("aria-valuenow", "10");

        // DESIGN §4: 2 px track, 10 px thumb inside a 24 px hit area.
        const metrics = await thumb.evaluate((element) => {
            const dot = getComputedStyle(element, "::after");
            const track = element
                .closest(".ui-slider__root")
                ?.querySelector(".ui-slider__track")
                ?.getBoundingClientRect();
            const hit = element.getBoundingClientRect();
            return {
                hit: [hit.width, hit.height],
                dot: [dot.width, dot.height],
                track: track?.height,
            };
        });
        expect(metrics).toEqual({ hit: [24, 24], dot: ["10px", "10px"], track: 2 });
    });

    test("select: opens with Enter, arrows move, typeahead finds, Escape keeps the value", async ({
        page,
    }) => {
        const select = entry(page, "select").getByRole("combobox", { name: "Ink" });
        await expect(select).toHaveText("Simple");
        await tabTo(page, select);
        await page.keyboard.press("Enter");
        const list = page.getByRole("listbox");
        await expect(list).toBeVisible();
        await expect(list.getByRole("option")).toHaveText([
            "Simple",
            "Alpha compositing",
            "Lock alpha",
        ]);
        // The list is modal: the page behind it is inert, not only hidden from assistive tech.
        const behind = page.locator("#root");
        await expect(behind).toHaveAttribute("aria-hidden", "true");
        await expect(behind).toHaveAttribute("inert", "");
        // Radix moves the focus one timer after the key; Enter acts on the focused option.
        await expect(list.getByRole("option", { name: "Simple" })).toBeFocused();
        await page.keyboard.press("ArrowDown");
        await expect(list.getByRole("option", { name: "Alpha compositing" })).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(list).toBeHidden();
        await expect(behind).not.toHaveAttribute("aria-hidden");
        await expect(behind).not.toHaveAttribute("inert");
        await expect(select).toHaveText("Alpha compositing");
        await expect(select).toBeFocused();

        await page.keyboard.press("Space");
        await expect(list.getByRole("option", { name: "Alpha compositing" })).toBeFocused();
        await page.keyboard.press("ArrowDown");
        await expect(list.getByRole("option", { name: "Lock alpha" })).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(list).toBeHidden();
        await expect(select).toHaveText("Alpha compositing");
        // Radix returns the focus one timer after the list has gone; Enter needs it there.
        await expect(select).toBeFocused();

        // Typeahead comes from Radix.
        await page.keyboard.press("Enter");
        await expect(list.getByRole("option", { name: "Alpha compositing" })).toBeFocused();
        await page.keyboard.type("lock");
        await expect(list.getByRole("option", { name: "Lock alpha" })).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(list).toBeHidden();
        await expect(select).toHaveText("Lock alpha");
        await expect(readout(page, "ink")).toHaveText("Ink: lock");

        // Typeahead on the closed trigger chooses too.
        await expect(select).toBeFocused();
        await page.keyboard.type("s");
        await expect(select).toHaveText("Simple");
        await expect(readout(page, "ink")).toHaveText("Ink: simple");
    });

    test("splitter: arrows resize, Home and End reach the limits, Enter and double-click reset", async ({
        page,
    }) => {
        const splitter = entry(page, "splitter").getByRole("separator", { name: "Resize pane" });
        const width = readout(page, "split");
        await expect(splitter).toHaveAttribute("aria-orientation", "vertical");
        await expect(splitter).toHaveAttribute("aria-valuenow", "160");
        // 8 px hit area with a 1 px visible line.
        expect((await boxOf(splitter)).width).toBe(8);
        expect(
            await splitter.evaluate((element) => getComputedStyle(element, "::after").width),
        ).toBe("1px");

        await tabTo(page, splitter);
        await page.keyboard.press("ArrowRight");
        await expect(width).toHaveText("Width: 168");
        await page.keyboard.press("Shift+ArrowLeft");
        await expect(width).toHaveText("Width: 136");
        await page.keyboard.press("Home");
        await expect(width).toHaveText("Width: 80");
        await page.keyboard.press("End");
        await expect(width).toHaveText("Width: 320");
        await expect(splitter).toHaveAttribute("aria-valuenow", "320");
        await page.keyboard.press("Enter");
        await expect(width).toHaveText("Width: 160");

        // Drag, then double-click back to the default.
        const box = await boxOf(splitter);
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 20, y, { steps: 4 });
        await page.mouse.move(x + 40, y, { steps: 4 });
        await page.mouse.up();
        await expect(width).toHaveText("Width: 200");
        await splitter.dblclick();
        await expect(width).toHaveText("Width: 160");
    });

    test("dialog: opens from the keyboard, traps focus, closes on Escape and returns focus", async ({
        page,
    }) => {
        const opener = button(page, "Open dialog");
        await tabTo(page, opener);
        await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog", { name: "New document" });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole("heading", { name: "New document" })).toBeVisible();
        const first = dialog.getByRole("spinbutton", { name: "Width" });
        await expect(first).toBeFocused();

        // Standard size: at most 560 px wide, centred.
        const box = await boxOf(dialog);
        expect(box.width).toBe(560);
        expect(box.x).toBe((1280 - 560) / 2);
        expect(Math.abs(box.y + box.height / 2 - 360)).toBeLessThanOrEqual(1);

        // Focus starts inside and Tab never leaves the dialog, either way round.
        const inside = () => dialog.evaluate((element) => element.contains(document.activeElement));
        for (let presses = 0; presses < 9; presses++) {
            await page.keyboard.press("Tab");
            expect(await inside()).toBe(true);
        }
        for (let presses = 0; presses < 5; presses++) {
            await page.keyboard.press("Shift+Tab");
            expect(await inside()).toBe(true);
        }

        // The page behind is inert while the dialog is open.
        await expect(page.locator("#root")).toHaveAttribute("aria-hidden", "true");

        // Right-aligned actions, the primary one accent-filled.
        const create = dialog.getByRole("button", { name: "Create" });
        const createBox = await boxOf(create);
        expect(box.x + box.width - (createBox.x + createBox.width)).toBeLessThanOrEqual(17);
        expect(await create.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
            "rgb(131, 232, 225)",
        );

        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(opener).toBeFocused();

        // An action button closes it too, activated from the keyboard.
        await page.keyboard.press("Space");
        await expect(dialog).toBeVisible();
        await expect(first).toBeFocused();
        await create.focus();
        await page.keyboard.press("Enter");
        await expect(dialog).toBeHidden();
        await expect(opener).toBeFocused();
    });

    test("popover: opens from the keyboard, closes on Escape and on an outside click", async ({
        page,
    }) => {
        const opener = button(page, "Open popover");
        await tabTo(page, opener);
        await page.keyboard.press("Enter");
        const popover = page.getByRole("dialog", { name: "Onion skin" });
        await expect(popover).toBeVisible();
        const frames = popover.getByRole("spinbutton", { name: "Frames before" });
        await expect(frames).toBeFocused();
        await page.keyboard.press("ArrowUp");
        await expect(frames).toHaveValue("3");
        await page.keyboard.press("Escape");
        await expect(popover).toBeHidden();
        await expect(opener).toBeFocused();

        await page.keyboard.press("Space");
        await expect(popover).toBeVisible();
        await settleTimers(page);
        await page.mouse.click(1200, 700);
        await expect(popover).toBeHidden();
    });
});
