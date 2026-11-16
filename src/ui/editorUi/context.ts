import { createContext, useContext } from "react";
import type { AnyEditorUi } from "./createEditorUi.js";

// The editor UI instance that `UiRoot` provides to the components under it (SPEC §1.2);
// non-React code imports the editor's own module instead.

export const EditorUiContext = createContext<AnyEditorUi | null>(null);

/** The editor UI instance of the nearest `UiRoot`; throws outside one. */
export function useEditorUi(): AnyEditorUi {
    const editorUi = useContext(EditorUiContext);
    if (editorUi === null) {
        throw new Error("useEditorUi: no editor UI here; render the component under UiRoot.");
    }
    return editorUi;
}
