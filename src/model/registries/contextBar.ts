import { byOrderThenId, collectEntries } from "../modules.js";
import type { ModuleMap } from "../modules.js";

// Registry of content that takes the context bar's place of the tool options (SPEC §1.3,
// `*.contextbar.tsx`; the transform fields of a floating selection, for one). A feature adds
// such content by creating a module named `*.contextbar.tsx` that exports `contextBarContent`;
// the editor finds it with one `import.meta.glob` line and passes the map, so no shared file is
// edited (RULES 3). While an entry is shown, the context bar shows it after the tool's name
// instead of the tool's options; the first shown entry by `order` wins.
//
//     // src/ui/tools/transform.contextbar.tsx
//     export const contextBarContent: ContextBarContent = {
//         id: "transform", order: 10, shown, subscribe, Body: TransformFields,
//     };
//
// Generic over the component type, so this layer imports no React (SPEC §1.1).

export interface ContextBarContent<Component = unknown> {
    /** Stable, unique id; also the `data-context-content` attribute of its wrapper. */
    id: string;
    /** Precedence among entries shown at once, ascending. */
    order: number;
    /** Whether the content takes the bar now. Must not throw. */
    shown(): boolean;
    /** Calls `listener` whenever `shown` may have changed; returns the unsubscribe. */
    subscribe(listener: () => void): () => void;
    /** The content, mounted while it is shown. */
    Body: Component;
}

/** What a `*.contextbar.tsx` module exports. */
export interface ContextBarContentModule<Component = unknown> {
    contextBarContent?: ContextBarContent<Component>;
}

/**
 * Validates the modules and returns their content by `order`, then by id in UTF-16 code-unit
 * order. Throws a `RegistrationError` naming the module for a missing export, an entry without
 * an id or a finite order, or an id used twice.
 */
export function collectContextBarContent<Component>(
    modules: ModuleMap<ContextBarContentModule<Component>>,
): ContextBarContent<Component>[] {
    const entries = collectEntries<ContextBarContent<Component>>(modules, {
        exportName: "contextBarContent",
        list: false,
        noun: "Context bar content",
        item: "context bar entry",
        key: "id",
        ordered: true,
    });
    return entries.map(({ entry }) => entry).sort(byOrderThenId);
}

/** The first of `entries` shown now, or null: the tool's options are shown. */
export function shownContextBarContent<Component>(
    entries: readonly ContextBarContent<Component>[],
): ContextBarContent<Component> | null {
    return entries.find((entry) => entry.shown()) ?? null;
}

/** Subscribes `listener` to every entry's changes; returns the function that stops them all. */
export function subscribeContextBarContent(
    listener: () => void,
    entries: readonly ContextBarContent[],
): () => void {
    const stops = entries.map((entry) => entry.subscribe(listener));
    return () => {
        for (const stop of stops) stop();
    };
}
