// Entry module of `@ngne/editor-ui/messages` (SPEC §4, §6): the message channels of DESIGN §5
// and their stores.

export {
    commandDialogs,
    createDialogRequests,
    dialogView,
    useDialogRequest,
} from "./dialogRequests.js";
export type {
    DialogRequestBase,
    DialogRequests,
    DialogState,
    DialogView,
} from "./dialogRequests.js";
export { commandDialog } from "./dialogRegistry.js";
export type {
    CommandDialog,
    CommandDialogModule,
    CommandDialogs,
    DialogComponent,
} from "./dialogRegistry.js";
export { DialogHost } from "./DialogHost.js";
export type { DialogHostProps } from "./DialogHost.js";
export { DiscardChangesDialog } from "./DiscardChangesDialog.js";
export type { DiscardAction, DiscardChangesRequest } from "./DiscardChangesDialog.js";
export { createNotices, notices } from "./notices.js";
export type { NoticeKind, NoticeOptions, Notices, NoticeSink } from "./notices.js";
export { RegionBoundary } from "./RegionBoundary.js";
export type { RegionBoundaryProps } from "./RegionBoundary.js";
export { createToastService, INFO_TOAST_MS, toast } from "./toast.js";
export type {
    ToastAction,
    ToastItem,
    ToastKind,
    ToastOptions,
    ToastService,
    ToastState,
} from "./toast.js";
export { ToastViewport } from "./ToastViewport.js";
export { WebGpuRequired } from "./WebGpuRequired.js";
export type { WebGpuRequiredProps } from "./WebGpuRequired.js";
export { WindowTooSmall } from "./WindowTooSmall.js";
export type { WindowTooSmallProps } from "./WindowTooSmall.js";
