import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { audit, boxOf, THEMES, uncaughtErrors } from "./gallery-support.ts";
import {
    chooseDemoTheme,
    expectEditorUsable,
    focus,
    openDemo,
    palette,
    paletteInput,
    ran,
    settle,
} from "./surfaces-support.ts";

// The menu bar (SPEC §8, DESIGN §2, §4, §8) on the demo editor: its menus in the order of the
// configuration's `menus`, each generated from the instance's command registry (Radix
// Menubar), chords right-aligned and muted, disabled items visible and inert; the keyboard
// moves through menus and items and Escape closes them; the `menuCentre` slot sits between the
// menus and the command palette trigger, which opens the palette; both themes pass axe.

const menuBar = (page: Page) => page.getByRole("menubar", { name: "Main menu" });
const menuTrigger = (page: Page, name: string) =>
    menuBar(page).getByRole("menuitem", { name, exact: true });
const openMenu = (page: Page) => page.getByRole("menu");
const menuItem = (page: Page, name: string) =>
    openMenu(page).getByRole("menuitem", { name: new RegExp(`^${escape(name)}`) });
const centre = (page: Page) => page.locator(".shell-menubar__centre");
const shellTrigger = (page: Page) =>
    page.locator("header.shell-menubar").getByRole("button", { name: "Commands" });

function escape(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Opens a menu of the menu bar with the pointer and waits for its items. */
async function openByPointer(page: Page, name: string) {
    await menuTrigger(page, name).click();
    await expect(openMenu(page)).toBeVisible();
}

/** The open menu's entries: each item's text, "—" for a separator. */
function entries(page: Page): Promise<string[]> {
    return openMenu(page).evaluate((menu) =>
        Array.from(
            menu.querySelectorAll<HTMLElement>('[role="menuitem"], [role="separator"]'),
            (node) => (node.getAttribute("role") === "separator" ? "—" : (node.textContent ?? "")),
        ),
    );
}

test.beforeEach(async ({ page }) => {
    await openDemo(page);
});

test("the menus follow the configuration's order, each generated from the registry", async ({
    page,
}) => {
    const errors = uncaughtErrors(page);
    await expect(menuBar(page).getByRole("menuitem")).toHaveText(["File", "Edit", "View", "Help"]);

    const expected: Record<string, string[]> = {
        // Orders in different hundreds are separated by a line.
        File: ["New DocumentCtrl+Alt+N", "—", "Close Document"],
        Edit: ["UndoCtrl+Z", "—", "Command Palette…Ctrl+K", "Preferences…"],
        // Open Source Licences… last, in a group of its own (SPEC §11).
        View: ["Zoom InCtrl+=", "Fit to Window", "—", "Open Source Licences…"],
        // Keyboard Shortcuts… first; an editor's items after it, in a group of their own;
        // About last, in a group of its own (SPEC §11).
        Help: ["Keyboard Shortcuts…?", "—", "Release Notes", "—", "About NGNE Demo Editor…"],
    };
    for (const [menu, items] of Object.entries(expected)) {
        await openByPointer(page, menu);
        await expect(menuTrigger(page, menu)).toHaveAttribute("data-state", "open");
        expect(await entries(page), menu).toEqual(items);
        await page.keyboard.press("Escape");
        await expect(openMenu(page)).toHaveCount(0);
    }
    expect(errors).toEqual([]);
});

test("chords are right-aligned and muted; disabled items are shown and inert", async ({ page }) => {
    await openByPointer(page, "Edit");
    const undo = menuItem(page, "Undo");
    const shortcut = undo.locator(".ui-menu__shortcut");
    await expect(shortcut).toHaveText("Ctrl+Z");
    await expect(shortcut).toHaveAttribute("data-chord", "Ctrl+Z");
    // The chord ends where the item's padding begins (DESIGN §4).
    const item = await boxOf(undo);
    const chord = await boxOf(shortcut);
    expect(Math.round(item.x + item.width - (chord.x + chord.width))).toBe(8);

    const palettePlace = menuItem(page, "Command Palette…");
    const colours = await palettePlace.evaluate((element) => {
        const style = getComputedStyle(document.documentElement);
        const resolve = (token: string) => {
            const probe = document.createElement("span");
            probe.style.color = style.getPropertyValue(token);
            document.body.append(probe);
            const colour = getComputedStyle(probe).color;
            probe.remove();
            return colour;
        };
        return {
            title: getComputedStyle(element).color,
            chord: getComputedStyle(element.querySelector(".ui-menu__shortcut")!).color,
            text: resolve("--text"),
            muted: resolve("--text-muted"),
            faint: resolve("--text-faint"),
            undo: getComputedStyle(
                element.parentElement!.querySelector('[data-command="demo.edit.undo"]')!,
            ).color,
        };
    });
    expect(colours.title).toBe(colours.text);
    expect(colours.chord).toBe(colours.muted);
    // The disabled item stays, in the colour of disabled controls.
    expect(colours.undo).toBe(colours.faint);
    await expect(undo).toBeVisible();
    await expect(undo).toHaveAttribute("aria-disabled", "true");

    // A press on it runs nothing and leaves the menu open.
    const before = (await ran(page)).length;
    await undo.click({ force: true });
    await settle(page);
    await expect(openMenu(page)).toBeVisible();
    expect((await ran(page)).slice(before)).toEqual([]);
    // The keyboard passes over it: the first enabled item takes the highlight.
    await page.keyboard.press("Escape");
    await expect(openMenu(page)).toHaveCount(0);
    await focus(menuTrigger(page, "Edit"));
    await page.keyboard.press("ArrowDown");
    await expect(menuItem(page, "Command Palette…")).toBeFocused();
    await page.keyboard.press("Escape");
});

test("the keyboard moves through the menus and items; Escape closes them; Enter runs an item", async ({
    page,
}) => {
    const errors = uncaughtErrors(page);
    // F6 reaches the menu bar's first trigger (shell.spec.ts); Enter opens its menu.
    await focus(menuTrigger(page, "File"));
    await page.keyboard.press("Enter");
    await expect(openMenu(page)).toBeVisible();
    await settle(page);
    await expect(menuItem(page, "New Document")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menuItem(page, "Close Document")).toBeFocused();
    // Right and left move between menus, the open state with them, and wrap.
    await page.keyboard.press("ArrowRight");
    await expect(menuTrigger(page, "Edit")).toHaveAttribute("data-state", "open");
    await page.keyboard.press("ArrowLeft");
    await expect(menuTrigger(page, "File")).toHaveAttribute("data-state", "open");
    await page.keyboard.press("ArrowLeft");
    await expect(menuTrigger(page, "Help")).toHaveAttribute("data-state", "open");
    // The menu reached that way takes the focus; Down highlights its first item.
    await settle(page);
    await expect(openMenu(page)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menuItem(page, "Keyboard Shortcuts…")).toBeFocused();

    // Escape closes the menu and gives the focus back to its trigger.
    await page.keyboard.press("Escape");
    await expect(openMenu(page)).toHaveCount(0);
    await settle(page);
    await expect(menuTrigger(page, "Help")).toBeFocused();

    // With the menus closed, the arrows move along the triggers.
    await page.keyboard.press("ArrowRight");
    await expect(menuTrigger(page, "File")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(menuTrigger(page, "Edit")).toBeFocused();

    // Enter on an item runs its command and closes the menu.
    const before = (await ran(page)).length;
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowDown");
    await settle(page);
    await expect(menuItem(page, "New Document")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(openMenu(page)).toHaveCount(0);
    await expect.poll(async () => (await ran(page)).slice(before)).toEqual(["New Document"]);
    await expectEditorUsable(page);

    // While a menu is open the editor's keys do nothing.
    await focus(menuTrigger(page, "View"));
    await page.keyboard.press("ArrowDown");
    await settle(page);
    await page.keyboard.press("Control+KeyK");
    await settle(page);
    await expect(palette(page)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(openMenu(page)).toHaveCount(0);
    expect(errors).toEqual([]);
});

test("the menuCentre slot sits between the menus and the palette trigger", async ({ page }) => {
    await expect(centre(page)).toHaveText("Untitled document");
    const bar = await boxOf(page.locator("header.shell-menubar"));
    const menus = await boxOf(menuBar(page));
    const middle = await boxOf(centre(page).locator("[data-demo-menu-centre]"));
    const slot = await boxOf(centre(page));
    const trigger = await boxOf(shellTrigger(page));
    // Menus at the left, the trigger at the right, the slot's content centred between them.
    expect(menus.x).toBe(bar.x + 8);
    expect(menus.x + menus.width).toBeLessThanOrEqual(slot.x);
    expect(slot.x + slot.width).toBeLessThanOrEqual(trigger.x);
    expect(Math.round(trigger.x + trigger.width)).toBe(bar.x + bar.width - 8);
    expect(middle.x).toBeGreaterThan(slot.x);
    expect(middle.x + middle.width).toBeLessThan(slot.x + slot.width);
    expect(Math.abs(middle.x + middle.width / 2 - (slot.x + slot.width / 2))).toBeLessThanOrEqual(
        1,
    );
    // All on the bar's line.
    for (const box of [menus, middle, trigger]) {
        expect(box.y).toBeGreaterThanOrEqual(bar.y);
        expect(box.y + box.height).toBeLessThanOrEqual(bar.y + bar.height);
    }
    // The order in the document follows the order on screen.
    const order = await page
        .locator("header.shell-menubar")
        .evaluate((header) =>
            [".menubar", ".shell-menubar__centre", ".command-palette-trigger"].map((selector) =>
                Array.prototype.indexOf.call(
                    header.querySelectorAll("*"),
                    header.querySelector(selector),
                ),
            ),
        );
    expect(order).toEqual([...order].sort((a, b) => a - b));
});

test("the trigger opens the command palette and gets the focus back", async ({ page }) => {
    await expect(shellTrigger(page)).toHaveAttribute("aria-keyshortcuts", "Control+K");
    await shellTrigger(page).click();
    await expect(paletteInput(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(palette(page)).toHaveCount(0);
    await settle(page);
    await expect(shellTrigger(page)).toBeFocused();
    await expectEditorUsable(page);
});

for (const theme of THEMES) {
    test(`${theme}: the menu bar, closed and with a menu open, passes axe`, async ({ page }) => {
        if (theme === "light") await chooseDemoTheme(page, "light");
        const closed = await audit(page, "header.shell-menubar");
        expect(closed.violations).toEqual([]);
        expect(closed.contrastUndecided).toEqual([]);
        expect(closed.contrastChecked).toBeGreaterThan(0);

        await openByPointer(page, "Edit");
        const open = await audit(page);
        expect(open.violations).toEqual([]);
        expect(open.contrastUndecided).toEqual([]);
        expect(open.contrastChecked).toBeGreaterThan(0);
    });
}
