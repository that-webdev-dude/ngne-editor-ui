import type { ToolOptionSpec, ToolOptionValue } from "./types.js";

// The values of a tool's options and the controls the context bar shows them in (SPEC §8,
// DESIGN §2, §4). The editor's active-tool store keeps what the user set, by option key;
// everything else is the option's default. A stored value the option cannot take (another type,
// out of range, a choice that no longer exists) reads as the nearest value it can take, or as
// the default. Pure: no store.

/** The control an option is shown in (DESIGN §4). */
export type ToolOptionControl = "number" | "toggle" | "segmented" | "select";

/**
 * The control of `option`: a number field for a number, a text toggle for on or off, a
 * segmented control for a choice, or a select for a choice that asks for one (`display`).
 */
export function optionControl(option: ToolOptionSpec): ToolOptionControl {
    switch (option.kind) {
        case "number":
            return "number";
        case "toggle":
            return "toggle";
        case "choice":
            return option.display === "select" ? "select" : "segmented";
    }
}

/** The value `option` takes for `stored`, which may be anything. */
export function optionValue(option: ToolOptionSpec, stored: unknown): ToolOptionValue {
    switch (option.kind) {
        case "number": {
            if (typeof stored !== "number" || !Number.isFinite(stored)) return option.default;
            return Math.min(option.max, Math.max(option.min, stored));
        }
        case "toggle":
            return typeof stored === "boolean" ? stored : option.default;
        case "choice":
            return option.choices.some((choice) => choice.value === stored)
                ? (stored as string)
                : option.default;
    }
}

/** Every option of a tool with its value, by key; `stored` is what the user set, by key. */
export function optionValues(
    options: readonly ToolOptionSpec[],
    stored?: Readonly<Record<string, unknown>>,
): Record<string, ToolOptionValue> {
    const values: Record<string, ToolOptionValue> = {};
    for (const option of options) values[option.key] = optionValue(option, stored?.[option.key]);
    return values;
}

/**
 * How many of a tool's options and command buttons, in that order, the context bar shows
 * (DESIGN §2): the most, in order, that fit `available` with room for the overflow menu's
 * trigger when any is left over; the rest move into that menu. `widths` are the items' widths,
 * `used` the width the bar's other items take with their gaps, `gap` the space before the
 * trigger and before each item that `leading` gives no space of its own (a command button
 * after another, in their tighter group).
 */
export function fittingOptions(
    widths: readonly number[],
    available: number,
    used: number,
    gap: number,
    trigger: number,
    leading: readonly (number | undefined)[] = [],
): number {
    let total = used;
    for (const [index, width] of widths.entries()) {
        total += (leading[index] ?? gap) + width;
        const rest = index + 1 < widths.length ? gap + trigger : 0;
        if (total + rest > available) return index;
    }
    return widths.length;
}
