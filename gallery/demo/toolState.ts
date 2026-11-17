import { optionValues, slotOf } from "@ngne/editor-ui/shell";
import type { RegisteredTool, ToolOptionValue, ToolStateSource } from "@ngne/editor-ui/shell";
import { editorUi } from "./editorUi.ts";
import { selectTool, setToolOption, toolStore } from "./tools.ts";
import type { DemoTool } from "./tools.ts";

// What the demo editor's tool rail and context bar read (SPEC §8 `tools`): its tool store over
// the instance's tool registry, as an editor's active-tool store is. A rail slot with variants
// shows the active tool when it is one of the slot's, else the slot's tool selected last.

const registry = editorUi.tools;
const listeners = new Set<() => void>();
let version = 0;

function changed(): void {
    version++;
    for (const listener of [...listeners]) listener();
}

/** The tool of each rail slot selected last, by slot id. */
const lastInSlot = new Map<string, string>();

function remember(id: string): void {
    const tool = registry.get(id);
    if (tool) lastInSlot.set(slotOf(tool), id);
}

remember(toolStore.getState().selected);
toolStore.subscribe((state, previous) => {
    if (state.selected !== previous.selected) remember(state.selected);
    changed();
});
registry.subscribe(() => {
    remember(toolStore.getState().selected);
    changed();
});

/** Option values made once per stored record, so a render reads the same object. */
const values = new WeakMap<
    RegisteredTool<DemoTool>,
    { stored: unknown; values: Readonly<Record<string, ToolOptionValue>> }
>();

export const demoTools: ToolStateSource<DemoTool> = {
    activeId: () => toolStore.getState().selected,
    shownInSlot(slot) {
        const active = slot.variants.find(
            (variant) => variant.id === toolStore.getState().selected,
        );
        if (active) return active;
        const last = lastInSlot.get(slot.id);
        return slot.variants.find((variant) => variant.id === last) ?? slot.tool;
    },
    select(id) {
        if (registry.get(id)) selectTool(id);
    },
    options(tool) {
        const stored = toolStore.getState().options[tool.id];
        const known = values.get(tool);
        if (known && known.stored === stored) return known.values;
        const next = optionValues(tool.options, stored);
        values.set(tool, { stored, values: next });
        return next;
    },
    setOption: (tool, key, value) => setToolOption(tool.id, key, value),
    subscribe(listener) {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },
    version: () => version,
};
