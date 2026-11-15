import { byOrderThenId, collectEntries } from "../modules.js";
import type { ModuleMap } from "../modules.js";

// Draw-layer registry of the viewport overlay (SPEC §1.3, `*.overlay.ts(x)`). A feature adds
// chrome to the overlay by creating a module named `*.overlay.ts` that exports
// `overlayLayers`; the editor finds it with one `import.meta.glob` line and passes the map, so
// no shared file is edited (RULES 3):
//
//     // src/app/tools/brushCursor.overlay.ts
//     export const overlayLayers: OverlayLayer<OverlayFrame>[] = [
//         { id: "brush-cursor", order: 900, draw: drawBrushCursor, watch: followTool },
//     ];
//
// The frame a layer draws from (canvas context, document, view mapping, cursor, theme) is the
// editor's: the registry is generic over it and keeps order and registration only. Drawing
// stays in the editors.

/**
 * One draw layer of the overlay. The overlay clears its canvas and calls every layer in
 * ascending `order` at each redraw.
 */
export interface OverlayLayer<Frame = unknown> {
    /** Stable and unique: "pixel-grid". */
    id: string;
    /**
     * Position in the stack, ascending: drawn bottom to top. DESIGN §6 gives the draw orders of
     * the suite's chrome: document outline 100, grids 200–300, selection ants 500, pending
     * selection 600, boxes and handles 650–700, cursor 900.
     */
    order: number;
    /** Draws the layer from one redraw's frame. */
    draw(frame: Frame): void;
    /**
     * Follows what the layer draws from, other than the view and the cursor: calls `redraw`
     * whenever that changed (a setting, a selection, the phase of an animation). Called when
     * the overlay is mounted; returns the function that stops following.
     */
    watch?(redraw: () => void): () => void;
}

/** What a `*.overlay.ts(x)` module exports. */
export interface OverlayLayerModule<Frame = unknown> {
    overlayLayers?: readonly OverlayLayer<Frame>[];
}

/**
 * Validates the modules and returns their layers in drawing order, bottom first: by `order`,
 * then by id in UTF-16 code-unit order, so the stack does not depend on module order. Throws a
 * `RegistrationError` naming the module for a missing export, a layer without an id or a
 * finite order, or an id used twice.
 */
export function collectOverlayLayers<Frame>(
    modules: ModuleMap<OverlayLayerModule<Frame>>,
): OverlayLayer<Frame>[] {
    const entries = collectEntries<OverlayLayer<Frame>>(modules, {
        exportName: "overlayLayers",
        list: true,
        noun: "Overlay layer",
        item: "layer",
        key: "id",
        ordered: true,
    });
    return entries.map(({ entry }) => entry).sort(byOrderThenId);
}
