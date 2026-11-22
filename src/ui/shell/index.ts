// Entry module of `@ngne/editor-ui/shell` (SPEC §4, §8): the `AppShell` frame with its slots,
// the layout maths and the instance's layout and bottom-region stores, with the layout store's
// factory over a storage the caller passes (SPEC §5), the F6 regions and the package commands
// of the shell; the dock-panel, context-bar and status-field registries
// (SPEC §1.3) and what the status bar reads; the tool base and the tool registry, generic over
// the editor's tool type (BRIEF D18), the option values and what the tool rail and the context
// bar read of the editor's active-tool store; the presentational tab strip (BRIEF D18).

export { RegistrationError } from "../../model/modules.js";
export { collectContextBarContent } from "../../model/registries/contextBar.js";
export type {
    ContextBarContent,
    ContextBarContentModule,
} from "../../model/registries/contextBar.js";
export { collapsedByDefault, collectDockPanels } from "../../model/registries/dock.js";
export type { DockPanel, DockPanelModule } from "../../model/registries/dock.js";
export { collectStatusFields } from "../../model/registries/statusFields.js";
export type { StatusField, StatusFieldModule } from "../../model/registries/statusFields.js";
export {
    BOTTOM_HEIGHT,
    bottomMaxHeight,
    defaultBottomHeight,
    DOCK_WIDTH,
    isWindowTooSmall,
    MIN_WINDOW_HEIGHT,
    MIN_WINDOW_WIDTH,
    parseStoredLayout,
    RAIL,
    railColumns,
    railOneColumnHeight,
    resolveBottomHeight,
    resolveDockWidth,
    storedLayout,
} from "../../model/shell/layout.js";
export type { LayoutSizes } from "../../model/shell/layout.js";
export { optionControl, optionValue, optionValues } from "../../model/tools/options.js";
export type { ToolOptionControl } from "../../model/tools/options.js";
export {
    createToolRegistry,
    railGroups,
    registerToolModules,
    slotOf,
} from "../../model/tools/registry.js";
export type { ToolRegistry } from "../../model/tools/registry.js";
export type {
    ChoiceToolOption,
    NumberToolOption,
    PlannedToolSpec,
    RailSlot,
    RegisteredTool,
    ToggleToolOption,
    ToolBase,
    ToolHoldKey,
    ToolIcon,
    ToolModule,
    ToolOptionSpec,
    ToolOptionValue,
} from "../../model/tools/types.js";

export { AppShell, useWindowTooSmall } from "./AppShell.js";
export type { AppShellProps } from "./AppShell.js";
export { setBottomRegionVisible } from "./bottomRegion.js";
export type { BottomRegionState } from "./bottomRegion.js";
export { bottomRegionCommand } from "./bottomRegion.commands.js";
export { createLayoutStore } from "./layoutStore.js";
export type { LayoutState } from "./layoutStore.js";
export {
    cycleFocusRegion,
    REGION_ATTRIBUTE,
    REGION_FOCUS_ATTRIBUTE,
    regionFocusTarget,
    SHELL_REGIONS,
} from "./regions.js";
export type { ShellRegion } from "./regions.js";
export { NEXT_REGION_COMMAND, PREVIOUS_REGION_COMMAND } from "./regions.commands.js";
export type { StatusBarSource, StatusHint } from "./StatusBar.js";
export { TabStrip } from "./TabStrip.js";
export type { TabStripItem, TabStripLeading, TabStripProps } from "./TabStrip.js";
export type { RailFilter } from "./ToolRail.js";
export { useToolState } from "./useToolState.js";
export type { ToolStateSource } from "./useToolState.js";
