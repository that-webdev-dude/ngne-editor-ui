// Entry module of `@ngne/editor-ui/colour` (SPEC §4): colour maths with no domain meaning
// (BRIEF D12). Pure TypeScript that imports nothing outside src/colour (SPEC §1.1).

export { BLACK, contrastRatio, labelColourOn, relativeLuminance, WHITE } from "./contrast.js";
export type { LabelColour } from "./contrast.js";
export { formatHex, parseHex } from "./hex.js";
export { formatHexColour, parseHexColour } from "./hexColour.js";
export { hsvToRgb, rgbToHsv } from "./hsv.js";
export type { Hsv, Rgb } from "./hsv.js";
export { oklabToSrgb8, srgb8ToOklab, writeOklab } from "./oklab.js";
export type { Oklab } from "./oklab.js";
export { packRgba, unpackRgba } from "./rgba.js";
export type { Rgba } from "./rgba.js";
