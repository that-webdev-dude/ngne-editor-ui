import { commandEntries } from "./entries/CommandsEntries.js";
import { messageEntries } from "./entries/MessagesEntries.js";
import { primitiveEntries } from "./entries/PrimitivesEntries.js";
import { surfaceEntries } from "./entries/SurfacesEntries.js";
import { tokensEntry } from "./entries/TokensEntry.js";
import type { GalleryEntry } from "./entry.js";

// The gallery's entries (SPEC §12), in the order the page shows them. An entry is a module
// under entries/ that exports a `GalleryEntry`, or a list of them; it joins with one import and
// one line here.

export const GALLERY_ENTRIES: readonly GalleryEntry[] = [
    tokensEntry, // DESIGN §3
    ...primitiveEntries, // DESIGN §4, SPEC §9.1
    ...messageEntries, // DESIGN §5, §7, SPEC §6
    ...commandEntries, // SPEC §2 Command refresh, §7.1
    ...surfaceEntries, // DESIGN §4 Command palette, §7 Shortcut sheet, SPEC §7.1
];

/** The dialogs the entries ask for, shown by the frame's dialog host. */
export { GALLERY_DIALOGS } from "./entries/MessagesEntries.js";
