/// <reference types="vite/client" />
import { createKeyContextStore } from "@ngne/editor-ui/commands";
import {
    createBottomRegionStore,
    createToolRegistry,
    registerToolModules,
} from "@ngne/editor-ui/shell";
import type { ToolModule } from "@ngne/editor-ui/shell";
import type { DemoTool } from "./tools.ts";

// The demo editor's own state (SPEC §5 `sources`), created in a module that imports no
// instance, as an editor creates it: its modules switch the `gesture` state context (the keys
// section's toggle) and may show or hide the Timeline through these stores, without importing
// `editorUi.ts`. Its tool registry holds the `*.tools.ts` tools before the command modules load,
// so its tool keys and its active-tool store read the objects the rail shows. The instance
// takes them instead of creating its own.

/** The demo's state contexts (SPEC §7.2): `gesture`, which the keys section's toggle switches. */
export const STATE_CONTEXTS = ["gesture"] as const;

/** Whether each state context is on; all off at startup. */
export const keyContextState = createKeyContextStore(STATE_CONTEXTS);

/** Whether the bottom region is shown; shown at startup. */
export const bottomRegionState = createBottomRegionStore();

/** The demo's tools: its `*.tools.ts` modules, and the tool the viewport's toggle registers. */
export const toolRegistry = createToolRegistry<DemoTool>();
registerToolModules(
    toolRegistry,
    import.meta.glob<ToolModule<DemoTool>>("./**/*.tools.{ts,tsx}", { eager: true }),
);
