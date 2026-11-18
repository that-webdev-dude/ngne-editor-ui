import type { CommandModule } from "../../../model/commands/types.js";
import type { AppInfo, BottomRegion } from "../../editorUi/config.js";
import { createEditorUi } from "../../editorUi/createEditorUi.js";
import type { AnyEditorUi } from "../../editorUi/createEditorUi.js";

// The fixture editor of the gallery's entries that need an editor UI instance (SPEC §5): a
// menu bar with commands with and without keys, two disabled, some outside the menus, and
// fixture build facts. Each entry builds an instance of its own under its own id, which names
// what the instance stores (recent commands, layout).

const MENUS = ["File", "Edit", "View", "Help"] as const;
type Menu = (typeof MENUS)[number];

const done = () => {};

const REPOSITORY_URL = "https://github.com/that-webdev-dude/ngne-editor-ui";

/** The fixture build facts the About entry shows (SPEC §5 `about`). */
const FIXTURE_ABOUT: Omit<AppInfo, "packageName"> = {
    version: "2.7.1",
    licence: "MIT",
    engine: { packageName: "@ngne/core", version: "0.8.5" },
    repositoryUrl: REPOSITORY_URL,
    changelogUrl: `${REPOSITORY_URL}/blob/main/CHANGELOG.md`,
};

const FIXTURE_COMMANDS: Readonly<Record<string, CommandModule<Menu, never>>> = {
    "./gallery/surfaces.commands.ts": {
        plannedCommands: [
            {
                id: "edit.commandPalette",
                title: "Command Palette…",
                menuPath: ["Edit"],
                menuOrder: 900,
            },
        ],
        commands: [
            {
                id: "file.new",
                title: "New Document",
                shortcut: "Ctrl+Alt+N",
                menuPath: ["File"],
                menuOrder: 100,
                run: done,
            },
            { id: "file.open", title: "Open…", menuPath: ["File"], menuOrder: 110, run: done },
            {
                id: "edit.undo",
                title: "Undo",
                shortcut: "Ctrl+Z",
                menuPath: ["Edit"],
                menuOrder: 100,
                enabled: () => false,
                run: done,
            },
            {
                id: "edit.redo",
                title: "Redo",
                shortcut: ["Ctrl+Y", "Ctrl+Shift+Z"],
                menuPath: ["Edit"],
                menuOrder: 110,
                enabled: () => false,
                run: done,
            },
            {
                id: "view.zoomIn",
                title: "Zoom In",
                shortcut: "Ctrl+=",
                menuPath: ["View"],
                menuOrder: 100,
                run: done,
            },
            {
                id: "view.grid",
                title: "Grid",
                shortcut: "Ctrl+G",
                menuPath: ["View", "Show"],
                menuOrder: 200,
                run: done,
            },
            { id: "tool.pencil", title: "Pencil", shortcut: "B", run: done },
            { id: "view.pan", title: "Pan", shortcut: "Space", release: done, run: done },
        ],
    },
};

/** What an entry's instance adds to the fixture configuration. */
export interface FixtureFrame {
    bottomRegion?: BottomRegion | null;
    railFooterHeight?: number;
}

/** An instance of the fixture configuration under `id`, with the frame `frame` gives it. */
export function fixtureInstance(id: string, frame: FixtureFrame = {}): AnyEditorUi {
    return createEditorUi<Menu>({
        id,
        productName: "NGNE Gallery Editor",
        about: { packageName: id, ...FIXTURE_ABOUT },
        menus: MENUS,
        modules: { commands: FIXTURE_COMMANDS },
        ...frame,
    });
}
