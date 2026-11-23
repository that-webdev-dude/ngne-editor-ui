import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

// The editor's state contexts (SPEC §7.2, `config.keyContexts.state`): contexts that follow
// editor state instead of focus. The feature that owns the state switches its context on and
// off (the sprite editor's polygon lasso for `gesture`, its floating selection for `floating`).
// One store per editor UI instance; the instance refreshes its commands when it changes, as a
// command's condition may read it. What a state context means stays in the editor. The editor
// may create the store itself, in a module that imports no instance, and pass it in
// `config.sources.keyContextState` (SPEC §5): its modules then switch a context through the
// store, without the instance.

/** Whether each state context is on. */
export type KeyContextState<Context extends string = string> = Readonly<Record<Context, boolean>>;

/** The store of the state contexts, or an editor UI instance that holds one. */
export type KeyContextTarget<Context extends string = string> =
    | StoreApi<KeyContextState<Context>>
    | { readonly keyContextState: StoreApi<KeyContextState<Context>> };

/** A store with every context of `contexts` off: the editor's `keyContexts.state`. */
export function createKeyContextStore<Context extends string>(
    contexts: readonly Context[],
): StoreApi<KeyContextState<Context>> {
    const initial = Object.fromEntries(contexts.map((context) => [context, false]));
    return createStore<KeyContextState<Context>>(() => initial as KeyContextState<Context>);
}

/**
 * Switches the state context `context` on or off, in the store `target` is or holds (an editor
 * UI instance, or the store the editor passed in `config.sources`); nothing changes, and
 * nothing refreshes, when it already is. Throws for a context that is not one of the editor's
 * state contexts.
 */
export function setKeyContext<Context extends string>(
    target: KeyContextTarget<Context>,
    context: NoInfer<Context>,
    active: boolean,
): void {
    const store = "keyContextState" in target ? target.keyContextState : target;
    const state = store.getState();
    if (!Object.hasOwn(state, context)) {
        throw new Error(`setKeyContext: "${context}" is not a state context (keyContexts.state).`);
    }
    if (state[context] !== active) store.setState({ [context]: active } as Partial<typeof state>);
}
