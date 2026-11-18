import { commandDialog } from "../messages/dialogRegistry.js";
import { LicencesDialog } from "./LicencesDialog.js";
import type { LicencesRequest } from "./openLicences.js";

/**
 * The dialog of Open Source Licences (SPEC §11), shown by the dialog host. A package dialog
 * module: `createEditorUi` adds it to the instance's dialogs beside the editor's `*.dialog.tsx`
 * modules.
 */
export const commandDialogs = [
    commandDialog<LicencesRequest>("licences", "Open Source Licences", LicencesDialog),
];
