import { describe, expect, it } from "vitest";
import { RegistrationError } from "../../src/model/modules.ts";
import { buildMenu } from "../../src/ui/commands/index.ts";
import type { CommandModule, MenuNode } from "../../src/ui/commands/index.ts";
import { PACKAGE_COMMAND_SOURCE } from "../../src/ui/editorUi/packageCommands.ts";
import { createEditorUi } from "../../src/ui/index.ts";
import type { AppInfo, EditorUiConfig } from "../../src/ui/index.ts";
import { LICENCES_COMMAND, LICENCES_PATH } from "../../src/ui/licences/index.ts";
import { LICENCES_MENU_ORDER } from "../../src/ui/licences/licences.commands.ts";
import { LicencesDialog } from "../../src/ui/licences/LicencesDialog.tsx";
import {
    createLicencesDialogs,
    licencesAddress,
    openLicences,
} from "../../src/ui/licences/openLicences.ts";
import type { LicencesHost } from "../../src/ui/licences/openLicences.ts";
import type { CommandDialogModule } from "../../src/ui/messages/index.ts";

// The Open Source Licences command (SPEC §11, DESIGN §7, §8): View → Open Source Licences…, a
// package command in the last group of the View menu, enabled while the editor's command gate
// stands for "no document open"; how it shows the licences file the build writes beside the
// page, under any base, in the package's licences dialog; and that dialog's place among the
// instance's dialogs.

type Menu = "File" | "View" | "Help";

const INFO: AppInfo = {
    packageName: "ngne-test-editor",
    version: "1.0.0",
    licence: "MIT",
    engine: { packageName: "@ngne/core", version: "0.1.0" },
    repositoryUrl: "https://example.test/repo",
    changelogUrl: "https://example.test/repo/blob/main/CHANGELOG.md",
};

const BASE: EditorUiConfig<Menu> = {
    id: "ngne-test-editor",
    productName: "NGNE Test Editor",
    about: INFO,
    menus: ["File", "View", "Help"],
};

const APP_PATH = "/src/app/view/view.commands.ts";
const run = () => {};

/** The editor's View items: one in each of two groups, and one an editor places late. */
const VIEW: CommandModule<Menu> = {
    commands: [
        { id: "view.zoomIn", title: "Zoom In", menuPath: ["View"], menuOrder: 100, run },
        { id: "view.grid", title: "Grid", menuPath: ["View"], menuOrder: 200, run },
        { id: "view.late", title: "Late", menuPath: ["View"], menuOrder: 99_999, run },
    ],
};

/** An instance of the real package over the editor's View items and `config`. */
function editor(config: Partial<EditorUiConfig<Menu>> = {}) {
    return createEditorUi({ ...BASE, ...config, modules: { commands: { [APP_PATH]: VIEW } } });
}

/** The ids of a menu's commands, with "---" for a separator. */
function outline(nodes: readonly MenuNode[]): string[] {
    return nodes.map((node) => (node.kind === "command" ? node.command.id : "---"));
}

/** A host that records what the command does; `text` is what the fetch gives. */
function fakeHost(text: string | null, baseUrl = "https://example.test/sub/path/index.html?x=1") {
    const log: string[] = [];
    const host: LicencesHost = {
        baseUrl,
        fetchText: async (url) => {
            log.push(`fetch ${url}`);
            return text;
        },
        show: async (shown, address) => {
            log.push(`show ${JSON.stringify(shown)} ${address}`);
        },
    };
    return { host, log };
}

describe("the Open Source Licences command", () => {
    it("is the last item of the View menu, in a group of its own, from a package module", () => {
        const command = editor().commands.get(LICENCES_COMMAND);
        expect(command).toMatchObject({
            planned: false,
            menuPath: ["View"],
            menuOrder: LICENCES_MENU_ORDER,
            shortcuts: [],
            source: `${PACKAGE_COMMAND_SOURCE}licences/licences.commands.ts`,
        });
        expect(command?.title()).toBe("Open Source Licences…");
        expect(outline(buildMenu(editor().commands.list(), ["View"]))).toEqual([
            "view.zoomIn",
            "---",
            "view.grid",
            "---",
            "view.late",
            "---",
            LICENCES_COMMAND,
        ]);
    });

    it("keeps the id both editors gave it", () => {
        expect(LICENCES_COMMAND).toBe("app.licences");
    });

    it("is enabled while the editor's gate stands for no document, and with one open", () => {
        let documentOpen = false;
        const editorUi = editor({ commandGate: () => documentOpen });
        expect(editorUi.commands.get("view.zoomIn")!.enabled()).toBe(false);
        expect(editorUi.commands.get(LICENCES_COMMAND)!.enabled()).toBe(true);
        documentOpen = true;
        editorUi.commands.refresh();
        expect(editorUi.commands.get("view.zoomIn")!.enabled()).toBe(true);
        expect(editorUi.commands.get(LICENCES_COMMAND)!.enabled()).toBe(true);
    });
});

describe("openLicences", () => {
    it("fetches the file beside the page and shows its text in the dialog", async () => {
        const { host, log } = fakeHost("Licences\n");
        await openLicences(host);
        expect(log).toEqual([
            "fetch https://example.test/sub/path/licences.txt",
            'show "Licences\\n" https://example.test/sub/path/licences.txt',
        ]);
        expect(LICENCES_PATH).toBe("licences.txt");
    });

    it("shows that the file could not be read, with its address, when the fetch fails", async () => {
        const { host, log } = fakeHost(null);
        await openLicences(host);
        expect(log).toEqual([
            "fetch https://example.test/sub/path/licences.txt",
            "show null https://example.test/sub/path/licences.txt",
        ]);
    });

    it.each([
        ["https://example.test/", "https://example.test/licences.txt"],
        ["https://example.test/index.html", "https://example.test/licences.txt"],
        [
            "https://user.github.io/ngne-sprite-editor/",
            "https://user.github.io/ngne-sprite-editor/licences.txt",
        ],
        [
            "https://user.github.io/ngne-editor-ui/demo/?bottom=none#top",
            "https://user.github.io/ngne-editor-ui/demo/licences.txt",
        ],
        ["http://localhost:5173/a/b/index.html?x=1", "http://localhost:5173/a/b/licences.txt"],
        ["http://127.0.0.1:4173/app", "http://127.0.0.1:4173/licences.txt"],
    ])("under the base %s reads %s", async (baseUrl, address) => {
        expect(licencesAddress(baseUrl)).toBe(address);
        const { host, log } = fakeHost("x", baseUrl);
        await openLicences(host);
        expect(log[0]).toBe(`fetch ${address}`);
    });
});

describe("the licences dialog", () => {
    it("asks for a dialog of kind licences and resolves with null once it is closed", async () => {
        const dialogs = createLicencesDialogs();
        dialogs.attachHost();
        const shown = dialogs.show({ text: "Licences\n", address: "https://example.test/l" });
        const request = dialogs.store.getState().request;
        expect(request).toMatchObject({
            kind: "licences",
            text: "Licences\n",
            address: "https://example.test/l",
        });
        request?.answer(null);
        await expect(shown).resolves.toBeNull();
        expect(dialogs.store.getState().request).toBeNull();
    });

    it("is answered with null at once while no host shows it", async () => {
        const dialogs = createLicencesDialogs();
        await expect(dialogs.show({ text: "x", address: "y" })).resolves.toBeNull();
        expect(dialogs.store.getState().request).toBeNull();
    });

    it("is among every instance's dialogs, beside the editor's", () => {
        const editorDialog: CommandDialogModule = {
            commandDialogs: [{ kind: "new-sprite", name: "New sprite", Component: () => null }],
        };
        const editorUi = createEditorUi({
            ...BASE,
            modules: { dialogs: { "/src/ui/sprite/sprite.dialog.tsx": editorDialog } },
        });
        expect([...editorUi.dialogs.keys()].sort()).toEqual(["licences", "new-sprite"]);
        expect(editorUi.dialogs.get("licences")).toMatchObject({
            kind: "licences",
            name: "Open Source Licences",
            Component: LicencesDialog,
        });
        expect(createEditorUi(BASE).dialogs.has("licences")).toBe(true);
    });

    it("an editor's dialog of the same kind fails at startup, naming the editor's module", () => {
        const path = "/src/ui/licences/licences.dialog.tsx";
        const module: CommandDialogModule = {
            commandDialogs: [{ kind: "licences", name: "Licences", Component: () => null }],
        };
        let error: unknown;
        try {
            createEditorUi({ ...BASE, modules: { dialogs: { [path]: module } } });
        } catch (thrown) {
            error = thrown;
        }
        expect(error).toBeInstanceOf(RegistrationError);
        expect((error as RegistrationError).path).toBe(path);
        expect((error as Error).message).toBe(
            `Dialog kind "licences" is used by ${PACKAGE_COMMAND_SOURCE}licences/licences.dialog.tsx and ${path}.`,
        );
    });
});
