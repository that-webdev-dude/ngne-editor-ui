// Entry module of `@ngne/editor-ui/primitives` (SPEC §4, §9.1): the primitives of DESIGN §4.
// Every primitive needs `UiRoot` above it, or at least a `TooltipProvider`.

export { Button } from "./Button.js";
export type { ButtonProps } from "./Button.js";
export { ContextMenu } from "./ContextMenu.js";
export type { ContextMenuEntry, ContextMenuProps } from "./ContextMenu.js";
export { cx } from "./cx.js";
export { Dialog } from "./Dialog.js";
export type { DialogProps } from "./Dialog.js";
export { Icon, ICON_SIZE, ICON_STROKE } from "./Icon.js";
export { IconButton } from "./IconButton.js";
export type { IconButtonProps } from "./IconButton.js";
export { NumberField } from "./NumberField.js";
export type { NumberFieldProps } from "./NumberField.js";
export { Popover } from "./Popover.js";
export type { PopoverProps } from "./Popover.js";
export { SegmentedControl } from "./SegmentedControl.js";
export type { SegmentedControlProps, SegmentedOption } from "./SegmentedControl.js";
export { Select } from "./Select.js";
export type { SelectOption, SelectProps } from "./Select.js";
export { Slider } from "./Slider.js";
export type { SliderProps } from "./Slider.js";
export { Splitter } from "./Splitter.js";
export type { SplitterProps } from "./Splitter.js";
export { Toggle } from "./Toggle.js";
export type { ToggleProps } from "./Toggle.js";
export { ToolButton } from "./ToolButton.js";
export type { ToolButtonProps } from "./ToolButton.js";
export { Tooltip, TooltipProvider, TOOLTIP_DELAY_MS } from "./Tooltip.js";
export type { TooltipProps } from "./Tooltip.js";
export { useClosingPopover } from "./useClosingPopover.js";
export type { ClosingPopover } from "./useClosingPopover.js";
