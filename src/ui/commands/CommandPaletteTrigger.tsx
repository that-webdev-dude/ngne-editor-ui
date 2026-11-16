import { Search } from "lucide-react";
import { chordKey, chordModifiers } from "../../model/commands/chord.js";
import { useEditorUi } from "../editorUi/context.js";
import { Icon } from "../primitives/Icon.js";
import { Chord } from "./Chord.js";
import { COMMAND_PALETTE_COMMAND } from "./commandPalette.commands.js";
import { runCommand } from "./runCommand.js";
import { useCommandValue } from "./useCommands.js";

/** A canonical chord in the notation of `aria-keyshortcuts`: "Control+K". */
function ariaKeyShortcut(chord: string): string {
    const { ctrl, alt, shift, meta } = chordModifiers(chord);
    const names = [ctrl && "Control", alt && "Alt", shift && "Shift", meta && "Meta"];
    return [...names.filter(Boolean), chordKey(chord)].join("+");
}

/**
 * The command palette trigger (DESIGN §2, §4): a button that runs the palette command of the
 * instance's registry and shows that command's shortcut, both read from the registry. The
 * shell places it at the right of the menu bar.
 */
export function CommandPaletteTrigger() {
    const editorUi = useEditorUi();
    // The values it shows, not the command: it renders only when one of them changes.
    const shortcut = useCommandValue(
        (registry) => registry.get(COMMAND_PALETTE_COMMAND)?.shortcuts[0],
    );
    const enabled = useCommandValue(
        (registry) => registry.get(COMMAND_PALETTE_COMMAND)?.enabled() ?? false,
    );
    return (
        <button
            type="button"
            className="command-palette-trigger"
            aria-keyshortcuts={shortcut ? ariaKeyShortcut(shortcut) : undefined}
            disabled={!enabled}
            onClick={() => runCommand(editorUi.commands, COMMAND_PALETTE_COMMAND)}
        >
            <Icon icon={Search} />
            Commands
            {shortcut ? (
                // The key is announced through `aria-keyshortcuts`.
                <span aria-hidden="true">
                    <Chord chord={shortcut} />
                </span>
            ) : null}
        </button>
    );
}
