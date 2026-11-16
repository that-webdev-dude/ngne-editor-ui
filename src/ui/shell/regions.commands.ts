import type { PackageCommandModule } from "../editorUi/packageCommands.js";
import { cycleFocusRegion } from "./regions.js";

// The region commands (SPEC §8, DESIGN §8): F6 and Shift+F6 cycle the focus through the
// regions of the shell, also while a text field has focus. They keep the ids both editors gave
// them, so their recent commands carry over (SPEC §5), and name no menu.

/** The id of the command that focuses the next region. */
export const NEXT_REGION_COMMAND = "focus.nextRegion";

/** The id of the command that focuses the previous region. */
export const PREVIOUS_REGION_COMMAND = "focus.previousRegion";

export const regionCommands: PackageCommandModule = () => ({
    commands: [
        {
            id: NEXT_REGION_COMMAND,
            title: "Focus Next Region",
            shortcut: "F6",
            context: ["global", "text"],
            run: () => {
                cycleFocusRegion(1);
            },
        },
        {
            id: PREVIOUS_REGION_COMMAND,
            title: "Focus Previous Region",
            shortcut: "Shift+F6",
            context: ["global", "text"],
            run: () => {
                cycleFocusRegion(-1);
            },
        },
    ],
});
