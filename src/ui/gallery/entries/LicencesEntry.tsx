import { useState } from "react";
import { LicencesDialog } from "../../licences/LicencesDialog.js";
import { licencesDialogs, openLicences } from "../../licences/openLicences.js";
import type { LicencesRequest } from "../../licences/openLicences.js";
import { commandDialog } from "../../messages/dialogRegistry.js";
import type { CommandDialogModule } from "../../messages/dialogRegistry.js";
import { Button, TooltipProvider } from "../../primitives/index.js";
import type { GalleryEntry } from "../entry.js";

// The Open Source Licences entry of the gallery (SPEC §11, DESIGN §7): the dialog the command
// opens, shown by the frame's dialog host, with the gallery's own `licences.txt` beside the
// page, and as it is when the file cannot be read. The entry has its own tooltip provider, as
// `UiRoot` gives an app one.

/**
 * The dialog's module for the frame's dialog host, registered as the package's licences
 * module registers it beside an editor's `*.dialog.tsx` modules (licences.dialog.tsx).
 */
export const LICENCES_DIALOG_MODULES: Readonly<Record<string, CommandDialogModule>> = {
    "./licences/licences.dialog.tsx": {
        commandDialogs: [
            commandDialog<LicencesRequest>("licences", "Open Source Licences", LicencesDialog),
        ],
    },
};

/** Shows the dialog as when the file at the page's address cannot be read. */
function openUnreadable(): Promise<void> {
    return openLicences({
        baseUrl: document.baseURI,
        fetchText: () => Promise.resolve(null),
        show: (text, address) => licencesDialogs.show({ text, address }),
    });
}

function LicencesEntryComponent() {
    const [closed, setClosed] = useState(0);
    const after = (opening: Promise<void>) => {
        void opening.then(() => setClosed((count) => count + 1));
    };
    return (
        <TooltipProvider>
            <div className="gallery__row">
                <Button onClick={() => after(openLicences())}>Open Source Licences…</Button>
                <Button onClick={() => after(openUnreadable())}>
                    Open with the file unreadable
                </Button>
                <output className="gallery__readout" data-readout="licences-closed">
                    Closed: {closed}
                </output>
            </div>
        </TooltipProvider>
    );
}

export const licencesEntry: GalleryEntry = {
    id: "licences",
    title: "Licences dialog",
    Component: LicencesEntryComponent,
};
