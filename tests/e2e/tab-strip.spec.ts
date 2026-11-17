import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import {
    ACCENT,
    audit,
    boxOf,
    button,
    chooseTheme,
    entry,
    horizontalOverflow,
    openGallery,
    readout,
    tabTo,
    THEMES,
    uncaughtErrors,
    WINDOWS,
} from "./gallery-support.ts";

// The tab strip (SPEC §8, DESIGN §2, §9) on the gallery's Tab strip entry, whose fixture tab
// model does what an editor would with each callback and shows the last call the strip made:
// the metrics and the selected style, which keeps a tab's width; press, drag and middle click;
// the close control, shown on the selected tab and under the pointer, taking no press while
// hidden and hidden from assistive technology; one tab stop with ← → Home End, Enter, Space,
// Delete and Ctrl+Shift+← →; with 30 tabs at 1280 px the sideways scroll without a scroll bar,
// the wheel, the chevron menu with the selected tab checked, and the selected tab in view. The
// entry in both themes, at 1280×720 and at 125% browser zoom, with no WCAG 2.1 AA violation.

const START = ["alpha", "beta", "gamma", "delta"] as const;

const tabEntry = (page: Page) => entry(page, "tab-strip");
const strip = (page: Page) => tabEntry(page).locator("[data-tab-strip]");
const tabList = (page: Page) => tabEntry(page).getByRole("tablist", { name: "Documents" });
const tabs = (page: Page) => tabEntry(page).getByRole("tab");
const tabOf = (page: Page, id: string) => tabEntry(page).locator(`[data-tab="${id}"]`);
const closeOf = (page: Page, id: string) => tabOf(page, id).locator("[data-tab-close]");
const overflowButton = (page: Page) => tabEntry(page).locator("[data-tabs-overflow]");
const viewportTarget = (page: Page) => tabEntry(page).locator("[data-viewport-focus]");

const order = (page: Page) => readout(page, "tab-order");
const selected = (page: Page) => readout(page, "tab-active");
const lastCall = (page: Page) => readout(page, "tab-last-call");
const calls = (page: Page) => readout(page, "tab-calls");

async function openEntry(page: Page) {
    await openGallery(page);
    await tabEntry(page).scrollIntoViewIfNeeded();
    await expect(tabs(page)).toHaveCount(START.length);
}

/** The computed value of `property` for an element styled with `value` (a token). */
function tokenValue(page: Page, property: "color" | "backgroundColor", value: string) {
    return page.evaluate(
        ([name, token]) => {
            const probe = document.createElement("div");
            probe.style[name as "color"] = token!;
            document.body.append(probe);
            const result = getComputedStyle(probe)[name as "color"];
            probe.remove();
            return result;
        },
        [property, value] as const,
    );
}

/** Whether `inner` lies inside the visible box of `outer`, within a pixel. */
async function liesWithin(inner: Locator, outer: Locator): Promise<boolean> {
    const a = await boxOf(inner);
    const b = await boxOf(outer);
    return a.x >= b.x - 1 && a.x + a.width <= b.x + b.width + 1;
}

/** Drags `from` along the strip to the point `toX` on its row, past the drag threshold. */
async function drag(page: Page, from: Locator, toX: number) {
    const box = await boxOf(from);
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + (toX < box.x ? -10 : 10), y);
    await page.mouse.move(toX, y, { steps: 6 });
    await page.mouse.up();
}

test.describe("tab strip", () => {
    test("metrics: 28 px tabs at most 200 px wide, the close control in the right 24 px column, the leading label muted before the tabs", async ({
        page,
    }) => {
        const errors = uncaughtErrors(page);
        await openEntry(page);
        for (const id of START) {
            const box = await boxOf(tabOf(page, id));
            expect(box.height, id).toBe(28);
            expect(box.width, id).toBeLessThanOrEqual(200);
            const close = await boxOf(closeOf(page, id));
            expect(close.width, id).toBe(24);
            expect(close.height, id).toBe(24);
            expect(close.x + close.width, id).toBeCloseTo(box.x + box.width, 0);
        }
        // The unsaved marker follows the label.
        const beta = tabOf(page, "beta");
        const name = await boxOf(beta.locator(".tab-strip__name"));
        const marker = await boxOf(beta.locator("[data-tab-unsaved]"));
        expect(marker.x).toBeGreaterThanOrEqual(name.x + name.width);
        await expect(beta.locator("[data-tab-unsaved]")).toHaveCSS(
            "color",
            await tokenValue(page, "color", "var(--warn)"),
        );
        await expect(tabOf(page, "alpha").locator("[data-tab-unsaved]")).toHaveCount(0);
        // The leading label, in --text-muted, before the first tab.
        const leading = strip(page).locator("[data-tab-leading]");
        await expect(leading).toContainText("Fixture project");
        await expect(leading).toHaveCSS(
            "color",
            await tokenValue(page, "color", "var(--text-muted)"),
        );
        expect((await boxOf(leading)).x + (await boxOf(leading)).width).toBeLessThanOrEqual(
            (await boxOf(tabOf(page, "alpha"))).x,
        );
        // Four tabs fit: no chevron.
        await expect(overflowButton(page)).toHaveCount(0);
        expect(errors).toEqual([]);
    });

    test("the selected tab is --bg-active with --text and a 2 px accent line inside its bottom edge, in the others' weight", async ({
        page,
    }) => {
        await openEntry(page);
        await page.mouse.move(0, 0);
        const alpha = tabOf(page, "alpha");
        await expect(alpha).toHaveAttribute("aria-selected", "true");
        await expect(alpha).toHaveCSS(
            "background-color",
            await tokenValue(page, "backgroundColor", "var(--bg-active)"),
        );
        await expect(alpha).toHaveCSS("color", await tokenValue(page, "color", "var(--text)"));
        const theme = (await page.locator("html").getAttribute("data-theme")) as "dark" | "light";
        await expect(alpha).toHaveCSS("box-shadow", `${ACCENT[theme]} 0px -2px 0px 0px inset`);
        const weight = await alpha.evaluate((element) => getComputedStyle(element).fontWeight);
        for (const id of START.slice(1)) {
            await expect(tabOf(page, id)).toHaveAttribute("aria-selected", "false");
            await expect(tabOf(page, id)).toHaveCSS("font-weight", weight);
            await expect(tabOf(page, id)).toHaveCSS("box-shadow", "none");
        }
    });

    test("a press selects (activate), a drag moves (move with the new index), a middle click or the close control closes (close)", async ({
        page,
    }) => {
        const errors = uncaughtErrors(page);
        await openEntry(page);

        // A press on a background tab selects it; on the selected tab it asks for nothing.
        await tabOf(page, "beta").click();
        await expect(lastCall(page)).toHaveText("activate(beta)");
        await expect(calls(page)).toHaveText("1");
        await expect(tabOf(page, "beta")).toHaveAttribute("aria-selected", "true");
        await tabOf(page, "beta").click();
        await expect(calls(page)).toHaveText("1");

        // Drag delta (the last) before alpha (the first): selected by the press, moved to 0.
        await drag(page, tabOf(page, "delta"), (await boxOf(tabOf(page, "alpha"))).x + 4);
        await expect(order(page)).toHaveText("delta alpha beta gamma");
        await expect(lastCall(page)).toHaveText("move(delta, 0)");
        await expect(selected(page)).toHaveText("delta");
        await expect(tabs(page)).toHaveText([/^Delta/, /^Alpha/, /^Beta/, /^Gamma/]);

        // Drag alpha past the end of the strip: the last place.
        const list = await boxOf(tabList(page));
        await drag(page, tabOf(page, "alpha"), list.x + list.width + 80);
        await expect(order(page)).toHaveText("delta beta gamma alpha");
        await expect(lastCall(page)).toHaveText("move(alpha, 3)");

        // Drag gamma past the start of the strip: the first place.
        await drag(page, tabOf(page, "gamma"), list.x - 80);
        await expect(order(page)).toHaveText("gamma delta beta alpha");
        await expect(lastCall(page)).toHaveText("move(gamma, 0)");
        await expect(selected(page)).toHaveText("gamma");

        // A middle click closes a background tab; the selection stays.
        let count = Number(await calls(page).textContent());
        await tabOf(page, "beta").click({ button: "middle" });
        await expect(lastCall(page)).toHaveText("close(beta)");
        await expect(calls(page)).toHaveText(String(count + 1));
        await expect(order(page)).toHaveText("gamma delta alpha");
        await expect(selected(page)).toHaveText("gamma");

        // The close control of a background tab under the pointer closes it without selecting.
        count += 1;
        await tabOf(page, "alpha").hover();
        await closeOf(page, "alpha").click();
        await expect(lastCall(page)).toHaveText("close(alpha)");
        await expect(calls(page)).toHaveText(String(count + 1));
        await expect(order(page)).toHaveText("gamma delta");
        await expect(selected(page)).toHaveText("gamma");

        // The selected tab's close control.
        await closeOf(page, "gamma").click();
        await expect(lastCall(page)).toHaveText("close(gamma)");
        await expect(order(page)).toHaveText("delta");
        expect(errors).toEqual([]);
    });

    test("the close control shows on the selected tab and under the pointer, takes no press while hidden and has no accessible name", async ({
        page,
    }) => {
        await openEntry(page);
        await page.mouse.move(0, 0);

        // The selected tab's close control is shown and takes presses.
        await expect(closeOf(page, "alpha")).toHaveCSS("opacity", "1");
        await expect(closeOf(page, "alpha")).toHaveCSS("pointer-events", "auto");

        // A background tab's is hidden and takes no press: what lies under it is the tab.
        for (const id of ["beta", "gamma", "delta"]) {
            const close = closeOf(page, id);
            await expect(close, id).toHaveCSS("opacity", "0");
            await expect(close, id).toHaveCSS("pointer-events", "none");
            const box = await boxOf(close);
            const hit = await page.evaluate(
                ([x, y]) => {
                    const element = document.elementFromPoint(x!, y!);
                    return {
                        tab: element?.closest("[data-tab]")?.getAttribute("data-tab") ?? null,
                        close: !!element?.closest("[data-tab-close]"),
                    };
                },
                [box.x + box.width / 2, box.y + box.height / 2],
            );
            expect(hit, id).toEqual({ tab: id, close: false });
        }

        // Under the pointer it shows and takes presses.
        await tabOf(page, "gamma").hover();
        await expect(closeOf(page, "gamma")).toHaveCSS("opacity", "1");
        await expect(closeOf(page, "gamma")).toHaveCSS("pointer-events", "auto");

        // Hidden from assistive technology: no name, no role, nothing in the tree.
        for (const id of START) {
            const close = closeOf(page, id);
            await expect(close, id).toHaveAttribute("aria-hidden", "true");
            for (const attribute of ["aria-label", "aria-labelledby", "title", "role"]) {
                expect(await close.getAttribute(attribute), `${id} ${attribute}`).toBeNull();
            }
        }
        const tree = await tabList(page).ariaSnapshot();
        expect(tree).not.toMatch(/img|button|close/i);
        await expect(tabOf(page, "alpha")).toHaveAccessibleName("Alpha");
        await expect(tabOf(page, "beta")).toHaveAccessibleName(/^Beta\s*Unsaved changes$/);
        await expect(tabOf(page, "alpha")).toHaveAttribute(
            "aria-keyshortcuts",
            "Delete Control+Shift+ArrowLeft Control+Shift+ArrowRight",
        );
    });

    test("one tab stop: ← → Home End move the focus, Enter and Space select, Ctrl+Shift+← → move, Delete closes", async ({
        page,
    }) => {
        const errors = uncaughtErrors(page);
        await openEntry(page);
        const key = (name: string) => page.keyboard.press(name);

        // The selected tab is the tab stop.
        await tabTo(page, tabOf(page, "alpha"));
        await expect(tabOf(page, "alpha")).toHaveAttribute("tabindex", "0");
        for (const id of START.slice(1)) {
            await expect(tabOf(page, id)).toHaveAttribute("tabindex", "-1");
        }

        // The arrows move the focus, wrapping at the ends, and select nothing.
        await key("ArrowRight");
        await expect(tabOf(page, "beta")).toBeFocused();
        await key("ArrowLeft");
        await key("ArrowLeft");
        await expect(tabOf(page, "delta")).toBeFocused();
        await key("ArrowRight");
        await expect(tabOf(page, "alpha")).toBeFocused();
        await key("End");
        await expect(tabOf(page, "delta")).toBeFocused();
        await key("Home");
        await expect(tabOf(page, "alpha")).toBeFocused();
        await expect(calls(page)).toHaveText("0");

        // Enter and Space select the focused tab, which keeps the focus and its width.
        await key("End");
        const width = (await boxOf(tabOf(page, "delta"))).width;
        await key("Enter");
        await expect(lastCall(page)).toHaveText("activate(delta)");
        await expect(tabOf(page, "delta")).toHaveAttribute("aria-selected", "true");
        await expect(tabOf(page, "delta")).toBeFocused();
        expect((await boxOf(tabOf(page, "delta"))).width).toBe(width);
        await key("ArrowLeft");
        await key("Space");
        await expect(lastCall(page)).toHaveText("activate(gamma)");
        await expect(tabOf(page, "gamma")).toBeFocused();
        await expect(calls(page)).toHaveText("2");

        // Ctrl+Shift+→ moves the focused tab one place; it keeps the focus. Not past the end.
        await key("Control+Shift+ArrowRight");
        await expect(lastCall(page)).toHaveText("move(gamma, 3)");
        await expect(order(page)).toHaveText("alpha beta delta gamma");
        await expect(tabOf(page, "gamma")).toBeFocused();
        await key("Control+Shift+ArrowRight");
        await expect(tabOf(page, "gamma")).toBeFocused();
        await expect(calls(page)).toHaveText("3");
        await expect(order(page)).toHaveText("alpha beta delta gamma");

        // Ctrl+Shift+← not past the start; then the first tab one place to the right.
        await key("Home");
        await key("Control+Shift+ArrowLeft");
        await expect(tabOf(page, "alpha")).toBeFocused();
        await expect(calls(page)).toHaveText("3");
        await key("Control+Shift+ArrowRight");
        await expect(lastCall(page)).toHaveText("move(alpha, 1)");
        await expect(order(page)).toHaveText("beta alpha delta gamma");
        await expect(tabOf(page, "alpha")).toBeFocused();
        await key("Control+Shift+ArrowLeft");
        await expect(lastCall(page)).toHaveText("move(alpha, 0)");
        await expect(order(page)).toHaveText("alpha beta delta gamma");
        await expect(tabOf(page, "alpha")).toBeFocused();

        // Delete closes the focused tab; the focus goes to the tab now in its place.
        await key("ArrowRight");
        await expect(tabOf(page, "beta")).toBeFocused();
        await key("Delete");
        await expect(lastCall(page)).toHaveText("close(beta)");
        await expect(order(page)).toHaveText("alpha delta gamma");
        await expect(tabOf(page, "delta")).toBeFocused();
        await expect(selected(page)).toHaveText("gamma");

        // The last tab, selected: the editor selects its neighbour, the focus goes before it.
        await key("End");
        await key("Delete");
        await expect(lastCall(page)).toHaveText("close(gamma)");
        await expect(order(page)).toHaveText("alpha delta");
        await expect(tabOf(page, "delta")).toBeFocused();
        await expect(selected(page)).toHaveText("delta");
        await key("Delete");
        await expect(tabOf(page, "alpha")).toBeFocused();

        // No tab left: the focus goes to the viewport target; the leading label stays.
        await key("Delete");
        await expect(lastCall(page)).toHaveText("close(alpha)");
        await expect(order(page)).toHaveText("none");
        await expect(tabList(page)).toHaveCount(0);
        await expect(viewportTarget(page)).toBeFocused();
        await expect(strip(page).locator("[data-tab-leading]")).toBeVisible();
        expect(errors).toEqual([]);
    });

    test("30 tabs at 1280 px: the strip scrolls sideways without a scroll bar, the wheel scrolls it, the chevron menu lists every tab with the selected one checked, and the selected tab stays in view", async ({
        page,
    }) => {
        const errors = uncaughtErrors(page);
        await page.setViewportSize({ width: 1280, height: 720 });
        await openEntry(page);
        await button(tabEntry(page), "Open 30 tabs").click();
        await expect(tabs(page)).toHaveCount(30);
        const ids = Array.from({ length: 30 }, (_, index) => `document-${index + 1}`);

        // Tabs shrink to 96 px, then the list scrolls, with no scroll bar, and the chevron shows.
        for (const id of ids) {
            expect((await boxOf(tabOf(page, id))).width, id).toBeGreaterThanOrEqual(96);
        }
        await expect(overflowButton(page)).toBeVisible();
        await expect(overflowButton(page)).toHaveAccessibleName("All documents");
        const list = await tabList(page).evaluate((element: HTMLElement) => ({
            scroll: element.scrollWidth,
            client: element.clientWidth,
            scrollBar: element.offsetHeight - element.clientHeight,
            scrollbarWidth: getComputedStyle(element).scrollbarWidth,
        }));
        expect(list.scroll).toBeGreaterThan(list.client);
        expect(list.scrollBar).toBe(0);
        expect(list.scrollbarWidth).toBe("none");
        // The strip stays inside its bar, the chevron after the tabs.
        const bar = await boxOf(tabEntry(page).locator(".gallery-tabs__bar"));
        const stripBox = await boxOf(strip(page));
        expect(stripBox.x).toBeGreaterThanOrEqual(bar.x);
        expect(stripBox.x + stripBox.width).toBeLessThanOrEqual(bar.x + bar.width);
        const chevron = await boxOf(overflowButton(page));
        const listBox = await boxOf(tabList(page));
        expect(chevron.x).toBeGreaterThanOrEqual(listBox.x + listBox.width);

        // The selected tab, the last, is in view.
        await expect(selected(page)).toHaveText("document-30");
        expect(await liesWithin(tabOf(page, "document-30"), tabList(page))).toBe(true);

        // A vertical wheel over the strip scrolls it sideways and leaves the page where it is.
        const gallery = page.locator(".gallery");
        const pageTop = await gallery.evaluate((element) => element.scrollTop);
        const before = await tabList(page).evaluate((element) => element.scrollLeft);
        await page.mouse.move(listBox.x + listBox.width / 2, listBox.y + listBox.height / 2);
        await page.mouse.wheel(0, -400);
        await expect
            .poll(() => tabList(page).evaluate((element) => element.scrollLeft))
            .toBeLessThan(before);
        expect(await gallery.evaluate((element) => element.scrollTop)).toBe(pageTop);
        await page.mouse.move(0, 0);

        // The chevron menu: every tab, the selected one checked.
        await overflowButton(page).click();
        const menu = page.getByRole("menu", { name: "All documents" });
        await expect(menu).toBeVisible();
        await expect(menu.getByRole("menuitemradio")).toHaveCount(30);
        const checked = menu.getByRole("menuitemradio", { checked: true });
        await expect(checked).toHaveCount(1);
        await expect(checked).toHaveAccessibleName("Document 30");
        await expect(checked.locator(".ui-menu__indicator svg")).toBeVisible();
        await expect(menu.getByRole("menuitemradio", { name: /^Document 4/ })).toContainText(
            "Unsaved changes",
        );

        // Choosing the first tab selects it and brings it into view.
        await menu.getByRole("menuitemradio", { name: "Document 1", exact: true }).click();
        await expect(menu).toHaveCount(0);
        await expect(lastCall(page)).toHaveText("activate(document-1)");
        await expect(overflowButton(page)).toBeFocused();
        await expect(tabOf(page, "document-1")).toHaveAttribute("aria-selected", "true");
        expect(await liesWithin(tabOf(page, "document-1"), tabList(page))).toBe(true);
        expect(await liesWithin(tabOf(page, "document-30"), tabList(page))).toBe(false);

        // From the keyboard: End reaches the last tab and brings it into view; Enter selects.
        await tabTo(page, tabOf(page, "document-1"));
        await page.keyboard.press("End");
        await expect(tabOf(page, "document-30")).toBeFocused();
        expect(await liesWithin(tabOf(page, "document-30"), tabList(page))).toBe(true);
        await page.keyboard.press("Enter");
        await expect(lastCall(page)).toHaveText("activate(document-30)");

        // The menu from the keyboard, its selected item checked; Escape gives the focus back.
        await tabTo(page, overflowButton(page));
        await page.keyboard.press("Enter");
        await expect(menu).toBeVisible();
        // Radix moves the focus into the menu after it opens.
        await expect(menu.getByRole("menuitemradio").first()).toBeFocused();
        await expect(menu.getByRole("menuitemradio", { checked: true })).toHaveAccessibleName(
            "Document 30",
        );
        await page.keyboard.press("Escape");
        await expect(menu).toHaveCount(0);
        await expect(overflowButton(page)).toBeFocused();

        // A tab added at the end is selected and in view.
        await tabTo(page, tabOf(page, "document-30"));
        await page.keyboard.press("Home");
        await expect(tabOf(page, "document-1")).toBeFocused();
        await button(tabEntry(page), "Add tab").click();
        await expect(tabs(page)).toHaveCount(31);
        await expect(tabOf(page, "added-1")).toHaveAttribute("aria-selected", "true");
        expect(await liesWithin(tabOf(page, "added-1"), tabList(page))).toBe(true);
        expect(errors).toEqual([]);
    });
});

for (const theme of THEMES) {
    for (const window of WINDOWS) {
        test(`the Tab strip entry in the ${theme} theme at ${window.name} passes axe, with 4 and with 30 tabs`, async ({
            page,
        }) => {
            await page.setViewportSize({ width: window.width, height: window.height });
            await openEntry(page);
            await chooseTheme(page, theme);
            const section = tabEntry(page);
            await section.scrollIntoViewIfNeeded();
            await expect(
                section.getByRole("heading", { name: "Tab strip", level: 2 }),
            ).toBeVisible();
            const scope = 'section[data-entry="tab-strip"]';

            expect(await horizontalOverflow(page)).toEqual({ page: 0, gallery: 0, outside: 0 });
            const rest = await audit(page, scope);
            expect(rest.violations).toEqual([]);
            expect(rest.contrastUndecided).toEqual([]);
            expect(rest.contrastChecked).toBeGreaterThan(0);

            await button(section, "Open 30 tabs").click();
            await expect(overflowButton(page)).toBeVisible();
            expect(await horizontalOverflow(page)).toEqual({ page: 0, gallery: 0, outside: 0 });
            const many = await audit(page, scope);
            expect(many.violations).toEqual([]);
            expect(many.contrastUndecided).toEqual([]);

            await overflowButton(page).click();
            const menu = page.getByRole("menu", { name: "All documents" });
            await expect(menu).toBeVisible();
            const open = await audit(page, '[role="menu"]');
            expect(open.violations).toEqual([]);
            expect(open.contrastUndecided).toEqual([]);
        });
    }
}
