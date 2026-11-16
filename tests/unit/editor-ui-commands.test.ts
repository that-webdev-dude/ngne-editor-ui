import { createStore } from "zustand/vanilla";
import { describe, expect, it, vi } from "vitest";
import { RegistrationError } from "../../src/model/modules.ts";
import type { CommandModule, CommandSpec } from "../../src/ui/commands/index.ts";
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
// modules are a fixture here, passed as `createEditorUi` passes the real list.

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
        [PACKAGE_PATH]: {
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
        },
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
