import type { RailSlot, ToolBase, ToolOptionValue } from "@ngne/editor-ui/shell";
import type { LucideIcon } from "lucide-react";
import { createStore } from "zustand/vanilla";

// The demo editor's tools (SPEC §8): its tool type, and the store its tool rail and context bar
// read through `toolState.ts`, kept as an editor keeps it: the tool the user selected and the
// option values the user set, by tool and option key. Its tool sets, as an editor shows the
// tools of the active layer's kind: the rail's filter keeps the slots of the chosen set, every
// set keeps the navigation group, and "All" passes no filter. The floating selection's flag:
// while it is up, the context bar shows the `*.contextbar.tsx` content in the options' place.

/** A tool of the demo: the package's base with lucide icons, nothing of its own. */
export type DemoTool = ToolBase<LucideIcon>;

export interface ToolStoreState {
    /** The id of the selected tool. */
    readonly selected: string;
    /** What the user set, by tool id and option key. */
    readonly options: Readonly<Record<string, Readonly<Record<string, ToolOptionValue>>>>;
}

export const toolStore = createStore<ToolStoreState>(() => ({ selected: "pencil", options: {} }));

export function selectTool(id: string): void {
    if (toolStore.getState().selected !== id) toolStore.setState({ selected: id });
}

export function setToolOption(tool: string, key: string, value: ToolOptionValue): void {
    toolStore.setState((state) => ({
        options: { ...state.options, [tool]: { ...state.options[tool], [key]: value } },
    }));
}

export type ToolSet = "paint" | "select" | "all";

export const TOOL_SETS: readonly { value: ToolSet; label: string }[] = [
    { value: "paint", label: "Paint" },
    { value: "select", label: "Select" },
    { value: "all", label: "All" },
];

/** The rail groups of each set, by the hundreds of their rail positions; navigation in all. */
const SET_GROUPS: Readonly<Record<Exclude<ToolSet, "all">, readonly number[]>> = {
    paint: [2, 3, 4, 5],
    select: [1, 5],
};

export const toolSetStore = createStore<{ readonly set: ToolSet }>(() => ({ set: "paint" }));

export function setToolSet(set: ToolSet): void {
    toolSetStore.setState({ set });
}

/** The rail's filter for a set: the slots of its groups; none for "All". */
export function toolSetFilter(set: ToolSet): ((slot: RailSlot<DemoTool>) => boolean) | undefined {
    if (set === "all") return undefined;
    const groups = SET_GROUPS[set];
    return (slot) => groups.includes(Math.floor(slot.railOrder / 100));
}

/** The rail footer's height: two colour chips stacked, 2 × 28 px and the gap between them. */
export const RAIL_FOOTER_HEIGHT = 58;

export const floatingStore = createStore<{ readonly floating: boolean }>(() => ({
    floating: false,
}));

export function setFloating(floating: boolean): void {
    floatingStore.setState({ floating });
}
