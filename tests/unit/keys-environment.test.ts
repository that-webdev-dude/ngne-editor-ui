import { describe, expect, it } from "vitest";
import {
    activeKeyContexts,
    createCommandRegistry,
    isTextField,
    nativeKeysOf,
    OVERLAY_SELECTOR,
    readKeyEnvironment,
    resolveKey,
    setKeyContext,
    VIEWPORT_FOCUS_ATTRIBUTE,
} from "../../src/ui/commands/index.ts";
import type {
    FocusedElement,
    KeyContextLists,
    KeymapDocument,
} from "../../src/ui/commands/index.ts";
import { createEditorUi } from "../../src/ui/index.ts";

// The key environment read from the page (SPEC §7.2): what has focus (a text field, the
// viewport target, another control, nothing), the native keys and typeahead of the focused
// control, an open overlay, and the editor's active contexts from its focus selectors and its
// state-context store, for the sprite and tilemap editors' configurations.

/** The sprite editor's contexts (SPEC §5): `timeline` is active inside its bottom region. */
const SPRITE: KeyContextLists<"gesture" | "floating" | "timeline"> = {
    order: ["gesture", "floating", "timeline"],
    state: ["gesture", "floating"],
    focus: { timeline: '[data-region="timeline"]' },
};

/** The tilemap editor's: `panel` inside its bottom panel and any marked panel. */
const TILEMAP: KeyContextLists<"gesture" | "markers" | "panel"> = {
    order: ["gesture", "markers", "panel"],
    state: ["gesture", "markers"],
    focus: { panel: '[data-region="bottom-panel"], [data-keymap-panel]' },
};

/** The selectors of a list, one by one: what `closest` with the list matches any of. */
const selectorsOf = (list: string) => list.split(",").map((selector) => selector.trim());

/**
 * An element double. `inside` lists the selectors of the elements it is in (itself included);
 * `closest` finds one when any selector of the list it is given is among them.
 */
function element(
    tagName: string,
    attributes: Record<string, string> = {},
    inside: string[] = [],
): FocusedElement {
    return {
        tagName: tagName.toUpperCase(),
        isContentEditable: attributes.contenteditable === "true",
        getAttribute: (name) => attributes[name] ?? null,
        hasAttribute: (name) => name in attributes,
        closest: (selector) => (selectorsOf(selector).some((s) => inside.includes(s)) ? {} : null),
    };
}

/** A document whose focus is on `active` and where the selectors `open` find an element. */
function page(active: FocusedElement | null, open: string[] = []): KeymapDocument {
    return {
        activeElement: active,
        querySelector: (selector) => (open.includes(selector) ? {} : null),
    };
}

const viewport = () => element("div", { tabindex: "0", [VIEWPORT_FOCUS_ATTRIBUTE]: "" });

describe("focus contexts from the configuration's selectors", () => {
    it("sprite editor: timeline while focus is inside its bottom region", () => {
        const cell = element("div", { role: "gridcell", tabindex: "0" }, [
            '[data-region="timeline"]',
        ]);
        expect(activeKeyContexts(page(cell), SPRITE, {})).toEqual(["timeline"]);
        expect(activeKeyContexts(page(viewport()), SPRITE, {})).toEqual([]);
        expect(activeKeyContexts(page(element("button")), SPRITE, {})).toEqual([]);
        // The tilemap's selectors mean nothing to the sprite editor.
        const marked = element("div", { tabindex: "0" }, ["[data-keymap-panel]"]);
        expect(activeKeyContexts(page(marked), SPRITE, {})).toEqual([]);
    });

    it("tilemap editor: panel inside the bottom panel and inside a marked panel", () => {
        for (const inside of ['[data-region="bottom-panel"]', "[data-keymap-panel]"]) {
            const item = element("div", { role: "treeitem", tabindex: "0" }, [inside]);
            expect(activeKeyContexts(page(item), TILEMAP, {}), inside).toEqual(["panel"]);
        }
        const timeline = element("div", { tabindex: "0" }, ['[data-region="timeline"]']);
        expect(activeKeyContexts(page(timeline), TILEMAP, {})).toEqual([]);
        expect(activeKeyContexts(page(viewport()), TILEMAP, {})).toEqual([]);
    });

    it("no focus context while nothing has focus", () => {
        for (const none of [null, element("body"), element("html")]) {
            expect(activeKeyContexts(page(none), SPRITE, {})).toEqual([]);
            expect(activeKeyContexts(page(none), TILEMAP, {})).toEqual([]);
        }
    });

    it("state contexts from the state, with focus contexts, in the editor's order", () => {
        const cell = element("div", { tabindex: "0" }, ['[data-region="timeline"]']);
        expect(activeKeyContexts(page(cell), SPRITE, { floating: true, gesture: false })).toEqual([
            "floating",
            "timeline",
        ]);
        expect(
            activeKeyContexts(page(viewport()), SPRITE, { floating: true, gesture: true }),
        ).toEqual(["gesture", "floating"]);
        const item = element("div", { tabindex: "0" }, ["[data-keymap-panel]"]);
        expect(activeKeyContexts(page(item), TILEMAP, { markers: true, gesture: true })).toEqual([
            "gesture",
            "markers",
            "panel",
        ]);
    });

    it("a context listed only in order is never active", () => {
        const lists: KeyContextLists = { order: ["solo"], state: [], focus: {} };
        expect(activeKeyContexts(page(viewport()), lists, { solo: true })).toEqual([]);
    });
});

describe("overlay open", () => {
    it("is read from the page whatever has focus", () => {
        for (const focused of [viewport(), element("button"), element("input"), null]) {
            expect(readKeyEnvironment(page(focused)).overlayOpen).toBe(false);
            expect(readKeyEnvironment(page(focused, [OVERLAY_SELECTOR])).overlayOpen).toBe(true);
        }
    });

    it("recognises Radix surfaces by role and state, and marked surfaces", () => {
        for (const role of ["dialog", "alertdialog", "menu", "listbox"]) {
            expect(OVERLAY_SELECTOR).toContain(`[role="${role}"][data-state="open"]`);
        }
        expect(OVERLAY_SELECTOR).toContain("[data-keymap-overlay]");
        expect(OVERLAY_SELECTOR).not.toContain("tooltip");
    });

    it("leaves no context to act, so a key resolves to nothing", () => {
        const registry = createCommandRegistry<string, string>({
            menus: ["View", "Help"],
            contexts: TILEMAP.order,
        });
        registry.register({
            id: "pencil",
            title: "Pencil",
            shortcut: "B",
            context: "canvas",
            run() {},
        });
        const open = readKeyEnvironment(page(viewport(), [OVERLAY_SELECTOR]));
        expect(resolveKey(registry, "B", open, []).action).toBe("pass");
    });
});

describe("text field", () => {
    it("recognises text and number fields", () => {
        for (const field of [
            element("input"),
            element("input", { type: "text", role: "spinbutton" }),
            element("input", { type: "number" }),
            element("input", { type: "search" }),
            element("textarea"),
            element("div", { contenteditable: "true" }),
            element("div", { role: "textbox" }),
        ]) {
            expect(isTextField(field)).toBe(true);
            expect(readKeyEnvironment(page(field))).toEqual({
                overlayOpen: false,
                focus: "text",
                nativeKeys: new Set(),
                typeahead: false,
            });
        }
        for (const control of [
            element("input", { type: "checkbox" }),
            element("input", { type: "range" }),
            element("button"),
            element("div", { tabindex: "0" }),
        ]) {
            expect(isTextField(control)).toBe(false);
            expect(readKeyEnvironment(page(control)).focus).toBe("control");
        }
    });

    it("a text field inside a focus context's region still has focus `text`", () => {
        const field = element("input", {}, ["[data-keymap-panel]"]);
        expect(readKeyEnvironment(page(field)).focus).toBe("text");
    });
});

describe("native keys of the focused control", () => {
    it("tells the viewport, a control and no focus apart", () => {
        expect(readKeyEnvironment(page(viewport()))).toEqual({
            overlayOpen: false,
            focus: "viewport",
            nativeKeys: new Set(),
            typeahead: false,
        });
        expect(readKeyEnvironment(page(element("button"))).focus).toBe("control");
        for (const none of [null, element("body"), element("html")]) {
            const environment = readKeyEnvironment(page(none));
            expect(environment.focus).toBe("none");
            expect([...environment.nativeKeys]).toEqual(["Tab"]);
        }
    });

    it("knows which native keys each kind of control consumes", () => {
        const keys = (target: FocusedElement) => [...nativeKeysOf(target)].sort();
        const activate = ["Enter", "Space", "Tab"];
        const navigate = [
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "End",
            "Enter",
            "Home",
            "Space",
            "Tab",
        ];
        expect(keys(element("button"))).toEqual(activate);
        expect(keys(element("summary"))).toEqual(activate);
        expect(keys(element("a", { href: "#" }))).toEqual(activate);
        expect(keys(element("input", { type: "checkbox" }))).toEqual(activate);
        expect(keys(element("div", { role: "button", tabindex: "0" }))).toEqual(activate);
        expect(keys(element("div", { role: "switch", tabindex: "0" }))).toEqual(activate);
        // A splitter, a Radix select trigger, a segmented control item, a menu bar trigger.
        expect(keys(element("div", { role: "separator", tabindex: "0" }))).toEqual(navigate);
        expect(keys(element("button", { role: "combobox" }))).toEqual(navigate);
        expect(keys(element("button", { role: "radio" }))).toEqual(navigate);
        expect(keys(element("button", { role: "menuitem" }))).toEqual(navigate);
        expect(keys(element("div", { role: "treeitem", tabindex: "0" }))).toEqual(navigate);
        expect(keys(element("select"))).toEqual(navigate);
        expect(keys(element("input", { type: "range" }))).toEqual(navigate);
        expect(keys(element("input", { type: "radio" }))).toEqual(navigate);
        // A cell of a panel: nothing but Tab.
        expect(keys(element("div", { role: "gridcell", tabindex: "0" }))).toEqual(["Tab"]);
        expect(keys(element("div", { tabindex: "0" }))).toEqual(["Tab"]);
        expect(keys(element("a"))).toEqual(["Tab"]);
        expect([...readKeyEnvironment(page(element("button"))).nativeKeys].sort()).toEqual(
            activate,
        );
    });

    it("gives typeahead to selects, lists and trees only", () => {
        const typeahead = (target: FocusedElement) => readKeyEnvironment(page(target)).typeahead;
        expect(typeahead(element("button", { role: "combobox" }))).toBe(true);
        expect(typeahead(element("select"))).toBe(true);
        expect(typeahead(element("div", { role: "treeitem" }))).toBe(true);
        expect(typeahead(element("button"))).toBe(false);
        expect(typeahead(element("button", { role: "menuitem" }))).toBe(false);
        expect(typeahead(viewport())).toBe(false);
    });
});

describe("the state-context store of an instance", () => {
    const config = {
        id: "ngne-sprite-editor",
        productName: "NGNE Sprite Editor",
        about: {
            packageName: "ngne-sprite-editor",
            version: "1.0.0",
            licence: "MIT",
            engine: { packageName: "@ngne/core", version: "1.0.0" },
            repositoryUrl: "https://example.com/repository",
            changelogUrl: "https://example.com/changelog",
        },
        menus: ["File", "View", "Help"] as const,
        keyContexts: SPRITE,
    };

    it("holds the state contexts, all off at startup", () => {
        const editorUi = createEditorUi(config);
        expect(editorUi.keyContextState.getState()).toEqual({ gesture: false, floating: false });
        expect(
            createEditorUi({ ...config, keyContexts: undefined }).keyContextState.getState(),
        ).toEqual({});
    });

    it("switches a context, and refreshes the commands only on a change", () => {
        const editorUi = createEditorUi(config);
        let refreshes = 0;
        editorUi.commands.subscribe(() => refreshes++);
        setKeyContext(editorUi, "floating", true);
        expect(editorUi.keyContextState.getState()).toEqual({ gesture: false, floating: true });
        expect(refreshes).toBe(1);
        setKeyContext(editorUi, "floating", true);
        expect(refreshes).toBe(1);
        setKeyContext(editorUi, "floating", false);
        expect(editorUi.keyContextState.getState().floating).toBe(false);
        expect(refreshes).toBe(2);
    });

    it("feeds the active contexts", () => {
        const editorUi = createEditorUi(config);
        setKeyContext(editorUi, "gesture", true);
        const state = editorUi.keyContextState.getState();
        expect(activeKeyContexts(page(viewport()), editorUi.config.keyContexts, state)).toEqual([
            "gesture",
        ]);
    });

    it("refuses a context that is not a state context", () => {
        const editorUi = createEditorUi(config);
        expect(() => setKeyContext(editorUi, "timeline", true)).toThrow(/"timeline"/);
        expect(() => setKeyContext(editorUi, "text" as never, true)).toThrow(/"text"/);
    });

    it("is one per instance", () => {
        const one = createEditorUi(config);
        const other = createEditorUi(config);
        setKeyContext(one, "gesture", true);
        expect(other.keyContextState.getState().gesture).toBe(false);
    });
});
