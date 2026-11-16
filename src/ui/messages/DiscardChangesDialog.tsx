import { Button } from "../primitives/Button.js";
import { Dialog } from "../primitives/Dialog.js";

/** What would take the unsaved changes away. */
export type DiscardAction = "close" | "open" | "revert";

/**
 * The question of the file workflows (DESIGN §7: closing or replacing an unsaved document is
 * confirmed once). A workflow asks through the app's dialog requests (`commandDialogs`,
 * SPEC §6) and waits for the answer; the app registers this dialog for the kind in one of its
 * `*.dialog.tsx` modules.
 */
export interface DiscardChangesRequest {
    kind: "discard-changes";
    /** Name of the document whose unsaved changes are lost. */
    document: string;
    action: DiscardAction;
    /** The file that takes the document's place ("open") or is read again ("revert"). */
    file: string | null;
    /** True to go on and lose the changes, null to keep the document. Closes the dialog. */
    answer(discard: true | null): void;
}

/** What happens to the document, said after "“name” has unsaved changes." */
function consequence({ action, file }: DiscardChangesRequest): string {
    switch (action) {
        case "close":
            return "Closing it loses them.";
        case "open":
            return `“${file ?? ""}” takes its place, and the changes are lost.`;
        case "revert":
            return `Revert reads “${file ?? ""}” again, and the changes are lost.`;
    }
}

/**
 * Asked once before unsaved changes are lost to Close, Open or Revert (DESIGN §7: what undo
 * cannot reverse is confirmed once). Cancel, Escape and a click outside keep the document.
 */
export function DiscardChangesDialog({ request }: Readonly<{ request: DiscardChangesRequest }>) {
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) request.answer(null);
            }}
            title="Discard unsaved changes?"
            actions={
                <>
                    <Button onClick={() => request.answer(null)}>Cancel</Button>
                    <Button variant="danger" onClick={() => request.answer(true)}>
                        Discard
                    </Button>
                </>
            }
        >
            <p>
                “{request.document}” has unsaved changes. {consequence(request)}
            </p>
        </Dialog>
    );
}
