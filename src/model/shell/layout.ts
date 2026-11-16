// The shell's geometry (DESIGN §2, SPEC §8), free of the DOM so it runs under unit tests. All
// values are CSS pixels. The fixed region sizes are repeated in src/ui/shell/shell.css. The
// bottom region is called "bottom" here; only the stored field of the layout record keeps the
// name both editors persist, `timelineHeight` (SPEC §5).

export const MIN_WINDOW_WIDTH = 1280;
export const MIN_WINDOW_HEIGHT = 720;

/** The right dock: 264 px, resizable 220–360 px. */
export const DOCK_WIDTH = { default: 264, min: 220, max: 360 } as const;

/** The bottom region: min(200 px, 28% of the window height), resizable 120 px–50%. */
export const BOTTOM_HEIGHT = {
    default: 200,
    /** The default is this fraction of the window height when that is less than `default`. */
    defaultFraction: 0.28,
    min: 120,
    /** Upper limit as a fraction of the window height. */
    maxFraction: 0.5,
} as const;

/** Tool rail metrics; they match the rail rules of shell.css. */
export const RAIL = {
    button: 28,
    gap: 2,
    padding: 8,
    /** A separator: 1 px line with 4 px margin on both sides. */
    separator: 9,
} as const;

/** The sizes the user chose with the splitters; null means the default. */
export interface LayoutSizes {
    readonly dockWidth: number | null;
    readonly bottomHeight: number | null;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Below the minimum window the shell shows a notice instead of the layout. */
export function isWindowTooSmall(width: number, height: number): boolean {
    return width < MIN_WINDOW_WIDTH || height < MIN_WINDOW_HEIGHT;
}

/** The tallest bottom region: half the window height, and never below the minimum. */
export function bottomMaxHeight(windowHeight: number): number {
    return Math.max(BOTTOM_HEIGHT.min, Math.floor(windowHeight * BOTTOM_HEIGHT.maxFraction));
}

/** min(200 px, 28% of the window height). */
export function defaultBottomHeight(windowHeight: number): number {
    return Math.min(
        BOTTOM_HEIGHT.default,
        Math.floor(windowHeight * BOTTOM_HEIGHT.defaultFraction),
    );
}

/** The bottom region height to render: the stored or default height within 120 px–50%. */
export function resolveBottomHeight(stored: number | null, windowHeight: number): number {
    return clamp(
        stored ?? defaultBottomHeight(windowHeight),
        BOTTOM_HEIGHT.min,
        bottomMaxHeight(windowHeight),
    );
}

/** The dock width to render: the stored or default width within 220–360 px. */
export function resolveDockWidth(stored: number | null): number {
    return clamp(stored ?? DOCK_WIDTH.default, DOCK_WIDTH.min, DOCK_WIDTH.max);
}

/**
 * Reads a stored layout record, `{ dockWidth, timelineHeight }` as both editors store it;
 * anything malformed falls back to the default per field.
 */
export function parseStoredLayout(value: unknown): LayoutSizes {
    const record = (typeof value === "object" && value !== null ? value : {}) as Record<
        string,
        unknown
    >;
    const size = (field: unknown) =>
        typeof field === "number" && Number.isFinite(field) && field > 0 ? field : null;
    return { dockWidth: size(record.dockWidth), bottomHeight: size(record.timelineHeight) };
}

/** The record `parseStoredLayout` reads: the stored field names are unchanged (SPEC §5). */
export function storedLayout(sizes: LayoutSizes): {
    dockWidth: number | null;
    timelineHeight: number | null;
} {
    return { dockWidth: sizes.dockWidth, timelineHeight: sizes.bottomHeight };
}

/**
 * Height the rail content needs in one column: `groupSizes` tool buttons per group, separators
 * between groups, and an optional footer of `footerHeight` (SPEC §5 `railFooterHeight`).
 */
export function railOneColumnHeight(groupSizes: readonly number[], footerHeight = 0): number {
    const groups = groupSizes.filter((size) => size > 0);
    const buttons = groups.reduce(
        (sum, size) => sum + size * RAIL.button + (size - 1) * RAIL.gap,
        0,
    );
    const separators = Math.max(0, groups.length - 1) * (RAIL.separator + 2 * RAIL.gap);
    // The footer sits one gap below the last group, when there is one.
    const footerGap = groups.length > 0 ? RAIL.gap : 0;
    const footer = footerHeight > 0 ? footerHeight + footerGap : 0;
    return 2 * RAIL.padding + buttons + separators + footer;
}

/** DESIGN §2: two columns when the content does not fit the rail's height in one. */
export function railColumns(
    groupSizes: readonly number[],
    footerHeight: number,
    availableHeight: number,
): 1 | 2 {
    return railOneColumnHeight(groupSizes, footerHeight) > availableHeight ? 2 : 1;
}
