import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

// Whether the bottom region is shown (DESIGN §2, SPEC §8), one store per editor UI instance.
// It is editor state outside any document and is not persisted: the region is shown again at
// every start, as both editors do. Tab toggles it while the viewport has focus
// (`bottomRegion.commands.ts`); the editor may show or hide it from its own code too. The
// editor may create the store itself, in a module that imports no instance, and pass it in
// `config.sources.bottomRegion` (SPEC §5): its modules then show or hide the region through
// the store, without the instance.

export interface BottomRegionState {
    /** The bottom region is shown. */
    readonly visible: boolean;
}

/** The store of the bottom region's visibility, or an editor UI instance that holds one. */
export type BottomRegionTarget =
    StoreApi<BottomRegionState> | { readonly bottomRegion: StoreApi<BottomRegionState> };

/** A store with the bottom region shown. */
export function createBottomRegionStore(): StoreApi<BottomRegionState> {
    return createStore<BottomRegionState>(() => ({ visible: true }));
}

/**
 * Shows or hides the bottom region in the store `target` is or holds (an editor UI instance,
 * or the store the editor passed in `config.sources`); nothing changes when it already is.
 */
export function setBottomRegionVisible(target: BottomRegionTarget, visible: boolean): void {
    const store = "bottomRegion" in target ? target.bottomRegion : target;
    if (store.getState().visible !== visible) store.setState({ visible });
}
