import { useState } from "react";
import type { ReactNode } from "react";
import { Button, TooltipProvider } from "../../primitives/index.js";
import { TabStrip } from "../../shell/TabStrip.js";
import type { TabStripItem } from "../../shell/TabStrip.js";
import type { GalleryEntry } from "../entry.js";

// The tab strip entry of the gallery (SPEC §8, DESIGN §2): the strip in a bar of the menu
// bar's height, over a fixture tab model that does what an editor would with each callback
// (select, close without asking, move), then readouts of the model and of the last call the
// strip made. Buttons open 30 tabs, which do not fit, add one, or go back to the four tabs.
// Below the bar, a viewport target (`data-viewport-focus`) takes the focus after the last tab
// is closed from the keyboard. The entry has its own tooltip provider, as `UiRoot` gives an
// app one.

interface FixtureTabs {
    items: readonly TabStripItem[];
    activeId: string | null;
}

const LABELS = ["Alpha", "Beta", "Gamma", "Delta"] as const;

function fixtureTab(label: string, dirty = false): TabStripItem {
    const id = label.toLowerCase().replaceAll(" ", "-");
    return { id, label, tooltip: `${label} (fixture document)`, dirty };
}

function startTabs(): FixtureTabs {
    const items = LABELS.map((label) => fixtureTab(label, label === "Beta"));
    return { items, activeId: items[0]!.id };
}

function manyTabs(count: number): FixtureTabs {
    const items = Array.from({ length: count }, (_, index) =>
        fixtureTab(`Document ${index + 1}`, index % 7 === 3),
    );
    return { items, activeId: items.at(-1)!.id };
}

/** The editor's close policy of the fixture: the selected tab's neighbour is selected next. */
function withoutTab(tabs: FixtureTabs, id: string): FixtureTabs {
    const index = tabs.items.findIndex((item) => item.id === id);
    if (index < 0) return tabs;
    const items = tabs.items.filter((item) => item.id !== id);
    if (tabs.activeId !== id) return { items, activeId: tabs.activeId };
    const next = items[index] ?? items[index - 1] ?? null;
    return { items, activeId: next?.id ?? null };
}

function withMove(tabs: FixtureTabs, id: string, index: number): FixtureTabs {
    const moved = tabs.items.find((item) => item.id === id);
    if (!moved) return tabs;
    const items = tabs.items.filter((item) => item.id !== id);
    items.splice(index, 0, moved);
    return { items, activeId: tabs.activeId };
}

function Readout({
    name,
    label,
    children,
}: Readonly<{ name: string; label: string; children: ReactNode }>) {
    return (
        <span className="gallery-tabs__fact">
            <span className="gallery__readout">{label}</span>
            <output className="gallery-tabs__value" data-readout={name}>
                {children}
            </output>
        </span>
    );
}

function TabStripDemo() {
    const [tabs, setTabs] = useState<FixtureTabs>(startTabs);
    const [lastCall, setLastCall] = useState("none");
    const [calls, setCalls] = useState(0);
    const [added, setAdded] = useState(0);

    const record = (call: string) => {
        setLastCall(call);
        setCalls((count) => count + 1);
    };
    const reset = (next: FixtureTabs) => {
        setTabs(next);
        setLastCall("none");
        setCalls(0);
    };

    return (
        <div className="gallery-tabs">
            <div className="gallery-tabs__bar">
                <TabStrip
                    items={tabs.items}
                    activeId={tabs.activeId}
                    label="Documents"
                    overflowLabel="All documents"
                    leading={{ label: "Fixture project", dirty: true }}
                    activate={(id) => {
                        record(`activate(${id})`);
                        setTabs((current) => ({ ...current, activeId: id }));
                    }}
                    close={(id) => {
                        record(`close(${id})`);
                        setTabs((current) => withoutTab(current, id));
                    }}
                    move={(id, index) => {
                        record(`move(${id}, ${index})`);
                        setTabs((current) => withMove(current, id, index));
                    }}
                />
            </div>
            <div className="gallery__row">
                <Button onClick={() => reset(manyTabs(30))}>Open 30 tabs</Button>
                <Button
                    onClick={() => {
                        const tab = fixtureTab(`Added ${added + 1}`);
                        setAdded(added + 1);
                        setTabs((current) => ({
                            items: [...current.items, tab],
                            activeId: tab.id,
                        }));
                    }}
                >
                    Add tab
                </Button>
                <Button onClick={() => reset(startTabs())}>Reset tabs</Button>
            </div>
            <div className="gallery__row">
                <Readout name="tab-order" label="Order">
                    {tabs.items.map((item) => item.id).join(" ") || "none"}
                </Readout>
                <Readout name="tab-active" label="Selected">
                    {tabs.activeId ?? "none"}
                </Readout>
                <Readout name="tab-last-call" label="Last call">
                    {lastCall}
                </Readout>
                <Readout name="tab-calls" label="Calls">
                    {calls}
                </Readout>
            </div>
            <section
                className="gallery-tabs__viewport"
                aria-label="Fixture viewport"
                tabIndex={-1}
                data-viewport-focus=""
            >
                Viewport
            </section>
        </div>
    );
}

function TabStripEntryComponent() {
    return (
        <TooltipProvider>
            <TabStripDemo />
        </TooltipProvider>
    );
}

export const tabStripEntry: GalleryEntry = {
    id: "tab-strip",
    title: "Tab strip",
    Component: TabStripEntryComponent,
};
