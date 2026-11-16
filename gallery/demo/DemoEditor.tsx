import { setTheme, useEditorUi, useTheme } from "@ngne/editor-ui";
import type { Theme } from "@ngne/editor-ui";
import { SegmentedControl } from "@ngne/editor-ui/primitives";

// The demo editor's content, read from the instance `UiRoot` provides. An editor sets the theme
// from its Preferences (SPEC §1.3); the demo has the one control.

const THEMES: readonly { value: Theme; label: string }[] = [
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
];

export function DemoEditor() {
    const editorUi = useEditorUi();
    const theme = useTheme();
    return (
        <main className="demo" data-editor-ui={editorUi.config.id}>
            <header className="demo__header">
                <h1 className="demo__heading">{editorUi.config.productName}</h1>
                <SegmentedControl
                    label="Theme"
                    value={theme}
                    onChange={(next) => setTheme(editorUi, next)}
                    options={THEMES}
                />
            </header>
            <p className="demo__text">
                The gallery's demo editor: an editor UI instance from its configuration, mounted
                through UiRoot.
            </p>
        </main>
    );
}
