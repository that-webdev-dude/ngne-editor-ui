import { SegmentedControl, Toggle } from "@ngne/editor-ui/primitives";
import { useState } from "react";
import { useStore } from "zustand";
import { floatingStore, setFloating, setToolSet, TOOL_SETS, toolSetStore } from "./tools.ts";

// The demo editor's tool slots (SPEC §8): the rail footer, two colour chips in the height the
// configuration reserves (`railFooterHeight`), which swap when either is pressed; the context
// bar's readouts, after the options; and the controls in the viewport that change what the
// rail's filter reads (the tool set) and float a selection (the `*.contextbar.tsx` content).

export function DemoRailFooter() {
    const [swapped, setSwapped] = useState(false);
    const chips = swapped ? ["background", "foreground"] : ["foreground", "background"];
    return (
        <>
            {chips.map((colour, index) => (
                <button
                    key={colour}
                    type="button"
                    className={`demo-chip demo-chip--${colour}`}
                    aria-label={index === 0 ? "Primary colour" : "Secondary colour"}
                    onClick={() => setSwapped((value) => !value)}
                />
            ))}
        </>
    );
}

export function DemoReadouts() {
    return (
        <span className="ui-field" data-tool-readout="canvas">
            <span className="ui-field__label">Canvas</span>
            <output className="context-readout">64 × 64</output>
        </span>
    );
}

export function DemoToolControls() {
    const set = useStore(toolSetStore, (state) => state.set);
    const floating = useStore(floatingStore, (state) => state.floating);
    return (
        <div className="demo__controls demo__tool-controls">
            <SegmentedControl
                label="Tool set"
                value={set}
                onChange={setToolSet}
                options={TOOL_SETS}
            />
            <Toggle
                label="Floating selection"
                showLabel
                pressed={floating}
                onPressedChange={setFloating}
            />
        </div>
    );
}
