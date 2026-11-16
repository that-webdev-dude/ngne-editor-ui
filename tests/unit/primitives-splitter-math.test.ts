import { describe, expect, it } from "vitest";
import { resizeByDrag, resizeByKey } from "../../src/ui/primitives/splitterMath.ts";
import type { SplitterAxis } from "../../src/ui/primitives/splitterMath.ts";

// The size rules of the splitter (DESIGN §2, §4): drag along its axis, arrow keys the way they
// point, Home and End to the limits, clamped to the pane's range.

describe("splitter sizes (DESIGN §4)", () => {
    const dock: SplitterAxis = { orientation: "vertical", growth: -1, min: 220, max: 360 };
    const bottom: SplitterAxis = { orientation: "horizontal", growth: -1, min: 120, max: 360 };
    const pane: SplitterAxis = { orientation: "vertical", growth: 1, min: 80, max: 320 };

    it("follows the pointer and stops at the limits", () => {
        expect(resizeByDrag(264, -30, dock)).toBe(294);
        expect(resizeByDrag(264, 30, dock)).toBe(234);
        expect(resizeByDrag(264, -500, dock)).toBe(360);
        expect(resizeByDrag(264, 500, dock)).toBe(220);
        expect(resizeByDrag(160, 12.4, pane)).toBe(172);
    });

    it("moves the line the way the arrow key points", () => {
        expect(resizeByKey(264, "ArrowLeft", dock)).toBe(272);
        expect(resizeByKey(264, "ArrowRight", dock)).toBe(256);
        expect(resizeByKey(200, "ArrowUp", bottom)).toBe(208);
        expect(resizeByKey(200, "ArrowDown", bottom)).toBe(192);
        expect(resizeByKey(160, "ArrowRight", pane)).toBe(168);
        expect(resizeByKey(160, "ArrowRight", pane, true)).toBe(192);
    });

    it("goes to the limits with Home and End and ignores other keys", () => {
        expect(resizeByKey(264, "Home", dock)).toBe(220);
        expect(resizeByKey(264, "End", dock)).toBe(360);
        expect(resizeByKey(264, "ArrowUp", dock)).toBeNull();
        expect(resizeByKey(200, "ArrowLeft", bottom)).toBeNull();
        expect(resizeByKey(264, "a", dock)).toBeNull();
    });
});
