import type { CommandSpec } from "@ngne/editor-ui/commands";
import type { DemoMenu } from "./editorUi.ts";
import { record } from "./keys.ts";
import {
    CROP_TO_SELECTION_COMMAND,
    DESELECT_COMMAND,
    hasSelection,
    INVERT_SELECTION_COMMAND,
    SELECT_ALL_COMMAND,
    selectionStore,
    setSelection,
} from "./selection.ts";

// The demo editor's selection commands (SPEC §7.1): the commands the marquee's command buttons
// run in the context bar (SPEC §8 Tools). Outside the menus and without keys, so the menus and
// the shortcut sheet stay as they are. Each records its title in the key log when it runs;
// Deselect, Invert and Crop are disabled while nothing is selected.

const ran = (title: string, then: () => void) => () => {
    then();
    record(title);
};

export const commands: CommandSpec<DemoMenu, never>[] = [
    {
        id: SELECT_ALL_COMMAND,
        title: "Select All",
        run: ran("Select All", () => setSelection("all")),
    },
    {
        id: DESELECT_COMMAND,
        title: "Deselect",
        enabled: hasSelection,
        run: ran("Deselect", () => setSelection("none")),
    },
    {
        id: INVERT_SELECTION_COMMAND,
        title: "Invert Selection",
        enabled: hasSelection,
        run: ran("Invert Selection", () =>
            setSelection(selectionStore.getState().selection === "inverted" ? "all" : "inverted"),
        ),
    },
    {
        id: CROP_TO_SELECTION_COMMAND,
        title: "Crop to Selection",
        enabled: hasSelection,
        run: ran("Crop to Selection", () => setSelection("none")),
    },
];
