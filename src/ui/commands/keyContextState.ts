import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

// The editor's state contexts (SPEC §7.2, `config.keyContexts.state`): contexts that follow
// editor state instead of focus. The feature that owns the state switches its context on and
// off (the sprite editor's polygon lasso for `gesture`, its floating selection for `floating`).
// One store per editor UI instance; the instance refreshes its commands when it changes, as a
// command's condition may read it. What a state context means stays in the editor.

/** Whether each state context is on. */
export type KeyContextState<Context extends string = string> = Readonly<Record<Context, boolean>>;

/** A store with every context of `contexts` off. */
export function createKeyContextStore<Context extends string>(
    contexts: readonly Context[],
): StoreApi<KeyContextState<Context>> {
    const initial = Object.fromEntries(contexts.map((context) => [context, false]));
    return createStore<KeyContextState<Context>>(() => initial as KeyContextState<Context>);
}

/**
 * Switches the state context `context` of `editorUi` on or off; nothing changes, and nothing
 * refreshes, when it already is. Throws for a context that is not one of the editor's state
 * contexts.
 */
export function setKeyContext<Context extends string>(
    editorUi: { readonly keyContextState: StoreApi<KeyContextState<Context>> },
    context: NoInfer<Context>,
    active: boolean,
): void {
    const store = editorUi.keyContextState;
    const state = store.getState();
    if (!Object.hasOwn(state, context)) {
        throw new Error(`setKeyContext: "${context}" is not a state context (keyContexts.state).`);
    }
    if (state[context] !== active) store.setState({ [context]: active } as Partial<typeof state>);
}
