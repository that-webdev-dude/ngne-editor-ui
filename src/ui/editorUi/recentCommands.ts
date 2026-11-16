import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";
import {
    readRecentCommands,
    withRecentCommand,
    writeRecentCommands,
} from "../../model/commands/recentCommands.js";
import { storageFailures } from "../platform/storage.js";
import type { KeyValueStorage } from "../platform/storage.js";

// The commands last run from the command palette, one store per editor UI instance, kept under
// the instance's `<id>.recent-commands` (SPEC §5) so an editor keeps its users' list. The
// list's rules are the model's (`withRecentCommand`).

export interface RecentCommandsState {
    /** Command ids, newest first, each once, at most `MAX_RECENT_COMMANDS`. */
    ids: readonly string[];
    /** Puts a command at the front of the list. */
    record(id: string): void;
}

/**
 * A list kept in `storage` under `key`; `null` keeps it in memory only. A failed write is
 * reported once per page and the list stays in effect.
 */
export function createRecentCommandsStore(
    storage: KeyValueStorage | null,
    key: string,
): StoreApi<RecentCommandsState> {
    return createStore<RecentCommandsState>((set, get) => ({
        ids: readRecentCommands(storage, key),
        record(id) {
            const ids = withRecentCommand(get().ids, id);
            set({ ids });
            writeRecentCommands(storage, key, ids, (error) => storageFailures.report(error));
        },
    }));
}
