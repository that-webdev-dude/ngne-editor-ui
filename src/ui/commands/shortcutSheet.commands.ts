import type { PackageCommandModule } from "../editorUi/packageCommands.js";

// The shortcut sheet's command (SPEC §7.1, §11, DESIGN §7): `?` in the `canvas` context, so
// a text field types the character; Help → Keyboard Shortcuts…, the first item of the Help
// menu. It keeps the id both editors gave it (its `edit.` prefix is the menu it started in),
// so their recent commands carry over (SPEC §5).

/** The id of the command that opens the shortcut sheet. */
export const SHORTCUT_SHEET_COMMAND = "edit.shortcuts";

/**
 * Its place in the Help menu: ahead of every item an editor places there at an order above 0,
 * and in a group of its own when that order is 100 or more (`CommandSpec.menuOrder`).
 */
export const SHORTCUT_SHEET_MENU_ORDER = 0;

export const shortcutSheetCommands: PackageCommandModule = ({ surfaces }) => ({
    commands: [
        {
            id: SHORTCUT_SHEET_COMMAND,
            title: "Keyboard Shortcuts…",
            shortcut: "?",
            context: "canvas",
            menuPath: ["Help"],
            menuOrder: SHORTCUT_SHEET_MENU_ORDER,
            run: () => surfaces.open("shortcut-sheet"),
        },
    ],
});
