import { Button } from "@ngne/editor-ui/primitives";
import { setDocumentOpen } from "./document.ts";

// The demo editor's `noDocument` slot (SPEC §8, DESIGN §6 Empty state): what the viewport shows
// while no document is open, the first action as a plain text button, centred.

export function DemoNoDocument() {
    return (
        <div className="demo-empty">
            <p className="demo-empty__text">No document is open.</p>
            <Button onClick={() => setDocumentOpen(true)}>New document</Button>
        </div>
    );
}
