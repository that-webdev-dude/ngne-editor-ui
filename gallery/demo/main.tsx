import "@ngne/editor-ui/styles.css";
import "./demo.css";
import "./slots.css";
import { UiRoot } from "@ngne/editor-ui";
import { SurfaceHost } from "@ngne/editor-ui/commands";
import { AppShell, useWindowTooSmall } from "@ngne/editor-ui/shell";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useStore } from "zustand";
import { DemoBottom } from "./DemoBottom.tsx";
import { DemoNoDocument } from "./DemoNoDocument.tsx";
import { DemoViewport } from "./DemoViewport.tsx";
import { documentStore } from "./document.ts";
import { editorUi } from "./editorUi.ts";

// The demo editor's page: its instance passed to `UiRoot` at the root, as an editor mounts it
// (SPEC §1.2, §8), the shell with the demo's slot contents, and the surface host beside the
// shell, outside every region (SPEC §7.1). The keyboard runs no command while the shell's
// window-too-small notice stands in for the editor (SPEC §7.2).

const root = document.getElementById("root");
if (!root) throw new Error("demo: index.html has no #root.");

function DemoPage() {
    const tooSmall = useWindowTooSmall();
    const open = useStore(documentStore, (state) => state.open);
    return (
        <UiRoot editorUi={editorUi} keymap={!tooSmall}>
            <AppShell
                viewport={<DemoViewport />}
                bottom={<DemoBottom />}
                noDocument={open ? null : <DemoNoDocument />}
            />
            <SurfaceHost />
        </UiRoot>
    );
}

createRoot(root).render(
    <StrictMode>
        <DemoPage />
    </StrictMode>,
);
