import { compareCodeUnits } from "../modules.js";
import { buildMenu, menuCommands } from "./menuModel.js";
import type { Command } from "./types.js";

// The shortcut sheet without the interface (SPEC §7.1, DESIGN §7): generated from the command
// registry, grouped by the editor's menus in their order, commands outside the menus under
// "Other". The menu bar is a parameter (BRIEF D3).

/** One command of the shortcut sheet with every chord that runs it. */
export interface ShortcutRow<Menu extends string = string, Context extends string = string> {
    command: Command<Menu, Context>;
    /** The command's title when the sheet was made. */
    title: string;
    /**
     * Canonical chords (chord.ts), in the order the command lists them; the first is the one
     * its menu item shows. `formatChord` displays each as menus do.
     */
    chords: readonly string[];
    /** The chords act while the key is held (a hold binding, `release`). */
    hold: boolean;
}

export interface ShortcutGroup<Menu extends string = string, Context extends string = string> {
    /** A menu of the menu bar, or `OTHER_SHORTCUTS`. */
    title: Menu | typeof OTHER_SHORTCUTS;
    rows: ShortcutRow<Menu, Context>[];
}

/** The group of the commands that have a shortcut and no menu item (tools, focus regions). */
export const OTHER_SHORTCUTS = "Other";

function row<Menu extends string, Context extends string>(
    command: Command<Menu, Context>,
): ShortcutRow<Menu, Context> {
    return {
        command,
        title: command.title(),
        chords: command.shortcuts,
        hold: command.release !== null,
    };
}

/**
 * The shortcut sheet (DESIGN §7), generated from the commands: every command that has a
 * shortcut, once, with all its chords. Grouped by menu in the order of `menus`, the editor's
 * menu bar, each group in menu order; the commands outside the menus form a last group,
 * ordered by title. A group without shortcuts is left out.
 */
export function shortcutGroups<Menu extends string, Context extends string>(
    commands: readonly Command<Menu, Context>[],
    menus: readonly Menu[],
): ShortcutGroup<Menu, Context>[] {
    const bound = (command: Command<Menu, Context>) => command.shortcuts.length > 0;
    const groups: ShortcutGroup<Menu, Context>[] = menus.map((menu) => ({
        title: menu,
        rows: menuCommands(buildMenu(commands, [menu]))
            .filter(bound)
            .map(row),
    }));
    const others = commands
        .filter((command) => bound(command) && command.menuPath === null)
        .map(row)
        .sort(
            (a, b) =>
                a.title.localeCompare(b.title, "en") ||
                compareCodeUnits(a.command.id, b.command.id),
        );
    groups.push({ title: OTHER_SHORTCUTS, rows: others });
    return groups.filter((group) => group.rows.length > 0);
}
