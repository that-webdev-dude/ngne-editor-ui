import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

// Whether the bottom region is shown (DESIGN §2, SPEC §8), one store per editor UI instance.
// It is editor state outside any document and is not persisted: the region is shown again at
// every start, as both editors do. Tab toggles it while the viewport has focus
// (`bottomRegion.commands.ts`); the editor may show or hide it from its own code too.

export interface BottomRegionState {
    /** The bottom region is shown. */
    readonly visible: boolean;
}

/** A store with the bottom region shown. */
export function createBottomRegionStore(): StoreApi<BottomRegionState> {
    return createStore<BottomRegionState>(() => ({ visible: true }));
}

/** Shows or hides the bottom region of `editorUi`; nothing changes when it already is. */
export function setBottomRegionVisible(
    editorUi: { readonly bottomRegion: StoreApi<BottomRegionState> },
    visible: boolean,
): void {
    const store = editorUi.bottomRegion;
    if (store.getState().visible !== visible) store.setState({ visible });
}
