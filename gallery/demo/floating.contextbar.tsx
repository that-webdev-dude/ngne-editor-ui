import type { ContextBarContent } from "@ngne/editor-ui/shell";
import { NumberField } from "@ngne/editor-ui/primitives";
import type { ComponentType } from "react";
import { useState } from "react";
import { floatingStore } from "./tools.ts";

// The demo editor's context-bar content (SPEC §1.3 `*.contextbar.tsx`): while a selection
// floats, the bar shows its offset fields in the place of the active tool's options.

function FloatingFields() {
    const [x, setX] = useState(0);
    const [y, setY] = useState(0);
    return (
        <>
            <NumberField
                label="Offset X"
                value={x}
                onChange={setX}
                min={-512}
                max={512}
                unit="px"
            />
            <NumberField
                label="Offset Y"
                value={y}
                onChange={setY}
                min={-512}
                max={512}
                unit="px"
            />
        </>
    );
}

export const contextBarContent: ContextBarContent<ComponentType> = {
    id: "floating",
    order: 10,
    shown: () => floatingStore.getState().floating,
    subscribe: (listener) => floatingStore.subscribe(listener),
    Body: FloatingFields,
};
