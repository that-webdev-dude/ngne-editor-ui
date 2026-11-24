import { describe, expect, it } from "vitest";
import {
    fittingOptions,
    optionControl,
    optionValue,
    optionValues,
} from "../../src/model/tools/options.ts";
import type { ToolOptionSpec } from "../../src/model/tools/types.ts";

// The option specs of a tool as the context bar shows them (SPEC §8, DESIGN §2, §4): each kind
// in its control, the value each takes for what the editor's store holds, and how many fit the
// bar before the rest move into the overflow menu.

const size: ToolOptionSpec = {
    key: "size",
    label: "Size",
    kind: "number",
    min: 1,
    max: 64,
    unit: "px",
    default: 8,
};
const perfect: ToolOptionSpec = {
    key: "perfect",
    label: "Pixel perfect",
    kind: "toggle",
    default: true,
};
const choices = [
    { value: "round", label: "Round" },
    { value: "square", label: "Square" },
] as const;
const shape: ToolOptionSpec = {
    key: "shape",
    label: "Shape",
    kind: "choice",
    choices,
    default: "round",
};
const blend: ToolOptionSpec = {
    key: "blend",
    label: "Blend",
    kind: "choice",
    display: "select",
    choices: [
        { value: "normal", label: "Normal" },
        { value: "multiply", label: "Multiply" },
    ],
    default: "normal",
};

describe("option controls", () => {
    it("map each kind to its control", () => {
        expect([size, perfect, shape, blend].map(optionControl)).toEqual([
            "number",
            "toggle",
            "segmented",
            "select",
        ]);
    });

    it("show a choice as a segmented control unless it asks for a select", () => {
        expect(optionControl({ ...shape, display: "segmented" } as ToolOptionSpec)).toBe(
            "segmented",
        );
        expect(optionControl({ ...shape, display: "select" } as ToolOptionSpec)).toBe("select");
    });
});

describe("option values", () => {
    it("take what the store holds when the option can take it", () => {
        expect(optionValue(size, 12)).toBe(12);
        expect(optionValue(perfect, false)).toBe(false);
        expect(optionValue(shape, "square")).toBe("square");
        expect(optionValue(blend, "multiply")).toBe("multiply");
    });

    it("clamp a number to the option's range", () => {
        expect(optionValue(size, 0)).toBe(1);
        expect(optionValue(size, 1000)).toBe(64);
    });

    it("read anything else as the default", () => {
        for (const stored of [undefined, null, "12", Number.NaN, Infinity, {}]) {
            expect(optionValue(size, stored)).toBe(8);
        }
        expect(optionValue(perfect, "yes")).toBe(true);
        expect(optionValue(shape, "triangle")).toBe("round");
        expect(optionValue(blend, 1)).toBe("normal");
    });

    it("give every option of a tool its value, by key", () => {
        expect(optionValues([size, perfect, shape, blend])).toEqual({
            size: 8,
            perfect: true,
            shape: "round",
            blend: "normal",
        });
        expect(
            optionValues([size, perfect, shape, blend], {
                size: 99,
                shape: "square",
                other: "kept out",
            }),
        ).toEqual({ size: 64, perfect: true, shape: "square", blend: "normal" });
        expect(optionValues([])).toEqual({});
    });
});

describe("options that fit the context bar", () => {
    // Options 100 px wide, a 12 px gap before each and before the 24 px trigger; the bar's
    // other items take 50 px.
    const widths = [100, 100, 100, 100];

    it("are all of them when they fit without the trigger", () => {
        // 50 + 4 × 112 = 498.
        expect(fittingOptions(widths, 498, 50, 12, 24)).toBe(4);
        expect(fittingOptions(widths, 1000, 50, 12, 24)).toBe(4);
    });

    it("leave room for the trigger when any is left over", () => {
        // Three take 386 and the trigger 36 more: 422.
        expect(fittingOptions(widths, 497, 50, 12, 24)).toBe(3);
        expect(fittingOptions(widths, 422, 50, 12, 24)).toBe(3);
        expect(fittingOptions(widths, 421, 50, 12, 24)).toBe(2);
    });

    it("are none when not even the first fits beside the trigger", () => {
        expect(fittingOptions(widths, 100, 50, 12, 24)).toBe(0);
        expect(fittingOptions([], 100, 50, 12, 24)).toBe(0);
    });

    it("keep their order: a narrow option after a wide one does not jump ahead", () => {
        expect(fittingOptions([300, 20, 20], 300, 0, 0, 24)).toBe(0);
    });

    it("count the command buttons after the options, each after its own space", () => {
        // Two options, then three 60 px buttons 2 px apart: 50 + 2 × 112 + 72 + 2 × 62 = 470.
        const items = [100, 100, 60, 60, 60];
        const leading = [undefined, undefined, undefined, 2, 2];
        expect(fittingOptions(items, 470, 50, 12, 24, leading)).toBe(5);
        // The last button moves first: four take 408 and the trigger 36 more.
        expect(fittingOptions(items, 469, 50, 12, 24, leading)).toBe(4);
        expect(fittingOptions(items, 444, 50, 12, 24, leading)).toBe(4);
        expect(fittingOptions(items, 443, 50, 12, 24, leading)).toBe(3);
        // Without their own spaces each takes the bar's gap: 50 + 5 × 12 + 380 = 490.
        expect(fittingOptions(items, 490, 50, 12, 24)).toBe(5);
        expect(fittingOptions(items, 489, 50, 12, 24)).toBe(4);
    });
});
