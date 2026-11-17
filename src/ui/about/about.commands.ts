import type { PackageCommandModule } from "../editorUi/packageCommands.js";

// The About command (SPEC §11, DESIGN §7, §8): Help → About <productName>…, the last item of
// the Help menu, in a group of its own; it opens the instance's About dialog. It keeps the id
// the sprite editor gave it, so its recent commands carry over (SPEC §5). No key: the command
// palette lists it under Help.

/** The id of the command that opens the About dialog. */
export const ABOUT_COMMAND = "help.about";

/**
 * Its place in the Help menu: after every item an editor places there, and in a hundred of its
 * own, so a line sets it apart (`CommandSpec.menuOrder`). An editor's Help items take orders
 * above 0 (Keyboard Shortcuts…, SPEC §11) and below this one.
 */
export const ABOUT_MENU_ORDER = Number.MAX_SAFE_INTEGER;

export const aboutCommands: PackageCommandModule = ({ productName, surfaces }) => ({
    commands: [
        {
            id: ABOUT_COMMAND,
            title: `About ${productName}…`,
            menuPath: ["Help"],
            menuOrder: ABOUT_MENU_ORDER,
            run: () => surfaces.open("about"),
        },
    ],
});
