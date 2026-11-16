// What `useSyncExternalStore` does with the source a command hook hands it (React 19 docs,
// `useSyncExternalStore`): the component renders once on mount, then again at a notification
// only when the snapshot differs from the one it rendered with (`Object.is`). The command hooks'
// unit tests mount their sources through this model; tests/e2e/command-refresh.spec.ts counts
// the renders of real components on the gallery.

export interface Mounted {
    /** Renders so far, the first one included. */
    readonly renders: number;
    unmount(): void;
}

/**
 * Mounts a component that reads `snapshot` from a store notifying through `subscribe`;
 * `render` is the component's body, called at every render.
 */
export function mount<Snapshot>(
    subscribe: (listener: () => void) => () => void,
    snapshot: () => Snapshot,
    render: () => void = () => {},
): Mounted {
    let rendered = snapshot();
    let renders = 0;
    const renderOnce = () => {
        renders += 1;
        render();
    };
    renderOnce();
    const unsubscribe = subscribe(() => {
        const next = snapshot();
        if (Object.is(next, rendered)) return;
        rendered = next;
        renderOnce();
    });
    return {
        get renders() {
            return renders;
        },
        unmount: unsubscribe,
    };
}
