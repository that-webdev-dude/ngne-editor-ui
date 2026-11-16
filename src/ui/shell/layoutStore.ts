import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";
import { parseStoredLayout, storedLayout } from "../../model/shell/layout.js";
import type { LayoutSizes } from "../../model/shell/layout.js";
import { readJson, writeItem } from "../platform/storage.js";
import type { KeyValueStorage } from "../platform/storage.js";

// The splitter sizes of an editor's shell (DESIGN §2), one store per editor UI instance, kept
// under the instance's `<id>.layout` (SPEC §5) in the record both editors store today, so a
// migrating editor keeps its users' sizes. The limits apply when the shell renders
// (src/model/shell/layout.ts), so a size stored in a larger window survives a smaller one.

export interface LayoutState extends LayoutSizes {
    /** Sets the dock width chosen by the user; null returns to the default. */
    setDockWidth(width: number | null): void;
    /** Sets the bottom region height chosen by the user; null returns to the default. */
    setBottomHeight(height: number | null): void;
}

/**
 * A layout store kept in `storage` under `key`; anything malformed there is the default. A
 * failed write is reported once per page and the size stays in effect.
 */
export function createLayoutStore(
    storage: KeyValueStorage | null,
    key: string,
): StoreApi<LayoutState> {
    return createStore<LayoutState>((set, get) => {
        const update = (change: Partial<LayoutSizes>) => {
            set(change);
            writeItem(storage, key, JSON.stringify(storedLayout(get())));
        };
        return {
            ...parseStoredLayout(readJson(storage, key)),
            setDockWidth: (dockWidth) => update({ dockWidth }),
            setBottomHeight: (bottomHeight) => update({ bottomHeight }),
        };
    });
}
