import type { CommandSpec } from "@ngne/editor-ui/commands";
import type { DemoMenu } from "./editorUi.ts";
import type { DemoContext } from "./keys.ts";
import { toolRegistry } from "./sources.ts";
import { toolKeyCommand } from "./toolKeys.ts";

// The demo editor's tool keys (SPEC §7.2, §8): each tool of its registry with a key has a
// command that selects it, read from the registry the instance's rail shows, before the
// instance exists. The editor owns them; the package's rail and context bar only read the
// store they set.

export const commands: CommandSpec<DemoMenu, DemoContext>[] = toolRegistry
    .list()
    .flatMap(toolKeyCommand);
