import { normalizeChord } from "../commands/chord.js";
import { compareCodeUnits, RegistrationError, registerModules } from "../modules.js";
import type { ModuleMap } from "../modules.js";
import type {
    PlannedToolSpec,
    RailSlot,
    RegisteredTool,
    ToolBase,
    ToolIcon,
    ToolAction,
    ToolModule,
    ToolOptionSpec,
} from "./types.js";

// The tool registry of an editor (SPEC §1.3, §8): the tool rail, the context bar and the
// editor's tool keys read it. Generic over the editor's tool type (BRIEF D18): the registry
// checks and orders what `ToolBase` declares and hands back the editor's tools unchanged
// otherwise. Registration errors throw a `RegistrationError` naming the module, so a broken
// module stops the editor at startup: an id used twice, an invalid option, action, key or tool
// set, a key that two tools of one tool set use.

export interface ToolRegistry<Tool extends ToolBase = ToolBase> {
    /** Adds a tool; returns the function that removes it. Throws `RegistrationError`. */
    register(spec: Tool, source?: string): () => void;
    /**
     * Adds the rail slot of a tool not implemented yet; returns its remover, which throws, and
     * keeps the slot, when the slot's tool would then share a key in a set it joins.
     */
    plan(spec: PlannedToolSpec<ToolIcon<Tool>>, source?: string): () => void;
    /** The registered tool with this id. */
    get(id: string): RegisteredTool<Tool> | undefined;
    /** Every registered tool, by id in UTF-16 code-unit order. */
    list(): readonly RegisteredTool<Tool>[];
    /**
     * The buttons of the rail in order: registered tools and planned slots, each with its
     * variants. A variant of a slot that does not exist is not in the rail.
     */
    railSlots(): readonly RailSlot<Tool>[];
    /** Calls `listener` when a tool or a slot is added or removed. */
    subscribe(listener: () => void): () => void;
    /** Changes whenever `subscribe` listeners are called; a snapshot for React. */
    version(): number;
}

function checkOption(option: ToolOptionSpec, fail: (problem: string) => never): void {
    const { key } = option;
    if (key.trim() === "") fail("has an option without a key.");
    switch (option.kind) {
        case "number":
            if (!(option.min <= option.default && option.default <= option.max)) {
                fail(`has option "${key}" with a default outside ${option.min}..${option.max}.`);
            }
            break;
        case "toggle":
            // Checked although typed: a module may be plain JavaScript data.
            if ((option.default as unknown) !== true && (option.default as unknown) !== false) {
                fail(`has toggle "${key}" without a true or false default.`);
            }
            break;
        case "choice":
            if (!option.choices.some((choice) => choice.value === option.default)) {
                fail(`has choice "${key}" whose default is not one of its choices.`);
            }
            break;
        default:
            fail(`has option "${key}" of an unknown kind.`);
    }
}

/** Checks a tool's command buttons: each names a command and a label, no command twice. */
function checkActions(actions: readonly ToolAction[], fail: (problem: string) => never): void {
    // Checked although typed: a module may be plain JavaScript data.
    if (!Array.isArray(actions)) fail("has actions that are not a list.");
    const commands = new Set<string>();
    for (const action of actions) {
        const { commandId, label } = action as Partial<ToolAction>;
        if (typeof commandId !== "string" || commandId.trim() === "") {
            fail("has an action without a command id.");
        }
        if (typeof label !== "string" || label.trim() === "") {
            fail(`has action "${commandId}" without a label.`);
        }
        if (commands.has(commandId)) fail(`lists action "${commandId}" twice.`);
        commands.add(commandId);
    }
}

/** The canonical form of `chord`; `fail` reports an invalid one. */
function checkedChord(chord: string, fail: (problem: string) => never): string {
    try {
        return normalizeChord(chord);
    } catch (error) {
        return fail(`has an invalid key: ${error instanceof Error ? error.message : error}`);
    }
}

/** Checks a tool's or planned slot's sets: none, or a list of named sets. */
function checkToolSets(sets: readonly string[] | undefined, fail: (problem: string) => never) {
    if (sets === undefined) return;
    // Checked although typed: a module may be plain JavaScript data.
    if (!Array.isArray(sets)) fail("has tool sets that are not a list.");
    if (sets.length === 0) fail("lists no tool set; leave the sets out for every set.");
    if (sets.some((set) => typeof set !== "string" || set.trim() === "")) {
        fail("has a tool set without a name.");
    }
}

function resolveTool<Tool extends ToolBase>(
    spec: Tool,
    source: string,
    planned?: PlannedToolSpec<ToolIcon<Tool>>,
): RegisteredTool<Tool> {
    const fail = (problem: string): never => {
        throw new RegistrationError(`Tool "${spec.id}" (${source}) ${problem}`, source);
    };
    if (spec.id.trim() === "") {
        throw new RegistrationError(`A tool of ${source} has no id.`, source);
    }
    if (spec.label.trim() === "") fail("has no label.");
    const options = [...(spec.options ?? [])];
    const keys = new Set<string>();
    for (const option of options) {
        checkOption(option, fail);
        if (keys.has(option.key)) fail(`lists option "${option.key}" twice.`);
        keys.add(option.key);
    }
    const actions = spec.actions ?? [];
    checkActions(actions, fail);
    for (const chord of [spec.shortcut, spec.hold?.key]) {
        if (chord !== undefined) checkedChord(chord, fail);
    }
    if (spec.railOrder !== undefined && !Number.isFinite(spec.railOrder)) {
        fail("has a rail position that is not a number.");
    }
    if (spec.variantOf?.trim() === "") fail("is a variant of a slot without an id.");
    checkToolSets(spec.toolSets, fail);
    // A variant shows its slot's icon when it has none of its own.
    const variant = spec.variantOf !== undefined && spec.variantOf !== spec.id;
    const tool = {
        ...spec,
        source,
        icon: spec.icon ?? planned?.icon,
        shortcut: spec.shortcut ?? planned?.shortcut,
        railOrder: spec.railOrder ?? planned?.railOrder,
        toolSets: spec.toolSets ?? planned?.toolSets,
        options,
        actions: [...actions],
    } as RegisteredTool<Tool>;
    if (tool.railOrder !== undefined && tool.icon === undefined && !variant) {
        fail("is in the rail but has no icon.");
    }
    return tool;
}

function byId<Item extends { readonly id: string }>(a: Item, b: Item): number {
    return compareCodeUnits(a.id, b.id);
}

/**
 * The id of the rail slot a tool belongs to: the slot it is a variant of (`variantOf`), or its
 * own id.
 */
export function slotOf(tool: Pick<ToolBase, "id" | "variantOf">): string {
    return tool.variantOf ?? tool.id;
}

/** Variants by their rail position (none last), then by id. */
function byVariantOrder(
    a: { readonly id: string; readonly railOrder: number | undefined },
    b: { readonly id: string; readonly railOrder: number | undefined },
): number {
    return (a.railOrder ?? Infinity) - (b.railOrder ?? Infinity) || byId(a, b);
}

/** Who uses a key: the tool or planned slot of `id`, from the module `source`, in its sets. */
interface KeyUser {
    readonly id: string;
    readonly source: string;
    /** The tool sets it is offered in; none for every set. */
    readonly toolSets?: readonly string[];
}

/** Whether two key users can be offered together: one is in every set, or they share one. */
function offeredTogether(a: KeyUser, b: KeyUser): boolean {
    const theirs = b.toolSets;
    if (a.toolSets === undefined || theirs === undefined) return true;
    return a.toolSets.some((set) => theirs.includes(set));
}

export function createToolRegistry<Tool extends ToolBase>(): ToolRegistry<Tool> {
    type Planned = PlannedToolSpec<ToolIcon<Tool>>;
    const specs = new Map<string, { spec: Tool; tool: RegisteredTool<Tool> }>();
    const planned = new Map<string, { spec: Planned; source: string }>();
    const listeners = new Set<() => void>();
    let version = 0;
    let slots: readonly RailSlot<Tool>[] | null = null;
    let tools: readonly RegisteredTool<Tool>[] | null = null;

    const changed = () => {
        version++;
        slots = null;
        tools = null;
        // A snapshot: a listener added or removed while the others run takes effect next time.
        for (const listener of Array.from(listeners)) listener();
    };

    /** The keys a registered tool uses: its own or its slot's, and its hold key, canonical. */
    const toolKeys = (tool: RegisteredTool<Tool>) =>
        [tool.shortcut, tool.hold?.key].flatMap((chord) =>
            chord === undefined ? [] : [normalizeChord(chord)],
        );

    /**
     * The keys in use by every tool and planned slot but those of `id`, canonical, with their
     * users. A planned slot keeps its key for its id, also while its tool names another.
     */
    const keysExcept = (id: string) => {
        const users: { readonly chord: string; readonly user: KeyUser }[] = [];
        for (const [other, { tool }] of specs) {
            if (other === id) continue;
            for (const chord of toolKeys(tool)) users.push({ chord, user: tool });
        }
        for (const [other, { spec, source }] of planned) {
            if (other === id || spec.shortcut === undefined) continue;
            const user = { id: other, source, toolSets: spec.toolSets };
            users.push({ chord: normalizeChord(spec.shortcut), user });
        }
        return users;
    };

    /**
     * Throws when a key of `user` is in use by another tool or planned slot offered with it:
     * one of its tool sets, or any when either is in every set (SPEC §8 Tools).
     */
    const checkKeys = (user: KeyUser, noun: string, keys: readonly string[]) => {
        const users = keysExcept(user.id);
        for (const chord of keys) {
            const other = users.find(
                (entry) => entry.chord === chord && offeredTogether(user, entry.user),
            )?.user;
            if (other === undefined) continue;
            throw new RegistrationError(
                `${noun} "${user.id}" (${user.source}) uses key "${chord}", as ` +
                    `"${other.id}" (${other.source}) does.`,
                user.source,
            );
        }
    };

    /**
     * The registered tool of `id` as it is with `plan` as the slot planned for its id, which
     * supplies its key and sets where it names none, its keys checked again; returns what puts
     * it in place. A plan added or removed may change both.
     */
    const retake = (id: string, plan: Planned | undefined): (() => void) => {
        const entry = specs.get(id);
        if (!entry) return () => undefined;
        const tool = resolveTool(entry.spec, entry.tool.source, plan);
        checkKeys(tool, "Tool", toolKeys(tool));
        return () => {
            entry.tool = tool;
        };
    };

    return {
        register(spec, source = "runtime") {
            const existing = specs.get(spec.id);
            if (existing) {
                throw new RegistrationError(
                    `Tool id "${spec.id}" is used by ${existing.tool.source} and ${source}.`,
                    source,
                );
            }
            const tool = resolveTool(spec, source, planned.get(spec.id)?.spec);
            checkKeys(tool, "Tool", toolKeys(tool));
            const entry = { spec, tool };
            specs.set(spec.id, entry);
            changed();
            return () => {
                if (specs.get(spec.id) !== entry) return;
                specs.delete(spec.id);
                changed();
            };
        },

        plan(spec, source = "runtime") {
            const existing = planned.get(spec.id);
            if (existing) {
                throw new RegistrationError(
                    `Planned tool id "${spec.id}" is used by ${existing.source} and ${source}.`,
                    source,
                );
            }
            const fail = (problem: string): never => {
                throw new RegistrationError(
                    `Planned tool "${spec.id}" (${source}) ${problem}`,
                    source,
                );
            };
            if (!Number.isFinite(spec.railOrder)) fail("has no rail position.");
            checkToolSets(spec.toolSets, fail);
            if (spec.shortcut !== undefined) {
                const key = checkedChord(spec.shortcut, fail);
                checkKeys({ id: spec.id, source, toolSets: spec.toolSets }, "Planned tool", [key]);
            }
            const take = retake(spec.id, spec);
            const entry = { spec, source };
            planned.set(spec.id, entry);
            take();
            changed();
            // Throws, and keeps the plan, when its tool would then share a key with a tool of
            // a set it joins: one that names no sets of its own joins every set.
            return () => {
                if (planned.get(spec.id) !== entry) return;
                const giveBack = retake(spec.id, undefined);
                planned.delete(spec.id);
                giveBack();
                changed();
            };
        },

        get: (id) => specs.get(id)?.tool,

        list() {
            tools ??= [...specs.values()].map((entry) => entry.tool).sort(byId);
            return tools;
        },

        railSlots() {
            if (slots) return slots;
            // The variants of each slot: the tools that name it, in their order.
            const variants = new Map<string, RegisteredTool<Tool>[]>();
            for (const { tool } of specs.values()) {
                const slot = slotOf(tool);
                if (slot === tool.id) continue;
                variants.set(slot, [...(variants.get(slot) ?? []), tool]);
            }
            for (const list of variants.values()) list.sort(byVariantOrder);
            const all: RailSlot<Tool>[] = [];
            const placed = new Set<string>();
            for (const { tool } of specs.values()) {
                if (slotOf(tool) !== tool.id || tool.railOrder === undefined) continue;
                placed.add(tool.id);
                all.push({
                    id: tool.id,
                    label: tool.label,
                    shortcut: tool.shortcut,
                    icon: tool.icon as ToolIcon<Tool> | undefined,
                    railOrder: tool.railOrder,
                    toolSets: tool.toolSets,
                    tool,
                    variants: [tool, ...(variants.get(tool.id) ?? [])],
                });
            }
            for (const [id, { spec }] of planned) {
                if (placed.has(id)) continue;
                const list = variants.get(id) ?? [];
                all.push({
                    id,
                    label: spec.label,
                    shortcut: spec.shortcut,
                    icon: spec.icon,
                    railOrder: spec.railOrder,
                    toolSets: spec.toolSets,
                    tool: list[0] ?? null,
                    variants: list,
                });
            }
            // Equal positions by id, so the rail does not depend on module order.
            all.sort((a, b) => a.railOrder - b.railOrder || byId(a, b));
            slots = all;
            return slots;
        },

        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        version: () => version,
    };
}

/**
 * Registers what the editor's `*.tools.ts(x)` modules export, modules in UTF-16 code-unit order
 * of their paths (SPEC §1.3, BRIEF D14). Plans go first, so a tool finds the slot planned for
 * it whatever the module order. Throws a `RegistrationError` naming the module.
 */
export function registerToolModules<Tool extends ToolBase>(
    registry: ToolRegistry<Tool>,
    modules: ModuleMap<ToolModule<Tool>>,
): void {
    registerModules(modules, (module, path) => {
        if (!Array.isArray(module.tools) && !Array.isArray(module.plannedTools)) {
            throw new RegistrationError(
                `${path} exports neither "tools" nor "plannedTools".`,
                path,
            );
        }
        for (const spec of module.plannedTools ?? []) registry.plan(spec, path);
    });
    registerModules(modules, (module, path) => {
        for (const spec of module.tools ?? []) registry.register(spec, path);
    });
}

/** The rail's slots in groups: positions that differ in the hundreds are in different groups. */
export function railGroups<Slot extends { readonly railOrder: number }>(
    slots: readonly Slot[],
): Slot[][] {
    const groups: Slot[][] = [];
    let group = Number.NaN;
    for (const slot of slots) {
        const hundreds = Math.floor(slot.railOrder / 100);
        if (hundreds !== group || groups.length === 0) {
            groups.push([]);
            group = hundreds;
        }
        groups.at(-1)?.push(slot);
    }
    return groups;
}
