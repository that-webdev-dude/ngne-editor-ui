import { collectEntries } from "../modules.js";
import type { ModuleMap } from "../modules.js";

// Registry of the dialogs commands ask for (SPEC §1.3, `*.dialog.tsx`). A feature adds a
// dialog by creating a module named `*.dialog.tsx` that exports `commandDialogs`; the editor
// finds it with one `import.meta.glob` line and passes the map, so no shared file is edited
// (RULES 3). The dialog host shows the dialog of the open request's kind.
//
//     // src/ui/sprite/sprite.dialog.tsx
//     export const commandDialogs = [
//         commandDialog<NewSpriteRequest>("new-sprite", "New sprite", NewSpriteDialog),
//     ];
//
// Generic over the component type, so this layer imports no React (SPEC §1.1).

export interface CommandDialog<Component = unknown> {
    /** The request kind it shows; unique. */
    kind: string;
    /** Name of the dialog, for the message when it fails. */
    name: string;
    /** The dialog, given the open request; it answers it. */
    Component: Component;
}

/** What a `*.dialog.tsx` module exports. */
export interface CommandDialogModule<Component = unknown> {
    commandDialogs?: readonly CommandDialog<Component>[];
}

/**
 * Validates the modules and returns their dialogs by kind: modules in path order (UTF-16 code
 * units), each module's dialogs in the order it declares them. Throws a `RegistrationError`
 * naming the module for a missing export, a dialog without a kind, or a kind used twice.
 */
export function collectCommandDialogs<Component>(
    modules: ModuleMap<CommandDialogModule<Component>>,
): ReadonlyMap<string, CommandDialog<Component>> {
    const entries = collectEntries<CommandDialog<Component>>(modules, {
        exportName: "commandDialogs",
        list: true,
        noun: "Dialog",
        item: "dialog",
        key: "kind",
        ordered: false,
    });
    return new Map(entries.map(({ entry }) => [entry.kind, entry]));
}
