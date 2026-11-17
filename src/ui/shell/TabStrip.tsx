import { Check, ChevronDown, X } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import {
    dragMoveIndex,
    indexAfterClose,
    keyboardMoveIndex,
    tabFocusIndex,
} from "../../model/shell/tabOrder.js";
import type { TabFocusKey } from "../../model/shell/tabOrder.js";
import { VIEWPORT_FOCUS_ATTRIBUTE } from "../commands/keyEnvironment.js";
import { Icon } from "../primitives/Icon.js";
import { Tooltip } from "../primitives/Tooltip.js";

// The tab strip (SPEC §8, DESIGN §2, BRIEF D18), which an editor places in `AppShell`'s
// `menuCentre` slot. It is presentational: the editor passes the tabs, the active one, the
// labels and what selecting, closing and moving a tab do; which documents are open, their
// labels, their unsaved state and whether closing asks first stay the editor's.
//
// A press selects a tab and a drag along the strip moves it; a middle click or the close
// control closes it. The close control shows on the selected tab and the one under the
// pointer, takes no press while hidden and is hidden from assistive technology (DESIGN §9):
// the keyboard closes a tab with Delete. From the keyboard the strip is one tab stop: ← → Home
// End move the focus, Enter or Space selects, Delete closes, Ctrl+Shift+← → move the tab.
// Tabs shrink to 96 px; past that the strip scrolls sideways without a scroll bar (the wheel
// scrolls it) and a chevron opens a menu of every tab, the selected one checked. The selected
// tab is always in view.

/** One tab, as the editor describes it. */
export interface TabStripItem {
    /** Stable id: what the callbacks receive. */
    readonly id: string;
    /** The tab's text. */
    readonly label: string;
    /** Shown under the pointer over the label (a file's path, say); the label by default. */
    readonly tooltip?: string;
    /** Unsaved changes: the marker follows the label. */
    readonly dirty?: boolean;
}

/** What the strip shows before the first tab (the project's name), in `--text-muted`. */
export interface TabStripLeading {
    readonly label: string;
    /** Shown under the pointer; the label by default. */
    readonly tooltip?: string;
    /** Unsaved changes: the marker follows the label. */
    readonly dirty?: boolean;
}

export interface TabStripProps {
    /** The tabs, in the strip's order. */
    items: readonly TabStripItem[];
    /** The selected tab's id; null selects none. */
    activeId: string | null;
    /** The accessible name of the tab list ("Documents", "Maps"). */
    label: string;
    /** The name of the chevron and its menu of every tab ("All documents", "All maps"). */
    overflowLabel: string;
    /** Shown before the first tab, also while there is none. */
    leading?: TabStripLeading;
    /** Selects the tab `id`: a press, Enter or Space, or the overflow menu. */
    activate: (id: string) => void;
    /**
     * Closes the tab `id`: a middle click, the close control, or Delete. The editor decides
     * whether to ask first; a returned promise settles once it has. After Delete the focus
     * goes to the tab now in the closed one's place, or the one before it, or, with none left,
     * to the viewport target (`data-viewport-focus`); a tab still there was kept.
     */
    close: (id: string) => void | Promise<unknown>;
    /** Moves the tab `id` to `index`, its place in the order once moved: a drag or Ctrl+Shift+← →. */
    move: (id: string, index: number) => void;
}

/** How far a press moves along the strip before it is a drag, in CSS pixels. */
const DRAG_THRESHOLD = 4;

/** The keys a tab takes without modifiers. */
const FOCUS_KEYS: ReadonlySet<string> = new Set<TabFocusKey>([
    "ArrowLeft",
    "ArrowRight",
    "Home",
    "End",
]);

const KEY_SHORTCUTS = "Delete Control+Shift+ArrowLeft Control+Shift+ArrowRight";

const tabSelector = (id: string) => `[data-tab="${CSS.escape(id)}"]`;

/** Scrolls `list` sideways so that `tab` lies inside it. */
function reveal(list: HTMLElement, tab: Element): void {
    const outer = list.getBoundingClientRect();
    const inner = tab.getBoundingClientRect();
    if (inner.left < outer.left) list.scrollLeft -= outer.left - inner.left;
    else if (inner.right > outer.right) list.scrollLeft += inner.right - outer.right;
}

/** Whether the focus is free to be moved by the strip: in it, or lost with a removed tab. */
function focusIsFree(root: HTMLElement | null): boolean {
    const active = document.activeElement;
    return !active || active === document.body || !!root?.contains(active);
}

/** The unsaved marker: an asterisk, spoken as its words. */
function UnsavedMarker({ className }: Readonly<{ className: string }>) {
    return (
        <span className={className} data-tab-unsaved="" title="Unsaved changes">
            <span aria-hidden="true">*</span>
            <span className="ui-visually-hidden">Unsaved changes</span>
        </span>
    );
}

/** The tab strip of the menu bar (SPEC §8, DESIGN §2); see the module comment. */
export function TabStrip({
    items,
    activeId,
    label,
    overflowLabel,
    leading,
    activate,
    close,
    move,
}: Readonly<TabStripProps>) {
    const root = useRef<HTMLDivElement>(null);
    const list = useRef<HTMLDivElement>(null);
    /** The latest tabs, for a drag and a close that outlive the render they began in. */
    const latest = useRef(items);
    const [overflowing, setOverflowing] = useState(false);
    /** The tab the keyboard is on: the selected one unless the arrows moved away from it. */
    const [focusId, setFocusId] = useState<string | null>(null);
    /** A tab that must have the focus once the strip has rendered (after a keyboard move). */
    const refocus = useRef<string | null>(null);
    const stopDrag = useRef<(() => void) | null>(null);
    const hasTabs = items.length > 0;
    const order = items.map((item) => item.id).join("\n");
    /** Everything that changes a tab's width: a longer label, the unsaved marker. */
    const widths = JSON.stringify(items.map((item) => [item.label, !!item.dirty]));
    const stopId = items.some((item) => item.id === focusId) ? focusId : activeId;
    const tabStopId = items.some((item) => item.id === stopId) ? stopId : (items[0]?.id ?? null);

    useLayoutEffect(() => {
        latest.current = items;
    }, [items]);

    // The chevron shows while the tabs, shrunk to their least width, do not fit. The strip and
    // each tab are observed: a tab that grows (a longer label) is measured again.
    useLayoutEffect(() => {
        const element = list.current;
        if (!element) {
            setOverflowing(false);
            return;
        }
        const measure = () => setOverflowing(element.scrollWidth > element.clientWidth + 1);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        for (const tab of element.querySelectorAll("[data-tab]")) observer.observe(tab);
        return () => observer.disconnect();
    }, [widths, hasTabs]);

    // The selected tab is always in view; so is a tab the keyboard moved, which keeps the
    // focus (moving its element in the page took the focus away from it).
    useLayoutEffect(() => {
        const element = list.current;
        const id = refocus.current ?? activeId;
        if (!element || id === null) return;
        const tab = element.querySelector<HTMLElement>(tabSelector(id));
        if (!tab) return;
        reveal(element, tab);
        if (refocus.current !== null) {
            refocus.current = null;
            if (focusIsFree(root.current)) tab.focus({ preventScroll: true });
        }
    }, [activeId, order, overflowing]);

    // A vertical wheel scrolls the strip sideways, and not the page, while it has more to show.
    useEffect(() => {
        const element = list.current;
        if (!element) return;
        const onWheel = (event: WheelEvent) => {
            if (event.deltaX !== 0 || event.deltaY === 0) return;
            if (element.scrollWidth <= element.clientWidth + 1) return;
            const lines = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
            element.scrollLeft += event.deltaY * lines;
            event.preventDefault();
        };
        element.addEventListener("wheel", onWheel, { passive: false });
        return () => element.removeEventListener("wheel", onWheel);
    }, [hasTabs]);

    // A drag that is still going when the strip goes away ends with it.
    useEffect(() => () => stopDrag.current?.(), []);

    if (!hasTabs && !leading) return null;

    const focusTab = (id: string) => {
        const tab = list.current?.querySelector<HTMLElement>(tabSelector(id));
        if (!tab) return;
        setFocusId(id);
        tab.focus({ preventScroll: true });
        if (list.current) reveal(list.current, tab);
    };

    /**
     * Delete: asks the editor to close the tab `id`, at `index`. Once it has, and the tab is
     * gone, the focus goes to the tab in its place, or the one before it, or the viewport.
     */
    const closeFocused = async (id: string, index: number) => {
        await close(id);
        // Once the strip has rendered without the closed tab.
        requestAnimationFrame(() => {
            const remaining = latest.current;
            if (remaining.some((item) => item.id === id)) return;
            if (!focusIsFree(root.current)) return;
            const at = indexAfterClose(index, remaining.length);
            const next = at === null ? null : remaining[at]!;
            if (next) setFocusId(next.id);
            const target = next
                ? list.current?.querySelector<HTMLElement>(tabSelector(next.id))
                : document.querySelector<HTMLElement>(`[${VIEWPORT_FOCUS_ATTRIBUTE}]`);
            target?.focus({ preventScroll: true });
            if (next && target && list.current) reveal(list.current, target);
        });
    };

    /** Ctrl+Shift+← →: moves the tab, which keeps the focus. Whether the key was taken. */
    const onMoveKey = (id: string, index: number, key: string): boolean => {
        if (key !== "ArrowLeft" && key !== "ArrowRight") return false;
        const to = keyboardMoveIndex(index, items.length, key === "ArrowLeft" ? -1 : 1);
        if (to !== null) {
            refocus.current = id;
            setFocusId(id);
            move(id, to);
        }
        return true;
    };

    /** A key without modifiers: ← → Home End, Enter or Space, Delete. Whether it was taken. */
    const onPlainKey = (id: string, index: number, key: string): boolean => {
        if (FOCUS_KEYS.has(key)) {
            const to = tabFocusIndex(key as TabFocusKey, index, items.length);
            if (to !== null) focusTab(items[to]!.id);
            return true;
        }
        if (key === "Enter" || key === " ") {
            if (id !== activeId) activate(id);
            return true;
        }
        if (key === "Delete") {
            void closeFocused(id, index);
            return true;
        }
        return false;
    };

    const onKeyDown = (event: KeyboardEvent<HTMLElement>, id: string) => {
        const index = items.findIndex((item) => item.id === id);
        const { altKey, ctrlKey, metaKey, shiftKey, key } = event;
        let handled = false;
        if (ctrlKey && shiftKey && !altKey && !metaKey) handled = onMoveKey(id, index, key);
        else if (!altKey && !ctrlKey && !metaKey && !shiftKey) {
            handled = onPlainKey(id, index, key);
        }
        // Taken here: the keymap leaves a key whose default was prevented alone.
        if (handled) event.preventDefault();
    };

    const onPointerDown = (event: ReactPointerEvent<HTMLElement>, id: string) => {
        if (event.button !== 0) return;
        // The close control closes; it does not select the tab first.
        if ((event.target as Element).closest("[data-tab-close]")) return;
        if (id !== activeId) activate(id);
        setFocusId(null);
        const element = list.current;
        if (!element) return;
        const { pointerId, clientX: startX } = event;
        let dragging = false;
        const onMove = (pointer: PointerEvent) => {
            if (pointer.pointerId !== pointerId) return;
            if (!dragging && Math.abs(pointer.clientX - startX) < DRAG_THRESHOLD) return;
            dragging = true;
            const middles = [...element.querySelectorAll<HTMLElement>("[data-tab]")]
                .filter((tab) => tab.dataset.tab !== id)
                .map((tab) => {
                    const box = tab.getBoundingClientRect();
                    return box.left + box.width / 2;
                });
            const to = dragMoveIndex(middles, pointer.clientX);
            const from = latest.current.findIndex((item) => item.id === id);
            if (from >= 0 && to !== from) move(id, to);
        };
        const end = (up: PointerEvent) => {
            if (up.pointerId === pointerId) stopDrag.current?.();
        };
        stopDrag.current?.();
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
        stopDrag.current = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", end);
            window.removeEventListener("pointercancel", end);
            stopDrag.current = null;
        };
    };

    return (
        <div ref={root} className="tab-strip" data-tab-strip="">
            {leading ? (
                <span
                    className="tab-strip__leading"
                    data-tab-leading=""
                    title={leading.tooltip ?? leading.label}
                >
                    <span className="tab-strip__leading-label">{leading.label}</span>
                    {leading.dirty ? <UnsavedMarker className="tab-strip__unsaved" /> : null}
                </span>
            ) : null}
            {hasTabs ? (
                <div
                    ref={list}
                    className="tab-strip__list"
                    role="tablist"
                    aria-label={label}
                    onBlur={(event) => {
                        // Left for another part of the page: the tab stop is the selected tab again.
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                            setFocusId(null);
                        }
                    }}
                >
                    {items.map((item) => {
                        const selected = item.id === activeId;
                        return (
                            <div
                                key={item.id}
                                role="tab"
                                className="tab-strip__tab"
                                aria-selected={selected}
                                tabIndex={item.id === tabStopId ? 0 : -1}
                                aria-keyshortcuts={KEY_SHORTCUTS}
                                data-tab={item.id}
                                onPointerDown={(event) => onPointerDown(event, item.id)}
                                onMouseDown={(event) => {
                                    // No autoscroll on a middle press: it closes the tab.
                                    if (event.button === 1) event.preventDefault();
                                }}
                                onAuxClick={(event) => {
                                    if (event.button !== 1) return;
                                    event.preventDefault();
                                    void close(item.id);
                                }}
                                onKeyDown={(event) => onKeyDown(event, item.id)}
                                onFocus={() => setFocusId(item.id)}
                            >
                                <span className="tab-strip__label">
                                    <span
                                        className="tab-strip__name"
                                        title={item.tooltip ?? item.label}
                                    >
                                        {item.label}
                                    </span>
                                    {item.dirty ? (
                                        <UnsavedMarker className="tab-strip__unsaved" />
                                    ) : null}
                                </span>
                                {/* Pointer only: from the keyboard Delete closes the tab. */}
                                <span
                                    className="tab-strip__close"
                                    aria-hidden="true"
                                    data-tab-close=""
                                    onClick={() => void close(item.id)}
                                >
                                    <Icon icon={X} />
                                </span>
                            </div>
                        );
                    })}
                </div>
            ) : null}
            {overflowing && hasTabs ? (
                <DropdownMenu.Root modal={false}>
                    <Tooltip label={overflowLabel}>
                        <DropdownMenu.Trigger asChild>
                            <button
                                type="button"
                                className="ui-icon-button tab-strip__overflow"
                                aria-label={overflowLabel}
                                data-tabs-overflow=""
                            >
                                <Icon icon={ChevronDown} />
                            </button>
                        </DropdownMenu.Trigger>
                    </Tooltip>
                    <DropdownMenu.Portal>
                        <DropdownMenu.Content
                            className="ui-menu"
                            align="end"
                            sideOffset={4}
                            collisionPadding={8}
                            aria-label={overflowLabel}
                            // A long list scrolls: the scrolling menu itself is focusable
                            // (WCAG 2.1.1). Radix keeps Tab from leaving an open menu.
                            tabIndex={0}
                            onContextMenu={(event) => event.preventDefault()}
                        >
                            <DropdownMenu.RadioGroup
                                value={activeId ?? ""}
                                onValueChange={(id) => activate(id)}
                            >
                                {items.map((item) => (
                                    <DropdownMenu.RadioItem
                                        key={item.id}
                                        className="ui-menu__item tab-strip__menu-item"
                                        value={item.id}
                                        data-tab-item={item.id}
                                    >
                                        <span className="tab-strip__menu-check">
                                            <DropdownMenu.ItemIndicator className="ui-menu__indicator">
                                                <Icon icon={Check} />
                                            </DropdownMenu.ItemIndicator>
                                        </span>
                                        <span className="tab-strip__menu-name">{item.label}</span>
                                        {item.dirty ? (
                                            <span className="ui-menu__shortcut">
                                                Unsaved changes
                                            </span>
                                        ) : null}
                                    </DropdownMenu.RadioItem>
                                ))}
                            </DropdownMenu.RadioGroup>
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>
            ) : null}
        </div>
    );
}
