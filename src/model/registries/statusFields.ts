import { byOrderThenId, collectEntries } from "../modules.js";
import type { ModuleMap } from "../modules.js";

// Status bar field registry (SPEC §1.3, §8, `*.status.ts`). A feature adds a field by creating
// a module named `*.status.ts` that exports `statusFields`; the editor finds it with one
// `import.meta.glob` line and passes the map, so no shared file is edited (RULES 3):
//
//     // src/ui/status/selection.status.ts
//     export const statusFields: StatusField<StatusInput>[] = [
//         { id: "selection", order: 500, text: ({ map }) => "…" },
//     ];
//
// Fields are shown left to right in ascending `order`; the hint sits at the right end and is
// not a field. Generic over what a field reads, which the editor defines.

export interface StatusField<Input = unknown> {
    /** Stable and unique: "cell"; also the `data-status` attribute of the field. */
    id: string;
    /** Position, ascending, left to right. */
    order: number;
    /** The text of the field; the empty string shows nothing. */
    text(input: Input): string;
    /**
     * The width in characters the field keeps while it has no text, so the fields after it do
     * not move when the pointer leaves the document. Without it an empty field is not rendered.
     */
    reserve?: number;
    /** A command shown as a quiet button right after the text ("Fit" after the zoom). */
    action?: { commandId: string };
    /**
     * For a field that also reads a store of its own feature: subscribes `listener` to it,
     * returning the function that stops it. The bar redraws on every call.
     */
    subscribe?(listener: () => void): () => void;
}

/** What a `*.status.ts` module exports. */
export interface StatusFieldModule<Input = unknown> {
    statusFields?: readonly StatusField<Input>[];
}

/**
 * Validates the modules and returns their fields in display order: by `order`, then by id in
 * UTF-16 code-unit order. Throws a `RegistrationError` naming the module for a missing export,
 * a field without an id or a finite order, or an id used twice.
 */
export function collectStatusFields<Input>(
    modules: ModuleMap<StatusFieldModule<Input>>,
): StatusField<Input>[] {
    const entries = collectEntries<StatusField<Input>>(modules, {
        exportName: "statusFields",
        list: true,
        noun: "Status field",
        item: "field",
        key: "id",
        ordered: true,
    });
    return entries.map(({ entry }) => entry).sort(byOrderThenId);
}
