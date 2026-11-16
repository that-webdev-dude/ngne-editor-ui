import { useEffect, useLayoutEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useStore } from "zustand";
import { inertOutsideModalLayers } from "../focus/inertOutside.js";
import { trackFocusModality } from "../focus/modality.js";
import { DialogHost } from "../messages/DialogHost.js";
import { ToastViewport } from "../messages/ToastViewport.js";
import { TooltipProvider } from "../primitives/Tooltip.js";
import { EditorUiContext } from "./context.js";
import type { AnyEditorUi } from "./createEditorUi.js";

export interface UiRootProps {
    /** The editor's instance, from `createEditorUi`. */
    editorUi: AnyEditorUi;
    children?: ReactNode;
}

/**
 * Everything the interface needs above it (SPEC §8): the instance's theme mirrored to
 * `<html data-theme>`, input-modality tracking, `inert` outside modal layers, the tooltip
 * provider, the host of the command dialogs (at the root, so no failed region takes the
 * dialogs with it) and the toasts, and the instance itself for the components under it
 * (SPEC §1.2). Rendered once, at the root of the editor.
 */
export function UiRoot({ editorUi, children }: Readonly<UiRootProps>) {
    const theme = useStore(editorUi.theme, (state) => state.theme);
    // A layout effect: the theme is on the page in the same frame as the first render.
    useLayoutEffect(() => {
        document.documentElement.dataset.theme = theme;
    }, [theme]);
    useEffect(() => trackFocusModality(), []);
    useEffect(() => inertOutsideModalLayers(), []);
    return (
        <EditorUiContext.Provider value={editorUi}>
            <TooltipProvider>
                {children}
                <DialogHost dialogs={editorUi.dialogs} />
                {/* The toasts are a live region: Radix leaves live regions and their ancestors
                    out when it hides the page behind a modal layer, so they sit beside the
                    page, not inside it. */}
                {createPortal(<ToastViewport />, document.body)}
            </TooltipProvider>
        </EditorUiContext.Provider>
    );
}
