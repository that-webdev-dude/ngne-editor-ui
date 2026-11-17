import { Button } from "@ngne/editor-ui/primitives";
import { DemoEditor } from "./DemoEditor.tsx";
import { setDocumentOpen } from "./document.ts";
import { DemoToolControls } from "./DemoToolSlots.tsx";

// The demo editor's viewport slot (SPEC §8): the demo's content, which scrolls where the
// region is shorter than it, and Close document, after which the shell shows the `noDocument`
// slot. An editor's viewport holds its canvas; the demo's canvas is the keys section's. The
// tool controls choose the rail's tool set and float a selection.

export function DemoViewport() {
    return (
        <div className="demo-viewport">
            <DemoEditor />
            <DemoToolControls />
            <div className="demo-viewport__document">
                <Button onClick={() => setDocumentOpen(false)}>Close document</Button>
            </div>
        </div>
    );
}
