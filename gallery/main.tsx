import "@ngne/editor-ui/styles.css";
import "@ngne/editor-ui/gallery.css";
import "./site.css";
import { Gallery } from "@ngne/editor-ui/gallery";
import type { GalleryEntry } from "@ngne/editor-ui/gallery";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { demoEditorEntry } from "./DemoEditorEntry.tsx";

// The gallery site (SPEC §12): the package's gallery, imported through its public subpaths
// only, its stylesheet after the package's, with the site's own entry after the package's, as
// an app's development gallery route mounts it.

/** The site's entries, after the package's. */
const SITE_ENTRIES: readonly GalleryEntry[] = [demoEditorEntry];

const root = document.getElementById("root");
if (!root) throw new Error("gallery: index.html has no #root.");

createRoot(root).render(
    <StrictMode>
        <Gallery entries={SITE_ENTRIES} />
    </StrictMode>,
);
