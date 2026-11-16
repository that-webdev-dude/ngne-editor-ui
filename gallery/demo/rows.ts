import { createStore } from "zustand/vanilla";

// The demo editor's rows (SPEC §12): a list a panel shows, and the row its context menu acts
// on. The row commands read this store, so it is one of the instance's `refreshOn` stores.

export interface DemoRow {
    readonly id: number;
    readonly name: string;
}

export interface RowsState {
    readonly rows: readonly DemoRow[];
    /** The id of the row the row commands act on: the one last right-clicked. */
    readonly target: number;
}

const INITIAL: readonly DemoRow[] = [
    { id: 1, name: "Background" },
    { id: 2, name: "Ground" },
    { id: 3, name: "Props" },
];

export const rowsStore = createStore<RowsState>(() => ({ rows: INITIAL, target: 1 }));

let nextId = INITIAL.length + 1;

/** The index of the target row, or -1. */
export function targetIndex(state: RowsState = rowsStore.getState()): number {
    return state.rows.findIndex((row) => row.id === state.target);
}

/** Moves the target row by `by` places. */
export function moveTarget(by: -1 | 1): void {
    const state = rowsStore.getState();
    const from = targetIndex(state);
    const to = from + by;
    if (from < 0 || to < 0 || to >= state.rows.length) return;
    const rows = [...state.rows];
    const [row] = rows.splice(from, 1);
    rows.splice(to, 0, row!);
    rowsStore.setState({ rows });
}

/** Adds a copy of the target row after it. */
export function duplicateTarget(): void {
    const state = rowsStore.getState();
    const from = targetIndex(state);
    if (from < 0) return;
    const rows = [...state.rows];
    rows.splice(from + 1, 0, { id: nextId++, name: `${state.rows[from]!.name} copy` });
    rowsStore.setState({ rows });
}
