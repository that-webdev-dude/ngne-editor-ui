import { describe, expect, it, vi } from "vitest";
import { ABOUT_COMMAND } from "../../src/ui/about/index.ts";
import { ABOUT_MENU_ORDER } from "../../src/ui/about/about.commands.ts";
import { copyText, versionLine } from "../../src/ui/about/versionInfo.ts";
import {
    buildMenu,
    buildMenuBar,
    paletteEntries,
    SHORTCUT_SHEET_COMMAND,
} from "../../src/ui/commands/index.ts";
import type { CommandModule, MenuNode } from "../../src/ui/commands/index.ts";
import { PACKAGE_COMMAND_SOURCE } from "../../src/ui/editorUi/packageCommands.ts";
import { createEditorUi } from "../../src/ui/index.ts";
import type { AppInfo, EditorUiConfig } from "../../src/ui/index.ts";

// The About dialog's facts and command (SPEC §11, DESIGN §7, §8): the one line Copy version
// info copies and the copy's two outcomes; Help → About <productName>…, a package command
// titled from the editor's product name; and the Help menu frame the menu model builds,
// Keyboard Shortcuts… first, the editor's items between, About last in a group of its own.

type Menu = "File" | "View" | "Help";

const INFO: AppInfo = {
    packageName: "ngne-sprite-editor",
    version: "9.8.7",
    licence: "MIT",
    engine: { packageName: "@ngne/core", version: "6.5.4" },
    repositoryUrl: "https://example.test/repo",
    changelogUrl: "https://example.test/repo/blob/main/CHANGELOG.md",
};

const BASE: EditorUiConfig<Menu> = {
    id: "ngne-sprite-editor",
    productName: "NGNE Sprite Editor",
    about: INFO,
    menus: ["File", "View", "Help"],
};

const APP_PATH = "/src/app/help/help.commands.ts";
const run = () => {};

/** An instance of the real package over one editor module and `config`. */
function editor(
    module: CommandModule<Menu> = { commands: [] },
    config: Partial<EditorUiConfig<Menu>> = {},
) {
    return createEditorUi({ ...BASE, ...config, modules: { commands: { [APP_PATH]: module } } });
}

/** The ids of a menu's commands, with "---" for a separator. */
function outline(nodes: readonly MenuNode[]): string[] {
    return nodes.map((node) => (node.kind === "command" ? node.command.id : "---"));
}

const help = (module?: CommandModule<Menu>) =>
    outline(buildMenu(editor(module).commands.list(), ["Help"]));

describe("the version line", () => {
    it("is <package> <version> · @ngne/core <version> · <user agent>, on one line", () => {
        expect(versionLine(INFO, "TestAgent/1.0")).toBe(
            "ngne-sprite-editor 9.8.7 · @ngne/core 6.5.4 · TestAgent/1.0",
        );
        const line = versionLine(
            { ...INFO, packageName: "ngne-tilemap-editor", version: "0.3.0-rc.1" },
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.0.0",
        );
        expect(line).toBe(
            "ngne-tilemap-editor 0.3.0-rc.1 · @ngne/core 6.5.4 · " +
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.0.0",
        );
        expect(line).not.toContain("\n");
    });
});

describe("copyText", () => {
    it("writes the text and answers true", async () => {
        const writeText = vi.fn(async () => undefined);
        await expect(copyText("line", { writeText })).resolves.toBe(true);
        expect(writeText).toHaveBeenCalledWith("line");
    });

    it("answers false, without throwing, when the clipboard refuses or is missing", async () => {
        const refused = {
            writeText: () => Promise.reject(new DOMException("Denied", "NotAllowedError")),
        };
        await expect(copyText("line", refused)).resolves.toBe(false);
        await expect(copyText("line", undefined)).resolves.toBe(false);
        // A clipboard object without the method, as some embedded browsers give.
        await expect(copyText("line", {} as never)).resolves.toBe(false);
    });

    it("answers false outside a browser: Node has no clipboard", async () => {
        await expect(copyText("line")).resolves.toBe(false);
    });
});

describe("the About command", () => {
    it("is titled About <productName>…, from the editor's configuration", () => {
        expect(ABOUT_COMMAND).toBe("help.about");
        expect(editor().commands.get(ABOUT_COMMAND)!.title()).toBe("About NGNE Sprite Editor…");
        const tilemap = editor(undefined, { productName: "NGNE Tilemap Editor" });
        expect(tilemap.commands.get(ABOUT_COMMAND)!.title()).toBe("About NGNE Tilemap Editor…");
    });

    it("is a package command in Help, with no key, enabled outside the editor's gate", () => {
        const { commands } = editor(undefined, { commandGate: () => false });
        expect(commands.get(ABOUT_COMMAND)).toMatchObject({
            source: `${PACKAGE_COMMAND_SOURCE}about/about.commands.ts`,
            planned: false,
            shortcuts: [],
            menuPath: ["Help"],
            menuOrder: ABOUT_MENU_ORDER,
            release: null,
        });
        expect(commands.get(ABOUT_COMMAND)!.enabled()).toBe(true);
    });

    it("opens the About dialog of its own instance", async () => {
        const first = editor();
        const second = editor(undefined, { id: "ngne-tilemap-editor" });
        await first.commands.get(ABOUT_COMMAND)!.run();
        expect(first.surfaces.store.getState().open).toBe("about");
        expect(second.surfaces.store.getState().open).toBeNull();
        expect(first.config.about).toBe(INFO);
    });

    it("copies nothing when it opens the dialog: Copy version info does, when asked", async () => {
        const writeText = vi.fn(async () => undefined);
        vi.stubGlobal("navigator", { clipboard: { writeText }, userAgent: "TestAgent/1.0" });
        try {
            const instance = editor();
            await instance.commands.get(ABOUT_COMMAND)!.run();
            expect(instance.surfaces.store.getState().open).toBe("about");
            expect(writeText).not.toHaveBeenCalled();
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it("is listed by the command palette, under Help", () => {
        const { commands } = editor();
        const [entry] = paletteEntries(commands.list(), BASE.menus, [], "about");
        expect(entry).toMatchObject({ title: "About NGNE Sprite Editor…", group: "Help" });
        expect(entry?.command).toBe(commands.get(ABOUT_COMMAND));
    });

    it("an editor's command with its id fails at startup", () => {
        expect(() => editor({ commands: [{ id: ABOUT_COMMAND, title: "About", run }] })).toThrow(
            `Command id "help.about" is used by ${PACKAGE_COMMAND_SOURCE}about/about.commands.ts and ${APP_PATH}.`,
        );
    });
});

describe("the Help menu frame", () => {
    it("is Keyboard Shortcuts…, then About in a group of its own, with no editor item", () => {
        expect(help()).toEqual([SHORTCUT_SHEET_COMMAND, "---", ABOUT_COMMAND]);
    });

    it("puts the editor's Help items between them, About last whatever their order", () => {
        expect(
            help({
                commands: [
                    { id: "help.guide", title: "Guide", menuPath: ["Help"], run },
                    { id: "help.tips", title: "Tips", menuPath: ["Help"], menuOrder: 1, run },
                    { id: "help.site", title: "Site", menuPath: ["Help"], menuOrder: 100, run },
                    {
                        id: "help.far",
                        title: "Far",
                        menuPath: ["Help"],
                        menuOrder: 1_000_000_000,
                        run,
                    },
                ],
            }),
        ).toEqual([
            SHORTCUT_SHEET_COMMAND,
            "help.tips",
            "---",
            "help.site",
            "---",
            "help.guide",
            "---",
            "help.far",
            "---",
            ABOUT_COMMAND,
        ]);
    });

    it("keeps About last when an editor plans an item for its id", () => {
        expect(
            help({
                plannedCommands: [
                    { id: ABOUT_COMMAND, title: "About…", menuPath: ["Help"], menuOrder: 50 },
                ],
                commands: [
                    { id: "help.site", title: "Site", menuPath: ["Help"], menuOrder: 100, run },
                ],
            }),
        ).toEqual([SHORTCUT_SHEET_COMMAND, "---", "help.site", "---", ABOUT_COMMAND]);
    });

    it("is the last menu of the menu bar, which ends with Help", () => {
        const bar = buildMenuBar(editor().commands);
        expect(bar.map((entry) => entry.menu)).toEqual(["File", "View", "Help"]);
        expect(outline(bar.at(-1)!.items)).toEqual([SHORTCUT_SHEET_COMMAND, "---", ABOUT_COMMAND]);
    });
});
