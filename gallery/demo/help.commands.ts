import type { CommandSpec } from "@ngne/editor-ui/commands";
import type { DemoMenu } from "./editorUi.ts";
import { record } from "./keys.ts";

// The demo editor's Help menu item (SPEC §7.1, DESIGN §8): an item an editor adds after the
// package's Keyboard Shortcuts…, which stays first, in a group of its own.

export const commands: CommandSpec<DemoMenu, never>[] = [
    {
        id: "demo.help.releaseNotes",
        title: "Release Notes",
        menuPath: ["Help"],
        menuOrder: 100,
        run: () => record("Release Notes"),
    },
];
