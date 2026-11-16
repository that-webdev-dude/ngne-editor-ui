// The commands last run from the command palette, newest first (SPEC §5, §7.1; DESIGN §4: the
// palette lists them before the others). They are kept in key-value storage under a key of
// their own, so the list survives a reload; it is not a preference. The storage and the key
// are parameters: the editor UI instance binds the key `<id>.recent-commands` (SPEC §5) and
// holds the list in its store.

export const MAX_RECENT_COMMANDS = 8;

/** The part of `Storage` the list uses; tests pass an in-memory one. */
export interface RecentCommandsStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

/** Reads a stored list. Anything that is not a list of ids gives an empty one; never throws. */
export function parseRecentCommands(stored: unknown): string[] {
    if (!Array.isArray(stored)) return [];
    const ids = stored.filter((id): id is string => typeof id === "string" && id !== "");
    return [...new Set(ids)].slice(0, MAX_RECENT_COMMANDS);
}

/** The list with `id` at the front: each id once, at most `MAX_RECENT_COMMANDS`. */
export function withRecentCommand(ids: readonly string[], id: string): string[] {
    return parseRecentCommands([id, ...ids]);
}

/**
 * The list stored under `key`. A missing storage, a missing or unreadable value and a storage
 * that throws all read as an empty list; never throws.
 */
export function readRecentCommands(storage: RecentCommandsStorage | null, key: string): string[] {
    let text: string | null;
    try {
        text = storage?.getItem(key) ?? null;
    } catch {
        return [];
    }
    if (text === null) return [];
    try {
        return parseRecentCommands(JSON.parse(text));
    } catch {
        return [];
    }
}

/**
 * Stores the list under `key`. Writes are best effort: a full or blocked storage must not
 * break the palette, so a write that fails is handed to `onWriteError` instead of thrown.
 * Returns whether the list was written; without a storage it is not, and nothing is reported.
 */
export function writeRecentCommands(
    storage: RecentCommandsStorage | null,
    key: string,
    ids: readonly string[],
    onWriteError: (error: unknown) => void = () => {},
): boolean {
    if (!storage) return false;
    try {
        storage.setItem(key, JSON.stringify(ids));
        return true;
    } catch (error) {
        onWriteError(error);
        return false;
    }
}
