import { collectCommandDialogs } from "../../model/registries/dialogs.js";
import type { CommandDialogs } from "../messages/dialogRegistry.js";
import { commandEntries } from "./entries/CommandsEntries.js";
import { LICENCES_DIALOG_MODULES, licencesEntry } from "./entries/LicencesEntry.js";
import { MESSAGE_DIALOG_MODULES, messageEntries } from "./entries/MessagesEntries.js";
import { primitiveEntries } from "./entries/PrimitivesEntries.js";
import { shellEntry } from "./entries/ShellEntry.js";
import { aboutEntry, surfaceEntries } from "./entries/SurfacesEntries.js";
import { tabStripEntry } from "./entries/TabStripEntry.js";
import { tokensEntry } from "./entries/TokensEntry.js";
import type { GalleryGroup } from "./entry.js";

// The package's gallery entries (SPEC §12), in groups, in the order the page shows them. An
// entry is a module under entries/ that exports a `GalleryEntry`, or a list of them; it joins
// with one import and one line here. An app's entries follow these (`<Gallery entries>`).

export const GALLERY_GROUPS: readonly GalleryGroup[] = [
    { title: "Tokens", entries: [tokensEntry] }, // DESIGN §3
    { title: "Primitives", entries: primitiveEntries }, // DESIGN §4, SPEC §9.1
    { title: "Messages", entries: messageEntries }, // DESIGN §5, §7, SPEC §6
    // SPEC §2 Command refresh, §7.1; DESIGN §4 Command palette, §7 Shortcut sheet
    { title: "Commands", entries: [...commandEntries, ...surfaceEntries] },
    { title: "About and licences", entries: [aboutEntry, licencesEntry] }, // DESIGN §7, SPEC §11
    { title: "Shell", entries: [tabStripEntry, shellEntry] }, // DESIGN §2, SPEC §8
];

/**
 * The dialogs the entries ask for, shown by the frame's dialog host: the message entries'
 * fixture `*.dialog.tsx` map and the licences dialog, which the Licences entry and the shell
 * frame's View menu open.
 */
export const GALLERY_DIALOGS: CommandDialogs = collectCommandDialogs({
    ...MESSAGE_DIALOG_MODULES,
    ...LICENCES_DIALOG_MODULES,
});
