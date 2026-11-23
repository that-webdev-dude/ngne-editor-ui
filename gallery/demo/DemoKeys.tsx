import { setKeyContext } from "@ngne/editor-ui/commands";
import { Button, Dialog, Select, Toggle } from "@ngne/editor-ui/primitives";
import { useState } from "react";
import { useStore } from "zustand";
import { keyLogStore } from "./keys.ts";
import { keyContextState } from "./sources.ts";

// The demo editor's keys section (SPEC §6, §7.2): a focusable viewport (`data-viewport-focus`),
// a panel region (the `panel` focus context, inside the panel selector), a text field, a
// select, a toggle for the `gesture` state context, a plain control, a dialog, and the key log.
// A control outside the panel activated with the pointer returns the focus to the viewport. The
// toggle switches the demo's own state-context store (`sources.ts`), which the instance holds.

type Brush = "pencil" | "jitter" | "eraser";

const BRUSHES: readonly { value: Brush; label: string }[] = [
    { value: "pencil", label: "Pencil" },
    { value: "jitter", label: "Jitter" },
    { value: "eraser", label: "Eraser" },
];

const LAYERS = ["Background", "Ground", "Props"] as const;

export function DemoKeys() {
    const gesture = useStore(keyContextState, (state) => state.gesture);
    const ran = useStore(keyLogStore, (state) => state.ran);
    const [brush, setBrush] = useState<Brush>("pencil");
    const [name, setName] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);

    return (
        <section className="demo__keys" aria-label="Keys">
            <div className="demo__controls">
                <Toggle
                    label="Gesture"
                    showLabel
                    pressed={gesture}
                    onPressedChange={(next) => setKeyContext(keyContextState, "gesture", next)}
                />
                <Button>Tool</Button>
                <label className="ui-field">
                    <span className="ui-field__label">Name</span>
                    <input
                        className="demo__text-field"
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                    />
                </label>
                <Select label="Brush" value={brush} onChange={setBrush} options={BRUSHES} />
                <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
            </div>
            <div className="demo__workspace">
                <div
                    className="demo__viewport"
                    tabIndex={0}
                    role="application"
                    aria-label="Canvas"
                    data-viewport-focus=""
                />
                <section className="demo__panel" aria-label="Panel" data-demo-panel="">
                    <ul className="demo__layers" aria-label="Layers">
                        {LAYERS.map((layer) => (
                            <li key={layer} className="demo__layer" tabIndex={0}>
                                {layer}
                            </li>
                        ))}
                    </ul>
                    <Button>Add layer</Button>
                </section>
            </div>
            <ol className="demo__log" aria-label="Commands run" data-ran-count={ran.length}>
                {ran.map((entry) => (
                    <li key={entry.id} data-ran={entry.text}>
                        {entry.text}
                    </li>
                ))}
            </ol>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title="Demo dialog">
                <p>Keys bound in the editor do not act while this dialog is open.</p>
                <Button onClick={() => setDialogOpen(false)}>Close</Button>
            </Dialog>
        </section>
    );
}
