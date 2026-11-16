import { formatChord } from "../../model/commands/chord.js";
import { invokeCommand } from "../../model/commands/invoke.js";
import { buildContextMenu } from "../../model/commands/menuModel.js";
import type { Command } from "../../model/commands/types.js";
import type { ContextMenuEntry } from "../primitives/ContextMenu.js";
import { reportCommandError } from "./runCommand.js";

/**
 * The entries of the context menu named `menu` for the `ContextMenu` primitive (DESIGN §4),
 * generated from the commands that list that menu in `contextMenus`: each with its first
 * chord, disabled ones shown and inert, a failure reported by an error toast. Call it while
 * rendering, with the commands of `useCommands()`, so titles and disabled states are current.
 */
export function contextMenuEntries(menu: string, commands: readonly Command[]): ContextMenuEntry[] {
    return buildContextMenu(commands, menu).flatMap((node, index): ContextMenuEntry[] => {
        if (node.kind === "separator") return [{ type: "separator", id: `separator-${index}` }];
        if (node.kind !== "command") return [];
        const { command } = node;
        const shortcut = command.shortcuts[0];
        return [
            {
                id: command.id,
                label: command.title(),
                shortcut: shortcut ? formatChord(shortcut) : undefined,
                disabled: !command.enabled(),
                onSelect: () => {
                    invokeCommand(command, reportCommandError);
                },
            },
        ];
    });
}
