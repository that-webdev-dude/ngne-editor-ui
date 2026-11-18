import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditorUi, setTheme } from "../../src/ui/index.ts";
import type { AppInfo, EditorUiConfig } from "../../src/ui/index.ts";
import type { KeyValueStorage } from "../../src/ui/platform/index.ts";
import { pwaNames, registerAppUpdates } from "../../src/ui/pwa/index.ts";
import { installServiceWorker } from "../../src/worker/index.ts";
import { FakeContainer, FakeWorker, simulateWorkerScope } from "./support/pwa.ts";

// The names an editor UI instance persists under (SPEC §5): the theme under `<id>.theme`, the
// shell's layout under `<id>.layout` with its stored fields unchanged (`timelineHeight` for the
// bottom region) and the recent commands under `<id>.recent-commands`, the names both editors
// use today, so a migrating editor keeps its users' data. Each instance reads and writes
// exactly those keys of the browser's storage (localStorage, stubbed here), and loads values
// the editors stored before they used the package. The service worker's names too: its cache
// prefix, the pages' messages and the older-windows key, in the worker and on the page. With the
// theme store's own cases.

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
