import { byOrderThenId, collectEntries } from "../modules.js";
import type { ModuleMap } from "../modules.js";

// Dock panel registry (SPEC §1.3, `*.dock.tsx`). A feature adds a section to the dock by
// creating a module named `*.dock.tsx` that exports `dockPanel`; the editor finds it with one
// `import.meta.glob` line and passes the map, so no shared file is edited (RULES 3).
//
//     // src/ui/panels/colour.dock.tsx
//     export const dockPanel: DockPanel = { id: "colour", title: "Colour", order: 10, Body };
//
// Generic over the component type, so this layer imports no React (SPEC §1.1).

export interface DockPanel<Component = unknown> {
    /** Stable, unique id; also the `data-dock-panel` attribute of the section. */
    id: string;
    /** Section header text. */
    title: string;
    /** Position in the dock, ascending. */
    order: number;
    /** Panel content, mounted only while the section is expanded. */
    Body: Component;
    /** Right side of the header (a menu, the current item). */
    HeaderExtra?: Component;
    /** Collapsed by default while the window is lower than this many CSS pixels. */
    collapseBelowHeight?: number;
}

/** What a `*.dock.tsx` module exports. */
export interface DockPanelModule<Component = unknown> {
    dockPanel?: DockPanel<Component>;
}

/**
 * Validates the modules and returns their panels in dock order: by `order`, then by id in
 * UTF-16 code-unit order. Throws a `RegistrationError` naming the module for a missing export,
 * a panel without an id or a finite order, or an id used twice.
 */
export function collectDockPanels<Component>(
    modules: ModuleMap<DockPanelModule<Component>>,
): DockPanel<Component>[] {
    const entries = collectEntries<DockPanel<Component>>(modules, {
        exportName: "dockPanel",
        list: false,
        noun: "Dock panel",
        item: "panel",
        key: "id",
        ordered: true,
    });
    return entries.map(({ entry }) => entry).sort(byOrderThenId);
}

/** Whether `panel` starts collapsed in a window `windowHeight` CSS pixels high. */
export function collapsedByDefault(
    panel: Pick<DockPanel, "collapseBelowHeight">,
    windowHeight: number,
): boolean {
    return panel.collapseBelowHeight !== undefined && windowHeight < panel.collapseBelowHeight;
}
