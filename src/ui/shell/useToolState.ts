import { useCallback, useSyncExternalStore } from "react";
import type {
    RailSlot,
    RegisteredTool,
    ToolBase,
    ToolOptionValue,
} from "../../model/tools/types.js";

// The editor's active-tool store as the tool rail and the context bar read it (SPEC §8): which
// tool is active, which variant a rail slot shows, the option values, and how to change them.
// The editor keeps the store, with its held keys, stroke state and stored options; the package
// reads it through this interface and renders again when it notifies.

/** What the editor's active-tool store gives the rail and the context bar (`AppShell` `tools`). */
export interface ToolStateSource<Tool extends ToolBase = ToolBase> {
    /**
     * The id of the active tool: the one the rail marks and the context bar shows (a tool held
     * with its key while it is held), or null for none.
     */
    activeId(): string | null;
    /**
     * The tool a rail slot's button shows: the active tool when it is one of the slot's, else
     * the slot's tool selected last, else `slot.tool`. Without it, the active tool when it is
     * one of the slot's, else `slot.tool`.
     */
    shownInSlot?(slot: RailSlot<Tool>): RegisteredTool<Tool> | null;
    /** Selects a registered tool, from the rail. */
    select(id: string): void;
    /** The values of a tool's options: the defaults, with what the user set over them. */
    options(tool: RegisteredTool<Tool>): Readonly<Record<string, ToolOptionValue>>;
    /** Sets one option of a tool, from the context bar. */
    setOption(tool: RegisteredTool<Tool>, key: string, value: ToolOptionValue): void;
    /** Calls `listener` whenever what the other methods return may have changed. */
    subscribe(listener: () => void): () => void;
    /** Changes whenever `subscribe` listeners are called; a snapshot for React. */
    version(): number;
}

/** The tool a slot's button shows, by the source's rule or the default one. */
export function shownInSlot<Tool extends ToolBase>(
    source: ToolStateSource<Tool>,
    slot: RailSlot<Tool>,
): RegisteredTool<Tool> | null {
    if (source.shownInSlot) return source.shownInSlot(slot);
    const active = source.activeId();
    return slot.variants.find((variant) => variant.id === active) ?? slot.tool;
}

/**
 * The editor's active-tool store, read in a component: it renders again when the store
 * notifies (the active or a selected tool, a hold, an option value).
 */
export function useToolState<Tool extends ToolBase>(
    source: ToolStateSource<Tool>,
): ToolStateSource<Tool> {
    // Called as methods, so a store written as a class keeps its `this`.
    const subscribe = useCallback((listener: () => void) => source.subscribe(listener), [source]);
    const version = useCallback(() => source.version(), [source]);
    useSyncExternalStore(subscribe, version, version);
    return source;
}
