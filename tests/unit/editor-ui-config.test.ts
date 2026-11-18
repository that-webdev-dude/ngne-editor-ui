import { describe, expect, it } from "vitest";
import { RegistrationError } from "../../src/model/modules.ts";
import { PACKAGE_COMMAND_SOURCE } from "../../src/ui/editorUi/packageCommands.ts";
import { createEditorUi } from "../../src/ui/index.ts";
import type { AppInfo, EditorUiConfig } from "../../src/ui/index.ts";

// The configuration of `createEditorUi` (SPEC §5): the default of every optional field, the
// module maps handed to their registries (SPEC §1.3), and the configurations that stop the
// editor at startup with an error naming the field.

const ABOUT: AppInfo = {
    packageName: "ngne-test-editor",
    version: "1.2.3",
    licence: "MIT",
    engine: { packageName: "@ngne/core", version: "0.4.0" },
    repositoryUrl: "https://example.com/ngne-test-editor",
    changelogUrl: "https://example.com/ngne-test-editor/CHANGELOG.md",
};

const MENUS = ["File", "Edit", "View", "Help"] as const;

const BASE: EditorUiConfig<(typeof MENUS)[number]> = {
    id: "ngne-test-editor",
    productName: "NGNE Test Editor",
    about: ABOUT,
    menus: MENUS,
};

const Empty = () => null;

/** `BASE` with `changes`, typed loosely so a test can pass what the types forbid. */
const withConfig = (changes: Record<string, unknown>) =>
    ({ ...BASE, ...changes }) as unknown as EditorUiConfig<string, string>;

describe("createEditorUi defaults (SPEC §5)", () => {
    const editorUi = createEditorUi(BASE);
    const { config } = editorUi;

    it("keeps the required fields as given", () => {
        expect(config.id).toBe("ngne-test-editor");
        expect(config.productName).toBe("NGNE Test Editor");
        expect(config.about).toEqual(ABOUT);
        expect(config.menus).toEqual(MENUS);
        expect(editorUi.commands.menus).toEqual(MENUS);
    });

    it("keyContexts: the package's contexts only", () => {
        expect(config.keyContexts).toEqual({ order: [], state: [], focus: {} });
        expect(editorUi.commands.contexts).toEqual(["text", "canvas", "global"]);
    });

    it("bottomRegion: none; railFooterHeight: 0", () => {
        expect(config.bottomRegion).toBeNull();
        expect(config.railFooterHeight).toBe(0);
    });

    it("modules: an empty map for each registry, and empty registries", () => {
        expect(config.modules).toEqual({
            commands: {},
            dialogs: {},
            dock: {},
            contextBars: {},
            tools: {},
            overlays: {},
            statusFields: {},
        });
        // The package's own dialog only (SPEC §11): the editor registers none.
        expect([...editorUi.dialogs.keys()]).toEqual(["licences"]);
        expect(editorUi.dockPanels).toEqual([]);
        expect(editorUi.contextBarContent).toEqual([]);
        expect(editorUi.tools.list()).toEqual([]);
        expect(editorUi.overlayLayers).toEqual([]);
        expect(editorUi.statusFields).toEqual([]);
    });

    it("refreshOn: none; commandGate: every command enabled; beforeRun: nothing", () => {
        expect(config.refreshOn).toEqual([]);
        const off = editorUi.commands.register({ id: "test.run", title: "Run", run: () => {} });
        const command = editorUi.commands.get("test.run")!;
        expect(config.commandGate(command)).toBe(true);
        expect(command.enabled()).toBe(true);
        expect(config.beforeRun(command)).toBeUndefined();
        off();
    });

    it("surfaces: the command palette, the shortcut sheet and the About dialog only", () => {
        expect(config.surfaces).toEqual({});
        expect(editorUi.surfaces.ids).toEqual(["command-palette", "shortcut-sheet", "about"]);
        expect(editorUi.surfaces.store.getState().open).toBeNull();
    });
});

describe("createEditorUi with every field given", () => {
    const editorUi = createEditorUi({
        ...BASE,
        keyContexts: {
            order: ["gesture", "timeline"],
            state: ["gesture"],
            focus: { timeline: '[data-region="timeline"]' },
        },
        bottomRegion: { id: "timeline", label: "Timeline" },
        railFooterHeight: 54,
        surfaces: { preferences: Empty },
    });

    it("keeps each value", () => {
        expect(editorUi.config.keyContexts).toEqual({
            order: ["gesture", "timeline"],
            state: ["gesture"],
            focus: { timeline: '[data-region="timeline"]' },
        });
        expect(editorUi.commands.contexts).toEqual([
            "text",
            "gesture",
            "timeline",
            "canvas",
            "global",
        ]);
        expect(editorUi.config.bottomRegion).toEqual({ id: "timeline", label: "Timeline" });
        expect(editorUi.config.railFooterHeight).toBe(54);
        expect(editorUi.config.surfaces).toEqual({ preferences: Empty });
    });

    it("tracks the editor's surfaces after the package's, one open at a time", () => {
        const { surfaces } = editorUi;
        expect(surfaces.ids).toEqual(["command-palette", "shortcut-sheet", "about", "preferences"]);
        surfaces.open("preferences");
        surfaces.open("command-palette");
        expect(surfaces.store.getState().open).toBe("command-palette");
        surfaces.close("preferences");
        expect(surfaces.store.getState().open).toBe("command-palette");
        surfaces.close();
        expect(surfaces.store.getState().open).toBeNull();
        expect(() => surfaces.open("release-notes")).toThrow(/"release-notes"/);
    });
});

describe("createEditorUi hands every module map to its registry (SPEC §1.3)", () => {
    const editorUi = createEditorUi({
        ...BASE,
        modules: {
            commands: {
                "/src/b.commands.ts": {
                    commands: [{ id: "b.run", title: "B", run: () => {}, menuPath: ["Edit"] }],
                },
                "/src/a.commands.ts": {
                    plannedCommands: [{ id: "a.later", title: "Later", menuPath: ["File"] }],
                },
            },
            dialogs: {
                "/src/a.dialog.tsx": {
                    commandDialogs: [{ kind: "a", name: "A", Component: Empty }],
                },
            },
            dock: {
                "/src/a.dock.tsx": { dockPanel: { id: "a", title: "A", order: 1, Body: Empty } },
            },
            contextBars: {
                "/src/a.contextbar.tsx": {
                    contextBarContent: {
                        id: "a",
                        order: 1,
                        shown: () => false,
                        subscribe: () => () => {},
                        Body: Empty,
                    },
                },
            },
            tools: { "/src/a.tools.ts": { tools: [{ id: "pen", label: "Pen", shortcut: "B" }] } },
            overlays: {
                "/src/a.overlay.ts": {
                    overlayLayers: [{ id: "grid", order: 200, draw: () => {} }],
                },
            },
            statusFields: {
                "/src/a.status.ts": { statusFields: [{ id: "zoom", order: 1, text: () => "1×" }] },
            },
        },
    });

    it("registers or collects what each module exports", () => {
        // The editor's commands; the package's own are tested in editor-ui-commands.
        const editorCommands = editorUi.commands
            .list()
            .filter((command) => !command.source.startsWith(PACKAGE_COMMAND_SOURCE));
        expect(editorCommands.map((command) => [command.id, command.source])).toEqual([
            ["a.later", "/src/a.commands.ts"],
            ["b.run", "/src/b.commands.ts"],
        ]);
        // The package's dialog first (SPEC §11), then the editor's.
        expect([...editorUi.dialogs.keys()]).toEqual(["licences", "a"]);
        expect(editorUi.dockPanels.map((panel) => panel.id)).toEqual(["a"]);
        expect(editorUi.contextBarContent.map((content) => content.id)).toEqual(["a"]);
        expect(editorUi.tools.list().map((tool) => [tool.id, tool.source])).toEqual([
            ["pen", "/src/a.tools.ts"],
        ]);
        expect(editorUi.overlayLayers.map((layer) => layer.id)).toEqual(["grid"]);
        expect(editorUi.statusFields.map((field) => field.id)).toEqual(["zoom"]);
    });

    it("throws the registry's error, naming the module", () => {
        const broken = { "/src/broken.dock.tsx": {} };
        const error = (() => {
            try {
                createEditorUi(withConfig({ modules: { dock: broken } }));
            } catch (caught) {
                return caught;
            }
            return null;
        })();
        expect(error).toBeInstanceOf(RegistrationError);
        expect((error as RegistrationError).path).toBe("/src/broken.dock.tsx");
    });
});

describe("createEditorUi refuses an invalid configuration at startup, naming the field", () => {
    const cases: [what: string, changes: Record<string, unknown>, field: RegExp][] = [
        ["no id", { id: undefined }, /config\.id is required/],
        ["an empty id", { id: " " }, /config\.id is required/],
        ["an id that is not lowercase", { id: "NGNE-Test-Editor" }, /config\.id "NGNE-Test/],
        ["an id with a dot", { id: "ngne.test" }, /config\.id "ngne\.test"/],
        ["no product name", { productName: undefined }, /config\.productName is required/],
        ["an empty product name", { productName: "" }, /config\.productName is required/],
        ["no About facts", { about: undefined }, /config\.about is required/],
        ["no menus", { menus: undefined }, /config\.menus is required/],
        ["no menus at all", { menus: [] }, /config\.menus .*"Help"/],
        ["menus without View", { menus: ["File", "Help"] }, /config\.menus .*"View"/],
        [
            "menus not ending with Help",
            { menus: ["File", "Help", "View"] },
            /config\.menus .*"Help"/,
        ],
        [
            "a package context in the order",
            { keyContexts: { order: ["canvas"] } },
            /config\.keyContexts\.order .*"canvas"/,
        ],
        [
            "a context twice in the order",
            { keyContexts: { order: ["panel", "panel"] } },
            /config\.keyContexts\.order .*"panel"/,
        ],
        [
            "an unknown state context",
            { keyContexts: { order: ["panel"], state: ["gesture"] } },
            /config\.keyContexts\.state .*"gesture"/,
        ],
        [
            "an unknown focus context",
            { keyContexts: { order: ["gesture"], focus: { panel: "[data-region]" } } },
            /config\.keyContexts\.focus .*"panel"/,
        ],
        [
            "a focus context without a selector",
            { keyContexts: { order: ["panel"], focus: { panel: "" } } },
            /config\.keyContexts\.focus .*"panel"/,
        ],
        ["a bottom region without a label", { bottomRegion: { id: "x" } }, /config\.bottomRegion/],
        [
            "a bottom region id that is not lowercase words joined by hyphens",
            { bottomRegion: { id: "Bottom panel", label: "Bottom Panel" } },
            /config\.bottomRegion id "Bottom panel" is not lowercase/,
        ],
        [
            "a bottom region with the id of another region of the shell",
            { bottomRegion: { id: "dock", label: "Dock" } },
            /config\.bottomRegion id "dock" is the id of another region/,
        ],
        ["a negative rail footer", { railFooterHeight: -1 }, /config\.railFooterHeight/],
        [
            "a rail footer that is not a number",
            { railFooterHeight: Number.NaN },
            /railFooterHeight/,
        ],
        [
            "an editor surface with a package surface's id",
            { surfaces: { "shortcut-sheet": Empty } },
            /config\.surfaces .*"shortcut-sheet"/,
        ],
    ];

    it.each(cases)("%s", (_what, changes, field) => {
        expect(() => createEditorUi(withConfig(changes))).toThrow(field);
    });

    it("a command bound in a context the editor does not have, naming its module", () => {
        const commands = {
            "/src/app/x.commands.ts": {
                commands: [{ id: "x.run", title: "X", run: () => {}, context: "timeline" }],
            },
        };
        const config = withConfig({ keyContexts: { order: ["panel"] }, modules: { commands } });
        expect(() => createEditorUi(config)).toThrow(RegistrationError);
        expect(() => createEditorUi(config)).toThrow(/x\.commands\.ts.*"timeline"/);
    });
});
