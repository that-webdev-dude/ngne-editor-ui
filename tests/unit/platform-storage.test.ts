import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as MessagesModule from "../../src/ui/messages/index.ts";
import type * as PlatformModule from "../../src/ui/platform/index.ts";
import type { KeyValueStorage } from "../../src/ui/platform/index.ts";

// Key-value storage with failure reporting (SPEC §6): reads, writes and JSON through the
// storage the caller passes, under the key the caller gives. A write that fails — the store is
// full or the browser blocks it — is reported once, as an error notice (a toast in the
// interface), instead of being lost silently; a missing storage reads as empty.

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & {
    data: Map<string, string>;
} {
    const data = new Map(Object.entries(initial));
    return {
        data,
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => void data.set(key, value),
        removeItem: (key) => void data.delete(key),
    };
}

/** A store that holds what it has and refuses every write, as a full one does. */
function fullStorage(): KeyValueStorage {
    const storage = memoryStorage();
    storage.setItem = () => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    };
    return storage;
}

/** Fresh modules (one report per page is module state), without a sink yet. */
async function freshModules() {
    vi.resetModules();
    const messages = (await import("../../src/ui/messages/index.ts")) as typeof MessagesModule;
    const platform = (await import("../../src/ui/platform/index.ts")) as typeof PlatformModule;
    return { messages, platform };
}

/** Fresh modules and the notices they send. */
async function fresh() {
    const { messages, platform } = await freshModules();
    const sent: [string, string][] = [];
    messages.notices.attachSink((kind, message) => sent.push([kind, message]));
    return { storage: platform, sent };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("storage reads and writes", () => {
    it("reads and writes through the injected storage, under the caller's key", async () => {
        const { storage, sent } = await fresh();
        const memory = memoryStorage({ "ngne-sprite-editor.theme": "light" });
        expect(storage.readItem(memory, "ngne-sprite-editor.theme")).toBe("light");
        expect(storage.readItem(memory, "ngne-tilemap-editor.theme")).toBeNull();
        expect(storage.writeItem(memory, "ngne-tilemap-editor.theme", "dark")).toBe(true);
        expect(memory.data.get("ngne-tilemap-editor.theme")).toBe("dark");
        expect(memory.data.get("ngne-sprite-editor.theme")).toBe("light");
        expect(sent).toEqual([]);
    });

    it("reads JSON, and an absent or unreadable value as undefined", async () => {
        const { storage } = await fresh();
        const memory = memoryStorage({
            list: JSON.stringify(["edit.undo", "edit.redo"]),
            broken: "{not json",
        });
        expect(storage.readJson(memory, "list")).toEqual(["edit.undo", "edit.redo"]);
        expect(storage.readJson(memory, "broken")).toBeUndefined();
        expect(storage.readJson(memory, "absent")).toBeUndefined();
        // A value written as JSON reads back.
        expect(storage.writeItem(memory, "layout", JSON.stringify({ dockWidth: 300 }))).toBe(true);
        expect(storage.readJson(memory, "layout")).toEqual({ dockWidth: 300 });
    });

    it("reads a missing storage, and one whose reads throw, as empty", async () => {
        const { storage, sent } = await fresh();
        expect(storage.readItem(null, "key")).toBeNull();
        expect(storage.readJson(null, "key")).toBeUndefined();
        const throwing = memoryStorage();
        throwing.getItem = () => {
            throw new DOMException("Access is denied for this document.", "SecurityError");
        };
        expect(storage.readItem(throwing, "key")).toBeNull();
        expect(storage.readJson(throwing, "key")).toBeUndefined();
        expect(sent).toEqual([]);
    });

    it("keeps values in memory without a store and reports nothing", async () => {
        const { storage, sent } = await fresh();
        expect(storage.writeItem(null, "key", "value")).toBe(false);
        expect(sent).toEqual([]);
    });
});

describe("storage failures", () => {
    it("reports the first failure only", async () => {
        const { storage } = await fresh();
        const notify = vi.fn();
        const failures = storage.createStorageFailures(notify);
        expect(failures.reported).toBe(false);
        failures.report(new Error("full"));
        failures.report(new Error("full again"));
        expect(notify).toHaveBeenCalledTimes(1);
        expect(notify).toHaveBeenCalledWith(storage.STORAGE_WRITE_FAILED_MESSAGE);
        expect(failures.reported).toBe(true);
    });

    it("writeItem returns whether it wrote, and reports a write that threw", async () => {
        const { storage } = await fresh();
        const notify = vi.fn();
        const failures = storage.createStorageFailures(notify);
        const memory = memoryStorage();
        expect(storage.writeItem(memory, "key", "value", failures)).toBe(true);
        expect(memory.getItem("key")).toBe("value");
        expect(notify).not.toHaveBeenCalled();
        expect(storage.writeItem(fullStorage(), "key", "value", failures)).toBe(false);
        expect(notify).toHaveBeenCalledTimes(1);
    });

    it("reports a throwing write as one error notice, whichever keys and stores fail", async () => {
        const { storage, sent } = await fresh();
        expect(storage.writeItem(fullStorage(), "ngne-sprite-editor.theme", "light")).toBe(false);
        expect(storage.writeItem(fullStorage(), "ngne-sprite-editor.layout", "{}")).toBe(false);
        expect(storage.writeItem(fullStorage(), "ngne-sprite-editor.theme", "dark")).toBe(false);
        expect(sent).toEqual([["error", storage.STORAGE_WRITE_FAILED_MESSAGE]]);
        expect(storage.storageFailures.reported).toBe(true);
    });

    it("shows a failure from before the toasts are ready once they are, and once only", async () => {
        const { messages, platform: storage } = await freshModules();
        const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
        try {
            // No sink yet: the interface has not attached its toasts.
            expect(storage.writeItem(fullStorage(), "key", "value")).toBe(false);
            expect(storage.storageFailures.reported).toBe(true);
            expect(logged).toHaveBeenCalledWith(storage.STORAGE_WRITE_FAILED_MESSAGE);
            const first: [string, string][] = [];
            messages.notices.attachSink((kind, message) => first.push([kind, message]));
            expect(first).toEqual([["error", storage.STORAGE_WRITE_FAILED_MESSAGE]]);
            // Shown once: a later sink and a later failure add nothing.
            const second: [string, string][] = [];
            messages.notices.attachSink((kind, message) => second.push([kind, message]));
            expect(storage.writeItem(fullStorage(), "key", "value")).toBe(false);
            expect(first).toHaveLength(1);
            expect(second).toEqual([]);
        } finally {
            logged.mockRestore();
        }
    });

    it("treats a store the browser blocks as one whose writes fail", async () => {
        const { storage, sent } = await fresh();
        vi.stubGlobal("localStorage", undefined);
        expect(storage.browserStorage()).toBeNull();
        const blocked = new DOMException("Access is denied for this document.", "SecurityError");
        Object.defineProperty(globalThis, "localStorage", {
            configurable: true,
            get() {
                throw blocked;
            },
        });
        try {
            const store = storage.browserStorage();
            expect(store).not.toBeNull();
            expect(storage.readItem(store, "key")).toBeNull();
            expect(storage.writeItem(store, "key", "value")).toBe(false);
            expect(sent).toEqual([["error", storage.STORAGE_WRITE_FAILED_MESSAGE]]);
        } finally {
            delete (globalThis as { localStorage?: unknown }).localStorage;
        }
    });

    it("gives the browser's localStorage where there is one", async () => {
        const { storage } = await fresh();
        const local = memoryStorage();
        vi.stubGlobal("localStorage", local);
        expect(storage.browserStorage()).toBe(local);
    });
});

describe("browser storage access (SPEC §6)", () => {
    const ROOT = fileURLToPath(new URL("../../", import.meta.url));
    const STORAGE_MODULE = "src/ui/platform/storage.ts";

    /** Every TypeScript source file under src/, as a path from the repository root. */
    const sourceFiles = () =>
        readdirSync(join(ROOT, "src"), { recursive: true, withFileTypes: true })
            .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
            .map((entry) =>
                relative(ROOT, join(entry.parentPath, entry.name)).replaceAll("\\", "/"),
            );

    /** A file's code without its comments, which may name the storage. */
    const code = (file: string) =>
        readFileSync(join(ROOT, file), "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/\/\/.*$/gm, "");

    it("goes through src/ui/platform/storage.ts only: no other module names the browser's", () => {
        const files = sourceFiles();
        expect(files).toContain(STORAGE_MODULE);
        const offenders = files.filter(
            (file) =>
                file !== STORAGE_MODULE && /\b(localStorage|sessionStorage)\b/.test(code(file)),
        );
        expect(offenders).toEqual([]);
        expect(/\blocalStorage\b/.test(code(STORAGE_MODULE))).toBe(true);
    });
});
