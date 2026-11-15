import { createContext, useContext } from "react";
import type { ComponentType } from "react";

// What the gallery frame (SPEC §12) knows of an entry, and the theme it shows them in.

/** One section of the gallery. */
export interface GalleryEntry {
    /** Stable id: the section's `data-entry` and its anchor. */
    id: string;
    /** The section's heading. */
    title: string;
    /** The section's content. */
    Component: ComponentType;
}

/** The two token sets of DESIGN §3. */
export type GalleryTheme = "dark" | "light";

/** The theme the frame shows, for entries that read the tokens' values. */
export const GalleryThemeContext = createContext<GalleryTheme>("dark");

/** The theme the frame shows. */
export function useGalleryTheme(): GalleryTheme {
    return useContext(GalleryThemeContext);
}
