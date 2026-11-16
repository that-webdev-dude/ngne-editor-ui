import {
    isTextField,
    OVERLAY_SELECTOR,
    VIEWPORT_FOCUS_ATTRIBUTE,
} from "../commands/keyEnvironment.js";
import type { FocusedElement } from "../commands/keyEnvironment.js";

// Return focus (SPEC §6): activating a non-text control with the pointer — a tool button, a
// swatch, a toggle, a splitter — returns the focus to the viewport target afterwards, the
// element the editor marks `data-viewport-focus`, so the `canvas` keys act at once. Keyboard
// activation leaves the focus where it is.
//
// Not returned: a text or number field, which keeps the focus to be typed in; a control inside
// the editor's panel selector (its focus contexts' regions), where a click keeps the focus so
// the panel's keys act; a control inside an open menu, dialog, popover or list, which manage
// their own focus; a control that opens one of those (`aria-haspopup`, a select); and anything
// inside `[data-keep-focus]`, for a control that must keep it. The focus moves only when the
// control still has it once its click has run: a control that sent the focus elsewhere (a
// dialog it opened) is left alone.
//
// A select (Radix Select, `role="combobox"`) is activated in two steps: opened, then a choice
// made in its list, after which the list gives the focus back to the select. Opened with the
// pointer and chosen with the pointer, it is a pointer activation: once the list has gone and
// the select has the focus again, the focus moves on to the viewport. Opened or chosen with
// the keyboard, it keeps the focus.

/** Elements a pointer activates; a `gridcell` is a palette swatch. */
export const CONTROL_SELECTOR = [
    "button",
    "input",
    "select",
    "summary",
    "a[href]",
    ...[
        "button",
        "checkbox",
        "switch",
        "radio",
        "tab",
        "slider",
        "separator",
        "option",
        "gridcell",
    ].map((role) => `[role="${role}"]`),
].join(", ");

/** Controls that open a surface of their own, which takes the focus. */
export const OPENS_SURFACE_SELECTOR =
    '[aria-haspopup]:not([aria-haspopup="false"]), [role="combobox"], select';

/** Opts a control or a region out of the rule. */
export const KEEP_FOCUS_ATTRIBUTE = "data-keep-focus";

/** The viewport target: the element the editor marks `data-viewport-focus`. */
const VIEWPORT_SELECTOR = `[${VIEWPORT_FOCUS_ATTRIBUTE}]`;

/** The part of an element the rule reads; DOM elements and test doubles both fit. */
export interface ControlElement extends FocusedElement {
    closest(selector: string): ControlElement | null;
    matches(selector: string): boolean;
}

/** Inside a region where the focus stays: the panel, an open overlay, `[data-keep-focus]`. */
function keepsFocus(element: ControlElement, panel: string | null): boolean {
    if (panel !== null && element.closest(panel) !== null) return true;
    if (element.closest(OVERLAY_SELECTOR) !== null) return true;
    return element.closest(`[${KEEP_FOCUS_ATTRIBUTE}]`) !== null;
}

/**
 * The control whose pointer activation returns the focus to the viewport, for a pointer press
 * on `target`; null when the press is on no such control. `panel` is the editor's panel
 * selector, or null for none.
 */
export function focusReturningControl(
    target: ControlElement | null,
    panel: string | null = null,
): ControlElement | null {
    const control = target?.closest(CONTROL_SELECTOR) ?? null;
    if (!control || isTextField(control)) return null;
    if (control.matches(OPENS_SURFACE_SELECTOR)) return null;
    return keepsFocus(control, panel) ? null : control;
}

/** A select's trigger. */
const SELECT_SELECTOR = '[role="combobox"]';
/** The list of an open select, and a choice in it. */
const OPEN_LIST_SELECTOR = '[role="listbox"]';
const CHOICE_SELECTOR = '[role="option"]';

/**
 * The select whose list, opened by a pointer press on `target`, returns the focus to the
 * viewport after a choice made with the pointer; null when the press is on no such select.
 */
export function focusReturningSelect(
    target: ControlElement | null,
    panel: string | null = null,
): ControlElement | null {
    const select = target?.closest(SELECT_SELECTOR) ?? null;
    if (!select || isTextField(select)) return null;
    return keepsFocus(select, panel) ? null : select;
}

/**
 * The editor's panel selector: the selectors of its focus contexts (`config.keyContexts.focus`)
 * as one list, or null when it has none.
 */
export function panelSelector(focus: Readonly<Partial<Record<string, string>>>): string | null {
    const selectors = Object.values(focus).filter((selector) => selector !== undefined);
    return selectors.length > 0 ? selectors.join(", ") : null;
}

/**
 * Applies the rule on the page (SPEC §6) with the editor's panel selector, or null for none.
 * The viewport target is looked up at each press, so it may come and go with the document.
 * Returns the function that stops it. `UiRoot` applies it for its instance.
 */
export function returnFocusToViewport(panel: string | null = null): () => void {
    let pressed: { control: Element; viewport: HTMLElement; pointerId: number } | null = null;
    /** A select opened with the pointer, while its list may be open, and its viewport. */
    let opened: { select: Element; viewport: HTMLElement } | null = null;
    /** A select whose list a pointer choice is closing; it gets the focus back next. */
    let chosen: { select: Element; viewport: HTMLElement } | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    /** Moves the focus to `viewport` once nothing else holds it and `owner` still has it. */
    const returnLater = (owner: Element, viewport: HTMLElement) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            const active = document.activeElement;
            if (!active || !owner.contains(active)) return;
            if (!viewport.isConnected || document.querySelector(OVERLAY_SELECTOR)) return;
            viewport.focus({ preventScroll: true });
        }, 0);
    };

    const onPointerDown = (event: PointerEvent) => {
        pressed = null;
        const target = event.target instanceof Element ? event.target : null;
        // A press in the open list of a select is part of its activation.
        if (!target?.closest(OPEN_LIST_SELECTOR)) {
            opened = null;
            chosen = null;
        }
        if (event.button !== 0 && event.button !== 2) return;
        const viewport = document.querySelector<HTMLElement>(VIEWPORT_SELECTOR);
        if (!viewport) return;
        const select = focusReturningSelect(target, panel);
        if (select instanceof Element && !viewport.contains(select)) opened = { select, viewport };
        const control = focusReturningControl(target, panel);
        if (control instanceof Element && !viewport.contains(control)) {
            pressed = { control, viewport, pointerId: event.pointerId };
        }
    };

    const onPointerUp = (event: PointerEvent) => {
        const target = event.target instanceof Element ? event.target : null;
        if (opened && target?.closest(CHOICE_SELECTOR)?.closest(OPEN_LIST_SELECTOR)) {
            chosen = opened;
            opened = null;
        }
        const press = pressed;
        pressed = null;
        if (press?.pointerId !== event.pointerId) return;
        // After the click that follows the release, and whatever the control did in it.
        returnLater(press.control, press.viewport);
    };

    const onPointerCancel = () => {
        pressed = null;
    };

    // The list gave the focus back to the select it closed for.
    const onFocusIn = (event: FocusEvent) => {
        if (event.target !== chosen?.select) return;
        const { select, viewport } = chosen;
        chosen = null;
        returnLater(select, viewport);
    };

    // A choice made with the keyboard (Enter in the list) keeps the focus on the select.
    const onKeyDown = () => {
        chosen = null;
    };

    // In the capture phase: a control that stops its pointer events still counts.
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerCancel, true);
    window.addEventListener("focusin", onFocusIn, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
        clearTimeout(timer);
        window.removeEventListener("pointerdown", onPointerDown, true);
        window.removeEventListener("pointerup", onPointerUp, true);
        window.removeEventListener("pointercancel", onPointerCancel, true);
        window.removeEventListener("focusin", onFocusIn, true);
        window.removeEventListener("keydown", onKeyDown, true);
    };
}
