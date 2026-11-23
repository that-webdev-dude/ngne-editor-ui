// The tools of an editor, as the tool rail and the context bar see them (SPEC §8, BRIEF D18).
// A tool is declared in a module of its own named `*.tools.ts(x)` that exports `tools` (and
// `plannedTools`); the editor finds the modules with one `import.meta.glob` line and passes the
// map (SPEC §1.3), so no shared file is edited (RULES 3).
//
// `ToolBase` holds only what the rail and the context bar need. An editor extends it with its
// own behaviour, pointer handlers, stroke and document types included, and the registry hands
// its tools back with that type (`createToolRegistry<Tool>()`). Generic over the icon type, so
// this layer imports no React or icon package (SPEC §1.1).

export type ToolOptionValue = number | boolean | string;

interface ToolOptionBase {
    /** The option's name in the tool's options: "size". */
    key: string;
    /** Label in the context bar: "Size". */
    label: string;
}

/** A number, shown as a number field (DESIGN §4). */
export interface NumberToolOption extends ToolOptionBase {
    kind: "number";
    min: number;
    max: number;
    /** Step of the arrow keys and the grid values snap to; the default is 1. */
    step?: number;
    /** Unit shown after the value: "px", "%". */
    unit?: string;
    default: number;
}

/** On or off, shown as a toggle with its label (DESIGN §4). */
export interface ToggleToolOption extends ToolOptionBase {
    kind: "toggle";
    default: boolean;
}

/** One of a few values, shown as a segmented control, or as a select with `display`. */
export interface ChoiceToolOption extends ToolOptionBase {
    kind: "choice";
    choices: readonly { value: string; label: string }[];
    default: string;
    /** The default is "segmented". */
    display?: "segmented" | "select";
}

/**
 * One option of a tool. The context bar shows the options of the active tool in the order the
 * tool lists them (DESIGN §2).
 */
export type ToolOptionSpec = NumberToolOption | ToggleToolOption | ChoiceToolOption;

/**
 * A key that makes a tool the active one while it is held ("Space", "Alt"). The editor binds
 * it and decides when it acts; the registry checks the chord and that no other tool uses it.
 */
export interface ToolHoldKey {
    /** The chord of the held key, in the notation of the commands' chords (SPEC §7.2). */
    key: string;
}

/**
 * What the tool rail and the context bar need of a tool (SPEC §8). Every other field of an
 * editor's tool, its handlers among them, is the editor's own.
 */
export interface ToolBase<Icon = unknown> {
    /** Stable and unique: "pencil". The id of a planned rail slot takes that slot. */
    id: string;
    /** Name in the rail's tooltip and the context bar: "Pencil". */
    label: string;
    /** Rail icon; a planned slot supplies one when the tool does not. */
    icon?: Icon;
    /** Key that selects the tool, bound in the `canvas` context (SPEC §7.2): "B". */
    shortcut?: string;
    /** A key that makes the tool the active one while it is held. */
    hold?: ToolHoldKey;
    /**
     * Position in the tool rail, ascending; positions that differ in the hundreds are in
     * different groups (`railGroups`). A tool without one takes the position of the planned
     * slot of its id, or is not in the rail. For a variant (`variantOf`) it orders the variants
     * of its slot.
     */
    railOrder?: number;
    /**
     * The rail slot this tool shares as a variant: the id of the slot's own tool or planned
     * slot. The slot's button switches between its variants; the variant has no slot of its
     * own.
     */
    variantOf?: string;
    /** The options the context bar shows while the tool is active. */
    options?: readonly ToolOptionSpec[];
    /**
     * The tool sets the tool is offered in, by the editor's names ("tile", "marker"), when the
     * editor offers one set at a time (the tilemap offers the tools of the active layer's kind).
     * Tools never offered together may share a key; two tools of one set may not. A tool
     * without sets is in every set. A tool takes its planned slot's sets unless it names its
     * own; the rail's filter may read them (`RailSlot.toolSets`).
     */
    toolSets?: readonly string[];
}

/** The icon type of a tool type. */
export type ToolIcon<Tool extends ToolBase> = NonNullable<Tool["icon"]>;

/** A tool as the registry holds it: the editor's tool, with what its planned slot supplies. */
export type RegisteredTool<Tool extends ToolBase> = Tool & {
    /** The module that registered it, as the module map keys it; used in error messages. */
    readonly source: string;
    readonly options: readonly ToolOptionSpec[];
    /** Its position in the rail, or undefined when it is not in the rail. */
    readonly railOrder: number | undefined;
};

/**
 * A slot of the tool rail for a tool not implemented yet: shown disabled until a tool with the
 * same id is registered, which then takes it over, its key, icon and position included unless
 * the tool names its own.
 */
export interface PlannedToolSpec<Icon = unknown> {
    id: string;
    label: string;
    shortcut?: string;
    icon: Icon;
    railOrder: number;
    /** The tool sets the slot is offered in, as `ToolBase.toolSets`; none for every set. */
    toolSets?: readonly string[];
}

/** What a `*.tools.ts(x)` module exports (at least one of the two). */
export interface ToolModule<Tool extends ToolBase = ToolBase> {
    tools?: readonly Tool[];
    plannedTools?: readonly PlannedToolSpec<ToolIcon<Tool>>[];
}

/** One button of the tool rail: a registered tool, or the planned slot of one. */
export interface RailSlot<Tool extends ToolBase = ToolBase> {
    readonly id: string;
    readonly label: string;
    readonly shortcut: string | undefined;
    readonly icon: ToolIcon<Tool> | undefined;
    readonly railOrder: number;
    /**
     * The tool sets the slot is offered in: those of the slot's own tool, or of its planned slot
     * while it has none; undefined for every set.
     */
    readonly toolSets: readonly string[] | undefined;
    /**
     * The tool of the slot's id, or the first of its variants when there is none; null while
     * the slot is planned only.
     */
    readonly tool: RegisteredTool<Tool> | null;
    /**
     * Every tool of the slot: the tool of its id first, then the tools that name it in
     * `variantOf`, by their `railOrder` and then their id. More than one means the button
     * switches between them.
     */
    readonly variants: readonly RegisteredTool<Tool>[];
}
