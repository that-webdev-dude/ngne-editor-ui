import { useEffect } from "react";
import type { AnyEditorUi } from "../editorUi/createEditorUi.js";
import { installKeymap } from "./installKeymap.js";
import { activeKeyContexts, readKeyEnvironment } from "./keyEnvironment.js";
import { reportCommandError } from "./runCommand.js";

/**
 * Connects the keyboard to the commands of `editorUi` (SPEC §7.2) while `active` holds: each
 * key reads the page's environment and the instance's active contexts, from its focus
 * selectors and its state-context store. A failing command is reported by an error toast.
 */
export function useEditorKeymap(editorUi: AnyEditorUi, active: boolean): void {
    useEffect(() => {
        if (!active) return;
        const { commands, config, keyContextState } = editorUi;
        return installKeymap({
            registry: commands,
            environment: () => readKeyEnvironment(document),
            activeContexts: () =>
                activeKeyContexts(document, config.keyContexts, keyContextState.getState()),
            onError: reportCommandError,
        });
    }, [editorUi, active]);
}
