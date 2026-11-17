import { useState } from "react";
import type { ReactNode } from "react";
import type { CommandModule } from "../../../model/commands/types.js";
import { ABOUT_COMMAND } from "../../about/about.commands.js";
import { CommandPaletteTrigger } from "../../commands/CommandPaletteTrigger.js";
import { SHORTCUT_SHEET_COMMAND } from "../../commands/shortcutSheet.commands.js";
import { runCommand } from "../../commands/runCommand.js";
import { SurfaceHost } from "../../commands/SurfaceHost.js";
import { EditorUiContext, useEditorUi } from "../../editorUi/context.js";
import { createEditorUi } from "../../editorUi/createEditorUi.js";
import type { AnyEditorUi } from "../../editorUi/createEditorUi.js";
import type { AppInfo } from "../../editorUi/config.js";
import { Button } from "../../primitives/index.js";
import type { GalleryEntry } from "../entry.js";

// The command palette, shortcut sheet and About entries of the gallery (SPEC §7.1, §11,
// DESIGN §4, §7): each over an editor UI instance of its own, built from a fixture
// configuration with commands in a menu bar, with and without keys, one disabled and some
// outside the menus, and fixture build facts, and shown by its own surface host. The instance is provided to the entry without `UiRoot`, which would
// take the document's theme from the gallery's switch; so the keys do not open the surfaces
// here, their buttons do.

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

/** An instance of the fixture configuration under `id`, which names its stored recent commands. */
function fixtureInstance(id: string): AnyEditorUi {
    return createEditorUi<Menu>({
        id,
        productName: "NGNE Gallery Editor",
        about: { packageName: id, ...FIXTURE_ABOUT },
        menus: MENUS,
        modules: { commands: FIXTURE_COMMANDS },
    });
}

/** The entry's instance for its content and its surface host. */
function WithInstance({ id, children }: Readonly<{ id: string; children: ReactNode }>) {
    const [editorUi] = useState(() => fixtureInstance(id));
    return (
        <EditorUiContext.Provider value={editorUi}>
            <div className="gallery__row">{children}</div>
            <SurfaceHost />
        </EditorUiContext.Provider>
    );
}

function CommandPaletteEntry() {
    return (
        <WithInstance id="ngne-gallery-palette">
            <CommandPaletteTrigger />
        </WithInstance>
    );
}

function SheetButton() {
    const editorUi = useEditorUi();
    return (
        <Button onClick={() => runCommand(editorUi.commands, SHORTCUT_SHEET_COMMAND)}>
            Keyboard Shortcuts…
        </Button>
    );
}

function ShortcutSheetEntry() {
    return (
        <WithInstance id="ngne-gallery-sheet">
            <SheetButton />
        </WithInstance>
    );
}

function AboutButton() {
    const editorUi = useEditorUi();
    const { title } = editorUi.commands.get(ABOUT_COMMAND)!;
    return <Button onClick={() => runCommand(editorUi.commands, ABOUT_COMMAND)}>{title()}</Button>;
}

function AboutEntry() {
    return (
        <WithInstance id="ngne-gallery-about">
            <AboutButton />
        </WithInstance>
    );
}

export const surfaceEntries: readonly GalleryEntry[] = [
    { id: "command-palette", title: "Command palette", Component: CommandPaletteEntry },
    { id: "shortcut-sheet", title: "Shortcut sheet", Component: ShortcutSheetEntry },
    { id: "about", title: "About dialog", Component: AboutEntry },
];
