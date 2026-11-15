import { describe, expect, it } from "vitest";
import { formatHexColour, parseHexColour } from "../../src/colour/index.ts";

// The `#rrggbb` text format of `@ngne/editor-ui/colour` (SPEC §4): writing an opaque colour
// 0xRRGGBB and reading typed text back.

describe("hex colour text", () => {
    it("writes a colour as #rrggbb", () => {
        expect(formatHexColour(0x3a3a3a)).toBe("#3a3a3a");
        expect(formatHexColour(0)).toBe("#000000");
        expect(formatHexColour(0xff)).toBe("#0000ff");
        expect(formatHexColour(0xffffff)).toBe("#ffffff");
    });

    it("reads #rrggbb, rrggbb and the short form, in either case", () => {
        expect(parseHexColour("#3a3a3a")).toBe(0x3a3a3a);
        expect(parseHexColour("C8C8C8")).toBe(0xc8c8c8);
        expect(parseHexColour(" #FfFfFf ")).toBe(0xffffff);
        expect(parseHexColour("#1af")).toBe(0x11aaff);
        expect(parseHexColour("000")).toBe(0);
    });

    it("rejects text that is not a colour", () => {
        for (const text of ["", "#", "#12", "#12345", "#1234567", "red", "#gggggg", "12 34 56"]) {
            expect(parseHexColour(text), text).toBeNull();
        }
    });

    it("round-trips every colour it writes", () => {
        for (const colour of [0, 1, 0x00ff00, 0x4a4a4a, 0xabcdef, 0xffffff]) {
            expect(parseHexColour(formatHexColour(colour))).toBe(colour);
        }
    });
});
