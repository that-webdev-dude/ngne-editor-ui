import { useState } from "react";
import { SurfaceHost } from "../../commands/SurfaceHost.js";
import { EditorUiContext } from "../../editorUi/context.js";
import { Toggle, TooltipProvider } from "../../primitives/index.js";
import { AppShell } from "../../shell/AppShell.js";
import type { GalleryEntry } from "../entry.js";
import { fixtureInstance } from "./fixtureEditor.js";

// The shell frame entry of the gallery (SPEC §8, DESIGN §2, BRIEF D17): `AppShell` over the
// fixture editor's instance, with a bottom region and a rail footer, each named slot filled
// with a box that names it, in a frame of its own instead of the window. The menu bar comes
// from the instance's command registry, so its menus open, and the palette trigger, Help and
// View → Open Source Licences… open their surfaces; the regions with no registry behind them
// here (rail, context bar, dock, status bar) stay empty. A toggle gives the frame its
// `noDocument` content. The instance is provided without `UiRoot` (SurfacesEntries.tsx says
// why), so the keys run no command here.

/** Room for the rail footer's box, whose name runs down the 44 px rail. */
const RAIL_FOOTER_HEIGHT = 96;

/** A slot's content in this entry: a box that names the slot. */
function Slot({ name }: Readonly<{ name: string }>) {
    return (
        <div className="gallery-shell__slot" data-slot={name}>
            {name}
        </div>
    );
}

function ShellFrame() {
    const [editorUi] = useState(() =>
        fixtureInstance("ngne-gallery-shell", {
            bottomRegion: { id: "bottom", label: "Bottom" },
            railFooterHeight: RAIL_FOOTER_HEIGHT,
        }),
    );
    const [noDocument, setNoDocument] = useState(false);
    return (
        <EditorUiContext.Provider value={editorUi}>
            <TooltipProvider>
                <div className="gallery__row">
                    <Toggle
                        label="No document"
                        showLabel
                        pressed={noDocument}
                        onPressedChange={setNoDocument}
                    />
                </div>
                <div className="gallery-shell">
                    <AppShell
                        menuCentre={<Slot name="menuCentre" />}
                        railFooter={<Slot name="railFooter" />}
                        viewport={<Slot name="viewport" />}
                        bottom={<Slot name="bottom" />}
                        noDocument={noDocument ? <Slot name="noDocument" /> : null}
                    />
                </div>
                <SurfaceHost />
            </TooltipProvider>
        </EditorUiContext.Provider>
    );
}

export const shellEntry: GalleryEntry = {
    id: "app-shell",
    title: "Shell frame",
    Component: ShellFrame,
};
