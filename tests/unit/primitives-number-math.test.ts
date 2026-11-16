import { describe, expect, it } from "vitest";
import {
    formatNumber,
    normalizeNumber,
    parseNumber,
    scrubNumber,
    stepNumber,
} from "../../src/ui/primitives/numberMath.ts";

// The value rules of the number field (DESIGN §4): arrow keys ±1 step, Shift ±10, scrubbing by
// dragging the label, clamping to the range, typed text, and a precision beside the step.

describe("number field values (DESIGN §4)", () => {
    const range = { min: 1, max: 64 };

    it("steps by 1 with the arrow keys and by 10 with Shift", () => {
        expect(stepNumber(8, 1, range)).toBe(9);
        expect(stepNumber(8, -1, range)).toBe(7);
        expect(stepNumber(8, 1, range, true)).toBe(18);
        expect(stepNumber(8, -1, range, true)).toBe(1);
    });

    it("stays inside the range", () => {
        expect(stepNumber(64, 1, range)).toBe(64);
        expect(stepNumber(1, -1, range)).toBe(1);
        expect(normalizeNumber(500, range)).toBe(64);
        expect(normalizeNumber(-3, {})).toBe(-3);
    });

    it("uses the step size and keeps its decimals", () => {
        const half = { min: 0, max: 2, step: 0.5 };
        expect(stepNumber(0.5, 1, half)).toBe(1);
        expect(stepNumber(0.5, 1, half, true)).toBe(2);
        expect(stepNumber(0.1, 2, { step: 0.1 })).toBe(0.3);
        expect(formatNumber(1, half)).toBe("1.0");
        expect(formatNumber(12, {})).toBe("12");
    });

    it("scrubs one step per two pixels of label drag, ten with Shift", () => {
        expect(scrubNumber(10, 0, range)).toBe(10);
        expect(scrubNumber(10, 1, range)).toBe(10);
        expect(scrubNumber(10, 20, range)).toBe(20);
        expect(scrubNumber(10, -6, range)).toBe(7);
        expect(scrubNumber(10, 4, range, true)).toBe(30);
        expect(scrubNumber(10, 4000, range)).toBe(64);
    });

    it("parses typed text and rejects what is not a number", () => {
        expect(parseNumber(" 12 ", range)).toBe(12);
        expect(parseNumber("200", range)).toBe(64);
        expect(parseNumber("2.6", range)).toBe(3);
        expect(parseNumber("0,5", { step: 0.5 })).toBe(0.5);
        expect(parseNumber("", range)).toBeNull();
        expect(parseNumber("12px", range)).toBeNull();
        expect(parseNumber("Infinity", range)).toBeNull();
    });
});

describe("a number field with more decimals than its step", () => {
    // Four decimals kept on entry, arrow keys stepping by 0.01: `precision` beside `step`.
    const FINE = { min: 0, max: 1, step: 0.01, precision: 4 };

    it("keeps four decimals of a typed value: 0.9688 stays 0.9688", () => {
        expect(parseNumber("0.9688", FINE)).toBe(0.9688);
        expect(parseNumber("0,96875", FINE)).toBe(0.9688);
        expect(parseNumber("0.123449", FINE)).toBe(0.1234);
        expect(normalizeNumber(2, FINE)).toBe(1);
    });

    it("steps by 0.01 with the arrow keys and by 0.1 with Shift, from a value of four decimals", () => {
        expect(stepNumber(0.9688, -1, FINE)).toBe(0.9588);
        expect(stepNumber(0.5, 1, FINE)).toBe(0.51);
        expect(stepNumber(0.9688, 1, FINE, true)).toBe(1);
    });

    it("shows the step's decimals at least and as many more as the value has", () => {
        expect(formatNumber(0.5, FINE)).toBe("0.50");
        expect(formatNumber(1, FINE)).toBe("1.00");
        expect(formatNumber(0.25, FINE)).toBe("0.25");
        expect(formatNumber(0.9688, FINE)).toBe("0.9688");
        expect(formatNumber(0.125, FINE)).toBe("0.125");
        expect(formatNumber(3.5, { step: 1, precision: 2 })).toBe("3.5");
        expect(formatNumber(3, { step: 1, precision: 2 })).toBe("3");
    });

    it("without a precision, nothing changes: the step's decimals", () => {
        const hundredths = { min: 0, max: 1, step: 0.01 };
        expect(parseNumber("0.9688", hundredths)).toBe(0.97);
        expect(formatNumber(0.5, hundredths)).toBe("0.50");
        expect(formatNumber(12, {})).toBe("12");
    });
});
