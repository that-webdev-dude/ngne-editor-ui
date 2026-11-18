import { TabStrip } from "@ngne/editor-ui/shell";
import { useStore } from "zustand";
import { documentStore } from "./document.ts";
import { activateTab, closeTab, moveTab, tabsStore } from "./tabs.ts";

// The demo editor's `menuCentre` slot (SPEC §8): the tab strip of its open documents
// (tabs.ts), between its menus and the command palette trigger; nothing while no document is
// open.

export function DemoMenuCentre() {
    const open = useStore(documentStore, (state) => state.open);
    const { items, activeId } = useStore(tabsStore);
    if (!open) return null;
    return (
        <div className="demo-menu-centre" data-demo-menu-centre="">
            <TabStrip
                items={items}
                activeId={activeId}
                label="Documents"
                overflowLabel="All documents"
                activate={activateTab}
                close={closeTab}
                move={moveTab}
            />
        </div>
    );
}
