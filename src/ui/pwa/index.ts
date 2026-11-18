// Entry module of `@ngne/editor-ui/pwa` (SPEC §4, §10): the page's update flow and toast, and
// the precache logic the worker runs, every name from the editor's id.

export {
    cacheName,
    cacheable,
    isOwnCache,
    mayDeleteStale,
    olderFile,
    precacheUrls,
    pwaNames,
    route,
    searchOrder,
    staleCaches,
    uniqueEntries,
} from "../../model/pwa/precache.js";
export type {
    PrecacheEntry,
    PwaNames,
    RequestLike,
    ResponseLike,
    Route,
} from "../../model/pwa/precache.js";
export { showUpdateToast, UPDATE_MESSAGE } from "./updateToast.js";
export { registerAppUpdates, RELOAD_KEPT_MS, UPDATE_CHECK_MS } from "./updates.js";
export type {
    AppUpdateOptions,
    AppUpdates,
    ContainerLike,
    RegistrationLike,
    UpdateState,
    WorkerLike,
} from "./updates.js";
