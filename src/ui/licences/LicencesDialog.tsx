import { useEditorUi } from "../editorUi/context.js";
import { Button } from "../primitives/Button.js";
import { Dialog } from "../primitives/Dialog.js";
import type { LicencesRequest } from "./openLicences.js";

/**
 * Open Source Licences (DESIGN §7, SPEC §11): the text of `licences.txt`, as the build writes
 * it, in a large dialog, in a labelled section whose text keeps its line breaks and scrolls.
 * When the file could not be read, the dialog says so, naming the editor, and links its
 * address. Shown by the dialog host for requests of kind `licences`.
 */
export function LicencesDialog({ request }: Readonly<{ request: LicencesRequest }>) {
    const { productName } = useEditorUi().config;
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) request.answer(null);
            }}
            title="Open Source Licences"
            size="large"
            actions={
                <Button variant="primary" onClick={() => request.answer(null)}>
                    Close
                </Button>
            }
        >
            {request.text === null ? (
                <p className="licences__missing">
                    The licences file of {productName} could not be loaded. It is at{" "}
                    <a href={request.address} target="_blank" rel="noopener noreferrer">
                        {request.address}
                    </a>
                    {/* The full stop is an element of its own, so the paragraph's own text is
                        one run. axe's contrast check (SPEC §3) compares what lies behind each
                        run of an element's text, the page under the dialog included, and
                        gives no verdict when they differ: a full stop past the link can fall
                        over another part of the page than the text before it. */}
                    <span>.</span>
                </p>
            ) : (
                <section aria-label="Licence text">
                    {/* Focusable, so the keyboard can scroll the text (WCAG 2.1.1; axe's
                        scrollable-region-focusable): it holds nothing else to focus. The
                        section names the region, so the text carries no role of its own. */}
                    <pre className="licences__text" tabIndex={0}>
                        {request.text}
                    </pre>
                </section>
            )}
        </Dialog>
    );
}
