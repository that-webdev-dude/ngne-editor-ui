// Synthetic module maps of the startup budget (docs/SPEC.md §2): 300 command specs in 30
// `*.commands.ts` modules and 30 modules for each other registry of SPEC §1.3, keyed by paths
// as an app's `import.meta.glob` gives them. The startup benchmark passes them to
// `createEditorUi` as `modules` (SPEC §5).
//
// The entry types are local and structural: the package's registry types do not exist yet, and
// the fixture must not depend on any one ticket's version of them. Every id is unique within
// its registry; every command chord is distinct, in canonical form (modifiers in the order
// Ctrl, Alt, Shift, Meta; letters upper case) and none of the package's own chords; every
// path sorts the same by UTF-16 code unit as by insertion.

/** Commands, and modules per registry, of the startup budget (SPEC §2). */
export const COMMAND_COUNT = 300;
export const COMMAND_MODULE_COUNT = 30;
export const REGISTRY_MODULE_COUNT = 30;

/** Menu bar the synthetic commands are placed in; contains `View` and ends with `Help` (SPEC §5). */
export const SYNTHETIC_MENUS = ["File", "Edit", "View", "Help"] as const;

/** Chords of the package's own commands (DESIGN §4, §7, §8), which no synthetic command binds. */
export const PACKAGE_CHORDS: readonly string[] = ["Ctrl+K", "?", "F6", "Shift+F6"];

const COMMANDS_PER_MODULE = COMMAND_COUNT / COMMAND_MODULE_COUNT;

/** The package's base contexts the synthetic commands bind in (SPEC §7.2). */
const COMMAND_CONTEXTS = ["global", "canvas"] as const;

/** Menus a synthetic command is placed in: every menu but Help, whose items the package owns. */
const COMMAND_MENUS = SYNTHETIC_MENUS.filter((menu) => menu !== "Help");

const LETTERS = Array.from({ length: 26 }, (_, index) => String.fromCodePoint(65 + index));

/**
 * Modifier sets of the command chords, each in canonical order. Ctrl, Shift and Ctrl+Shift
 * alone are left out, so no synthetic chord meets the package's or a browser's common chords.
 * 12 sets × 26 letters = 312 chords, enough for 300 commands.
 */
const MODIFIER_SETS = [
    "Alt",
    "Meta",
    "Ctrl+Alt",
    "Ctrl+Meta",
    "Alt+Shift",
    "Alt+Meta",
    "Shift+Meta",
    "Ctrl+Alt+Shift",
    "Ctrl+Alt+Meta",
    "Ctrl+Shift+Meta",
    "Alt+Shift+Meta",
    "Ctrl+Alt+Shift+Meta",
] as const;

/** Keys that select a synthetic tool, bound in the `canvas` context: A–Z, then 1–4. */
const TOOL_KEYS = [...LETTERS, "1", "2", "3", "4"];

export interface SyntheticCommandSpec {
    id: string;
    title: string;
    run(): void;
    enabled(): boolean;
    shortcut: string;
    context: (typeof COMMAND_CONTEXTS)[number];
    menuPath: readonly string[];
    menuOrder: number;
}

export interface SyntheticCommandDialog {
    kind: string;
    name: string;
    Component: () => null;
}

export interface SyntheticDockPanel {
    id: string;
    title: string;
    order: number;
    Body: () => null;
}

export interface SyntheticContextBarContent {
    id: string;
    order: number;
    shown(): boolean;
    subscribe(listener: () => void): () => void;
    Body: () => null;
}

export interface SyntheticToolSpec {
    id: string;
    label: string;
    shortcut: string;
    railOrder: number;
}

export interface SyntheticOverlayLayer {
    id: string;
    order: number;
    draw(frame: unknown): void;
}

export interface SyntheticStatusField {
    id: string;
    order: number;
    text(input: unknown): string;
}

/** The module maps of `EditorUiConfig.modules` (SPEC §5), one per registry of SPEC §1.3. */
export interface EditorUiModuleMaps {
    commands: Record<string, { commands: readonly SyntheticCommandSpec[] }>;
    dialogs: Record<string, { commandDialogs: readonly SyntheticCommandDialog[] }>;
    dock: Record<string, { dockPanel: SyntheticDockPanel }>;
    contextBars: Record<string, { contextBarContent: SyntheticContextBarContent }>;
    tools: Record<string, { tools: readonly SyntheticToolSpec[] }>;
    overlays: Record<string, { overlayLayers: readonly SyntheticOverlayLayer[] }>;
    statusFields: Record<string, { statusFields: readonly SyntheticStatusField[] }>;
}

const noop = (): void => undefined;
const always = (): boolean => true;
const never = (): boolean => false;
const unsubscribe = (): (() => void) => noop;
const Empty = (): null => null;
const emptyText = (): string => "";

/** Two-digit index, so paths and ids sort by code unit in index order. */
function pad(index: number): string {
    return String(index).padStart(2, "0");
}

/** The glob key of feature `index`'s module with `suffix`, as `/src/**` globs give it. */
function modulePath(layer: "app" | "ui", index: number, suffix: string): string {
    const feature = `feature-${pad(index)}`;
    return `/src/${layer}/${feature}/${feature}.${suffix}`;
}

function commandChord(index: number): string {
    const modifiers = MODIFIER_SETS[Math.floor(index / LETTERS.length)];
    return `${modifiers}+${LETTERS[index % LETTERS.length]}`;
}

function commandModule(moduleIndex: number): { commands: SyntheticCommandSpec[] } {
    const commands = Array.from({ length: COMMANDS_PER_MODULE }, (_, offset) => {
        const index = moduleIndex * COMMANDS_PER_MODULE + offset;
        return {
            id: `feature${pad(moduleIndex)}.command${pad(offset)}`,
            title: `Feature ${moduleIndex} Command ${offset}`,
            run: noop,
            enabled: always,
            shortcut: commandChord(index),
            context: COMMAND_CONTEXTS[index % COMMAND_CONTEXTS.length],
            menuPath: [COMMAND_MENUS[moduleIndex % COMMAND_MENUS.length]],
            menuOrder: 100 * (1 + Math.floor(offset / 5)) + offset,
        };
    });
    return { commands };
}

/** Builds the maps; a new set of objects on every call. */
export function createEditorUiModules(): EditorUiModuleMaps {
    const maps: EditorUiModuleMaps = {
        commands: {},
        dialogs: {},
        dock: {},
        contextBars: {},
        tools: {},
        overlays: {},
        statusFields: {},
    };
    for (let index = 0; index < COMMAND_MODULE_COUNT; index++) {
        maps.commands[modulePath("app", index, "commands.ts")] = commandModule(index);
    }
    for (let index = 0; index < REGISTRY_MODULE_COUNT; index++) {
        const id = `feature-${pad(index)}`;
        const order = 10 * (index + 1);
        maps.dialogs[modulePath("ui", index, "dialog.tsx")] = {
            commandDialogs: [{ kind: id, name: `Feature ${index}`, Component: Empty }],
        };
        maps.dock[modulePath("ui", index, "dock.tsx")] = {
            dockPanel: { id, title: `Feature ${index}`, order, Body: Empty },
        };
        maps.contextBars[modulePath("ui", index, "contextbar.tsx")] = {
            contextBarContent: { id, order, shown: never, subscribe: unsubscribe, Body: Empty },
        };
        maps.tools[modulePath("app", index, "tools.ts")] = {
            tools: [
                {
                    id,
                    label: `Feature ${index}`,
                    shortcut: TOOL_KEYS[index],
                    railOrder: 100 * (1 + Math.floor(index / 10)) + index,
                },
            ],
        };
        maps.overlays[modulePath("app", index, "overlay.ts")] = {
            overlayLayers: [{ id, order, draw: noop }],
        };
        maps.statusFields[modulePath("ui", index, "status.ts")] = {
            statusFields: [{ id, order, text: emptyText }],
        };
    }
    return maps;
}
