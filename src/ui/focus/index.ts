// Entry module of `@ngne/editor-ui/focus` (SPEC §4, §6): input modality, inert outside modal
// layers, and the menu opener.

export { inertOutsideModalLayers } from "./inertOutside.js";
export { focusMenuOpener, surfaceOpener, trackMenuOrigins } from "./menuOpener.js";
export { isKeyboardNavigation, trackFocusModality } from "./modality.js";
export type { Modality, ModalityKey } from "./modality.js";
