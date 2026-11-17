import { describe, expect, it } from "vitest";
import {
    dragMoveIndex,
    indexAfterClose,
    keyboardMoveIndex,
    tabFocusIndex,
} from "../../src/model/shell/tabOrder.ts";

// The tab strip's index maths (SPEC §8, DESIGN §2): the place Ctrl+Shift+← / → and a drag move
// a tab to (first, last, past the ends), where the arrow keys, Home and End move the focus, and
// which tab takes the focus after Delete.

describe("keyboard move (Ctrl+Shift+← / →)", () => {
    it("moves a middle tab one place either way", () => {
        expect(keyboardMoveIndex(2, 5, -1)).toBe(1);
        expect(keyboardMoveIndex(2, 5, 1)).toBe(3);
    });

    it("moves the first tab right, and not past the start", () => {
        expect(keyboardMoveIndex(0, 5, 1)).toBe(1);
        expect(keyboardMoveIndex(0, 5, -1)).toBeNull();
    });

    it("moves the last tab left, and not past the end", () => {
        expect(keyboardMoveIndex(4, 5, -1)).toBe(3);
        expect(keyboardMoveIndex(4, 5, 1)).toBeNull();
    });

    it("moves a lone tab nowhere", () => {
        expect(keyboardMoveIndex(0, 1, -1)).toBeNull();
        expect(keyboardMoveIndex(0, 1, 1)).toBeNull();
    });

    it("moves no tab that is not in the strip", () => {
        expect(keyboardMoveIndex(-1, 3, 1)).toBeNull();
        expect(keyboardMoveIndex(3, 3, -1)).toBeNull();
    });
});

describe("drag move", () => {
    // The middles of the other tabs, 100 px apart.
    const middles = [50, 150, 250, 350];

    it("takes the first place before the first tab's middle", () => {
        expect(dragMoveIndex(middles, 49)).toBe(0);
        expect(dragMoveIndex(middles, 50)).toBe(0);
    });

    it("takes the place after each middle the pointer has passed", () => {
        expect(dragMoveIndex(middles, 51)).toBe(1);
        expect(dragMoveIndex(middles, 200)).toBe(2);
        expect(dragMoveIndex(middles, 300)).toBe(3);
    });

    it("takes the last place past the last tab's middle", () => {
        expect(dragMoveIndex(middles, 351)).toBe(4);
    });

    it("keeps to the first and last place past the strip's ends", () => {
        expect(dragMoveIndex(middles, -1000)).toBe(0);
        expect(dragMoveIndex(middles, 10_000)).toBe(middles.length);
    });

    it("gives a lone tab its own place", () => {
        expect(dragMoveIndex([], 0)).toBe(0);
        expect(dragMoveIndex([], 500)).toBe(0);
    });
});

describe("focus keys (← → Home End)", () => {
    it("moves one tab along, wrapping at the ends", () => {
        expect(tabFocusIndex("ArrowRight", 1, 4)).toBe(2);
        expect(tabFocusIndex("ArrowLeft", 1, 4)).toBe(0);
        expect(tabFocusIndex("ArrowRight", 3, 4)).toBe(0);
        expect(tabFocusIndex("ArrowLeft", 0, 4)).toBe(3);
    });

    it("goes to the first and last tab", () => {
        expect(tabFocusIndex("Home", 2, 4)).toBe(0);
        expect(tabFocusIndex("End", 0, 4)).toBe(3);
    });

    it("has nowhere to go without tabs", () => {
        expect(tabFocusIndex("ArrowRight", 0, 0)).toBeNull();
        expect(tabFocusIndex("End", 0, 0)).toBeNull();
    });
});

describe("focus after Delete", () => {
    it("goes to the tab now in the closed one's place", () => {
        expect(indexAfterClose(0, 3)).toBe(0);
        expect(indexAfterClose(1, 3)).toBe(1);
    });

    it("goes to the tab before it when the last tab closed", () => {
        expect(indexAfterClose(3, 3)).toBe(2);
    });

    it("goes to no tab when none remains", () => {
        expect(indexAfterClose(0, 0)).toBeNull();
    });
});
