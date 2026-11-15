import { describe, expect, it } from "vitest";
import { collectOverlayLayers, RegistrationError } from "../../src/model/overlay/index.ts";
import type { OverlayLayer } from "../../src/model/overlay/index.ts";

// The overlay's draw-layer registry (SPEC §1.3, `*.overlay.ts(x)`): layers in draw order,
// bottom first (DESIGN §6), over the editor's own frame type.

/** A frame as an editor defines it; the registry only passes it on. */
interface Frame {
    drawn: string[];
}

const layer = (id: string, order: number): OverlayLayer<Frame> => ({
    id,
    order,
    draw(frame) {
        frame.drawn.push(id);
    },
});

const outlineLayers = [layer("document-outline", 100)];
const gridLayers = [layer("pixel-grid", 200), layer("tile-grid", 300)];

describe("draw-layer registry", () => {
    it("orders the layers of every module by draw order, bottom first", () => {
        const layers = collectOverlayLayers({
            "./cursor.overlay.ts": { overlayLayers: [layer("cursor", 900)] },
            "./grid.overlay.ts": { overlayLayers: gridLayers },
            "./selection.overlay.ts": {
                overlayLayers: [layer("handles", 700), layer("ants", 500), layer("pending", 600)],
            },
            "./outline.overlay.ts": { overlayLayers: outlineLayers },
        });
        expect(layers.map((entry) => [entry.id, entry.order])).toEqual([
            ["document-outline", 100],
            ["pixel-grid", 200],
            ["tile-grid", 300],
            ["ants", 500],
            ["pending", 600],
            ["handles", 700],
            ["cursor", 900],
        ]);
        const frame: Frame = { drawn: [] };
        for (const entry of layers) entry.draw(frame);
        expect(frame.drawn).toEqual(layers.map((entry) => entry.id));
    });

    it("takes a layer from a module of its own without an edit to a shared file", () => {
        const added = layer("brush-cursor", 900);
        const axes = layer("symmetry-axes", 250);
        const layers = collectOverlayLayers({
            "./grid.overlay.ts": { overlayLayers: gridLayers },
            "../tools/brushCursor.overlay.ts": { overlayLayers: [added] },
            "./outline.overlay.ts": { overlayLayers: outlineLayers },
            "../symmetry/axes.overlay.ts": { overlayLayers: [axes] },
        });
        expect(layers.map((entry) => entry.id)).toEqual([
            "document-outline",
            "pixel-grid",
            "symmetry-axes",
            "tile-grid",
            "brush-cursor",
        ]);
    });

    it("draws equal orders by id, whatever the order of the modules", () => {
        const one = collectOverlayLayers({
            "./b.overlay.ts": { overlayLayers: [layer("b", 5)] },
            "./a.overlay.ts": { overlayLayers: [layer("a", 5)] },
        });
        const other = collectOverlayLayers({
            "./a.overlay.ts": { overlayLayers: [layer("a", 5)] },
            "./b.overlay.ts": { overlayLayers: [layer("b", 5)] },
        });
        expect(one.map((entry) => entry.id)).toEqual(["a", "b"]);
        expect(other.map((entry) => entry.id)).toEqual(["a", "b"]);
    });

    it("refuses a module without layers, a layer without id or order, and an id used twice", () => {
        expect(() => collectOverlayLayers({ "./empty.overlay.ts": {} })).toThrow(
            new RegistrationError(
                './empty.overlay.ts does not export "overlayLayers".',
                "./empty.overlay.ts",
            ),
        );
        expect(() =>
            collectOverlayLayers({ "./x.overlay.ts": { overlayLayers: [layer(" ", 1)] } }),
        ).toThrow("A layer of ./x.overlay.ts has no id.");
        expect(() =>
            collectOverlayLayers({ "./x.overlay.ts": { overlayLayers: [layer("x", Number.NaN)] } }),
        ).toThrow('Overlay layer "x" (./x.overlay.ts) has no order.');
        expect(() =>
            collectOverlayLayers({
                "./a.overlay.ts": { overlayLayers: [layer("grid", 1)] },
                "./b.overlay.ts": { overlayLayers: [layer("grid", 2)] },
            }),
        ).toThrow('Overlay layer id "grid" is used by ./a.overlay.ts and ./b.overlay.ts.');
    });
});
