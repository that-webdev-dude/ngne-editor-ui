// Commands of an editor (SPEC §7.1). Menus, context menus, shortcuts, the command palette and
// the shortcut sheet are generated from one registry (DESIGN §8); the interface runs a
// command, it never changes a document itself.
//
// Generic over the editor's lists (BRIEF D3, D16): `Menu` is a name of the editor's menu bar
// (`menus`, SPEC §5) and `Context` one of its own key contexts (SPEC §7.2), beside the
// package's `text`, `canvas` and `global`.

/** The key contexts the package owns (SPEC §7.2). */
export const BASE_CONTEXTS = ["text", "canvas", "global"] as const;
export type BaseContext = (typeof BASE_CONTEXTS)[number];

/** A key context: one of the package's, or one of the editor's state and focus contexts. */
export type KeyContext<Context extends string = string> = BaseContext | Context;

/**
 * Place in the menu bar: the menu, then any submenus, for example `["Layer"]` or
 * `["File", "Open Recent"]`. The first name is one of the editor's `menus`.
 */
export type MenuPath<Menu extends string = string> = readonly [Menu, ...string[]];

/** Where a command appears in a context menu (right-click on a layer, a frame, a tile, …). */
export interface ContextMenuPlacement {
    /** Name of the context menu, chosen by the feature that shows it: "layer", "cel", … */
    menu: string;
    /** Position in that menu; see `CommandSpec.menuOrder`. The default is 1000. */
    order?: number;
}

/**
 * One command of the editor. A feature registers its commands from a module named
 * `*.commands.ts` (or `.tsx`) that exports `commands`; the editor finds the module with one
 * `import.meta.glob` line and passes the map, so no shared file is edited (RULES 3):
 *
 *     // src/app/layers/layers.commands.ts
 *     export const commands: CommandSpec<Menu, Context>[] = [
 *         { id: "layer.new", title: "New Layer", shortcut: "Shift+N", run: newLayer },
 *     ];
 */
export interface CommandSpec<Menu extends string = string, Context extends string = string> {
    /** Stable and unique: "edit.undo". The id of a planned command implements it. */
    id: string;
    /** Menu text; a function when the text follows the state ("Undo Pencil"). */
    title: string | (() => string);
    /** Performs the command. Called only while `enabled` holds. */
    run(): void | Promise<void>;
    /** Whether the command can run now; the default is always. Must not throw. */
    enabled?(): boolean;
    /** One chord or several, in the notation of chord.ts: "Ctrl+Y" or ["Ctrl+Y", "Ctrl+Shift+Z"]. */
    shortcut?: string | readonly string[];
    /**
     * Contexts the shortcut is bound in; the default is "global". A chord that also acts while
     * a text field has focus lists "text" as well: `context: ["global", "text"]`.
     */
    context?: KeyContext<Context> | readonly KeyContext<Context>[];
    /** Place in the menu bar, under one of the editor's menus. */
    menuPath?: MenuPath<Menu>;
    /**
     * Position in its menu, ascending; the default is 1000. Items whose orders differ in the
     * hundreds are separated by a line: 100 and 110 form one group, 200 starts the next.
     */
    menuOrder?: number;
    /** Context menus that list the command. */
    contextMenus?: readonly ContextMenuPlacement[];
    /**
     * Makes the shortcut a hold binding ("Space (hold)"): `run` is called once when the key
     * goes down, `release` when it comes up or the window loses focus.
     */
    release?(): void;
    /** Ids of planned commands this command takes the place of (their menu items disappear). */
    replaces?: readonly string[];
}

/**
 * A command that already has its menu item but no implementation yet: shown disabled until a
 * `CommandSpec` with the same id is registered. That command takes over the menu position
 * unless it names its own. Exported as `plannedCommands` from a `*.commands.ts` module.
 */
export interface PlannedCommandSpec<Menu extends string = string> {
    id: string;
    title: string;
    menuPath: MenuPath<Menu>;
    menuOrder?: number;
}

/** What a `*.commands.ts` module exports (at least one of the two). */
export interface CommandModule<Menu extends string = string, Context extends string = string> {
    commands?: readonly CommandSpec<Menu, Context>[];
    plannedCommands?: readonly PlannedCommandSpec<Menu>[];
}

/** A command as the registry holds it: every optional field of the spec resolved. */
export interface Command<Menu extends string = string, Context extends string = string> {
    readonly id: string;
    /** The module (or "runtime") that registered the command; used in error messages. */
    readonly source: string;
    /** True for a planned command that has no implementation yet; it is never enabled. */
    readonly planned: boolean;
    title(): string;
    /** The registry's `commandGate`, then the spec's own `enabled`. */
    enabled(): boolean;
    /** The registry's `beforeRun`, then the spec's own `run`. */
    run(): void | Promise<void>;
    readonly release: (() => void) | null;
    /** Canonical chords, in the order given. */
    readonly shortcuts: readonly string[];
    readonly contexts: readonly KeyContext<Context>[];
    readonly menuPath: MenuPath<Menu> | null;
    readonly menuOrder: number;
    readonly contextMenus: readonly Required<ContextMenuPlacement>[];
}

export const DEFAULT_MENU_ORDER = 1000;
