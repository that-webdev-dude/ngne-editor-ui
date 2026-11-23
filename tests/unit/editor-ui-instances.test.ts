import { afterEach, describe, expect, it, vi } from "vitest";
import type * as CommandsModule from "../../src/ui/commands/index.ts";
import type { KeymapDocument } from "../../src/ui/commands/index.ts";
import type * as EditorUiModule from "../../src/ui/index.ts";
import type { AppInfo, EditorUiConfig } from "../../src/ui/index.ts";
import type * as MessagesModule from "../../src/ui/messages/index.ts";
import type * as PlatformModule from "../../src/ui/platform/index.ts";
import type { KeyValueStorage } from "../../src/ui/platform/index.ts";
import type * as ShellModule from "../../src/ui/shell/index.ts";

// Identity-bound state is per editor UI instance, identity-free services are not (SPEC §1.2):
// two instances with different ids share no theme, recent commands, command registry or
// surfaces, while toasts, notices, command dialog requests and storage-failure reporting stay
// one copy for the page. With the store cases of a failed write, reported once per page. The
// state an editor passes as its own (SPEC §5 `sources`) drives its instance as the instance's
// own stores do, and stays apart from another instance's.

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
    productName: id,
    about: ABOUT,
    menus: ["File", "View", "Help"],
    surfaces: { preferences: () => null },
});

function memoryStorage(): KeyValueStorage & { items: Map<string, string> } {
    const items = new Map<string, string>();
    return {
        items,
        getItem: (key) => items.get(key) ?? null,
        setItem: (key, value) => void items.set(key, value),
        removeItem: (key) => void items.delete(key),
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

/** Fresh modules (one report per page is module state), and the notices they send. */
async function fresh() {
    vi.resetModules();
    const editorUi = (await import("../../src/ui/index.ts")) as typeof EditorUiModule;
    const messages = (await import("../../src/ui/messages/index.ts")) as typeof MessagesModule;
    const platform = (await import("../../src/ui/platform/index.ts")) as typeof PlatformModule;
    const sent: [string, string][] = [];
    messages.notices.attachSink((kind, message) => sent.push([kind, message]));
    return { editorUi, messages, platform, sent };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("two editor UI instances", () => {
    async function pair() {
        const storage = memoryStorage();
        vi.stubGlobal("localStorage", storage);
        const { editorUi } = await fresh();
        const sprite = editorUi.createEditorUi(config("ngne-sprite-editor"));
        const tilemap = editorUi.createEditorUi(config("ngne-tilemap-editor"));
        return { module: editorUi, storage, sprite, tilemap };
    }

    it("share no theme", async () => {
        const { module, storage, sprite, tilemap } = await pair();
        expect(sprite.theme).not.toBe(tilemap.theme);
        module.setTheme(sprite, "light");
        expect(sprite.theme.getState().theme).toBe("light");
        expect(tilemap.theme.getState().theme).toBe("dark");
        expect([...storage.items.keys()]).toEqual(["ngne-sprite-editor.theme"]);
    });

    it("share no recent commands", async () => {
        const { storage, sprite, tilemap } = await pair();
        expect(sprite.recentCommands).not.toBe(tilemap.recentCommands);
        tilemap.recentCommands.getState().record("edit.undo");
        expect(tilemap.recentCommands.getState().ids).toEqual(["edit.undo"]);
        expect(sprite.recentCommands.getState().ids).toEqual([]);
        expect([...storage.items.keys()]).toEqual(["ngne-tilemap-editor.recent-commands"]);
    });

    it("share no command registry", async () => {
        const { sprite, tilemap } = await pair();
        expect(sprite.commands).not.toBe(tilemap.commands);
        const refreshed = vi.fn();
        tilemap.commands.subscribe(refreshed);
        sprite.commands.register({ id: "sprite.only", title: "Sprite", run: () => {} });
        expect(sprite.commands.get("sprite.only")).toBeDefined();
        expect(tilemap.commands.get("sprite.only")).toBeUndefined();
        expect(refreshed).not.toHaveBeenCalled();
        // The same id registers in each: the registries do not see each other's commands.
        expect(() =>
            tilemap.commands.register({ id: "sprite.only", title: "Tilemap", run: () => {} }),
        ).not.toThrow();
    });

    it("share no surfaces", async () => {
        const { sprite, tilemap } = await pair();
        expect(sprite.surfaces).not.toBe(tilemap.surfaces);
        sprite.surfaces.open("preferences");
        expect(sprite.surfaces.store.getState().open).toBe("preferences");
        expect(tilemap.surfaces.store.getState().open).toBeNull();
    });

    it("hold none of the identity-free services", async () => {
        vi.stubGlobal("localStorage", memoryStorage());
        const { editorUi, messages, platform } = await fresh();
        const instance = editorUi.createEditorUi(config("ngne-sprite-editor"));
        const services = [
            messages.toast,
            messages.notices,
            messages.commandDialogs,
            platform.storageFailures,
        ];
        for (const value of Object.values(instance)) expect(services).not.toContain(value);
    });

    it("report failed writes through one storage-failure report for the page", async () => {
        vi.stubGlobal("localStorage", fullStorage());
        const { editorUi, platform, sent } = await fresh();
        const sprite = editorUi.createEditorUi(config("ngne-sprite-editor"));
        const tilemap = editorUi.createEditorUi(config("ngne-tilemap-editor"));
        editorUi.setTheme(sprite, "light");
        tilemap.recentCommands.getState().record("edit.undo");
        editorUi.setTheme(tilemap, "light");
        expect(sent).toEqual([["error", platform.STORAGE_WRITE_FAILED_MESSAGE]]);
        expect(platform.storageFailures.reported).toBe(true);
    });
});

describe("the state an editor passes as its own (SPEC §5 sources)", () => {
    /** A page with nothing focused: only the state contexts can be active. */
    const PAGE: KeymapDocument = { activeElement: null, querySelector: () => null };

    /** An instance over sources created as an editor's own module creates them. */
    async function withSources() {
        vi.stubGlobal("localStorage", memoryStorage());
        const { editorUi: module } = await fresh();
        const commands = (await import("../../src/ui/commands/index.ts")) as typeof CommandsModule;
        const shell = (await import("../../src/ui/shell/index.ts")) as typeof ShellModule;
        const build = (id: string) => {
            const sources = {
                keyContextState: commands.createKeyContextStore(["gesture", "floating"]),
                bottomRegion: shell.createBottomRegionStore(),
                commandRunner: commands.createCommandRunner(),
            };
            const instance = module.createEditorUi({
                ...config(id),
                keyContexts: { order: ["gesture", "floating"], state: ["gesture", "floating"] },
                bottomRegion: { id: "timeline", label: "Timeline" },
                sources,
            });
            const refreshed = vi.fn();
            instance.commands.subscribe(refreshed);
            const active = () =>
                commands.activeKeyContexts(
                    PAGE,
                    instance.config.keyContexts,
                    instance.keyContextState.getState(),
                );
            const toggleTitle = () => instance.commands.get("view.timeline")!.title();
            return { instance, sources, refreshed, active, toggleTitle };
        };
        return { commands, shell, build };
    }

    it("a state context switched in the editor's store changes the active contexts and refreshes once", async () => {
        const { commands, build } = await withSources();
        const sprite = build("ngne-sprite-editor");
        commands.setKeyContext(sprite.sources.keyContextState, "floating", true);
        expect(sprite.active()).toEqual(["floating"]);
        expect(sprite.refreshed).toHaveBeenCalledTimes(1);
        commands.setKeyContext(sprite.sources.keyContextState, "floating", true);
        expect(sprite.refreshed).toHaveBeenCalledTimes(1);
        commands.setKeyContext(sprite.instance, "gesture", true);
        expect(sprite.active()).toEqual(["gesture", "floating"]);
        expect(sprite.sources.keyContextState.getState()).toEqual({
            gesture: true,
            floating: true,
        });
        expect(sprite.refreshed).toHaveBeenCalledTimes(2);
    });

    it("a write to the editor's store that changes nothing refreshes nothing", async () => {
        const { build } = await withSources();
        const sprite = build("ngne-sprite-editor");
        sprite.sources.keyContextState.setState({ gesture: false });
        sprite.sources.bottomRegion.setState({ visible: true });
        expect(sprite.refreshed).not.toHaveBeenCalled();
    });

    it("the bottom region hidden in the editor's store refreshes once and retitles the Tab toggle", async () => {
        const { shell, build } = await withSources();
        const sprite = build("ngne-sprite-editor");
        expect(sprite.toggleTitle()).toBe("Hide Timeline");
        shell.setBottomRegionVisible(sprite.sources.bottomRegion, false);
        expect(sprite.instance.bottomRegion.getState().visible).toBe(false);
        expect(sprite.refreshed).toHaveBeenCalledTimes(1);
        expect(sprite.toggleTitle()).toBe("Show Timeline");
        // The toggle writes the editor's store.
        expect(sprite.sources.commandRunner.run("view.timeline")).toBe(true);
        expect(sprite.sources.bottomRegion.getState().visible).toBe(true);
        expect(sprite.toggleTitle()).toBe("Hide Timeline");
        expect(sprite.refreshed).toHaveBeenCalledTimes(2);
    });

    it("two instances keep their state apart", async () => {
        const { commands, shell, build } = await withSources();
        const sprite = build("ngne-sprite-editor");
        const tilemap = build("ngne-tilemap-editor");
        commands.setKeyContext(sprite.sources.keyContextState, "gesture", true);
        shell.setBottomRegionVisible(sprite.sources.bottomRegion, false);
        expect(sprite.active()).toEqual(["gesture"]);
        expect(tilemap.active()).toEqual([]);
        expect(sprite.toggleTitle()).toBe("Show Timeline");
        expect(tilemap.toggleTitle()).toBe("Hide Timeline");
        expect(tilemap.refreshed).not.toHaveBeenCalled();
        // Each runner runs its own instance's commands.
        tilemap.instance.commands.register({ id: "tilemap.only", title: "T", run: () => {} });
        expect(tilemap.sources.commandRunner.run("tilemap.only")).toBe(true);
        expect(sprite.sources.commandRunner.run("tilemap.only")).toBe(false);
    });
});

describe("every instance store reports a failed write once, and keeps the value", () => {
    it("the theme", async () => {
        vi.stubGlobal("localStorage", fullStorage());
        const { editorUi, platform, sent } = await fresh();
        const instance = editorUi.createEditorUi(config("ngne-sprite-editor"));
        editorUi.setTheme(instance, "light");
        expect(instance.theme.getState().theme).toBe("light");
        editorUi.setTheme(instance, "dark");
        expect(sent).toEqual([["error", platform.STORAGE_WRITE_FAILED_MESSAGE]]);
    });

    it("the recent commands", async () => {
        vi.stubGlobal("localStorage", fullStorage());
        const { editorUi, platform, sent } = await fresh();
        const { recentCommands } = editorUi.createEditorUi(config("ngne-sprite-editor"));
        recentCommands.getState().record("edit.undo");
        expect(recentCommands.getState().ids).toEqual(["edit.undo"]);
        recentCommands.getState().record("edit.redo");
        expect(recentCommands.getState().ids).toEqual(["edit.redo", "edit.undo"]);
        expect(sent).toEqual([["error", platform.STORAGE_WRITE_FAILED_MESSAGE]]);
    });
});
