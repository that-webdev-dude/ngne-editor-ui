import type { CommandSpec } from "@ngne/editor-ui/commands";
import type { DemoMenu } from "./editorUi.ts";
import type { DemoContext } from "./keys.ts";
import { selectTool } from "./tools.ts";
import type { DemoTool } from "./tools.ts";

// The command that selects a demo tool by its key (SPEC §7.2, §8), bound in the `canvas`
// context, as an editor binds its tools' keys: `tools.commands.ts` makes one for each tool of
// the registry at startup, the probe tool's toggle one for the tool it registers.

/** The key command of `tool`, or none when it has no key. */
export function toolKeyCommand(tool: DemoTool): CommandSpec<DemoMenu, DemoContext>[] {
    if (tool.shortcut === undefined) return [];
    return [
        {
            id: `demo.tool.${tool.id}`,
            title: `${tool.label} Tool`,
            shortcut: tool.shortcut,
            context: "canvas",
            run: () => selectTool(tool.id),
        },
    ];
}
