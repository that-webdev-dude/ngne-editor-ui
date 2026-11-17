import type { ComponentType } from "react";
import type { DockPanel } from "@ngne/editor-ui/shell";

// The demo editor's Properties panel (SPEC §1.3 `*.dock.tsx`, DESIGN §2): the second section of
// the dock, collapsed by default in a window lower than 800 CSS pixels (`collapseBelowHeight`),
// expanded in a higher one, as an editor starts its less used sections collapsed.

/** The window height under which the section starts collapsed. */
export const PROPERTIES_COLLAPSE_BELOW = 800;

const PROPERTIES = [
    ["Width", "64 px"],
    ["Height", "64 px"],
    ["Frames", "4"],
] as const;

function PropertiesBody() {
    return (
        <dl className="demo-properties">
            {PROPERTIES.map(([name, value]) => (
                <div key={name} className="demo-properties__row">
                    <dt>{name}</dt>
                    <dd>{value}</dd>
                </div>
            ))}
        </dl>
    );
}

/** The section's header extra: the number of properties. */
function PropertiesCount() {
    return <span className="demo-properties__count">{PROPERTIES.length}</span>;
}

export const dockPanel: DockPanel<ComponentType> = {
    id: "properties",
    title: "Properties",
    order: 20,
    Body: PropertiesBody,
    HeaderExtra: PropertiesCount,
    collapseBelowHeight: PROPERTIES_COLLAPSE_BELOW,
};
