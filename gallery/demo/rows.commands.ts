import type { CommandSpec } from "@ngne/editor-ui/commands";
import type { DemoMenu } from "./editorUi.ts";
import { duplicateTarget, moveTarget, rowsStore, targetIndex } from "./rows.ts";

// The demo editor's row commands (SPEC §7.1): a `*.commands.ts` module the instance finds with
// its glob, listed in the rows' context menu ("demo-row") with their chords. Move Up and Move
// Down are disabled at the ends of the list; Export fails, which an error toast reports.

const lastIndex = () => rowsStore.getState().rows.length - 1;

export const commands: CommandSpec<DemoMenu, never>[] = [
    {
        id: "demo.row.duplicate",
        title: "Duplicate Row",
        shortcut: "Ctrl+D",
        contextMenus: [{ menu: "demo-row", order: 100 }],
        run: duplicateTarget,
    },
    {
        id: "demo.row.move-up",
        title: "Move Row Up",
        shortcut: "Alt+ArrowUp",
        contextMenus: [{ menu: "demo-row", order: 200 }],
        enabled: () => targetIndex() > 0,
        run: () => moveTarget(-1),
    },
    {
        id: "demo.row.move-down",
        title: "Move Row Down",
        shortcut: "Alt+ArrowDown",
        contextMenus: [{ menu: "demo-row", order: 210 }],
        enabled: () => targetIndex() < lastIndex(),
        run: () => moveTarget(1),
    },
    {
        id: "demo.row.export",
        title: "Export Row",
        contextMenus: [{ menu: "demo-row", order: 300 }],
        run: () => {
            throw new Error("the demo editor cannot export.");
        },
    },
];
