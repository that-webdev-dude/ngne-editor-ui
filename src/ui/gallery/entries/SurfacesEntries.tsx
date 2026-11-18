import { useState } from "react";
import type { ReactNode } from "react";
import { ABOUT_COMMAND } from "../../about/about.commands.js";
import { CommandPaletteTrigger } from "../../commands/CommandPaletteTrigger.js";
import { SHORTCUT_SHEET_COMMAND } from "../../commands/shortcutSheet.commands.js";
import { runCommand } from "../../commands/runCommand.js";
import { SurfaceHost } from "../../commands/SurfaceHost.js";
import { EditorUiContext, useEditorUi } from "../../editorUi/context.js";
import { Button } from "../../primitives/index.js";
import type { GalleryEntry } from "../entry.js";
import { fixtureInstance } from "./fixtureEditor.js";

// The command palette, shortcut sheet and About entries of the gallery (SPEC §7.1, §11,
// DESIGN §4, §7): each over an editor UI instance of its own, built from the fixture editor's
// configuration (fixtureEditor.ts), and shown by its own surface host. The instance is
// provided to the entry without `UiRoot`, which would take the document's theme from the
// gallery's switch; so the keys do not open the surfaces here, their buttons do.

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
];

export const aboutEntry: GalleryEntry = {
    id: "about",
    title: "About dialog",
    Component: AboutEntry,
};
