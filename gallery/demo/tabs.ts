import { createStore } from "zustand/vanilla";
import type { TabStripItem } from "@ngne/editor-ui/shell";
import { documentStore, setDocumentOpen } from "./document.ts";

// The demo editor's open documents, which its `menuCentre` slot shows as the tab strip (SPEC §8,
// DESIGN §2): a press selects, the close control, a middle click or Delete closes without
// asking, a drag or Ctrl+Shift+← → moves. Closing the last one closes the document, as Close
// document does; New document opens the starting tabs again.

export interface TabsState {
    readonly items: readonly TabStripItem[];
    readonly activeId: string | null;
}

const START: TabsState = {
    items: [
        { id: "untitled", label: "Untitled document", tooltip: "Untitled document", dirty: true },
        { id: "level-1", label: "Level 1", tooltip: "Level 1", dirty: false },
        { id: "sprites", label: "Sprites", tooltip: "Sprites", dirty: false },
    ],
    activeId: "untitled",
};

export const tabsStore = createStore<TabsState>(() => START);

export function activateTab(id: string): void {
    tabsStore.setState({ activeId: id });
}

/** Closes the tab `id`; its neighbour is selected next when it was the selected one. */
export function closeTab(id: string): void {
    const { items, activeId } = tabsStore.getState();
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return;
    const rest = items.filter((item) => item.id !== id);
    const neighbour = rest[index] ?? rest[index - 1] ?? null;
    tabsStore.setState({
        items: rest,
        activeId: activeId === id ? (neighbour?.id ?? null) : activeId,
    });
    if (rest.length === 0) setDocumentOpen(false);
}

/** Moves the tab `id` to `index`, its place once moved. */
export function moveTab(id: string, index: number): void {
    const { items } = tabsStore.getState();
    const moved = items.find((item) => item.id === id);
    if (!moved) return;
    const rest = items.filter((item) => item.id !== id);
    rest.splice(index, 0, moved);
    tabsStore.setState({ items: rest });
}

documentStore.subscribe((state, previous) => {
    if (state.open && !previous.open && tabsStore.getState().items.length === 0) {
        tabsStore.setState(START);
    }
});
