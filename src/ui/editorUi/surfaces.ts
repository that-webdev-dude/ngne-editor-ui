import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

// The surfaces of DESIGN §4 and §7 that a command opens without asking for an answer: the
// package's command palette and shortcut sheet, and the editor's own (`surfaces`, SPEC §5),
// such as its Preferences dialog. One set per editor UI instance (SPEC §1.2). A command opens
// one; the interface shows it and closes it.

export interface SurfaceState {
    /** The surface that is open, or null. */
    open: string | null;
}

export interface Surfaces {
    /** The package's surfaces, then the editor's. */
    readonly ids: readonly string[];
    readonly store: StoreApi<SurfaceState>;
    /** Opens a surface. One at a time: it takes the place of the one that is open. */
    open(id: string): void;
    /** Closes the open surface; with an id, only when that one is open. */
    close(id?: string): void;
}

/** The surfaces `ids`; opening any other id throws. */
export function createSurfaces(ids: readonly string[]): Surfaces {
    const store = createStore<SurfaceState>(() => ({ open: null }));
    const known = new Set(ids);
    return {
        ids: [...ids],
        store,
        open(id) {
            if (!known.has(id)) throw new Error(`There is no surface "${id}".`);
            if (store.getState().open !== id) store.setState({ open: id });
        },
        close(id) {
            const { open } = store.getState();
            if (open !== null && (id === undefined || id === open)) store.setState({ open: null });
        },
    };
}
