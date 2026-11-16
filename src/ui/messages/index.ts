// Entry module of `@ngne/editor-ui/messages` (SPEC §4, §6).

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
export { createNotices, notices } from "./notices.js";
export type { NoticeKind, NoticeOptions, Notices, NoticeSink } from "./notices.js";
export { createToastService, INFO_TOAST_MS, toast } from "./toast.js";
export type {
    ToastAction,
    ToastItem,
    ToastKind,
    ToastOptions,
    ToastService,
    ToastState,
} from "./toast.js";
