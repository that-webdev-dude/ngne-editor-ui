import { compareCodeUnits, RegistrationError, registerModules } from "../modules.js";
import type { ModuleMap } from "../modules.js";
import { normalizeChord } from "./chord.js";
import { keyContextOrder } from "./contexts.js";
import { isBrowserChord, isTextEditingChord } from "./keyClasses.js";
import { DEFAULT_MENU_ORDER } from "./types.js";
import type {
    Command,
    CommandModule,
    CommandSpec,
    ContextMenuPlacement,
    KeyContext,
    MenuPath,
    PlannedCommandSpec,
} from "./types.js";

// The command registry of an editor (SPEC §1.3, §7.1). Menus, context menus, shortcuts, the
// command palette and the shortcut sheet read it; nothing else lists commands (DESIGN §8). The
// editor's lists are parameters (BRIEF D3, D16): its menu bar, its key contexts, a gate that
// disables commands and a hook that runs before each one. Registration errors throw a
// `RegistrationError` naming the module, so a broken module stops the editor at startup.

/** What an editor passes to `createCommandRegistry` (SPEC §5). */
export interface CommandRegistryOptions<Menu extends string, Context extends string> {
    /** The menu bar, in order: every menu path starts with one of these names. */
    menus: readonly Menu[];
    /** The editor's own key contexts, highest priority first (SPEC §7.2). */
    contexts?: readonly Context[];
    /** Disables every command it rejects, whatever the command's own `enabled`. Must not throw. */
    commandGate?: (command: Command<Menu, Context>) => boolean;
    /** Runs before every command, ahead of the command's own `run`. */
    beforeRun?: (command: Command<Menu, Context>) => void;
}

export interface CommandRegistry<Menu extends string = string, Context extends string = string> {
    /** The menu bar, in the editor's order. */
    readonly menus: readonly Menu[];
    /** Every key context, highest priority first: `text`, the editor's, `canvas`, `global`. */
    readonly contexts: readonly KeyContext<Context>[];
    /** Adds a command; returns the function that removes it. Throws `RegistrationError`. */
    register(spec: CommandSpec<Menu, Context>, source?: string): () => void;
    /** Adds the menu item of a command not implemented yet; returns its remover. */
    plan(spec: PlannedCommandSpec<Menu>, source?: string): () => void;
    /** The command with this id: registered, or planned and not yet implemented. */
    get(id: string): Command<Menu, Context> | undefined;
    /** Every command, ordered by id. Planned commands that were replaced are left out. */
    list(): readonly Command<Menu, Context>[];
    /** The commands that bind `chord` (canonical) in `context`, enabled or not, by id. */
    bindings(context: KeyContext<Context>, chord: string): readonly Command<Menu, Context>[];
    /** Whether any command binds `chord` (canonical) in any context. */
    isBound(chord: string): boolean;
    /** Calls `listener` when a command is added or removed and on `refresh`. */
    subscribe(listener: () => void): () => void;
    /** Changes whenever `subscribe` listeners are called; a snapshot for React. */
    version(): number;
    /** Tells subscribers that state read by `enabled` or `title` functions has changed. */
    refresh(): void;
}

interface Entry<Menu extends string, Context extends string> {
    spec: CommandSpec<Menu, Context>;
    command: Command<Menu, Context>;
}

function asList<Item>(value: Item | readonly Item[] | undefined): readonly Item[] {
    if (value === undefined) return [];
    return (Array.isArray(value) ? value : [value]) as readonly Item[];
}

const sameList = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((name, index) => name === b[index]);

/** Throws the registration error of one command for `problem`. */
type Fail = (problem: string) => never;

/** The canonical chords of a command, each once. */
function resolveShortcuts(shortcut: string | readonly string[] | undefined, fail: Fail): string[] {
    let shortcuts: string[] = [];
    try {
        shortcuts = asList(shortcut).map(normalizeChord);
    } catch (error) {
        fail(`has an invalid shortcut: ${error instanceof Error ? error.message : error}`);
    }
    if (new Set(shortcuts).size !== shortcuts.length) fail("lists a shortcut twice.");
    return shortcuts;
}

/** SPEC §7.2: in a text field only Ctrl, Alt and F-key chords act, and the field keeps its own. */
function checkTextShortcuts(shortcuts: readonly string[], fail: Fail): void {
    for (const chord of shortcuts) {
        if (!isBrowserChord(chord) || isTextEditingChord(chord)) {
            fail(`binds "${chord}" in the text context, where the field handles that key.`);
        }
    }
}

export function createCommandRegistry<Menu extends string, Context extends string = never>(
    options: CommandRegistryOptions<Menu, Context>,
): CommandRegistry<Menu, Context> {
    type Cmd = Command<Menu, Context>;
    const menus: readonly Menu[] = [...options.menus];
    const contexts = keyContextOrder(options.contexts ?? []);
    const { commandGate, beforeRun } = options;

    const checkMenuPath = (path: readonly string[], id: string, source: string): void => {
        if (path.length === 0 || path.some((name) => name.trim() === "")) {
            throw new RegistrationError(
                `Command "${id}" (${source}) has an empty menu path.`,
                source,
            );
        }
        if (!(menus as readonly string[]).includes(path[0]!)) {
            throw new RegistrationError(
                `Command "${id}" (${source}) names the menu "${path[0]}"; the menu bar has ` +
                    `${menus.join(", ")}.`,
                source,
            );
        }
    };

    /** The contexts a command binds its chords in, each a known context named once. */
    const resolveContexts = (
        context: KeyContext<Context> | readonly KeyContext<Context>[] | undefined,
        fail: Fail,
    ): KeyContext<Context>[] => {
        const bound: KeyContext<Context>[] =
            context === undefined ? ["global"] : [...asList(context)];
        for (const name of bound) {
            if (!contexts.includes(name)) fail(`names the unknown context "${name}".`);
        }
        if (bound.length === 0 || new Set(bound).size !== bound.length) {
            fail("needs each of its contexts once.");
        }
        return bound;
    };

    /** A command takes the menu position planned for its id unless it names another menu. */
    const resolveMenuPosition = (
        spec: CommandSpec<Menu, Context>,
        source: string,
        planned: PlannedCommandSpec<Menu> | undefined,
    ): { menuPath: MenuPath<Menu> | null; menuOrder: number } => {
        const menuPath: MenuPath<Menu> | null = spec.menuPath ?? planned?.menuPath ?? null;
        if (menuPath) checkMenuPath(menuPath, spec.id, source);
        const atPlannedPath =
            planned !== undefined && menuPath !== null && sameList(menuPath, planned.menuPath);
        const plannedOrder = atPlannedPath ? planned.menuOrder : undefined;
        return { menuPath, menuOrder: spec.menuOrder ?? plannedOrder ?? DEFAULT_MENU_ORDER };
    };

    const resolveSpec = (
        spec: CommandSpec<Menu, Context>,
        source: string,
        planned?: PlannedCommandSpec<Menu>,
    ): Cmd => {
        const { id } = spec;
        const fail: Fail = (problem) => {
            throw new RegistrationError(`Command "${id}" (${source}) ${problem}`, source);
        };
        if (id.trim() === "")
            throw new RegistrationError(`A command of ${source} has no id.`, source);

        const shortcuts = resolveShortcuts(spec.shortcut, fail);
        const bound = resolveContexts(spec.context, fail);
        if (bound.includes("text")) checkTextShortcuts(shortcuts, fail);
        const { menuPath, menuOrder } = resolveMenuPosition(spec, source, planned);

        const contextMenus = (spec.contextMenus ?? []).map(
            (placement): Required<ContextMenuPlacement> => {
                if (placement.menu.trim() === "") fail("names an empty context menu.");
                return { menu: placement.menu, order: placement.order ?? DEFAULT_MENU_ORDER };
            },
        );

        const { title, enabled } = spec;
        const command: Cmd = {
            id,
            source,
            planned: false,
            title: typeof title === "function" ? title : () => title,
            // The gate first: a command's own condition may assume what the gate checks.
            enabled: () =>
                (commandGate === undefined || commandGate(command)) &&
                (enabled === undefined || enabled()),
            run: () => {
                beforeRun?.(command);
                return spec.run();
            },
            release: spec.release ? () => spec.release?.() : null,
            shortcuts,
            contexts: bound,
            menuPath,
            menuOrder,
            contextMenus,
        };
        return command;
    };

    const resolvePlanned = (spec: PlannedCommandSpec<Menu>, source: string): Cmd => {
        if (spec.id.trim() === "") {
            throw new RegistrationError(`A command of ${source} has no id.`, source);
        }
        checkMenuPath(spec.menuPath, spec.id, source);
        return {
            id: spec.id,
            source,
            planned: true,
            title: () => spec.title,
            enabled: () => false,
            run: () => {},
            release: null,
            shortcuts: [],
            contexts: [],
            menuPath: spec.menuPath,
            menuOrder: spec.menuOrder ?? DEFAULT_MENU_ORDER,
            contextMenus: [],
        };
    };

    const registered = new Map<string, Entry<Menu, Context>>();
    const planned = new Map<string, { spec: PlannedCommandSpec<Menu>; command: Cmd }>();
    const listeners = new Set<() => void>();
    let version = 0;
    let listed: readonly Cmd[] | null = null;

    const changed = () => {
        version++;
        listed = null;
        // A snapshot: a listener added or removed while the others run takes effect next time.
        for (const listener of Array.from(listeners)) listener();
    };

    /** A registered command takes the menu position planned for its id, when there is one. */
    const resolveAgain = (id: string) => {
        const entry = registered.get(id);
        if (!entry) return;
        entry.command = resolveSpec(entry.spec, entry.command.source, planned.get(id)?.spec);
    };

    /**
     * Two commands without an `enabled` condition that bind one chord in one context are
     * enabled together in every state, so the key could never tell them apart (SPEC §7.1).
     */
    const checkChordConflict = (entry: Entry<Menu, Context>) => {
        if (entry.spec.enabled !== undefined) return;
        const { command } = entry;
        for (const other of registered.values()) {
            if (other.spec.enabled !== undefined) continue;
            for (const context of command.contexts) {
                if (!other.command.contexts.includes(context)) continue;
                const chord = command.shortcuts.find((shortcut) =>
                    other.command.shortcuts.includes(shortcut),
                );
                if (chord === undefined) continue;
                throw new RegistrationError(
                    `Commands "${other.command.id}" (${other.command.source}) and ` +
                        `"${command.id}" (${command.source}) both bind "${chord}" in the ` +
                        `"${context}" context, and neither has an enabled condition.`,
                    command.source,
                );
            }
        }
    };

    const all = (): readonly Cmd[] => {
        if (listed) return listed;
        const replaced = new Set<string>();
        for (const { spec } of registered.values()) {
            for (const id of spec.replaces ?? []) replaced.add(id);
        }
        const commands = [...registered.values()].map((entry) => entry.command);
        for (const [id, { command }] of planned) {
            if (!registered.has(id) && !replaced.has(id)) commands.push(command);
        }
        commands.sort((a, b) => compareCodeUnits(a.id, b.id));
        listed = commands;
        return listed;
    };

    return {
        menus,
        contexts,

        register(spec, source = "runtime") {
            const existing = registered.get(spec.id);
            if (existing) {
                throw new RegistrationError(
                    `Command id "${spec.id}" is used by ${existing.command.source} and ${source}.`,
                    source,
                );
            }
            const entry: Entry<Menu, Context> = {
                spec,
                command: resolveSpec(spec, source, planned.get(spec.id)?.spec),
            };
            checkChordConflict(entry);
            registered.set(spec.id, entry);
            changed();
            return () => {
                if (registered.get(spec.id) !== entry) return;
                registered.delete(spec.id);
                changed();
            };
        },

        plan(spec, source = "runtime") {
            const existing = planned.get(spec.id);
            if (existing) {
                throw new RegistrationError(
                    `Planned command id "${spec.id}" is used by ${existing.command.source} ` +
                        `and ${source}.`,
                    source,
                );
            }
            const entry = { spec, command: resolvePlanned(spec, source) };
            planned.set(spec.id, entry);
            resolveAgain(spec.id);
            changed();
            return () => {
                if (planned.get(spec.id) !== entry) return;
                planned.delete(spec.id);
                resolveAgain(spec.id);
                changed();
            };
        },

        get: (id) => all().find((command) => command.id === id),
        list: all,

        bindings: (context, chord) =>
            all().filter(
                (command) =>
                    command.contexts.includes(context) && command.shortcuts.includes(chord),
            ),
        isBound: (chord) => all().some((command) => command.shortcuts.includes(chord)),

        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        version: () => version,
        refresh: changed,
    };
}

/**
 * Registers what the editor's `*.commands.ts(x)` modules export, modules in UTF-16 code-unit
 * order of their paths (SPEC §1.3). Plans go first, so a command finds the menu position
 * planned for it whatever the module order. Throws a `RegistrationError` naming the module.
 */
export function registerCommandModules<Menu extends string, Context extends string>(
    registry: CommandRegistry<Menu, Context>,
    modules: ModuleMap<CommandModule<Menu, Context>>,
): void {
    registerModules(modules, (module, path) => {
        if (!module.commands && !module.plannedCommands) {
            throw new RegistrationError(
                `${path} exports neither "commands" nor "plannedCommands".`,
                path,
            );
        }
        for (const spec of module.plannedCommands ?? []) registry.plan(spec, path);
    });
    registerModules(modules, (module, path) => {
        for (const spec of module.commands ?? []) registry.register(spec, path);
    });
}

/** A chord that more than one enabled command binds in one context. */
export interface ChordConflict<Context extends string = string> {
    context: KeyContext<Context>;
    chord: string;
    /** Ids of the enabled commands that share the chord. */
    commands: string[];
}

/**
 * Every chord that two or more commands enabled right now bind in the same context. Commands
 * may share a chord in a context only when their `enabled` conditions exclude each other
 * (arrows nudge with a selection and change the frame without one); an editor runs this check
 * in the states where its set of enabled commands differs.
 */
export function findChordConflicts<Menu extends string, Context extends string>(
    registry: Pick<CommandRegistry<Menu, Context>, "contexts" | "list">,
): ChordConflict<Context>[] {
    const enabled = registry.list().filter((command) => command.enabled());
    const conflicts: ChordConflict<Context>[] = [];
    for (const context of registry.contexts) {
        const byChord = new Map<string, string[]>();
        for (const command of enabled) {
            if (!command.contexts.includes(context)) continue;
            for (const chord of command.shortcuts) {
                byChord.set(chord, [...(byChord.get(chord) ?? []), command.id]);
            }
        }
        for (const [chord, commands] of byChord) {
            if (commands.length > 1) conflicts.push({ context, chord, commands });
        }
    }
    return conflicts;
}
