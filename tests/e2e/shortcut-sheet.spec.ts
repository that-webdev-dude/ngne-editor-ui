import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { audit, THEMES, uncaughtErrors } from "./gallery-support.ts";
import {
    activeOption,
    chooseDemoTheme,
    expectEditorUsable,
    focus,
    nameField,
    openDemo,
    openPalette,
    palette,
    PALETTE_COMMAND,
    settle,
    shortcutList,
    shortcutSheet,
    SHORTCUTS_COMMAND,
    toolButton,
    viewport,
} from "./surfaces-support.ts";

// The shortcut sheet (DESIGN §7, SPEC §7.1) on the demo editor: `?` opens it in the canvas
// context, and so does the palette's Keyboard Shortcuts… row; it is generated from the
// instance's registry, grouped by the demo's menus in their order, "Other" last. Both themes
// pass axe with the sheet open. Its Help menu item is reached through the menu bar's specs.

interface SheetRow {
    group: string;
    id: string;
    title: string;
    /** Canonical chords, from `data-chord`. */
    chords: string[];
    hold: boolean;
}

/** Every row of the open sheet, in the order shown. */
function sheetRows(page: Page): Promise<SheetRow[]> {
    return shortcutSheet(page).evaluate((sheet) =>
        Array.from(sheet.querySelectorAll<HTMLElement>("[data-shortcut-group]"), (group) =>
            Array.from(group.querySelectorAll<HTMLElement>("[data-command]"), (row) => ({
                group: group.dataset.shortcutGroup ?? "",
                id: row.dataset.command ?? "",
                title: row.querySelector("dt")?.textContent ?? "",
                chords: Array.from(
                    row.querySelectorAll<HTMLElement>("kbd"),
                    (key) => key.dataset.chord ?? "",
                ),
                hold: row.querySelector(".shortcut-sheet__hold") !== null,
            })),
        ).flat(),
    );
}

async function openSheetWithKey(page: Page) {
    await page.keyboard.press("Shift+Slash");
    await expect(shortcutSheet(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
    await openDemo(page);
});

test("? opens the sheet in the canvas context; a text field types it", async ({ page }) => {
    const errors = uncaughtErrors(page);
    await focus(viewport(page));
    await openSheetWithKey(page);
    // The list has the focus, so the keyboard scrolls it.
    await expect(shortcutList(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(shortcutSheet(page)).toBeHidden();
    await expect(viewport(page)).toBeFocused();

    // From a focused control as well.
    await focus(toolButton(page));
    await openSheetWithKey(page);
    await shortcutSheet(page).getByRole("button", { name: "Close" }).click();
    await expect(shortcutSheet(page)).toBeHidden();
    await expect(toolButton(page)).toBeFocused();
    await expectEditorUsable(page);

    // A text field takes the character, and no sheet opens.
    await focus(nameField(page));
    await page.keyboard.press("Shift+Slash");
    await settle(page);
    await expect(nameField(page)).toHaveValue("?");
    await expect(shortcutSheet(page)).toHaveCount(0);

    // The sheet is a dialog: a second ? opens no other one.
    await focus(viewport(page));
    await openSheetWithKey(page);
    await page.keyboard.press("Shift+Slash");
    await settle(page);
    await expect(page.getByRole("dialog")).toHaveCount(1);
    expect(errors).toEqual([]);
});

test("the palette's Keyboard Shortcuts… row opens the sheet", async ({ page }) => {
    await focus(viewport(page));
    await openPalette(page);
    await page.keyboard.type("keyboard shortcuts");
    await expect(activeOption(page)).toHaveAttribute("data-command", SHORTCUTS_COMMAND);
    await page.keyboard.press("Enter");
    await expect(shortcutSheet(page)).toBeVisible();
    await expect(palette(page)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(shortcutSheet(page)).toBeHidden();
    await expect(viewport(page)).toBeFocused();
    await expectEditorUsable(page);
});

test("the groups follow the demo's menus in their order, Other last", async ({ page }) => {
    await focus(viewport(page));
    await openSheetWithKey(page);
    const sheet = shortcutSheet(page);
    await expect(
        sheet.getByRole("heading", { name: "Keyboard shortcuts", level: 2 }),
    ).toBeVisible();
    // One heading per menu with shortcuts, in the menu bar's order; then Other.
    await expect(sheet.getByRole("heading", { level: 3 })).toHaveText([
        "File",
        "Edit",
        "View",
        "Help",
        "Other",
    ]);

    const rows = await sheetRows(page);
    const inGroup = (group: string) =>
        rows.filter((row) => row.group === group).map((row) => row.id);
    // In menu order; a command without a key (Close Document, Preferences…, Fit) is not listed.
    expect(inGroup("File")).toEqual(["demo.file.new"]);
    expect(inGroup("Edit")).toEqual(["demo.edit.undo", PALETTE_COMMAND]);
    expect(inGroup("View")).toEqual(["demo.view.zoomIn"]);
    expect(inGroup("Help")).toEqual([SHORTCUTS_COMMAND]);
    // Outside the menus: the key and row commands, by title.
    const other = rows.filter((row) => row.group === "Other");
    expect(other.map((row) => row.id)).toEqual(
        expect.arrayContaining([
            "demo.keys.canvas-mark",
            "demo.keys.panel-find",
            "demo.row.duplicate",
            "demo.row.move-up",
        ]),
    );
    expect(other.map((row) => row.title)).toEqual(
        [...other.map((row) => row.title)].sort((a, b) => a.localeCompare(b, "en")),
    );
    // A disabled command keeps its row; each row shows its title and every chord.
    expect(rows.find((row) => row.id === "demo.edit.undo")).toEqual({
        group: "Edit",
        id: "demo.edit.undo",
        title: "Undo",
        chords: ["Ctrl+Z"],
        hold: false,
    });
    await expect(sheet.locator(`[data-command="${SHORTCUTS_COMMAND}"]`)).toHaveText(
        "Keyboard Shortcuts…?",
    );
    await expect(sheet.locator(`[data-command="${PALETTE_COMMAND}"]`)).toHaveText(
        "Command Palette…Ctrl+K",
    );
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
});

for (const theme of THEMES) {
    test(`${theme}: the open sheet passes axe`, async ({ page }) => {
        if (theme === "light") await chooseDemoTheme(page, "light");
        await focus(viewport(page));
        await openSheetWithKey(page);
        const result = await audit(page);
        expect(result.violations).toEqual([]);
        expect(result.contrastUndecided).toEqual([]);
        expect(result.contrastChecked).toBeGreaterThan(0);
    });
}
