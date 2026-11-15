import "@ngne/editor-ui/styles.css";
import { Gallery } from "@ngne/editor-ui/gallery";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// The gallery site (SPEC §12): the package's gallery, imported through its public subpaths
// only, as an app imports it.

const root = document.getElementById("root");
if (!root) throw new Error("gallery: index.html has no #root.");

createRoot(root).render(
    <StrictMode>
        <Gallery />
    </StrictMode>,
);
