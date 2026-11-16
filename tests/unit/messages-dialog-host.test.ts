import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { collectCommandDialogs } from "../../src/model/registries/dialogs.ts";
import { commandDialog, commandDialogs, DialogHost } from "../../src/ui/messages/index.ts";
import type {
    CommandDialogModule,
    CommandDialogs,
    DialogRequestBase,
} from "../../src/ui/messages/index.ts";

// The dialog host (SPEC §1.3, §6): it shows the dialog that the `*.dialog.tsx` registry holds
// for the kind of the open request, from the dialogs `collectCommandDialogs` collects out of a
// module map, here a fixture map whose paths are not in registry order.
//
// The host is rendered on the server. There a store is read at its initial state, so each case
// stands the open request in for it; the host's effects (attaching itself, cancelling a kind
// nobody registers) do not run there and are covered by tests/e2e/messages.spec.ts.

interface FixtureRequest extends DialogRequestBase {
    readonly kind: string;
    answer(values: true | null): void;
}

/** A fixture dialog: one line naming the dialog and the request it shows. */
const fixtureDialog = (name: string) =>
    commandDialog<FixtureRequest>(name, name, ({ request }) =>
        createElement("p", { "data-dialog": name }, `${name} shows ${request.kind}`),
    );

/** A fixture `*.dialog.tsx` map, as an editor's one glob line returns it, keyed out of order. */
const MODULES: Readonly<Record<string, CommandDialogModule>> = {
    "./sprite/sprite.dialog.tsx": {
        commandDialogs: [fixtureDialog("new-sprite"), fixtureDialog("canvas-size")],
    },
    "./file/file.dialog.tsx": { commandDialogs: [fixtureDialog("discard-changes")] },
    "./export/export.dialog.tsx": { commandDialogs: [fixtureDialog("export")] },
};

/** Renders the host over `dialogs` with `request` open. */
function renderHost(dialogs: CommandDialogs, request: DialogRequestBase | null): string {
    vi.spyOn(commandDialogs.store, "getInitialState").mockReturnValue({ request });
    return renderToStaticMarkup(createElement(DialogHost, { dialogs }));
}

/** Opens a request of `kind` through the app's requests; returns it. */
function openRequest(kind: string): DialogRequestBase {
    void commandDialogs.open<true>((answer): FixtureRequest => ({ kind, answer }));
    const { request } = commandDialogs.store.getState();
    if (!request) throw new Error(`The request of kind "${kind}" did not open.`);
    return request;
}

describe("dialog host", () => {
    let detach: (() => void) | null = null;
    afterEach(() => {
        detach?.();
        detach = null;
        vi.restoreAllMocks();
    });

    it("renders the dialogs collected from a fixture *.dialog.tsx map in registry order", () => {
        const dialogs = collectCommandDialogs(MODULES);
        // Registry order: modules by path, each module's dialogs as it declares them.
        expect([...dialogs.keys()]).toEqual([
            "export",
            "discard-changes",
            "new-sprite",
            "canvas-size",
        ]);

        detach = commandDialogs.attachHost();
        const shown = [...dialogs.keys()].map((kind) => {
            const request = openRequest(kind);
            const markup = renderHost(dialogs, request);
            (request.answer as (values: null) => void)(null);
            return markup;
        });
        expect(shown).toEqual([
            '<p data-dialog="export">export shows export</p>',
            '<p data-dialog="discard-changes">discard-changes shows discard-changes</p>',
            '<p data-dialog="new-sprite">new-sprite shows new-sprite</p>',
            '<p data-dialog="canvas-size">canvas-size shows canvas-size</p>',
        ]);
        expect(commandDialogs.store.getState().request).toBeNull();
    });

    it("renders nothing while no request is open, or for a kind no module registers", () => {
        const dialogs = collectCommandDialogs(MODULES);
        expect(renderHost(dialogs, null)).toBe("");

        detach = commandDialogs.attachHost();
        const request = openRequest("unknown");
        expect(renderHost(dialogs, request)).toBe("");
        (request.answer as (values: null) => void)(null);
    });

    it("renders nothing over an empty registry", () => {
        detach = commandDialogs.attachHost();
        const request = openRequest("export");
        expect(renderHost(collectCommandDialogs({}), request)).toBe("");
        (request.answer as (values: null) => void)(null);
    });
});
