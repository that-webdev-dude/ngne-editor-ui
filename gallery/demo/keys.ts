import { createStore } from "zustand/vanilla";

// The demo editor's key log (SPEC §7.2): each key command records the context it is bound in,
// so the page shows which context took a key. The demo's contexts: `gesture`, a state context
// a toggle switches, and `panel`, a focus context active inside `[data-demo-panel]`.

export const DEMO_CONTEXTS = ["gesture", "panel"] as const;
export type DemoContext = (typeof DEMO_CONTEXTS)[number];

/** The panel region's selector: the demo's focus context and its panel selector (SPEC §6). */
export const PANEL_SELECTOR = "[data-demo-panel]";

/** One run of a key command: its place in the log and what it recorded. */
export interface KeyLogEntry {
    readonly id: number;
    readonly text: string;
}

export interface KeyLogState {
    /** What each key command run so far recorded, oldest first. */
    readonly ran: readonly KeyLogEntry[];
}

export const keyLogStore = createStore<KeyLogState>(() => ({ ran: [] }));

/** Records that the command bound in `context` ran. */
export function record(context: string): void {
    keyLogStore.setState((state) => ({
        ran: [...state.ran, { id: state.ran.length, text: context }],
    }));
}
