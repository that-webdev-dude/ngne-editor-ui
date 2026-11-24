import { useEditorUi } from "@ngne/editor-ui";
import { SegmentedControl, Toggle } from "@ngne/editor-ui/primitives";
import { slotOf } from "@ngne/editor-ui/shell";
import { useState, useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { probeToolRegistered, setProbeTool } from "./probeTool.ts";
import { selectionStore, selectionText } from "./selection.ts";
import { toolRegistry } from "./sources.ts";
import {
    floatingStore,
    SELECT_SET,
    selectTool,
    setFloating,
    setToolSet,
    TOOL_SETS,
    toolSetStore,
    toolStore,
} from "./tools.ts";

// The demo editor's tool slots (SPEC §8): the rail footer, two colour chips in the height the
// configuration reserves (`railFooterHeight`), which swap when either is pressed; the context
// bar's readouts slot, after the options and the command buttons: the variant choice of the
// active tool's rail slot, the selection while a selection tool is active, and the canvas
// size; and the controls in the viewport that change what the rail's filter reads (the tool
// set), float a selection (the `*.contextbar.tsx` content) and register the probe tool at run
// time.

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

/** A readout of the context bar: its label and the text it reads now. */
function Readout({ id, label, text }: Readonly<{ id: string; label: string; text: string }>) {
    return (
        <span className="ui-field" data-tool-readout={id}>
            <span className="ui-field__label">{label}</span>
            <output className="context-readout">{text}</output>
        </span>
    );
}

/**
 * The variants of the active tool's rail slot that name themselves (`variantLabel`), as a
 * segmented control that selects one: the readouts slot is where an editor draws a variant
 * choice (SPEC §8 Context bar); it never moves into the overflow menu.
 */
function VariantChoice({ activeId }: Readonly<{ activeId: string }>) {
    useSyncExternalStore(toolRegistry.subscribe, toolRegistry.version);
    const tool = toolRegistry.get(activeId);
    if (!tool) return null;
    const slot = toolRegistry.railSlots().find((each) => each.id === slotOf(tool));
    const variants = (slot?.variants ?? []).flatMap((each) =>
        each.variantLabel === undefined ? [] : [{ value: each.id, label: each.variantLabel }],
    );
    if (!slot || variants.length < 2) return null;
    return (
        <span className="ui-field" data-tool-variant-choice={slot.id}>
            <SegmentedControl
                label="Variant"
                value={tool.id}
                onChange={selectTool}
                options={variants}
            />
        </span>
    );
}

export function DemoReadouts() {
    const activeId = useStore(toolStore, (state) => state.selected);
    const selection = useStore(selectionStore, (state) => state.selection);
    const selecting = toolRegistry.get(activeId)?.toolSets?.some((set) => SELECT_SET.includes(set));
    return (
        <>
            <VariantChoice activeId={activeId} />
            {selecting ? (
                <Readout id="selection" label="Selection" text={selectionText(selection)} />
            ) : null}
            <Readout id="canvas" label="Canvas" text="64 × 64" />
        </>
    );
}

/** Whether the probe tool is registered, and what registers or removes it. */
function useProbeTool(): [registered: boolean, setRegistered: (registered: boolean) => void] {
    const { commands } = useEditorUi();
    const registered = useSyncExternalStore(toolRegistry.subscribe, probeToolRegistered);
    return [registered, (next) => setProbeTool(commands, next)];
}

export function DemoToolControls() {
    const set = useStore(toolSetStore, (state) => state.set);
    const floating = useStore(floatingStore, (state) => state.floating);
    const [probe, setProbe] = useProbeTool();
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
            <Toggle label="Probe tool" showLabel pressed={probe} onPressedChange={setProbe} />
        </div>
    );
}
