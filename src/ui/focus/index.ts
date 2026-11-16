// Entry module of `@ngne/editor-ui/focus` (SPEC §4, §6): input modality, inert outside modal
// layers, the menu opener, and return focus to the viewport target.

export { inertOutsideModalLayers } from "./inertOutside.js";
export { focusMenuOpener, surfaceOpener, trackMenuOrigins } from "./menuOpener.js";
export { isKeyboardNavigation, trackFocusModality } from "./modality.js";
export type { Modality, ModalityKey } from "./modality.js";
export {
    focusReturningControl,
    focusReturningSelect,
    KEEP_FOCUS_ATTRIBUTE,
    panelSelector,
    returnFocusToViewport,
} from "./returnFocus.js";
export type { ControlElement } from "./returnFocus.js";
