import type { RailSlot, ToolBase, ToolOptionValue } from "@ngne/editor-ui/shell";
import type { LucideIcon } from "lucide-react";
import { createStore } from "zustand/vanilla";

// The demo editor's tools (SPEC §8): its tool type, and the store its tool rail and context bar
// read through `toolState.ts`, kept as an editor keeps it: the tool the user selected and the
// option values the user set, by tool and option key. Its tool sets, as an editor shows the
// tools of the active layer's kind: each tool names its sets (`toolSets`, SPEC §8 Tools), the
// rail's filter keeps the slots of the chosen set and those in every set (the navigation
// group), and "All" passes no filter. The two sets share a key, as the tilemap's sets do: G is
// the Paint set's fill and the Select set's magic wand. The floating selection's flag: while it
// is up, the context bar shows the `*.contextbar.tsx` content in the options' place.

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

/** The sets the demo's tools name: one set each, or none for every set. */
export const PAINT_SET: readonly string[] = ["paint"];
export const SELECT_SET: readonly string[] = ["select"];

export const TOOL_SETS: readonly { value: ToolSet; label: string }[] = [
    { value: "paint", label: "Paint" },
    { value: "select", label: "Select" },
    { value: "all", label: "All" },
];

export const toolSetStore = createStore<{ readonly set: ToolSet }>(() => ({ set: "paint" }));

export function setToolSet(set: ToolSet): void {
    toolSetStore.setState({ set });
}

/** The rail's filter for a set: the slots of that set and those in every set; none for "All". */
export function toolSetFilter(set: ToolSet): ((slot: RailSlot<DemoTool>) => boolean) | undefined {
    if (set === "all") return undefined;
    return (slot) => slot.toolSets === undefined || slot.toolSets.includes(set);
}

/** The rail footer's height: two colour chips stacked, 2 × 28 px and the gap between them. */
export const RAIL_FOOTER_HEIGHT = 58;

export const floatingStore = createStore<{ readonly floating: boolean }>(() => ({
    floating: false,
}));

export function setFloating(floating: boolean): void {
    floatingStore.setState({ floating });
}
