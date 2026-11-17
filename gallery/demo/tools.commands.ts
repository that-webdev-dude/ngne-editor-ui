import type { CommandSpec } from "@ngne/editor-ui/commands";
import type { DemoMenu } from "./editorUi.ts";
import type { DemoContext } from "./keys.ts";
import { tools as navigateTools } from "./navigate.tools.ts";
import { tools as paintTools } from "./paint.tools.ts";
import { tools as selectTools } from "./select.tools.ts";
import { selectTool } from "./tools.ts";

// The demo editor's tool keys (SPEC §7.2, §8): each tool with a key has a command that selects
// it, bound in the `canvas` context, as an editor binds its tools' keys. The editor owns them;
// the package's rail and context bar only read the store they set.

export const commands: CommandSpec<DemoMenu, DemoContext>[] = [
    ...selectTools,
    ...paintTools,
    ...navigateTools,
].flatMap((tool) =>
    tool.shortcut === undefined
        ? []
        : [
              {
                  id: `demo.tool.${tool.id}`,
                  title: `${tool.label} Tool`,
                  shortcut: tool.shortcut,
                  context: "canvas" as const,
                  run: () => selectTool(tool.id),
              },
          ],
);
