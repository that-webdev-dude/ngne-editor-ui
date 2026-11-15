import { describe, expect, it } from "vitest";
import { RegistrationError } from "../../src/model/modules.ts";
import { collapsedByDefault, collectDockPanels } from "../../src/model/registries/dock.ts";
import type { DockPanel } from "../../src/model/registries/dock.ts";

// The dock panel registry (SPEC §1.3, `*.dock.tsx`): a dock panel registers from its own
// module and the registry orders it; no shared file is edited.

type Component = () => null;
const Body: Component = () => null;
const panel = (id: string, order: number, extra: Partial<DockPanel<Component>> = {}) => ({
    id,
    title: id,
    order,
    Body,
    ...extra,
});

describe("dock panel registry", () => {
    it("holds the sections of a fixture map in dock order, with their fields", () => {
        const HeaderExtra: Component = () => null;
        const panels = collectDockPanels({
            "./panels/preview.dock.tsx": { dockPanel: panel("preview", 30, { title: "Preview" }) },
            "./panels/colour.dock.tsx": { dockPanel: panel("colour", 10, { title: "Colour" }) },
            "./panels/palette.dock.tsx": {
                dockPanel: panel("palette", 20, {
                    title: "Palette",
                    HeaderExtra,
                    collapseBelowHeight: 800,
                }),
            },
        });
        expect(panels.map((entry) => [entry.id, entry.title])).toEqual([
            ["colour", "Colour"],
            ["palette", "Palette"],
            ["preview", "Preview"],
        ]);
        expect(panels[1]?.HeaderExtra).toBe(HeaderExtra);
        expect(panels[1]?.collapseBelowHeight).toBe(800);
        for (const entry of panels) expect(entry.Body).toBe(Body);
    });

    it("orders panels by `order`, whatever the module order", () => {
        const panels = collectDockPanels({
            "./z.dock.tsx": { dockPanel: panel("last", 30) },
            "./a.dock.tsx": { dockPanel: panel("middle", 20) },
            "./m.dock.tsx": { dockPanel: panel("first", 10) },
            "./b.dock.tsx": { dockPanel: panel("also-middle", 20) },
        });
        expect(panels.map((entry) => entry.id)).toEqual(["first", "also-middle", "middle", "last"]);
    });

    it("collapses a panel by default only below its height", () => {
        const palette = panel("palette", 20, { collapseBelowHeight: 800 });
        expect(collapsedByDefault(palette, 799)).toBe(true);
        expect(collapsedByDefault(palette, 800)).toBe(false);
        expect(collapsedByDefault(panel("colour", 10), 300)).toBe(false);
    });

    it("rejects two panels with one id, naming both modules", () => {
        expect(() =>
            collectDockPanels({
                "./a.dock.tsx": { dockPanel: panel("colour", 10) },
                "./b.dock.tsx": { dockPanel: panel("colour", 20) },
            }),
        ).toThrow(/"colour".*\.\/a\.dock\.tsx.*\.\/b\.dock\.tsx/);
    });

    it("rejects a module that does not export dockPanel", () => {
        expect(() => collectDockPanels({ "./a.dock.tsx": {} })).toThrow(
            new RegistrationError('./a.dock.tsx does not export "dockPanel".', "./a.dock.tsx"),
        );
    });

    it("rejects a panel without an id or a finite order", () => {
        expect(() => collectDockPanels({ "./a.dock.tsx": { dockPanel: panel("", 10) } })).toThrow(
            "A panel of ./a.dock.tsx has no id.",
        );
        expect(() =>
            collectDockPanels({ "./a.dock.tsx": { dockPanel: panel("colour", Number.NaN) } }),
        ).toThrow('Dock panel "colour" (./a.dock.tsx) has no order.');
    });
});
