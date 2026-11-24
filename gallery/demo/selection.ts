import { createStore } from "zustand/vanilla";

// The demo editor's selection, as far as its selection tools' command buttons need one (SPEC
// §8 Tools): none, the whole canvas, or the canvas inverted from a selection. The commands
// that use it (`selection.commands.ts`) are enabled by it, and the instance refreshes them
// when it changes (`refreshOn`), so the context bar's buttons follow.

/** The ids of the selection commands, which the marquees' command buttons name. */
export const SELECT_ALL_COMMAND = "demo.select.all";
export const DESELECT_COMMAND = "demo.select.deselect";
export const INVERT_SELECTION_COMMAND = "demo.select.invert";
export const CROP_TO_SELECTION_COMMAND = "demo.select.crop";
export const FILL_SELECTION_COMMAND = "demo.select.fill";
export const STROKE_SELECTION_COMMAND = "demo.select.stroke";

export type Selection = "none" | "all" | "inverted";

export const selectionStore = createStore<{ readonly selection: Selection }>(() => ({
    selection: "none",
}));

export function setSelection(selection: Selection): void {
    selectionStore.setState({ selection });
}

export const hasSelection = (): boolean => selectionStore.getState().selection !== "none";
