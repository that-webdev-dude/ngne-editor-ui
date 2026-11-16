import type { CommandSpec } from "@ngne/editor-ui/commands";
import type { DemoMenu } from "./editorUi.ts";
import { record } from "./keys.ts";
import type { DemoContext } from "./keys.ts";

// The demo editor's key commands (SPEC §7.2): one chord bound in several contexts, each
// command recording its context, so the first applicable context that binds the chord shows
// in the key log. J is bound in `gesture`, `panel` and `canvas`; Alt+J in `text` and `global`;
// Ctrl+F only in `panel`, so elsewhere it is a browser shortcut the keymap suppresses.

const bound = (
    id: string,
    title: string,
    shortcut: string,
    context: DemoContext | "text" | "canvas" | "global",
): CommandSpec<DemoMenu, DemoContext> => ({
    id: `demo.keys.${id}`,
    title,
    shortcut,
    context,
    run: () => record(`${context} ${shortcut}`),
});

export const commands: CommandSpec<DemoMenu, DemoContext>[] = [
    bound("gesture-mark", "Mark in Gesture", "J", "gesture"),
    bound("panel-mark", "Mark in Panel", "J", "panel"),
    bound("canvas-mark", "Mark on Canvas", "J", "canvas"),
    bound("text-mark", "Mark in Text", "Alt+J", "text"),
    bound("global-mark", "Mark Anywhere", "Alt+J", "global"),
    bound("panel-find", "Find in Panel", "Ctrl+F", "panel"),
];
