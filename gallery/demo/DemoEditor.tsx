import { setTheme, useEditorUi, useTheme } from "@ngne/editor-ui";
import { CommandPaletteTrigger, runCommand } from "@ngne/editor-ui/commands";
import { Button, SegmentedControl } from "@ngne/editor-ui/primitives";
import { useStore } from "zustand";
import { DemoKeys } from "./DemoKeys.tsx";
import { DemoRows } from "./DemoRows.tsx";
import { PREFERENCES_COMMAND } from "./preferences.ts";
import { THEMES } from "./themes.ts";

// The demo editor's content, read from the instance `UiRoot` provides. An editor sets the theme
// from its Preferences (SPEC §1.3); the demo has the one control in its header as well. The
// header opens the editor's Preferences surface and the command palette (its trigger); the
// page names the open surface of the instance in `data-open-surface` (SPEC §7.1).

export function DemoEditor() {
    const editorUi = useEditorUi();
    const theme = useTheme();
    const open = useStore(editorUi.surfaces.store, (state) => state.open);
    return (
        <main
            className="demo"
            data-editor-ui={editorUi.config.id}
            data-open-surface={open ?? undefined}
        >
            <header className="demo__header">
                <h1 className="demo__heading">{editorUi.config.productName}</h1>
                <div className="demo__actions">
                    <Button onClick={() => runCommand(editorUi.commands, PREFERENCES_COMMAND)}>
                        Preferences…
                    </Button>
                    <CommandPaletteTrigger />
                    <SegmentedControl
                        label="Theme"
                        value={theme}
                        onChange={(next) => setTheme(editorUi, next)}
                        options={THEMES}
                    />
                </div>
            </header>
            <p className="demo__text">
                The gallery's demo editor: an editor UI instance from its configuration, mounted
                through UiRoot.
            </p>
            <DemoRows />
            <DemoKeys />
        </main>
    );
}
