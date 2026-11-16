import type { CommandSpec } from "@ngne/editor-ui/commands";
import { editorUi } from "./editorUi.ts";
import type { DemoMenu } from "./editorUi.ts";
import { PREFERENCES_COMMAND } from "./preferences.ts";

// The demo editor's Preferences command: it opens the editor's own surface `preferences`
// (`surfaces`, SPEC §5), which the package's surface host shows and tracks with the command
// palette and the shortcut sheet (SPEC §7.1). Edit → Preferences…, as in the editors. It reads
// the instance only when it runs, after the instance module has finished (preferences.ts).

export const commands: CommandSpec<DemoMenu, never>[] = [
    {
        id: PREFERENCES_COMMAND,
        title: "Preferences…",
        menuPath: ["Edit"],
        menuOrder: 910,
        run: () => editorUi.surfaces.open("preferences"),
    },
];
