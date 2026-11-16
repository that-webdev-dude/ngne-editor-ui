import "@ngne/editor-ui/styles.css";
import "./demo.css";
import { UiRoot } from "@ngne/editor-ui";
import { SurfaceHost } from "@ngne/editor-ui/commands";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DemoEditor } from "./DemoEditor.tsx";
import { editorUi } from "./editorUi.ts";

// The demo editor's page: its instance passed to `UiRoot` at the root, as an editor mounts it
// (SPEC §1.2, §8), with the surface host beside the content, outside every region (SPEC §7.1).

const root = document.getElementById("root");
if (!root) throw new Error("demo: index.html has no #root.");

createRoot(root).render(
    <StrictMode>
        <UiRoot editorUi={editorUi}>
            <DemoEditor />
            <SurfaceHost />
        </UiRoot>
    </StrictMode>,
);
