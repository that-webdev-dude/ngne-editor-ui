import type { CommandSpec } from "@ngne/editor-ui/commands";
import type { DemoMenu } from "./editorUi.ts";
import type { DemoContext } from "./keys.ts";
import { toolRegistry } from "./sources.ts";
import { selectTool, toolSetStore } from "./tools.ts";
import type { DemoTool } from "./tools.ts";

// The command that selects a demo tool by its key (SPEC §7.2, §8), bound in the `canvas`
// context, as an editor binds its tools' keys: `tools.commands.ts` makes one for each tool of
// the registry at startup, the probe tool's toggle one for the tool it registers. The key is the
// tool's own, unchanged; a tool of a set acts while its set is shown, so the commands of a key
// two sets share are enabled in turn and may bind one chord (SPEC §7.1).

/**
 * Whether the key of `tool` selects it now: always for a tool in every set, else while its set
 * is shown. "All" shows every set; there a key two sets share selects the Paint set's tool.
 */
function keySelects(tool: DemoTool): boolean {
    const sets = tool.toolSets;
    if (sets === undefined) return true;
    const shown = toolSetStore.getState().set;
    if (shown !== "all") return sets.includes(shown);
    if (sets.includes("paint")) return true;
    return !toolRegistry
        .list()
        .some((other) => other.id !== tool.id && other.shortcut === tool.shortcut);
}

/** The key command of `tool`, or none when it has no key. */
export function toolKeyCommand(tool: DemoTool): CommandSpec<DemoMenu, DemoContext>[] {
    if (tool.shortcut === undefined) return [];
    return [
        {
            id: `demo.tool.${tool.id}`,
            title: `${tool.label} Tool`,
            shortcut: tool.shortcut,
            context: "canvas",
            ...(tool.toolSets === undefined ? {} : { enabled: () => keySelects(tool) }),
            run: () => selectTool(tool.id),
        },
    ];
}
