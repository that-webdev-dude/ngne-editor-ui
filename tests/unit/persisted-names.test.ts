import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    createEditorUi,
    createRecentCommandsStore,
    createThemeStore,
    DEFAULT_THEME,
    persistedNames,
    setTheme,
} from "../../src/ui/index.ts";
import type { AppInfo, EditorUiConfig, PersistedNames } from "../../src/ui/index.ts";
import type { KeyValueStorage } from "../../src/ui/platform/index.ts";
import { pwaNames, registerAppUpdates } from "../../src/ui/pwa/index.ts";
import { createLayoutStore } from "../../src/ui/shell/index.ts";
import { installServiceWorker } from "../../src/worker/index.ts";
import { FakeContainer, FakeWorker, simulateWorkerScope } from "./support/pwa.ts";

// The names an editor UI instance persists under (SPEC §5): the theme under `<id>.theme`, the
// shell's layout under `<id>.layout` with its stored fields unchanged (`timelineHeight` for the
// bottom region) and the recent commands under `<id>.recent-commands`, the names both editors
// use today, so a migrating editor keeps its users' data. Each instance reads and writes
// exactly those keys of the browser's storage (localStorage, stubbed here), and loads values
// the editors stored before they used the package. The service worker's names too: its cache
// prefix, the pages' messages and the older-windows key, in the worker and on the page. The
// package exports every name for an id (`persistedNames`) and the factories the instance builds
// its stores with, so an editor's own storage-key tests drive them against a storage they pass
// in. With the theme store's own cases.

const IDS = ["ngne-sprite-editor", "ngne-tilemap-editor"] as const;

const ABOUT: AppInfo = {
    packageName: "ngne-test-editor",
    version: "1.0.0",
    licence: "MIT",
    engine: { packageName: "@ngne/core", version: "0.1.0" },
    repositoryUrl: "https://example.com",
    changelogUrl: "https://example.com/CHANGELOG.md",
};

const config = (id: string): EditorUiConfig<"File" | "View" | "Help"> => ({
    id,
    productName: "NGNE Test Editor",
    about: ABOUT,
    menus: ["File", "View", "Help"],
});

/** An in-memory storage that records the keys read and written. */
function recordingStorage(initial: Record<string, string> = {}) {
    const items = new Map(Object.entries(initial));
    const read: string[] = [];
    const written: string[] = [];
    const storage: KeyValueStorage = {
        getItem(key) {
            read.push(key);
            return items.get(key) ?? null;
        },
        setItem(key, value) {
            written.push(key);
            items.set(key, value);
        },
        removeItem: (key) => void items.delete(key),
    };
    return { storage, items, read, written };
}

/** Puts `storage` where the browser's localStorage is. */
function useStorage(initial: Record<string, string> = {}) {
    const recording = recordingStorage(initial);
    vi.stubGlobal("localStorage", recording.storage);
    return recording;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe.each(IDS)("persisted names of %s", (id) => {
    it("reads exactly <id>.theme, <id>.layout and <id>.recent-commands at startup", () => {
        const { read } = useStorage();
        createEditorUi(config(id));
        expect(read.sort()).toEqual([`${id}.layout`, `${id}.recent-commands`, `${id}.theme`]);
    });

    it("writes the theme under <id>.theme, as the bare name", () => {
        const { items, written } = useStorage();
        const editorUi = createEditorUi(config(id));
        setTheme(editorUi, "light");
        expect(written).toEqual([`${id}.theme`]);
        expect(items.get(`${id}.theme`)).toBe("light");
    });

    it("writes the recent commands under <id>.recent-commands, as a JSON list", () => {
        const { items, written } = useStorage();
        const editorUi = createEditorUi(config(id));
        editorUi.recentCommands.getState().record("edit.undo");
        editorUi.recentCommands.getState().record("layer.new");
        expect(written).toEqual([`${id}.recent-commands`, `${id}.recent-commands`]);
        expect(items.get(`${id}.recent-commands`)).toBe('["layer.new","edit.undo"]');
    });

    it("writes the layout under <id>.layout, with the stored field names unchanged", () => {
        const { items, written } = useStorage();
        const editorUi = createEditorUi(config(id));
        editorUi.layout.getState().setDockWidth(300);
        editorUi.layout.getState().setBottomHeight(240);
        expect(written).toEqual([`${id}.layout`, `${id}.layout`]);
        expect(JSON.parse(items.get(`${id}.layout`)!)).toEqual({
            dockWidth: 300,
            timelineHeight: 240,
        });
        editorUi.layout.getState().setBottomHeight(null);
        expect(JSON.parse(items.get(`${id}.layout`)!)).toEqual({
            dockWidth: 300,
            timelineHeight: null,
        });
    });

    it("loads a layout the editor stored before the package, timelineHeight as the bottom height", () => {
        // As both editors write it today: `JSON.stringify({ dockWidth, timelineHeight })`.
        useStorage({ [`${id}.layout`]: '{"dockWidth":312,"timelineHeight":260}' });
        expect(createEditorUi(config(id)).layout.getState()).toMatchObject({
            dockWidth: 312,
            bottomHeight: 260,
        });
        useStorage({ [`${id}.layout`]: '{"dockWidth":null,"timelineHeight":150}' });
        expect(createEditorUi(config(id)).layout.getState()).toMatchObject({
            dockWidth: null,
            bottomHeight: 150,
        });
    });

    it("loads the theme and recent commands the editor stored before the package", () => {
        useStorage({
            [`${id}.theme`]: "light",
            [`${id}.recent-commands`]: '["view.zoomIn","edit.undo"]',
        });
        const editorUi = createEditorUi(config(id));
        expect(editorUi.theme.getState().theme).toBe("light");
        expect(editorUi.recentCommands.getState().ids).toEqual(["view.zoomIn", "edit.undo"]);
    });

    it("ignores another editor's values on the shared origin", () => {
        const other = IDS.find((name) => name !== id)!;
        useStorage({
            [`${other}.theme`]: "light",
            [`${other}.layout`]: '{"dockWidth":300,"timelineHeight":240}',
            [`${other}.recent-commands`]: '["edit.undo"]',
        });
        const editorUi = createEditorUi(config(id));
        expect(editorUi.theme.getState().theme).toBe("dark");
        expect(editorUi.layout.getState()).toMatchObject({ dockWidth: null, bottomHeight: null });
        expect(editorUi.recentCommands.getState().ids).toEqual([]);
    });
});

/** The rows of SPEC §5's persisted-names table: each value with its `persistedNames` field. */
function specNames(): { field: string; value: string }[] {
    const spec = readFileSync(new URL("../../docs/SPEC.md", import.meta.url), "utf8");
    const start = spec.indexOf("Persisted names keep their current values");
    const section = spec.slice(start, spec.indexOf("\n\n", spec.indexOf("| --- |", start)));
    const ticked = (cell: string) => [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1]!);
    return section
        .split("\n")
        .filter(
            (line) => line.startsWith("| ") && !line.startsWith("| Name") && !line.includes("---"),
        )
        .flatMap((line) => {
            const [, , value = "", fields = ""] = line.split("|");
            const values = ticked(value).filter((name) => name.includes("<id>"));
            const names = ticked(fields);
            expect(values.length, line).toBe(names.length);
            return names.map((field, index) => ({ field, value: values[index]! }));
        });
}

describe.each(IDS)("exported persisted names of %s", (id) => {
    const names = persistedNames(id);

    it("are SPEC §5's table for the id, every name once", () => {
        const rows = specNames();
        expect(rows).toHaveLength(7);
        expect(Object.keys(names).sort()).toEqual(rows.map((row) => row.field).sort());
        for (const { field, value } of rows) {
            expect(names[field as keyof PersistedNames], field).toBe(value.replace("<id>", id));
        }
    });

    it("hold the worker's names as pwaNames gives them", () => {
        expect(names).toMatchObject(pwaNames(id));
    });

    it("are exactly the keys the instance's stores read and write", () => {
        const { read, written } = useStorage();
        const editorUi = createEditorUi(config(id));
        setTheme(editorUi, "light");
        editorUi.layout.getState().setDockWidth(300);
        editorUi.recentCommands.getState().record("edit.undo");
        const keys = [names.layout, names.recentCommands, names.theme];
        expect([...new Set(read)].sort()).toEqual(keys);
        expect([...new Set(written)].sort()).toEqual(keys);
    });
});

describe("exported store factories, over a storage the caller passes", () => {
    const names = persistedNames("ngne-sprite-editor");

    it("build the theme store under the key given, DEFAULT_THEME when nothing is stored", () => {
        expect(DEFAULT_THEME).toBe("dark");
        const { storage, items, written } = recordingStorage();
        const theme = createThemeStore(storage, names.theme);
        expect(theme.getState().theme).toBe(DEFAULT_THEME);
        theme.getState().setTheme("light");
        expect(written).toEqual([names.theme]);
        expect(items.get(names.theme)).toBe("light");
        expect(createThemeStore(storage, names.theme).getState().theme).toBe("light");
        const unknown = recordingStorage({ [names.theme]: "sepia" }).storage;
        expect(createThemeStore(unknown, names.theme).getState().theme).toBe(DEFAULT_THEME);
    });

    it("build the layout store under the key given, in the stored record", () => {
        const { storage, items, written } = recordingStorage({
            [names.layout]: '{"dockWidth":312,"timelineHeight":260}',
        });
        const layout = createLayoutStore(storage, names.layout);
        expect(layout.getState()).toMatchObject({ dockWidth: 312, bottomHeight: 260 });
        layout.getState().setBottomHeight(240);
        expect(written).toEqual([names.layout]);
        expect(JSON.parse(items.get(names.layout)!)).toEqual({
            dockWidth: 312,
            timelineHeight: 240,
        });
    });

    it("build the recent-commands store under the key given", () => {
        const { storage, items, written } = recordingStorage();
        const recent = createRecentCommandsStore(storage, names.recentCommands);
        recent.getState().record("edit.undo");
        recent.getState().record("layer.new");
        expect(written).toEqual([names.recentCommands, names.recentCommands]);
        expect(items.get(names.recentCommands)).toBe('["layer.new","edit.undo"]');
        expect(createRecentCommandsStore(storage, names.recentCommands).getState().ids).toEqual([
            "layer.new",
            "edit.undo",
        ]);
    });

    it("keep each store in memory without a storage, and never reach the browser's", () => {
        expect(typeof localStorage).toBe("undefined");
        const theme = createThemeStore(null, names.theme);
        const layout = createLayoutStore(null, names.layout);
        const recent = createRecentCommandsStore(null, names.recentCommands);
        theme.getState().setTheme("light");
        layout.getState().setDockWidth(300);
        recent.getState().record("edit.undo");
        expect(theme.getState().theme).toBe("light");
        expect(layout.getState().dockWidth).toBe(300);
        expect(recent.getState().ids).toEqual(["edit.undo"]);
        expect(createThemeStore(null, names.theme).getState().theme).toBe(DEFAULT_THEME);
    });
});

/** The service worker's names as each editor's source writes them today. */
const APP_PWA_NAMES = {
    "ngne-sprite-editor": {
        cachePrefix: "ngne-sprite-editor-",
        skipWaiting: "ngne-sprite-editor:skip-waiting",
        started: "ngne-sprite-editor:started",
        olderWindows: "ngne-sprite-editor-older-windows",
    },
    "ngne-tilemap-editor": {
        cachePrefix: "ngne-tilemap-editor-",
        skipWaiting: "ngne-tilemap-editor:skip-waiting",
        started: "ngne-tilemap-editor:started",
        olderWindows: "ngne-tilemap-editor-older-windows",
    },
} as const;

describe.each(IDS)("service worker names of %s", (id) => {
    const names = APP_PWA_NAMES[id];
    const scope = "https://example.test/app/";

    it("are the editor's current cache prefix, worker messages and older-windows key", () => {
        expect(pwaNames(id)).toEqual(names);
    });

    it("are the names the worker caches under and answers to", async () => {
        const worker = simulateWorkerScope(scope, { [`${scope}index.html`]: "<!doctype html>" });
        worker.storage.fill(`${names.cachePrefix}00000000`, {});
        installServiceWorker({ id, manifest: [{ url: "index.html", revision: "1" }] });
        await worker.install();
        const [, current] = await worker.storage.keys();
        expect(current).toMatch(new RegExp(`^${names.cachePrefix}[0-9a-f]{8}$`));

        worker.state.windows = ["older-page"];
        await worker.activate();
        expect(worker.storage.urls(current!)).toContain(`${scope}${names.olderWindows}`);
        worker.state.windows = [];
        await worker.message({ type: names.started });
        expect(await worker.storage.keys()).toEqual([current]);

        await worker.message({ type: names.skipWaiting });
        expect(worker.state.skipWaiting).toBe(1);
    });

    it("are the messages the page sends its worker", async () => {
        const served = new FakeWorker();
        const container = new FakeContainer(served);
        const updates = registerAppUpdates({
            id,
            container,
            url: "sw.js",
            scope: "/",
            reload: () => {},
        });
        await updates.check();
        const waiting = new FakeWorker();
        container.registration.install(waiting);
        waiting.become("installed");
        updates.apply();
        expect(served.messages).toEqual([{ type: names.started }]);
        expect(waiting.messages).toEqual([{ type: names.skipWaiting }]);
    });
});

describe("theme store", () => {
    const id = "ngne-sprite-editor";

    it("defaults to dark, with storage and without", () => {
        useStorage();
        expect(createEditorUi(config(id)).theme.getState().theme).toBe("dark");
        vi.unstubAllGlobals();
        expect(typeof localStorage).toBe("undefined");
        expect(createEditorUi(config(id)).theme.getState().theme).toBe("dark");
    });

    it("persists the theme and restores it in a new instance", () => {
        const { items } = useStorage();
        const editorUi = createEditorUi(config(id));
        setTheme(editorUi, "light");
        expect(items.get(`${id}.theme`)).toBe("light");
        expect(createEditorUi(config(id)).theme.getState().theme).toBe("light");

        editorUi.theme.getState().toggleTheme();
        expect(editorUi.theme.getState().theme).toBe("dark");
        expect(createEditorUi(config(id)).theme.getState().theme).toBe("dark");
    });

    it("falls back to dark on an unknown stored value", () => {
        useStorage({ [`${id}.theme`]: "sepia" });
        expect(createEditorUi(config(id)).theme.getState().theme).toBe("dark");
    });

    it("notifies subscribers", () => {
        useStorage();
        const editorUi = createEditorUi(config(id));
        const seen: string[] = [];
        editorUi.theme.subscribe((state) => seen.push(state.theme));
        setTheme(editorUi, "light");
        expect(seen).toEqual(["light"]);
    });
});
