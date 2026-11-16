import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    ADAPTER_ATTEMPTS,
    ADAPTER_TIMED_OUT,
    ADAPTER_TIMEOUT_MS,
    checkWebGpu,
    detectWebGpu,
    initialWebGpuSupport,
} from "../../src/ui/platform/index.ts";
import type { NavigatorLike, WebGpuSupport } from "../../src/ui/platform/index.ts";

// The WebGPU check behind the "WebGPU required" notice (DESIGN §7, SPEC §6, BRIEF D14): 5 s per
// adapter request, one retry, then "unsupported" instead of a blank window. A missing API, a
// missing adapter and a refused request are unsupported too; a resolved adapter passes.

/** A navigator whose adapter requests answer after `delays[n]` ms (`null`: never). */
function navigatorAnswering(delays: (number | null)[], adapter: object | null = {}) {
    const requestAdapter = vi.fn(() => {
        const delay = delays[requestAdapter.mock.calls.length - 1] ?? null;
        return new Promise<object | null>((resolve) => {
            if (delay !== null) setTimeout(() => resolve(adapter), delay);
        });
    });
    const nav: NavigatorLike = { gpu: { requestAdapter } };
    return { nav, requestAdapter };
}

/** Starts the check and records its answer once it settles. */
function start(nav: NavigatorLike) {
    const state: { result: WebGpuSupport | null } = { result: null };
    void checkWebGpu(nav).then((result) => {
        state.result = result;
    });
    return state;
}

describe("WebGPU check time limit", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("limits each request to 5 s and makes one retry", () => {
        expect(ADAPTER_TIMEOUT_MS).toBe(5_000);
        expect(ADAPTER_ATTEMPTS).toBe(2);
    });

    it("ends unsupported with a timeout detail when no adapter request ever settles", async () => {
        const { nav, requestAdapter } = navigatorAnswering([null, null]);
        const check = start(nav);

        await vi.advanceTimersByTimeAsync(ADAPTER_TIMEOUT_MS - 1);
        expect(check.result).toBeNull();
        expect(requestAdapter).toHaveBeenCalledTimes(1);

        // The first limit passes: one retry, still no answer.
        await vi.advanceTimersByTimeAsync(1);
        expect(check.result).toBeNull();
        expect(requestAdapter).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(ADAPTER_TIMEOUT_MS);
        expect(check.result).toEqual({
            status: "unsupported",
            reason: "no-adapter",
            detail: "WebGPU adapter request timed out",
        });
        expect(check.result).toEqual(ADAPTER_TIMED_OUT);
        // No third request.
        await vi.advanceTimersByTimeAsync(ADAPTER_TIMEOUT_MS * 4);
        expect(requestAdapter).toHaveBeenCalledTimes(2);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("is supported when a slow adapter request settles within its limit", async () => {
        const { nav, requestAdapter } = navigatorAnswering([ADAPTER_TIMEOUT_MS - 500]);
        const check = start(nav);

        await vi.advanceTimersByTimeAsync(ADAPTER_TIMEOUT_MS - 501);
        expect(check.result).toBeNull();
        await vi.advanceTimersByTimeAsync(1);
        expect(check.result).toEqual({ status: "supported" });
        expect(requestAdapter).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("is supported when the retry settles", async () => {
        const { nav, requestAdapter } = navigatorAnswering([null, 1_000]);
        const check = start(nav);

        await vi.advanceTimersByTimeAsync(ADAPTER_TIMEOUT_MS + 1_000);
        expect(check.result).toEqual({ status: "supported" });
        expect(requestAdapter).toHaveBeenCalledTimes(2);
    });

    it("takes a late answer of the first request while the retry is pending", async () => {
        const { nav, requestAdapter } = navigatorAnswering([ADAPTER_TIMEOUT_MS + 2_000, null]);
        const check = start(nav);

        await vi.advanceTimersByTimeAsync(ADAPTER_TIMEOUT_MS + 1_999);
        expect(check.result).toBeNull();
        await vi.advanceTimersByTimeAsync(1);
        expect(check.result).toEqual({ status: "supported" });
        expect(requestAdapter).toHaveBeenCalledTimes(2);
    });

    it("passes a settled answer through unchanged", async () => {
        const supported = start(navigatorAnswering([0]).nav);
        const noAdapter = start(navigatorAnswering([0], null).nav);
        const noApi = start({});
        const rejected = start({
            gpu: { requestAdapter: () => Promise.reject(new Error("adapter request blocked")) },
        });

        await vi.advanceTimersByTimeAsync(0);
        expect(supported.result).toEqual({ status: "supported" });
        expect(noAdapter.result).toEqual({ status: "unsupported", reason: "no-adapter" });
        expect(noApi.result).toEqual({ status: "unsupported", reason: "no-api" });
        expect(rejected.result).toEqual({
            status: "unsupported",
            reason: "no-adapter",
            detail: "Error: adapter request blocked",
        });
        expect(vi.getTimerCount()).toBe(0);
    });

    it("takes other limits when given them", async () => {
        const { nav, requestAdapter } = navigatorAnswering([null, null, null]);
        const state: { result: WebGpuSupport | null } = { result: null };
        void checkWebGpu(nav, { timeoutMs: 100, attempts: 3 }).then((result) => {
            state.result = result;
        });

        await vi.advanceTimersByTimeAsync(299);
        expect(state.result).toBeNull();
        await vi.advanceTimersByTimeAsync(1);
        expect(state.result).toEqual(ADAPTER_TIMED_OUT);
        expect(requestAdapter).toHaveBeenCalledTimes(3);
    });
});

describe("WebGPU detection", () => {
    it("reports a missing navigator.gpu without waiting", async () => {
        expect(initialWebGpuSupport({})).toEqual({ status: "unsupported", reason: "no-api" });
        expect(await detectWebGpu({})).toEqual({ status: "unsupported", reason: "no-api" });
    });

    it("checks adapter acquisition when the API exists", async () => {
        const gpu = { requestAdapter: () => Promise.resolve({}) };
        expect(initialWebGpuSupport({ gpu })).toEqual({ status: "checking" });
        expect(await detectWebGpu({ gpu })).toEqual({ status: "supported" });
    });

    it("reports a null adapter as unsupported", async () => {
        const gpu = { requestAdapter: () => Promise.resolve(null) };
        expect(await detectWebGpu({ gpu })).toEqual({
            status: "unsupported",
            reason: "no-adapter",
        });
    });

    it("reports a rejected or throwing adapter request as unsupported, with the error", async () => {
        const rejecting = { requestAdapter: () => Promise.reject(new Error("blocked")) };
        expect(await detectWebGpu({ gpu: rejecting })).toEqual({
            status: "unsupported",
            reason: "no-adapter",
            detail: "Error: blocked",
        });
        const throwing = {
            requestAdapter: (): Promise<object | null> => {
                throw new TypeError("not allowed");
            },
        };
        expect(await detectWebGpu({ gpu: throwing })).toMatchObject({
            status: "unsupported",
            reason: "no-adapter",
        });
        expect(await checkWebGpu({ gpu: throwing })).toMatchObject({
            status: "unsupported",
            reason: "no-adapter",
        });
    });
});
