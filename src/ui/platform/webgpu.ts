import { useEffect, useState } from "react";

/**
 * WebGPU availability for the "WebGPU required" notice (DESIGN §7, SPEC §6). The engine is not
 * involved: only `navigator.gpu` and adapter acquisition are probed, so nothing here imports
 * `@ngne/core` (BRIEF D2). The browser's `requestAdapter()` can stay pending for good, so the
 * check limits each request to 5 s, with one retry; without the limit the editor would show
 * nothing (BRIEF D14).
 */
export type WebGpuSupport =
    | { status: "checking" }
    | { status: "supported" }
    | { status: "unsupported"; reason: "no-api" | "no-adapter"; detail?: string };

// The DOM library of the pinned TypeScript has no WebGPU types; only these fields are read.
interface GpuLike {
    requestAdapter(): Promise<object | null>;
}
export interface NavigatorLike {
    gpu?: GpuLike;
}

const NO_API: WebGpuSupport = { status: "unsupported", reason: "no-api" };

/** How long one adapter request may take before it is retried or given up. */
export const ADAPTER_TIMEOUT_MS = 5_000;
/** Adapter requests made before the check gives up: the first and one retry. */
export const ADAPTER_ATTEMPTS = 2;

export const ADAPTER_TIMED_OUT: WebGpuSupport = {
    status: "unsupported",
    reason: "no-adapter",
    detail: "WebGPU adapter request timed out",
};

export interface WebGpuCheckLimits {
    timeoutMs?: number;
    attempts?: number;
}

/** The answer available without waiting: missing API, or still to be checked. */
export function initialWebGpuSupport(nav: NavigatorLike): WebGpuSupport {
    return nav.gpu ? { status: "checking" } : NO_API;
}

/** Resolves once adapter acquisition has succeeded or failed, with no time limit. Never rejects. */
export async function detectWebGpu(nav: NavigatorLike): Promise<WebGpuSupport> {
    const gpu = nav.gpu;
    if (!gpu) return NO_API;
    try {
        const adapter = await gpu.requestAdapter();
        return adapter ? { status: "supported" } : { status: "unsupported", reason: "no-adapter" };
    } catch (error) {
        return { status: "unsupported", reason: "no-adapter", detail: String(error) };
    }
}

const PENDING = Symbol("pending");

/** `promise`'s value, or `PENDING` once `ms` have passed without one. */
function within<T>(promise: Promise<T>, ms: number): Promise<T | typeof PENDING> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limit = new Promise<typeof PENDING>((resolve) => {
        timer = setTimeout(() => resolve(PENDING), ms);
    });
    return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

/**
 * `detectWebGpu` with a time limit per adapter request. A request still pending at its limit is
 * retried; an earlier request that answers late still counts. When none has answered after the
 * last attempt, WebGPU counts as unsupported (`ADAPTER_TIMED_OUT`). Never rejects.
 */
export async function checkWebGpu(
    nav: NavigatorLike,
    { timeoutMs = ADAPTER_TIMEOUT_MS, attempts = ADAPTER_ATTEMPTS }: WebGpuCheckLimits = {},
): Promise<WebGpuSupport> {
    const requests: Promise<WebGpuSupport>[] = [];
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        requests.push(detectWebGpu(nav));
        const result = await within(Promise.race(requests), timeoutMs);
        if (result !== PENDING) return result;
    }
    return ADAPTER_TIMED_OUT;
}

/** The browser's WebGPU support, from `checkWebGpu` with its time limit. */
export function useWebGpuSupport(): WebGpuSupport {
    const [support, setSupport] = useState<WebGpuSupport>(() =>
        initialWebGpuSupport(navigator as NavigatorLike),
    );
    useEffect(() => {
        let live = true;
        void checkWebGpu(navigator as NavigatorLike).then((result) => {
            if (live) setSupport(result);
        });
        return () => {
            live = false;
        };
    }, []);
    return support;
}
