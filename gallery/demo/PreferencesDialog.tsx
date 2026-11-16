import { setTheme, useEditorUi, useTheme } from "@ngne/editor-ui";
import { SHORTCUT_SHEET_COMMAND, runCommand } from "@ngne/editor-ui/commands";
import { Button, Dialog, SegmentedControl } from "@ngne/editor-ui/primitives";
import { THEMES } from "./themes.ts";

// The demo editor's Preferences dialog: a fixture of an editor's own surface (DESIGN §7,
// SPEC §5 `surfaces`), shown by the package's surface host while the instance's `preferences`
// surface is open. Theme first, a change applies at once; then a button that opens the
// shortcut sheet in its place, as one surface takes the place of another.

export function PreferencesDialog() {
    const editorUi = useEditorUi();
    const theme = useTheme();
    const close = () => editorUi.surfaces.close("preferences");
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) close();
            }}
            title="Preferences"
            actions={
                <Button variant="primary" onClick={close}>
                    Close
                </Button>
            }
        >
            <div className="demo__preferences">
                <SegmentedControl
                    label="Theme"
                    value={theme}
                    onChange={(next) => setTheme(editorUi, next)}
                    options={THEMES}
                />
                <Button onClick={() => runCommand(editorUi.commands, SHORTCUT_SHEET_COMMAND)}>
                    Keyboard Shortcuts…
                </Button>
            </div>
        </Dialog>
    );
}
