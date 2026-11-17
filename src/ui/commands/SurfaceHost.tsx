import { Component, useEffect } from "react";
import type { ComponentType, ReactNode } from "react";
import { useStore } from "zustand";
import { AboutDialog } from "../about/AboutDialog.js";
import { useEditorUi } from "../editorUi/context.js";
import type { Surfaces } from "../editorUi/surfaces.js";
import { focusMenuOpener } from "../focus/menuOpener.js";
import { toast } from "../messages/toast.js";
import { CommandPalette } from "./CommandPalette.js";
import { ShortcutSheet } from "./ShortcutSheet.js";

// The surfaces host (SPEC §7.1): shows the surface of the editor UI instance that a command
// has opened — the package's command palette, shortcut sheet and About dialog (SPEC §11), or
// one of the editor's own (`config.surfaces`, SPEC §5), such as its Preferences dialog.

/** The package's surfaces with the names their failure toasts give them. */
const PACKAGE_SURFACES: Readonly<Record<string, { name: string; Surface: ComponentType }>> = {
    "command-palette": { name: "Command palette", Surface: CommandPalette },
    "shortcut-sheet": { name: "Keyboard shortcuts", Surface: ShortcutSheet },
    about: { name: "About", Surface: AboutDialog },
};

interface SurfaceBoundaryProps {
    surfaces: Surfaces;
    children: ReactNode;
}

interface SurfaceBoundaryState {
    failed: boolean;
}

/**
 * Error boundary of the surfaces. A surface that crashes is closed and reported by an error
 * toast (DESIGN §5: a toast reports failures); the editor behind it stays usable, and the
 * surface can be opened again. React reports the caught error to the console. An editor's
 * surface is named only by its id, so its toast speaks of "the dialog".
 */
class SurfaceBoundary extends Component<Readonly<SurfaceBoundaryProps>, SurfaceBoundaryState> {
    override state: SurfaceBoundaryState = { failed: false };

    static getDerivedStateFromError(): SurfaceBoundaryState {
        return { failed: true };
    }

    override componentDidCatch(): void {
        const { surfaces } = this.props;
        const { open } = surfaces.store.getState();
        surfaces.close();
        const name = (open === null ? undefined : PACKAGE_SURFACES[open]?.name) ?? "The dialog";
        toast.error(`${name} failed to open.`);
        this.setState({ failed: false });
    }

    override render(): ReactNode {
        return this.state.failed ? null : this.props.children;
    }
}

/**
 * Shows the surface a command has opened in the instance `UiRoot` provides, one at a time.
 * The editor mounts it once under `UiRoot`, outside every region and inside a boundary of its
 * own, so a failed region does not take the surfaces with it.
 */
export function SurfaceHost() {
    const editorUi = useEditorUi();
    const { surfaces } = editorUi;
    const open = useStore(surfaces.store, (state) => state.open);
    // A surface opened from a menu item is opened while that menu still has focus. The
    // listener runs in the same call, before the surface exists, so the surface's opener is
    // the menu's control and not an item that is about to disappear.
    useEffect(
        () =>
            surfaces.store.subscribe((state, previous) => {
                if (state.open && !previous.open) focusMenuOpener();
            }),
        [surfaces],
    );
    const Surface =
        open === null
            ? null
            : (PACKAGE_SURFACES[open]?.Surface ?? editorUi.config.surfaces[open] ?? null);
    return <SurfaceBoundary surfaces={surfaces}>{Surface ? <Surface /> : null}</SurfaceBoundary>;
}
