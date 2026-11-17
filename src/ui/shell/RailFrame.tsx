import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { railColumns } from "../../model/shell/layout.js";
import { RegionBoundary } from "../messages/RegionBoundary.js";

export interface RailFrameProps {
    /** The number of buttons in each group the rail shows, in order. */
    groupSizes: readonly number[];
    /** The height reserved for the footer (`railFooterHeight`); 0 without one. */
    footerHeight: number;
    /** The groups (`RailGroup`). */
    children?: ReactNode;
    /** Content pinned to the bottom of the rail; none when undefined or null. */
    footer?: ReactNode;
}

/**
 * The tool rail region (SPEC §8, DESIGN §2). It lays its groups out in one column and switches
 * to two (72 px) when they do not fit its height; it never scrolls and never clips a tool. The
 * groups are `RailGroup`s; the separators between them are drawn by the rail; the footer is
 * pinned to the bottom in the height the editor reserves.
 *
 * The column count follows the planned content, not what is rendered: the groups the rail
 * shows and the reserved footer height. A rail whose content failed to render keeps the
 * healthy layout, and the footer, which two columns lay out side by side, cannot make the rail
 * switch back and forth.
 */
export function RailFrame({
    groupSizes,
    footerHeight,
    children,
    footer,
}: Readonly<RailFrameProps>) {
    const ref = useRef<HTMLElement>(null);
    const [height, setHeight] = useState<number | null>(null);

    useLayoutEffect(() => {
        const rail = ref.current;
        if (!rail) return;
        // Measured here, before the browser lays the page out again: what a layout effect sets
        // is rendered at once, so the first layout anyone observes already has the column
        // count. The resize observer's first report comes later, in a task of its own: until
        // then the viewport region would be measured beside a one-column rail.
        setHeight(rail.clientHeight);
        const resize = new ResizeObserver(() => setHeight(rail.clientHeight));
        resize.observe(rail);
        return () => resize.disconnect();
    }, []);

    const columns = height === null ? 1 : railColumns(groupSizes, footerHeight, height);

    return (
        <nav
            ref={ref}
            className="shell-rail"
            data-region="tool-rail"
            data-columns={columns}
            aria-label="Tools"
        >
            <RegionBoundary name="Tool rail" compact>
                {children}
                {footer === undefined || footer === null ? null : (
                    <div className="shell-rail__footer" data-rail-footer="">
                        {footer}
                    </div>
                )}
            </RegionBoundary>
        </nav>
    );
}

/** One group of tool buttons; its direct children are the buttons. */
export function RailGroup({ children }: Readonly<{ children: ReactNode }>) {
    return (
        <div className="shell-rail__group" data-rail-group="">
            {children}
        </div>
    );
}
