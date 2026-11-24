import { Circle, RotateCcw, RotateCw, Square } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import type { CommandModule } from "../../../model/commands/types.js";
import { optionValues } from "../../../model/tools/options.js";
import type {
    RegisteredTool,
    ToolAction,
    ToolBase,
    ToolOptionValue,
} from "../../../model/tools/types.js";
import { EditorUiContext } from "../../editorUi/context.js";
import { SegmentedControl, Toggle, TooltipProvider } from "../../primitives/index.js";
import { ContextBar } from "../../shell/ContextBar.js";
import type { ToolStateSource } from "../../shell/useToolState.js";
import type { GalleryEntry } from "../entry.js";
import { fixtureInstance } from "./fixtureEditor.js";
import type { FixtureMenu } from "./fixtureEditor.js";

// The context bar entry of the gallery (SPEC §8, DESIGN §2): the bar of a fixture stamp whose
// rail slot has two variants, Rectangle and Ellipse. The active tool's name, its options, its
// command buttons (two icon buttons, two text buttons) and, in the readouts slot, the variant
// choice the editor draws there and the stamp's turn and flip, as an editor shows them. A
// toggle places the stamp or takes it away: the buttons' commands are enabled while a stamp is
// placed, and the instance refreshes them when it changes. Options and buttons that do not fit
// the bar move into its overflow menu; the readouts stay. The instance is provided without
// `UiRoot` (SurfacesEntries.tsx says why).

interface StampState {
    readonly active: string;
    readonly options: Readonly<Record<string, Readonly<Record<string, ToolOptionValue>>>>;
    readonly placed: boolean;
    readonly turns: number;
    readonly flipped: boolean;
}

interface FixtureStamp {
    readonly store: StoreApi<StampState>;
    readonly source: ToolStateSource;
    readonly editorUi: ReturnType<typeof fixtureInstance>;
}

const ACTIONS: readonly ToolAction<LucideIcon>[] = [
    { commandId: "gallery.stamp.rotateLeft", label: "Rotate Stamp Left", icon: RotateCcw },
    { commandId: "gallery.stamp.rotateRight", label: "Rotate Stamp Right", icon: RotateCw },
    { commandId: "gallery.stamp.flip", label: "Flip" },
    { commandId: "gallery.stamp.reset", label: "Reset" },
];

const fill = {
    key: "fill",
    label: "Fill",
    kind: "choice",
    choices: [
        { value: "outline", label: "Outline" },
        { value: "filled", label: "Filled" },
    ],
    default: "outline",
} as const;

// Not "Size": the number field entry's control has that name on the same page.
const margin = {
    key: "margin",
    label: "Margin",
    kind: "number",
    min: 1,
    max: 32,
    unit: "px",
    default: 4,
} as const;

const TOOLS: readonly ToolBase<LucideIcon>[] = [
    {
        id: "rectangle",
        label: "Rectangle",
        icon: Square,
        railOrder: 100,
        options: [fill, margin],
        actions: ACTIONS,
    },
    {
        id: "ellipse",
        label: "Ellipse",
        icon: Circle,
        railOrder: 101,
        variantOf: "rectangle",
        options: [fill, margin],
        actions: ACTIONS,
    },
];

/** What the user set on a tool that has nothing set: one object, so its values are made once. */
const NOTHING_SET: Readonly<Record<string, ToolOptionValue>> = {};

/** The fixture's store, its instance and the active-tool source the bar reads. */
function fixtureStamp(): FixtureStamp {
    const store = createStore<StampState>(() => ({
        active: "rectangle",
        options: {},
        placed: true,
        turns: 0,
        flipped: false,
    }));
    const placed = () => store.getState().placed;
    const change = (next: (state: StampState) => Partial<StampState>) => () => store.setState(next);
    const commands: CommandModule<FixtureMenu, never> = {
        commands: [
            {
                id: "gallery.stamp.rotateLeft",
                title: "Rotate Stamp Left",
                enabled: placed,
                run: change((state) => ({ turns: (state.turns + 3) % 4 })),
            },
            {
                id: "gallery.stamp.rotateRight",
                title: "Rotate Stamp Right",
                enabled: placed,
                run: change((state) => ({ turns: (state.turns + 1) % 4 })),
            },
            {
                id: "gallery.stamp.flip",
                title: "Flip Stamp",
                enabled: placed,
                run: change((state) => ({ flipped: !state.flipped })),
            },
            {
                id: "gallery.stamp.reset",
                title: "Reset Stamp",
                enabled: placed,
                run: change(() => ({ turns: 0, flipped: false })),
            },
        ],
    };
    const editorUi = fixtureInstance("ngne-gallery-context-bar", {
        commands: { "./gallery/stamp.commands.ts": commands },
        tools: { "./gallery/stamp.tools.ts": { tools: TOOLS } },
        refreshOn: [store],
    });
    let version = 0;
    store.subscribe(() => version++);
    const values = new WeakMap<object, Readonly<Record<string, ToolOptionValue>>>();
    const source: ToolStateSource = {
        activeId: () => store.getState().active,
        select: (id) => store.setState({ active: id }),
        options(tool: RegisteredTool<ToolBase>) {
            const stored = store.getState().options[tool.id] ?? NOTHING_SET;
            const known = values.get(stored);
            if (known) return known;
            const next = optionValues(tool.options, stored);
            values.set(stored, next);
            return next;
        },
        setOption: (tool, key, value) =>
            store.setState((state) => ({
                options: {
                    ...state.options,
                    [tool.id]: { ...state.options[tool.id], [key]: value },
                },
            })),
        subscribe: (listener) => store.subscribe(listener),
        version: () => version,
    };
    return { store, source, editorUi };
}

/** The editor's readouts of the fixture: the variant choice, then the stamp's turn and flip. */
function StampReadouts({ stamp }: Readonly<{ stamp: FixtureStamp }>) {
    const active = useStore(stamp.store, (state) => state.active);
    const turns = useStore(stamp.store, (state) => state.turns);
    const flipped = useStore(stamp.store, (state) => state.flipped);
    return (
        <>
            <span className="ui-field" data-tool-variant-choice="rectangle">
                <SegmentedControl
                    label="Variant"
                    value={active}
                    onChange={(id) => stamp.store.setState({ active: id })}
                    options={TOOLS.map((tool) => ({ value: tool.id, label: tool.label }))}
                />
            </span>
            <span className="ui-field" data-tool-readout="turn">
                <span className="ui-field__label">Turn</span>
                <output className="context-readout">{turns * 90}°</output>
            </span>
            <span className="ui-field" data-tool-readout="flip">
                <span className="ui-field__label">Flip</span>
                <output className="context-readout">{flipped ? "On" : "Off"}</output>
            </span>
        </>
    );
}

function ContextBarFrame() {
    const [stamp] = useState(fixtureStamp);
    const placed = useStore(stamp.store, (state) => state.placed);
    return (
        <EditorUiContext.Provider value={stamp.editorUi}>
            <TooltipProvider>
                <div className="gallery__row">
                    <Toggle
                        label="Stamp placed"
                        showLabel
                        pressed={placed}
                        onPressedChange={(next) => stamp.store.setState({ placed: next })}
                    />
                </div>
                <section className="gallery-context-bar" aria-label="Tool options">
                    <ContextBar tools={stamp.source} readouts={<StampReadouts stamp={stamp} />} />
                </section>
            </TooltipProvider>
        </EditorUiContext.Provider>
    );
}

export const contextBarEntry: GalleryEntry = {
    id: "context-bar",
    title: "Context bar",
    Component: ContextBarFrame,
};
