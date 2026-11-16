import { formatChord } from "../../model/commands/chord.js";

export interface ChordProps {
    /** A canonical chord: "Ctrl+Shift+Z". */
    chord: string;
}

/** A key chord as a key cap: the canonical chord in `data-chord`, shown as menus show it. */
export function Chord({ chord }: Readonly<ChordProps>) {
    return (
        <kbd className="ui-chord" data-chord={chord}>
            {formatChord(chord)}
        </kbd>
    );
}
