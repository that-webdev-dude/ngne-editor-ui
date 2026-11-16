import "@ngne/editor-ui/styles.css";
import "./demo.css";
import { UiRoot } from "@ngne/editor-ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DemoEditor } from "./DemoEditor.tsx";
import { editorUi } from "./editorUi.ts";

// The demo editor's page: its instance passed to `UiRoot` at the root, as an editor mounts it
// (SPEC §1.2, §8).

const root = document.getElementById("root");
if (!root) throw new Error("demo: index.html has no #root.");

createRoot(root).render(
    <StrictMode>
        <UiRoot editorUi={editorUi}>
            <DemoEditor />
        </UiRoot>
    </StrictMode>,
);
