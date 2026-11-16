// Entry module of `@ngne/editor-ui/platform` (SPEC §4, §6).

export {
    browserStorage,
    createStorageFailures,
    readItem,
    readJson,
    STORAGE_WRITE_FAILED_MESSAGE,
    storageFailures,
    writeItem,
} from "./storage.js";
export type { KeyValueStorage, StorageFailures } from "./storage.js";
export { useWindowHeight, useWindowWidth } from "./useWindowSize.js";
export {
    ADAPTER_ATTEMPTS,
    ADAPTER_TIMED_OUT,
    ADAPTER_TIMEOUT_MS,
    checkWebGpu,
    detectWebGpu,
    initialWebGpuSupport,
    useWebGpuSupport,
} from "./webgpu.js";
export type { NavigatorLike, WebGpuCheckLimits, WebGpuSupport } from "./webgpu.js";
