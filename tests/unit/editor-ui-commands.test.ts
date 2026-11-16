import { createStore } from "zustand/vanilla";
import { describe, expect, it, vi } from "vitest";
import { RegistrationError } from "../../src/model/modules.ts";
import {
    buildMenu,
    COMMAND_PALETTE_COMMAND,
    resolveKey,
    SHORTCUT_SHEET_COMMAND,
} from "../../src/ui/commands/index.ts";
import type {
    CommandModule,
    CommandSpec,
    KeyEnvironment,
    MenuNode,
} from "../../src/ui/commands/index.ts";
import { buildEditorUi } from "../../src/ui/editorUi/createEditorUi.ts";
import type { PackageParts } from "../../src/ui/editorUi/createEditorUi.ts";
import {
    PACKAGE_COMMAND_MODULES,
    PACKAGE_COMMAND_SOURCE,
} from "../../src/ui/editorUi/packageCommands.ts";
import { createEditorUi } from "../../src/ui/index.ts";
import type { AppInfo, EditorUiConfig } from "../../src/ui/index.ts";

// The command registry of an editor UI instance (SPEC §1.3, §5, §7.1): the package's command
// modules register before the editor's, so an editor's command that takes a package command's
// id or chord fails at startup, naming the editor's module; the editor's `commandGate` and
// `refreshOn` stores act on its own commands, `beforeRun` on every command. The package's
// modules are a fixture here, passed as `createEditorUi` passes the real list, except in the
// last block: the real command palette and shortcut sheet commands, their chords and contexts,
// their menu places (Keyboard Shortcuts… first in Help) and the surfaces they open.

type Menu = "File" | "Edit" | "View" | "Help";

const ABOUT: AppInfo = {
    packageName: "ngne-test-editor",
    version: "1.0.0",
    licence: "MIT",
    engine: { packageName: "@ngne/core", version: "0.1.0" },
    repositoryUrl: "https://example.com",
    changelogUrl: "https://example.com/CHANGELOG.md",
};

const BASE: EditorUiConfig<Menu> = {
    id: "ngne-test-editor",
    productName: "NGNE Test Editor",
    about: ABOUT,
    menus: ["File", "Edit", "View", "Help"],
};

const PACKAGE_PATH = `${PACKAGE_COMMAND_SOURCE}fixture.commands.ts`;
const APP_PATH = "/src/app/feature/feature.commands.ts";

/** The package's parts with one fixture module: a palette-like command without a condition. */
const PACKAGE: PackageParts = {
    commandModules: {
        [PACKAGE_PATH]: () => ({
            commands: [
                { id: "package.palette", title: "Palette", shortcut: "Ctrl+K", run: () => {} },
                {
                    id: "package.sheet",
                    title: "Keyboard Shortcuts…",
                    shortcut: "?",
                    menuPath: ["Help"],
                    run: () => {},
                },
            ],
        }),
    },
};

/** An instance whose editor has one module with `commands`, over the fixture package. */
function instance(
    commands: readonly CommandSpec<Menu>[],
    config: Partial<EditorUiConfig<Menu>> = {},
) {
    const module: CommandModule<Menu> = { commands };
    return buildEditorUi(
        { ...BASE, ...config, modules: { commands: { [APP_PATH]: module } } },
        PACKAGE,
    );
}

/** What `run` throws. */
function thrown(run: () => unknown): unknown {
    try {
        run();
    } catch (error) {
        return error;
    }
    throw new Error("Expected an error.");
}

const run = () => {};

describe("package commands", () => {
    it("register with the editor's, in one registry", () => {
        const editorUi = instance([{ id: "edit.undo", title: "Undo", shortcut: "Ctrl+Z", run }]);
        expect(editorUi.commands.list().map((command) => [command.id, command.source])).toEqual([
            ["edit.undo", APP_PATH],
            ["package.palette", PACKAGE_PATH],
            ["package.sheet", PACKAGE_PATH],
        ]);
    });

    it("register before the editor's: a clash of ids names the package first, the editor's module fails", () => {
        const error = thrown(() => instance([{ id: "package.palette", title: "Mine", run }]));
        expect(error).toBeInstanceOf(RegistrationError);
        expect((error as RegistrationError).path).toBe(APP_PATH);
        expect((error as Error).message).toBe(
            `Command id "package.palette" is used by ${PACKAGE_PATH} and ${APP_PATH}.`,
        );
    });

    it("an editor's command binding a package command's chord fails, naming the editor's module", () => {
        const error = thrown(() =>
            instance([{ id: "app.search", title: "Search", shortcut: "Ctrl+K", run }]),
        );
        expect(error).toBeInstanceOf(RegistrationError);
        expect((error as RegistrationError).path).toBe(APP_PATH);
        expect((error as Error).message).toMatch(
            /"package\.palette" .* and "app\.search" .* both bind "Ctrl\+K" in the "global" context/,
        );
    });

    it("are the package's own list in createEditorUi, each module under the package's prefix", () => {
        const editorUi = createEditorUi(BASE);
        const packageIds = Object.values(PACKAGE_COMMAND_MODULES)
            .map((module) => module({ surfaces: editorUi.surfaces }))
            .flatMap((module) => [...(module.commands ?? []), ...(module.plannedCommands ?? [])])
            .map((spec) => spec.id)
            .sort();
        expect(editorUi.commands.list().map((command) => command.id)).toEqual(packageIds);
        for (const path of Object.keys(PACKAGE_COMMAND_MODULES)) {
            expect(path.startsWith(PACKAGE_COMMAND_SOURCE), path).toBe(true);
        }
        for (const command of editorUi.commands.list()) {
            expect(["View", "Help", undefined], command.id).toContain(command.menuPath?.[0]);
            expect(command.source.startsWith(PACKAGE_COMMAND_SOURCE), command.id).toBe(true);
        }
    });
});

describe("commandGate", () => {
    it("disables the editor's commands it rejects, before their own condition", () => {
        const own = vi.fn(() => true);
        const gate = vi.fn((command: { id: string }) => command.id !== "edit.cut");
        const editorUi = instance(
            [
                { id: "edit.cut", title: "Cut", enabled: own, run },
                { id: "edit.copy", title: "Copy", enabled: own, run },
            ],
            { commandGate: gate },
        );
        expect(editorUi.commands.get("edit.cut")!.enabled()).toBe(false);
        expect(own).not.toHaveBeenCalled();
        expect(editorUi.commands.get("edit.copy")!.enabled()).toBe(true);
        expect(own).toHaveBeenCalledTimes(1);
        expect(gate).toHaveBeenCalledWith(editorUi.commands.get("edit.cut"));
    });

    it("leaves the package's commands enabled: they act without a document", () => {
        const gate = vi.fn(() => false);
        const editorUi = instance([{ id: "edit.undo", title: "Undo", run }], { commandGate: gate });
        expect(editorUi.commands.get("edit.undo")!.enabled()).toBe(false);
        expect(editorUi.commands.get("package.palette")!.enabled()).toBe(true);
        expect(editorUi.commands.get("package.sheet")!.enabled()).toBe(true);
        expect(gate).not.toHaveBeenCalledWith(editorUi.commands.get("package.palette"));
    });
});

describe("beforeRun", () => {
    it("runs before every command, the editor's and the package's", async () => {
        const calls: string[] = [];
        const editorUi = instance(
            [{ id: "edit.undo", title: "Undo", run: () => void calls.push("run edit.undo") }],
            { beforeRun: (command) => void calls.push(`before ${command.id}`) },
        );
        await editorUi.commands.get("edit.undo")!.run();
        await editorUi.commands.get("package.palette")!.run();
        expect(calls).toEqual(["before edit.undo", "run edit.undo", "before package.palette"]);
    });
});

describe("refreshOn", () => {
    it("refreshes the commands when any of the stores changes", () => {
        const document = createStore(() => ({ open: false }));
        const selection = createStore(() => ({ size: 0 }));
        const editorUi = instance(
            [
                {
                    id: "edit.cut",
                    title: "Cut",
                    enabled: () => document.getState().open && selection.getState().size > 0,
                    run,
                },
            ],
            { refreshOn: [document, selection] },
        );
        const cut = editorUi.commands.get("edit.cut")!;
        const refreshed = vi.fn();
        editorUi.commands.subscribe(refreshed);
        const version = editorUi.commands.version();

        document.setState({ open: true });
        expect(refreshed).toHaveBeenCalledTimes(1);
        expect(cut.enabled()).toBe(false);
        selection.setState({ size: 3 });
        expect(refreshed).toHaveBeenCalledTimes(2);
        expect(cut.enabled()).toBe(true);
        expect(editorUi.commands.version()).toBe(version + 2);
    });

    it("refreshes nothing without stores", () => {
        const store = createStore(() => ({ value: 0 }));
        const editorUi = instance([{ id: "edit.undo", title: "Undo", run }]);
        const refreshed = vi.fn();
        editorUi.commands.subscribe(refreshed);
        store.setState({ value: 1 });
        expect(refreshed).not.toHaveBeenCalled();
    });
});

describe("the command palette and shortcut sheet commands (SPEC §7.1, §11)", () => {
    const PALETTE_SOURCE = `${PACKAGE_COMMAND_SOURCE}commands/commandPalette.commands.ts`;
    const SHEET_SOURCE = `${PACKAGE_COMMAND_SOURCE}commands/shortcutSheet.commands.ts`;

    /** An instance of the real package over the editor's module and `config`. */
    function editor(
        module: CommandModule<Menu> = { commands: [] },
        config: Partial<EditorUiConfig<Menu>> = {},
    ) {
        return createEditorUi({
            ...BASE,
            ...config,
            modules: { commands: { [APP_PATH]: module } },
        });
    }

    /** The ids of a menu's commands, with "---" for a separator. */
    function outline(nodes: readonly MenuNode[]): string[] {
        return nodes.map((node) => (node.kind === "command" ? node.command.id : "---"));
    }

    /** A key pressed with nothing open; the focus on the viewport unless stated otherwise. */
    function environment(overrides: Partial<KeyEnvironment> = {}): KeyEnvironment {
        return {
            overlayOpen: false,
            focus: "viewport",
            nativeKeys: new Set(),
            typeahead: false,
            ...overrides,
        };
    }

    it("are the package's commands, each from a module of its own", () => {
        const { commands } = editor();
        expect(COMMAND_PALETTE_COMMAND).toBe("edit.commandPalette");
        expect(SHORTCUT_SHEET_COMMAND).toBe("edit.shortcuts");
        expect(commands.list().map((command) => command.id)).toEqual(
            expect.arrayContaining([COMMAND_PALETTE_COMMAND, SHORTCUT_SHEET_COMMAND]),
        );
        expect(commands.get(COMMAND_PALETTE_COMMAND)).toMatchObject({
            source: PALETTE_SOURCE,
            planned: false,
        });
        expect(commands.get(SHORTCUT_SHEET_COMMAND)).toMatchObject({
            source: SHEET_SOURCE,
            planned: false,
        });
        expect(commands.get(COMMAND_PALETTE_COMMAND)!.title()).toBe("Command Palette…");
        expect(commands.get(SHORTCUT_SHEET_COMMAND)!.title()).toBe("Keyboard Shortcuts…");
    });

    it("the palette binds Ctrl+K in global and text, and names no menu", () => {
        expect(editor().commands.get(COMMAND_PALETTE_COMMAND)).toMatchObject({
            shortcuts: ["Ctrl+K"],
            contexts: ["global", "text"],
            menuPath: null,
            release: null,
        });
    });

    it("the sheet binds ? in canvas only, in the Help menu", () => {
        expect(editor().commands.get(SHORTCUT_SHEET_COMMAND)).toMatchObject({
            shortcuts: ["?"],
            contexts: ["canvas"],
            menuPath: ["Help"],
            menuOrder: 0,
            release: null,
        });
    });

    it("Ctrl+K reaches the palette everywhere but under an overlay, where it is suppressed", () => {
        const { commands } = editor();
        const palette = commands.get(COMMAND_PALETTE_COMMAND);
        const resolved = (overrides: Partial<KeyEnvironment>) =>
            resolveKey(commands, "Ctrl+K", environment(overrides), []);
        expect(resolved({})).toMatchObject({ action: "run", command: palette });
        expect(resolved({ focus: "none" })).toMatchObject({ action: "run", command: palette });
        expect(resolved({ focus: "control" })).toMatchObject({ action: "run", command: palette });
        expect(resolved({ focus: "text" })).toMatchObject({
            action: "run",
            command: palette,
            context: "text",
        });
        expect(resolved({ overlayOpen: true })).toEqual({ action: "suppress" });
    });

    it("? reaches the sheet in canvas; a text field, a typeahead or an overlay keeps it", () => {
        const { commands } = editor();
        const sheet = commands.get(SHORTCUT_SHEET_COMMAND);
        const resolved = (overrides: Partial<KeyEnvironment>) =>
            resolveKey(commands, "?", environment(overrides), []);
        expect(resolved({})).toMatchObject({ action: "run", command: sheet, context: "canvas" });
        expect(resolved({ focus: "none" })).toMatchObject({ action: "run", command: sheet });
        expect(resolved({ focus: "control" })).toMatchObject({ action: "run", command: sheet });
        expect(resolved({ focus: "text" })).toEqual({ action: "pass" });
        expect(resolved({ focus: "control", typeahead: true })).toEqual({ action: "pass" });
        expect(resolved({ overlayOpen: true })).toEqual({ action: "pass" });
    });

    it("Keyboard Shortcuts… is the first item of Help, ahead of the editor's items there", () => {
        const help = (module: CommandModule<Menu>) =>
            outline(buildMenu(editor(module).commands.list(), ["Help"]));
        expect(help({ commands: [] })).toEqual([SHORTCUT_SHEET_COMMAND]);
        expect(
            help({
                commands: [
                    { id: "help.guide", title: "Guide", menuPath: ["Help"], run },
                    { id: "help.tips", title: "Tips", menuPath: ["Help"], menuOrder: 1, run },
                    { id: "help.site", title: "Site", menuPath: ["Help"], menuOrder: 100, run },
                ],
            }),
        ).toEqual([SHORTCUT_SHEET_COMMAND, "help.tips", "---", "help.site", "---", "help.guide"]);
        // An editor's plan for the sheet's id does not move it: the command names its place.
        expect(
            help({
                plannedCommands: [
                    {
                        id: SHORTCUT_SHEET_COMMAND,
                        title: "Keyboard Shortcuts…",
                        menuPath: ["Help"],
                        menuOrder: 100,
                    },
                ],
                commands: [
                    { id: "help.tips", title: "Tips", menuPath: ["Help"], menuOrder: 50, run },
                ],
            }),
        ).toEqual([SHORTCUT_SHEET_COMMAND, "help.tips"]);
    });

    it("the palette takes the menu item an editor plans for its id", () => {
        const { commands } = editor({
            plannedCommands: [
                {
                    id: COMMAND_PALETTE_COMMAND,
                    title: "Command Palette…",
                    menuPath: ["Edit"],
                    menuOrder: 900,
                },
            ],
        });
        expect(commands.get(COMMAND_PALETTE_COMMAND)).toMatchObject({
            planned: false,
            source: PALETTE_SOURCE,
            menuPath: ["Edit"],
            menuOrder: 900,
            shortcuts: ["Ctrl+K"],
        });
    });

    it("each opens its surface in its own instance, outside the editor's gate", async () => {
        const first = editor(undefined, { commandGate: () => false });
        const second = editor();
        const open = (editorUi: ReturnType<typeof editor>) =>
            editorUi.surfaces.store.getState().open;
        expect(first.commands.get(COMMAND_PALETTE_COMMAND)!.enabled()).toBe(true);
        expect(first.commands.get(SHORTCUT_SHEET_COMMAND)!.enabled()).toBe(true);

        await first.commands.get(COMMAND_PALETTE_COMMAND)!.run();
        expect(open(first)).toBe("command-palette");
        expect(open(second)).toBeNull();
        await first.commands.get(SHORTCUT_SHEET_COMMAND)!.run();
        expect(open(first)).toBe("shortcut-sheet");
        await second.commands.get(COMMAND_PALETTE_COMMAND)!.run();
        expect(open(second)).toBe("command-palette");
        expect(open(first)).toBe("shortcut-sheet");
    });

    it("an editor's surface is tracked with the package's: one open at a time", async () => {
        const Preferences = () => null;
        const editorUi = editor(undefined, { surfaces: { preferences: Preferences } });
        expect(editorUi.surfaces.ids).toEqual(["command-palette", "shortcut-sheet", "preferences"]);
        editorUi.surfaces.open("preferences");
        await editorUi.commands.get(COMMAND_PALETTE_COMMAND)!.run();
        expect(editorUi.surfaces.store.getState().open).toBe("command-palette");
        editorUi.surfaces.open("preferences");
        expect(editorUi.surfaces.store.getState().open).toBe("preferences");
    });
});
