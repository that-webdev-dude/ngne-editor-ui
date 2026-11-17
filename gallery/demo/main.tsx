import "@ngne/editor-ui/styles.css";
import "./demo.css";
import "./slots.css";
import { UiRoot } from "@ngne/editor-ui";
import { SurfaceHost } from "@ngne/editor-ui/commands";
import { AppShell, useWindowTooSmall } from "@ngne/editor-ui/shell";
import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { useStore } from "zustand";
import { DemoBottom } from "./DemoBottom.tsx";
import { DemoMenuCentre } from "./DemoMenuCentre.tsx";
import { DemoNoDocument } from "./DemoNoDocument.tsx";
import { DemoRailFooter, DemoReadouts } from "./DemoToolSlots.tsx";
import { DemoViewport } from "./DemoViewport.tsx";
import { documentStore } from "./document.ts";
import { editorUi } from "./editorUi.ts";
import { demoStatus } from "./status.ts";
import { toolSetFilter, toolSetStore } from "./tools.ts";
import { demoTools } from "./toolState.ts";

// The demo editor's page: its instance passed to `UiRoot` at the root, as an editor mounts it
// (SPEC §1.2, §8), the shell with the demo's slot contents and what its status bar reads, and
// the surface host beside the shell, outside every region (SPEC §7.1). The keyboard runs no command while the shell's
// window-too-small notice stands in for the editor (SPEC §7.2). The tool rail and the context
// bar read the demo's tool store, the rail keeps the slots of the chosen tool set, and a tool
// chosen with the pointer sends the focus to the canvas; the page opened with
// `?tool-focus=name` sends it to the Name field instead, a target of the editor's choosing.

const root = document.getElementById("root");
if (!root) throw new Error("demo: index.html has no #root.");

const TOOL_FOCUS_SELECTOR =
    new URLSearchParams(window.location.search).get("tool-focus") === "name"
        ? "input.demo__text-field"
        : "[data-viewport-focus]";

const toolFocus = () => document.querySelector<HTMLElement>(TOOL_FOCUS_SELECTOR);

function DemoPage() {
    const tooSmall = useWindowTooSmall();
    const open = useStore(documentStore, (state) => state.open);
    const toolSet = useStore(toolSetStore, (state) => state.set);
    const railFilter = useMemo(() => toolSetFilter(toolSet), [toolSet]);
    return (
        <UiRoot editorUi={editorUi} keymap={!tooSmall}>
            <AppShell
                menuCentre={<DemoMenuCentre />}
                railFooter={<DemoRailFooter />}
                viewport={<DemoViewport />}
                bottom={<DemoBottom />}
                noDocument={open ? null : <DemoNoDocument />}
                status={demoStatus}
                tools={demoTools}
                railFilter={railFilter}
                toolFocus={toolFocus}
                contextReadouts={<DemoReadouts />}
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
