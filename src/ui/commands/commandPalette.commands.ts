import type { PackageCommandModule } from "../editorUi/packageCommands.js";

// The command palette's command (SPEC §7.1, DESIGN §4): Ctrl+K, also while a text field has
// focus. It keeps the id both editors gave it, so their recent commands (`<id>.recent-commands`,
// SPEC §5) and the menu item each plans for it carry over. It names no menu: an editor places
// it with a planned command of this id (`PlannedCommandSpec`), as both do in their Edit menus.

/** The id of the command that opens the command palette. */
export const COMMAND_PALETTE_COMMAND = "edit.commandPalette";

export const commandPaletteCommands: PackageCommandModule = ({ surfaces }) => ({
    commands: [
        {
            id: COMMAND_PALETTE_COMMAND,
            title: "Command Palette…",
            shortcut: "Ctrl+K",
            context: ["global", "text"],
            run: () => surfaces.open("command-palette"),
        },
    ],
});
