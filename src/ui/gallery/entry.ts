import { createContext, useContext } from "react";
import type { ComponentType } from "react";

// What the gallery frame (SPEC §12) knows of an entry, and the theme it shows them in.

/** One section of the gallery: the package's, or one an app passes (`<Gallery entries>`). */
export interface GalleryEntry {
    /** Stable id, unique in the gallery: the section's `data-entry` and its anchor (`#id`). */
    id: string;
    /** The section's heading. */
    title: string;
    /** The section's content. */
    Component: ComponentType;
}

/** A group of entries, listed under its title in the gallery's navigation. */
export interface GalleryGroup {
    title: string;
    entries: readonly GalleryEntry[];
}

/** The two token sets of DESIGN §3. */
export type GalleryTheme = "dark" | "light";

/** The theme the frame shows, for entries that read the tokens' values. */
export const GalleryThemeContext = createContext<GalleryTheme>("dark");

/**
 * The theme the gallery shows, for an entry that renders outside the document's theming (a
 * page in a frame, for example); renders again when it changes.
 */
export function useGalleryTheme(): GalleryTheme {
    return useContext(GalleryThemeContext);
}
