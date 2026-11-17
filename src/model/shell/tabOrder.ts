// The tab strip's index maths (SPEC §8, DESIGN §2): where the arrow keys, Home and End move the
// focus, where Ctrl+Shift+← / → and a drag move a tab, and which tab takes the focus after
// Delete closed one. Indexes count from 0 in the strip's order; the strip hands the results to
// the editor's `move(id, index)`, where `index` is the tab's place once moved.

/** The keys that move the focus along the strip. */
export type TabFocusKey = "ArrowLeft" | "ArrowRight" | "Home" | "End";

/**
 * The index the focus moves to from the tab at `index` of `count`: ← and → wrap around the
 * ends, Home and End go to the first and last tab. Null with no tab.
 */
export function tabFocusIndex(key: TabFocusKey, index: number, count: number): number | null {
    if (count <= 0) return null;
    switch (key) {
        case "ArrowLeft":
            return (index - 1 + count) % count;
        case "ArrowRight":
            return (index + 1) % count;
        case "Home":
            return 0;
        case "End":
            return count - 1;
    }
}

/**
 * Ctrl+Shift+← (`-1`) or → (`1`): the index the tab at `index` of `count` moves to, one place
 * along; null at the end it moves towards, where it stays.
 */
export function keyboardMoveIndex(index: number, count: number, direction: -1 | 1): number | null {
    const to = index + direction;
    return index >= 0 && index < count && to >= 0 && to < count ? to : null;
}

/**
 * A drag: the index the dragged tab moves to, the number of the other tabs whose middle lies
 * left of the pointer. `middles` are the other tabs' middles, along the strip, in its order;
 * a pointer before the first or past the last gives the first or last place.
 */
export function dragMoveIndex(middles: readonly number[], pointerX: number): number {
    return middles.filter((middle) => middle < pointerX).length;
}

/**
 * After the tab at `index` closed, the index of the tab that takes the focus among the
 * `remaining` ones: the tab now in its place, or the one before it at the end; null when none
 * remains.
 */
export function indexAfterClose(index: number, remaining: number): number | null {
    if (remaining <= 0) return null;
    return Math.max(0, Math.min(index, remaining - 1));
}
