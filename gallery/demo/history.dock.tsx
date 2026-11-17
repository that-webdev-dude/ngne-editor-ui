import type { ComponentType } from "react";
import type { DockPanel } from "@ngne/editor-ui/shell";

// The demo editor's History panel (SPEC §1.3 `*.dock.tsx`, DESIGN §2): the first section of the
// dock, a list of steps longer than the dock at 1280×720, so the dock scrolls as one column
// and the headers below it are reached by scrolling.

const STEPS = Array.from({ length: 24 }, (_, index) => `Step ${index + 1}`);

function HistoryBody() {
    return (
        <ol className="demo-history" aria-label="History steps">
            {STEPS.map((step) => (
                <li key={step} className="demo-history__step">
                    {step}
                </li>
            ))}
        </ol>
    );
}

export const dockPanel: DockPanel<ComponentType> = {
    id: "history",
    title: "History",
    order: 10,
    Body: HistoryBody,
};
