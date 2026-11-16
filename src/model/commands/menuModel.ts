import { compareCodeUnits } from "../modules.js";
import type { CommandRegistry } from "./registry.js";
import type { Command } from "./types.js";

// Menus generated from the command registry (SPEC §7.1, DESIGN §8): the menu bar in the
// editor's order, its submenus, and the context menus features show.

/** One entry of a generated menu. */
export type MenuNode<Menu extends string = string, Context extends string = string> =
    | { kind: "command"; command: Command<Menu, Context> }
    | { kind: "submenu"; title: string; children: MenuNode<Menu, Context>[] }
    | { kind: "separator" };

/** One menu of the menu bar and its entries. */
export interface MenuBarEntry<Menu extends string = string, Context extends string = string> {
    menu: Menu;
    items: MenuNode<Menu, Context>[];
}

interface Placed<Menu extends string, Context extends string> {
    order: number;
    /** Breaks ties between equal orders, so the result does not depend on module order. */
    key: string;
    node: MenuNode<Menu, Context>;
}

function startsWith(path: readonly string[], prefix: readonly string[]): boolean {
    return prefix.every((name, index) => path[index] === name);
}

/** Sorts by order and puts a separator between items whose orders differ in the hundreds. */
function arrange<Menu extends string, Context extends string>(
    placed: Placed<Menu, Context>[],
): MenuNode<Menu, Context>[] {
    placed.sort((a, b) => a.order - b.order || compareCodeUnits(a.key, b.key));
    const nodes: MenuNode<Menu, Context>[] = [];
    let group: number | null = null;
    for (const { order, node } of placed) {
        const next = Math.floor(order / 100);
        if (group !== null && next !== group) nodes.push({ kind: "separator" });
        group = next;
        nodes.push(node);
    }
    return nodes;
}

/**
 * The menu at `path` of the menu bar, generated from the commands: `["Edit"]` is the Edit
 * menu, `["File", "Open Recent"]` a submenu. A submenu sits at the position of its first item.
 */
export function buildMenu<Menu extends string, Context extends string>(
    commands: readonly Command<Menu, Context>[],
    path: readonly string[],
): MenuNode<Menu, Context>[] {
    const placed: Placed<Menu, Context>[] = [];
    const submenus = new Map<string, number>();
    for (const command of commands) {
        const menuPath = command.menuPath;
        if (!menuPath || !startsWith(menuPath, path)) continue;
        if (menuPath.length === path.length) {
            placed.push({
                order: command.menuOrder,
                key: command.id,
                node: { kind: "command", command },
            });
        } else {
            const title = menuPath[path.length] ?? "";
            submenus.set(title, Math.min(submenus.get(title) ?? Infinity, command.menuOrder));
        }
    }
    for (const [title, order] of submenus) {
        const children = buildMenu(commands, [...path, title]);
        placed.push({ order, key: title, node: { kind: "submenu", title, children } });
    }
    return arrange(placed);
}

/** Every menu of the menu bar with its entries, in the editor's menu order. */
export function buildMenuBar<Menu extends string, Context extends string>(
    registry: Pick<CommandRegistry<Menu, Context>, "menus" | "list">,
): MenuBarEntry<Menu, Context>[] {
    const commands = registry.list();
    return registry.menus.map((menu) => ({ menu, items: buildMenu(commands, [menu]) }));
}

/**
 * What is wrong with a menu bar: every editor's menu bar has a View menu, which ends with
 * Open Source Licences…, and ends with Help (DESIGN §8). Empty when nothing is.
 */
export function menuBarProblems(menus: readonly string[]): string[] {
    const problems: string[] = [];
    if (!menus.includes("View")) problems.push('The menu bar has no "View" menu.');
    const last = menus.at(-1);
    if (last !== "Help") {
        problems.push(
            last === undefined
                ? 'The menu bar is empty; it ends with "Help".'
                : `The menu bar ends with "${last}"; it ends with "Help".`,
        );
    }
    return problems;
}

/** The context menu named `menu`, generated from the commands that list it. */
export function buildContextMenu<Menu extends string, Context extends string>(
    commands: readonly Command<Menu, Context>[],
    menu: string,
): MenuNode<Menu, Context>[] {
    const placed: Placed<Menu, Context>[] = [];
    for (const command of commands) {
        const placement = command.contextMenus.find((entry) => entry.menu === menu);
        if (!placement) continue;
        placed.push({
            order: placement.order,
            key: command.id,
            node: { kind: "command", command },
        });
    }
    return arrange(placed);
}

/** The commands of a menu and of its submenus, in menu order. */
export function menuCommands<Menu extends string, Context extends string>(
    nodes: readonly MenuNode<Menu, Context>[],
): Command<Menu, Context>[] {
    return nodes.flatMap((node) => {
        if (node.kind === "command") return [node.command];
        if (node.kind === "submenu") return menuCommands(node.children);
        return [];
    });
}
