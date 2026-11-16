import { primitiveEntries } from "./entries/PrimitivesEntries.js";
import { tokensEntry } from "./entries/TokensEntry.js";
import type { GalleryEntry } from "./entry.js";

// The gallery's entries (SPEC §12), in the order the page shows them. An entry is a module
// under entries/ that exports a `GalleryEntry`, or a list of them; it joins with one import and
// one line here.

export const GALLERY_ENTRIES: readonly GalleryEntry[] = [
    tokensEntry, // DESIGN §3
    ...primitiveEntries, // DESIGN §4, SPEC §9.1
];
