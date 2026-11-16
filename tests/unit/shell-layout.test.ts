import { describe, expect, it } from "vitest";
import {
    BOTTOM_HEIGHT,
    bottomMaxHeight,
    defaultBottomHeight,
    DOCK_WIDTH,
    isWindowTooSmall,
    MIN_WINDOW_HEIGHT,
    MIN_WINDOW_WIDTH,
    parseStoredLayout,
    railColumns,
    railOneColumnHeight,
    resolveBottomHeight,
    resolveDockWidth,
    storedLayout,
} from "../../src/model/shell/layout.ts";
import { createLayoutStore } from "../../src/ui/shell/layoutStore.ts";
import type { KeyValueStorage } from "../../src/ui/platform/storage.ts";

// The shell's layout maths (DESIGN §2, SPEC §8) under the bottom-region names: the minimum
// window, the dock's and the bottom region's defaults and limits, the rail's column count, and
// the layout record and store, whose stored field keeps the name `timelineHeight` (SPEC §5).

const KEY = "ngne-test-editor.layout";

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & {
    data: Map<string, string>;
} {
    const data = new Map(Object.entries(initial));
    return {
        data,
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => void data.set(key, value),
        removeItem: (key) => void data.delete(key),
    };
}

describe("shell layout (DESIGN §2)", () => {
    it("has the minimum window 1280×720, and shows the too-small notice below it only", () => {
        expect([MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT]).toEqual([1280, 720]);
        expect(isWindowTooSmall(1280, 720)).toBe(false);
        expect(isWindowTooSmall(1440, 900)).toBe(false);
        expect(isWindowTooSmall(1279, 720)).toBe(true);
        expect(isWindowTooSmall(1280, 719)).toBe(true);
        expect(isWindowTooSmall(800, 600)).toBe(true);
    });

    it("defaults the bottom region to min(200 px, 28% of the window height)", () => {
        expect(BOTTOM_HEIGHT).toEqual({
            default: 200,
            defaultFraction: 0.28,
            min: 120,
            maxFraction: 0.5,
        });
        expect(defaultBottomHeight(900)).toBe(200);
        expect(defaultBottomHeight(720)).toBe(200);
        expect(defaultBottomHeight(600)).toBe(168);
    });

    it("keeps the bottom region within 120 px and 50% of the window height", () => {
        expect(bottomMaxHeight(900)).toBe(450);
        expect(bottomMaxHeight(720)).toBe(360);
        // Never below the minimum, however low the window.
        expect(bottomMaxHeight(200)).toBe(120);
        expect(resolveBottomHeight(null, 900)).toBe(200);
        expect(resolveBottomHeight(300, 900)).toBe(300);
        expect(resolveBottomHeight(40, 900)).toBe(120);
        expect(resolveBottomHeight(700, 900)).toBe(450);
        expect(resolveBottomHeight(400, 720)).toBe(360);
    });

    it("keeps the dock within 220 and 360 px, 264 px by default", () => {
        expect(DOCK_WIDTH).toEqual({ default: 264, min: 220, max: 360 });
        expect(resolveDockWidth(null)).toBe(264);
        expect(resolveDockWidth(300)).toBe(300);
        expect(resolveDockWidth(100)).toBe(220);
        expect(resolveDockWidth(900)).toBe(360);
    });

    it("measures the rail's one-column height from its groups and footer", () => {
        // Four groups of 4, 3, 4 and 2 tools.
        expect(railOneColumnHeight([4, 3, 4, 2])).toBe(437);
        expect(railOneColumnHeight([4, 3, 4, 2], 28)).toBe(467);
        expect(railOneColumnHeight([4, 0, 3])).toBe(railOneColumnHeight([4, 3]));
        expect(railOneColumnHeight([])).toBe(16);
        expect(railOneColumnHeight([], 54)).toBe(70);
    });

    it("switches the rail to two columns only when one column does not fit", () => {
        expect(railColumns([4, 3, 4, 2], 0, 640)).toBe(1);
        expect(railColumns([4, 3, 4, 2], 0, 437)).toBe(1);
        expect(railColumns([4, 3, 4, 2], 0, 436)).toBe(2);
        // 1280×720 with the default bottom region leaves the rail 460 px: a footer tips it
        // over, as the sprite editor's colour chips (54 px) do.
        expect(railColumns([4, 3, 4, 2], 0, 460)).toBe(1);
        expect(railColumns([4, 3, 4, 2], 28, 460)).toBe(2);
        expect(railColumns([4, 3, 4, 2], 54, 460)).toBe(2);
    });
});

describe("the layout record", () => {
    it("reads the stored record, timelineHeight as the bottom height, per field", () => {
        expect(parseStoredLayout({ dockWidth: 300, timelineHeight: 240 })).toEqual({
            dockWidth: 300,
            bottomHeight: 240,
        });
        expect(parseStoredLayout({ dockWidth: 300 })).toEqual({
            dockWidth: 300,
            bottomHeight: null,
        });
        expect(parseStoredLayout({ dockWidth: "wide", timelineHeight: -5 })).toEqual({
            dockWidth: null,
            bottomHeight: null,
        });
        // The public name is not a stored field: only `timelineHeight` is read.
        expect(parseStoredLayout({ bottomHeight: 240 })).toEqual({
            dockWidth: null,
            bottomHeight: null,
        });
        for (const value of [undefined, null, 7, "x", [], { dockWidth: Number.NaN }]) {
            expect(parseStoredLayout(value)).toEqual({ dockWidth: null, bottomHeight: null });
        }
    });

    it("writes the record with the stored field names unchanged", () => {
        expect(storedLayout({ dockWidth: 312, bottomHeight: 260 })).toEqual({
            dockWidth: 312,
            timelineHeight: 260,
        });
        expect(parseStoredLayout(storedLayout({ dockWidth: null, bottomHeight: 130 }))).toEqual({
            dockWidth: null,
            bottomHeight: 130,
        });
    });
});

describe("the layout store", () => {
    it("starts from defaults with an empty or corrupt store", () => {
        expect(createLayoutStore(memoryStorage(), KEY).getState()).toMatchObject({
            dockWidth: null,
            bottomHeight: null,
        });
        const corrupt = memoryStorage({ [KEY]: "{not json" });
        expect(createLayoutStore(corrupt, KEY).getState()).toMatchObject({
            dockWidth: null,
            bottomHeight: null,
        });
        expect(createLayoutStore(null, KEY).getState().dockWidth).toBeNull();
    });

    it("writes every change and restores it in a new store", () => {
        const storage = memoryStorage();
        const store = createLayoutStore(storage, KEY);
        store.getState().setDockWidth(312);
        store.getState().setBottomHeight(260);
        expect(JSON.parse(storage.data.get(KEY) ?? "")).toEqual({
            dockWidth: 312,
            timelineHeight: 260,
        });
        expect(createLayoutStore(storage, KEY).getState()).toMatchObject({
            dockWidth: 312,
            bottomHeight: 260,
        });

        store.getState().setDockWidth(null);
        expect(JSON.parse(storage.data.get(KEY) ?? "")).toEqual({
            dockWidth: null,
            timelineHeight: 260,
        });
        expect(createLayoutStore(storage, KEY).getState()).toMatchObject({
            dockWidth: null,
            bottomHeight: 260,
        });
    });

    it("keeps working when the store rejects writes", () => {
        const storage = memoryStorage();
        storage.setItem = () => {
            throw new Error("quota");
        };
        const store = createLayoutStore(storage, KEY);
        store.getState().setDockWidth(300);
        store.getState().setBottomHeight(240);
        expect(store.getState()).toMatchObject({ dockWidth: 300, bottomHeight: 240 });
    });
});
