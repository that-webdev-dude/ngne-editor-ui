import { describe, expect, it } from "vitest";
import {
    createCommandRegistry,
    MAX_RECENT_COMMANDS,
    paletteEntries,
    parseRecentCommands,
    readRecentCommands,
    runPaletteCommand,
    withRecentCommand,
    writeRecentCommands,
} from "../../src/ui/commands/index.ts";
import type { RecentCommandsStorage } from "../../src/ui/commands/index.ts";

// The recent commands of the palette (SPEC §5, §7.1): newest first, each once, capped, read and
// written through the storage and under the key the caller gives. A storage that is missing,
// unreadable or refuses writes leaves the palette working.

const KEY = "ngne-sprite-editor.recent-commands";

/** An in-memory storage that records every key it is asked for. */
function memoryStorage(initial: Record<string, string> = {}) {
    const data = new Map(Object.entries(initial));
    const keys: string[] = [];
    const storage: RecentCommandsStorage = {
        getItem(key) {
            keys.push(key);
            return data.get(key) ?? null;
        },
        setItem(key, value) {
            keys.push(key);
            data.set(key, value);
        },
    };
    return { storage, data, keys };
}

const failing = (what: "read" | "write" | "both"): RecentCommandsStorage => ({
    getItem(): string | null {
        if (what !== "write") throw new Error("SecurityError");
        return null;
    },
    setItem() {
        if (what !== "read") throw new Error("QuotaExceededError");
    },
});

describe("the recent list", () => {
    it("puts the newest command first and lists each command once", () => {
        let ids: string[] = [];
        for (const id of ["a", "b", "c", "a"]) ids = withRecentCommand(ids, id);
        expect(ids).toEqual(["a", "c", "b"]);
    });

    it("keeps at most eight commands", () => {
        let ids: string[] = [];
        for (let index = 0; index < 12; index++) ids = withRecentCommand(ids, `command-${index}`);
        ids = withRecentCommand(ids, "command-11");
        expect(MAX_RECENT_COMMANDS).toBe(8);
        expect(ids).toHaveLength(8);
        expect(ids[0]).toBe("command-11");
        expect(ids.at(-1)).toBe("command-4");
    });

    it("does not change the list it is given", () => {
        const ids = Object.freeze(["a", "b"]);
        expect(withRecentCommand(ids, "c")).toEqual(["c", "a", "b"]);
        expect(ids).toEqual(["a", "b"]);
    });

    it("reads anything that is not a list of ids as an empty list, without an error", () => {
        for (const stored of [undefined, null, 7, "edit.undo", {}, { ids: ["a"] }]) {
            expect(parseRecentCommands(stored)).toEqual([]);
        }
        expect(parseRecentCommands(["a", 3, null, "", "b", "a"])).toEqual(["a", "b"]);
        const tooMany = Array.from({ length: 12 }, (_, index) => `command-${index}`);
        expect(parseRecentCommands(tooMany)).toEqual(tooMany.slice(0, 8));
    });
});

describe("recent commands in storage", () => {
    it("starts empty when nothing is stored, or there is no storage", () => {
        expect(readRecentCommands(memoryStorage().storage, KEY)).toEqual([]);
        expect(readRecentCommands(null, KEY)).toEqual([]);
    });

    it("writes the list as JSON under the given key, and reads it back", () => {
        const { storage, data, keys } = memoryStorage();
        expect(writeRecentCommands(storage, KEY, ["file.new", "edit.undo"])).toBe(true);
        expect(JSON.parse(data.get(KEY) ?? "null")).toEqual(["file.new", "edit.undo"]);
        expect(readRecentCommands(storage, KEY)).toEqual(["file.new", "edit.undo"]);
        expect(new Set(keys)).toEqual(new Set([KEY]));
    });

    it("uses only the key it is given: two editors keep separate lists", () => {
        const { storage, data } = memoryStorage();
        const tilemap = "ngne-tilemap-editor.recent-commands";
        writeRecentCommands(storage, KEY, ["sprite.flip"]);
        writeRecentCommands(storage, tilemap, ["map.resize"]);
        expect([...data.keys()].sort()).toEqual([KEY, tilemap]);
        expect(readRecentCommands(storage, KEY)).toEqual(["sprite.flip"]);
        expect(readRecentCommands(storage, tilemap)).toEqual(["map.resize"]);
    });

    it("loads a list an editor stored before it used the package", () => {
        const stored = JSON.stringify(["edit.commandPalette", "file.new"]);
        const { storage } = memoryStorage({ [KEY]: stored });
        expect(readRecentCommands(storage, KEY)).toEqual(["edit.commandPalette", "file.new"]);
    });

    it("reads a value that is not JSON or not a list as an empty list", () => {
        for (const text of ["{not json", "7", '{"ids":["a"]}', "null"]) {
            expect(readRecentCommands(memoryStorage({ [KEY]: text }).storage, KEY), text).toEqual(
                [],
            );
        }
        const { storage } = memoryStorage({ [KEY]: '["a", 3, "", "b", "a"]' });
        expect(readRecentCommands(storage, KEY)).toEqual(["a", "b"]);
    });

    it("reads a storage that throws as empty", () => {
        expect(readRecentCommands(failing("read"), KEY)).toEqual([]);
    });

    it("reports a write that fails instead of throwing it, and writes nothing without storage", () => {
        const reported: unknown[] = [];
        expect(
            writeRecentCommands(failing("write"), KEY, ["edit.undo"], (error) =>
                reported.push(error),
            ),
        ).toBe(false);
        expect(reported).toHaveLength(1);
        expect((reported[0] as Error).message).toBe("QuotaExceededError");
        expect(() => writeRecentCommands(failing("write"), KEY, ["edit.undo"])).not.toThrow();
        expect(writeRecentCommands(null, KEY, ["edit.undo"], (error) => reported.push(error))).toBe(
            false,
        );
        expect(reported).toHaveLength(1);
    });
});

describe("the palette over a failing storage", () => {
    it("keeps running commands and listing the recent ones first", () => {
        const storage = failing("both");
        const registry = createCommandRegistry({ menus: ["File", "Edit", "View", "Help"] });
        let ran = 0;
        registry.register({ id: "file.new", title: "New", menuPath: ["File"], run() {} });
        registry.register({
            id: "edit.fill",
            title: "Fill",
            menuPath: ["Edit"],
            run: () => void ran++,
        });

        // As the editor UI instance holds it: read once, then record and write on each run.
        let ids = readRecentCommands(storage, KEY);
        const failures: unknown[] = [];
        const recent = {
            record(id: string) {
                ids = withRecentCommand(ids, id);
                writeRecentCommands(storage, KEY, ids, (error) => failures.push(error));
            },
        };
        expect(ids).toEqual([]);
        expect(runPaletteCommand(registry.get("edit.fill")!, () => {}, recent)).toBe(true);
        expect(ran).toBe(1);
        expect(failures).toHaveLength(1);
        expect(ids).toEqual(["edit.fill"]);
        const rows = paletteEntries(registry.list(), registry.menus, ids, "");
        expect(rows.map((row) => row.command.id)).toEqual(["edit.fill", "file.new"]);
    });
});
