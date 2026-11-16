import { createStore } from "zustand/vanilla";

// Whether the demo editor has a document open (SPEC §8 `noDocument`): while none is, the shell
// shows the demo's empty state in the viewport and leaves the dock and the bottom region empty.
// It starts with a document open.

export interface DocumentState {
    readonly open: boolean;
}

export const documentStore = createStore<DocumentState>(() => ({ open: true }));

export function setDocumentOpen(open: boolean): void {
    documentStore.setState({ open });
}
