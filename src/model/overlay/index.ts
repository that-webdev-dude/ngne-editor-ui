// Entry module of `@ngne/editor-ui/overlay` (SPEC §4, §1.3): the overlay's draw-layer registry
// and the wheel → zoom and pan steps. Pure TypeScript that imports nothing outside src/model
// (SPEC §1.1); drawing stays in the editors.

export { RegistrationError } from "../modules.js";
export { collectOverlayLayers } from "./layers.js";
export type { OverlayLayer, OverlayLayerModule } from "./layers.js";
export { createWheelPan, createWheelZoom, WHEEL_ZOOM_TRAVEL, wheelPixels } from "./wheel.js";
