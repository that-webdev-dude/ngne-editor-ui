import type { ComponentType } from "react";
import type {
    CommandDialog as ModelCommandDialog,
    CommandDialogModule as ModelCommandDialogModule,
} from "../../model/registries/dialogs.js";
import type { DialogRequestBase } from "./dialogRequests.js";

// The dialogs of the `*.dialog.tsx` registry (SPEC §1.3), typed by React components: what a
// module exports, the helper that builds an entry, and what `collectCommandDialogs(map)` gives
// the dialog host.
//
//     // src/ui/sprite/sprite.dialog.tsx
//     export const commandDialogs = [
//         commandDialog<NewSpriteRequest>("new-sprite", "New sprite", NewSpriteDialog),
//     ];

/** A dialog the host shows, given the open request; it answers it. */
export type DialogComponent = ComponentType<{ request: DialogRequestBase }>;

/** One registered dialog: the request kind it shows, its name, its component. */
export type CommandDialog = ModelCommandDialog<DialogComponent>;

/** What a `*.dialog.tsx` module exports. */
export type CommandDialogModule = ModelCommandDialogModule<DialogComponent>;

/** The registered dialogs by request kind, as `collectCommandDialogs(map)` returns them. */
export type CommandDialogs = ReadonlyMap<string, CommandDialog>;

/** A registry entry for the requests of one kind, typed by its request. */
export function commandDialog<Request extends DialogRequestBase>(
    kind: Request["kind"],
    name: string,
    Component: ComponentType<{ request: Request }>,
): CommandDialog {
    // The host gives a component only requests of its own kind.
    return { kind, name, Component: Component as DialogComponent };
}
