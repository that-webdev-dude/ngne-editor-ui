import { useState } from "react";
import { collapsedByDefault } from "../../model/registries/dock.js";
import { useEditorUi } from "../editorUi/context.js";
import { useWindowHeight } from "../platform/useWindowSize.js";
import { DockSection } from "./DockSection.js";

/**
 * The dock's content (SPEC §8, DESIGN §2): one section per `*.dock.tsx` panel of the instance,
 * in dock order. A section the user has not toggled follows its panel's default for the
 * current window height (`collapseBelowHeight`).
 */
export function Dock() {
    const { dockPanels } = useEditorUi();
    const windowHeight = useWindowHeight();
    const [chosen, setChosen] = useState<Readonly<Record<string, boolean>>>({});
    return dockPanels.map((panel) => (
        <DockSection
            key={panel.id}
            panel={panel}
            collapsed={chosen[panel.id] ?? collapsedByDefault(panel, windowHeight)}
            onCollapsedChange={(collapsed) =>
                setChosen((current) => ({ ...current, [panel.id]: collapsed }))
            }
        />
    ));
}
