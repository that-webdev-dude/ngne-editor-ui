import { shortcutGroups } from "../../model/commands/shortcutSheet.js";
import type { ShortcutGroup } from "../../model/commands/shortcutSheet.js";
import { useEditorUi } from "../editorUi/context.js";
import { Button } from "../primitives/Button.js";
import { Dialog } from "../primitives/Dialog.js";
import { Chord } from "./Chord.js";
import { useCommands } from "./useCommands.js";

/** One menu: its name as a heading, then its commands with their keys. */
function Group({ group }: Readonly<{ group: ShortcutGroup }>) {
    return (
        <section className="shortcut-sheet__group" data-shortcut-group={group.title}>
            <h3 className="shortcut-sheet__heading">{group.title}</h3>
            <dl className="shortcut-sheet__rows">
                {group.rows.map((row) => (
                    <div
                        key={row.command.id}
                        className="shortcut-sheet__row"
                        data-command={row.command.id}
                    >
                        <dt className="shortcut-sheet__title">{row.title}</dt>
                        <dd className="shortcut-sheet__keys">
                            {row.chords.map((chord) => (
                                <Chord key={chord} chord={chord} />
                            ))}
                            {row.hold ? <span className="shortcut-sheet__hold">hold</span> : null}
                        </dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}

/**
 * Shortcut sheet (DESIGN §7): every shortcut of the instance's command registry, grouped by
 * the editor's menus in their order, the commands outside the menus under "Other" last. It is
 * generated from the registry (`shortcutGroups`), so it lists a binding as soon as its command
 * is registered. The list is one tab stop, so the keyboard scrolls it. Shown by the surface
 * host while the instance's `shortcut-sheet` surface is open.
 */
export function ShortcutSheet() {
    const editorUi = useEditorUi();
    const groups = shortcutGroups(useCommands(), editorUi.config.menus);
    const close = () => editorUi.surfaces.close("shortcut-sheet");
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) close();
            }}
            title="Keyboard shortcuts"
            className="shortcut-dialog"
            actions={
                <Button variant="primary" onClick={close}>
                    Close
                </Button>
            }
        >
            <div
                className="shortcut-sheet"
                role="group"
                aria-label="Shortcuts by menu"
                tabIndex={0}
            >
                <div className="shortcut-sheet__columns">
                    {groups.map((group) => (
                        <Group key={group.title} group={group} />
                    ))}
                </div>
            </div>
        </Dialog>
    );
}
