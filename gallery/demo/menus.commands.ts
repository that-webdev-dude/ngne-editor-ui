import { COMMAND_PALETTE_COMMAND } from "@ngne/editor-ui/commands";
import type { CommandSpec, PlannedCommandSpec } from "@ngne/editor-ui/commands";
import type { DemoMenu } from "./editorUi.ts";
import { record } from "./keys.ts";

// The demo editor's menu commands (SPEC §7.1): commands placed in its File, Edit and View
// menus, with and without keys, and Undo, which is disabled, so the command palette and the
// shortcut sheet show menus, chords and disabled state. Each records its title in the key log
// when it runs. The package's palette command takes the Edit menu item planned for its id, as
// the editors place it.

const run = (title: string) => () => record(title);

export const plannedCommands: PlannedCommandSpec<DemoMenu>[] = [
    { id: COMMAND_PALETTE_COMMAND, title: "Command Palette…", menuPath: ["Edit"], menuOrder: 900 },
];

export const commands: CommandSpec<DemoMenu, never>[] = [
    {
        id: "demo.file.new",
        title: "New Document",
        shortcut: "Ctrl+Alt+N",
        menuPath: ["File"],
        menuOrder: 100,
        run: run("New Document"),
    },
    {
        id: "demo.file.close",
        title: "Close Document",
        menuPath: ["File"],
        menuOrder: 200,
        run: run("Close Document"),
    },
    {
        id: "demo.edit.undo",
        title: "Undo",
        shortcut: "Ctrl+Z",
        menuPath: ["Edit"],
        menuOrder: 100,
        // The demo keeps no history: there is never anything to undo.
        enabled: () => false,
        run: run("Undo"),
    },
    {
        id: "demo.view.zoomIn",
        title: "Zoom In",
        shortcut: "Ctrl+=",
        menuPath: ["View"],
        menuOrder: 100,
        run: run("Zoom In"),
    },
    {
        id: "demo.view.fit",
        title: "Fit to Window",
        menuPath: ["View"],
        menuOrder: 110,
        run: run("Fit to Window"),
    },
];
