import type { KeyEnvironment } from "../../model/commands/resolve.js";

// The key environment (SPEC §7.2) read from the page: what has focus, whether an overlay is
// open, and which of the editor's contexts are active. The contracts with the interface:
//
// - The focusable viewport element carries `data-viewport-focus`. Only that element counts as
//   "the viewport itself is focused".
// - A focus context is active while focus is inside an element its selector matches
//   (`config.keyContexts.focus`); a state context while its state is on (`setKeyContext`).
// - An open Radix menu, dialog, popover or select list is recognised by its role and
//   `data-state="open"`; any other surface that handles its own keys carries
//   `data-keymap-overlay` while it is open.

export const VIEWPORT_FOCUS_ATTRIBUTE = "data-viewport-focus";
export const OVERLAY_ATTRIBUTE = "data-keymap-overlay";
export const OVERLAY_SELECTOR = [
    ...["dialog", "alertdialog", "menu", "listbox"].map(
        (role) => `[role="${role}"][data-state="open"]`,
    ),
    `[${OVERLAY_ATTRIBUTE}]`,
].join(", ");

/** The part of an element the keymap reads; DOM elements and test doubles both fit. */
export interface FocusedElement {
    tagName: string;
    isContentEditable?: boolean;
    getAttribute(name: string): string | null;
    hasAttribute(name: string): boolean;
    closest(selector: string): unknown;
}

/** The part of a document the keymap reads. */
export interface KeymapDocument {
    activeElement: FocusedElement | null;
    querySelector(selector: string): unknown;
}

/** The editor's key contexts as the keymap reads them (the resolved `config.keyContexts`). */
export interface KeyContextLists<Context extends string = string> {
    /** The editor's contexts, highest priority first. */
    readonly order: readonly Context[];
    /** Contexts active while the editor's state says so. */
    readonly state: readonly Context[];
    /** Contexts active while focus is inside the element a selector matches. */
    readonly focus: Readonly<Partial<Record<Context, string>>>;
}

const NON_TEXT_INPUT_TYPES = new Set([
    "button",
    "checkbox",
    "color",
    "file",
    "hidden",
    "image",
    "radio",
    "range",
    "reset",
    "submit",
]);

const ACTIVATION_KEYS = ["Enter", "Space", "Tab"];
/** Nothing focused, or a focusable element without keys of its own: Tab still moves focus. */
const TAB_ONLY: ReadonlySet<string> = new Set(["Tab"]);
/** Buttons, links and checkboxes. */
const ACTIVATE: ReadonlySet<string> = new Set(ACTIVATION_KEYS);
/** Controls that also move a value or a choice: sliders, splitters, selects, radio groups. */
const NAVIGATE: ReadonlySet<string> = new Set([
    ...ACTIVATION_KEYS,
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Home",
    "End",
]);
const NOTHING: ReadonlySet<string> = new Set();

const ACTIVATE_ROLES = new Set(["button", "link", "checkbox", "switch"]);
const NAVIGATE_ROLES = new Set([
    "combobox",
    "listbox",
    "option",
    "slider",
    "separator",
    "scrollbar",
    "spinbutton",
    "radio",
    "radiogroup",
    "tab",
    "tablist",
    "menu",
    "menubar",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "tree",
    "treeitem",
]);
const TYPEAHEAD_ROLES = new Set(["combobox", "listbox", "option", "tree", "treeitem"]);

function tagOf(element: FocusedElement): string {
    return element.tagName.toLowerCase();
}

function inputType(element: FocusedElement): string {
    return (element.getAttribute("type") ?? "text").toLowerCase();
}

/** A text or number field: it handles typing, Enter, Escape, arrows and Tab itself. */
export function isTextField(element: FocusedElement): boolean {
    if (element.isContentEditable) return true;
    const tag = tagOf(element);
    if (tag === "textarea") return true;
    if (tag === "input") return !NON_TEXT_INPUT_TYPES.has(inputType(element));
    const role = element.getAttribute("role");
    return role === "textbox" || role === "searchbox";
}

/** The native keys a focused non-text control consumes itself. */
export function nativeKeysOf(element: FocusedElement): ReadonlySet<string> {
    const role = element.getAttribute("role");
    if (role) {
        if (NAVIGATE_ROLES.has(role)) return NAVIGATE;
        if (ACTIVATE_ROLES.has(role)) return ACTIVATE;
        return TAB_ONLY;
    }
    const tag = tagOf(element);
    if (tag === "select") return NAVIGATE;
    if (tag === "input") {
        const type = inputType(element);
        return type === "range" || type === "radio" ? NAVIGATE : ACTIVATE;
    }
    if (tag === "button" || tag === "summary") return ACTIVATE;
    if (tag === "a" && element.hasAttribute("href")) return ACTIVATE;
    return TAB_ONLY;
}

function usesTypeahead(element: FocusedElement): boolean {
    const role = element.getAttribute("role");
    return role ? TYPEAHEAD_ROLES.has(role) : tagOf(element) === "select";
}

/** The focused element, or null when focus is on the page itself. */
function focusedElement(document: KeymapDocument): FocusedElement | null {
    const active = document.activeElement;
    return active && !["body", "html"].includes(tagOf(active)) ? active : null;
}

/** The environment of a key pressed now (SPEC §7.2), from the document. */
export function readKeyEnvironment(document: KeymapDocument): KeyEnvironment {
    const focused = focusedElement(document);
    const overlayOpen = document.querySelector(OVERLAY_SELECTOR) !== null;
    if (!focused) return { overlayOpen, focus: "none", nativeKeys: TAB_ONLY, typeahead: false };
    if (isTextField(focused)) {
        return { overlayOpen, focus: "text", nativeKeys: NOTHING, typeahead: false };
    }
    if (focused.hasAttribute(VIEWPORT_FOCUS_ATTRIBUTE)) {
        return { overlayOpen, focus: "viewport", nativeKeys: NOTHING, typeahead: false };
    }
    return {
        overlayOpen,
        focus: "control",
        nativeKeys: nativeKeysOf(focused),
        typeahead: usesTypeahead(focused),
    };
}

/**
 * The editor's contexts that are active now, in the editor's order (SPEC §7.2): each state
 * context whose state is on, and each focus context whose selector matches the focused element
 * or one of its ancestors.
 */
export function activeKeyContexts<Context extends string>(
    document: KeymapDocument,
    contexts: KeyContextLists<Context>,
    state: Readonly<Partial<Record<Context, boolean>>>,
): Context[] {
    const focused = focusedElement(document);
    return contexts.order.filter((context) => {
        if (contexts.state.includes(context) && state[context] === true) return true;
        const selector = contexts.focus[context];
        return selector !== undefined && focused?.closest(selector) != null;
    });
}
