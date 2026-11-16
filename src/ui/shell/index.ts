// Entry module of `@ngne/editor-ui/shell` (SPEC §4, §8). The Model part so far: the tool base
// and the tool registry, generic over the editor's tool type (BRIEF D18).

export { RegistrationError } from "../../model/modules.js";
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
