import { createKeyContextStore } from "@ngne/editor-ui/commands";
import { createBottomRegionStore } from "@ngne/editor-ui/shell";

// The demo editor's own state (SPEC §5 `sources`), created in a module that imports no
// instance, as an editor creates it: its modules switch the `gesture` state context (the keys
// section's toggle) and may show or hide the Timeline through these stores, without importing
// `editorUi.ts`. The instance takes them instead of creating its own.

/** The demo's state contexts (SPEC §7.2): `gesture`, which the keys section's toggle switches. */
export const STATE_CONTEXTS = ["gesture"] as const;

/** Whether each state context is on; all off at startup. */
export const keyContextState = createKeyContextStore(STATE_CONTEXTS);

/** Whether the bottom region is shown; shown at startup. */
export const bottomRegionState = createBottomRegionStore();
