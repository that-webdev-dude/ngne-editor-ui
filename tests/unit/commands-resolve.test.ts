import { describe, expect, it } from "vitest";
import {
    applicableContexts,
    createCommandRegistry,
    resolveKey,
} from "../../src/ui/commands/index.ts";
import type { CommandRegistry, KeyContext, KeyEnvironment } from "../../src/ui/commands/index.ts";

// Applicable contexts and key resolution (SPEC §7.2), for the context lists of both editors:
// the sprite editor's state contexts `gesture` and `floating` and focus context `timeline`, and
// the tilemap editor's `gesture`, `markers` and `panel`. Each editor's contexts come in its
// order between the package's `text` and its `canvas` and `global`.

interface EditorContexts {
    name: string;
    /** The editor's contexts, highest priority first. */
    contexts: readonly [gesture: string, state: string, focus: string];
}

const EDITORS: readonly EditorContexts[] = [
    { name: "sprite editor", contexts: ["gesture", "floating", "timeline"] },
    { name: "tilemap editor", contexts: ["gesture", "markers", "panel"] },
];

/** Focus on the viewport, nothing open. */
const VIEWPORT: KeyEnvironment = {
    overlayOpen: false,
    focus: "viewport",
    nativeKeys: new Set(),
    typeahead: false,
};
const TEXT: KeyEnvironment = { ...VIEWPORT, focus: "text" };
const BODY: KeyEnvironment = { ...VIEWPORT, focus: "none", nativeKeys: new Set(["Tab"]) };
const BUTTON: KeyEnvironment = {
    ...VIEWPORT,
    focus: "control",
    nativeKeys: new Set(["Enter", "Space", "Tab"]),
};
const SLIDER: KeyEnvironment = {
    ...VIEWPORT,
    focus: "control",
    nativeKeys: new Set([
        "Enter",
        "Space",
        "Tab",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
    ]),
};
const SELECT: KeyEnvironment = { ...SLIDER, typeahead: true };
/** Focus on an item of a focus context's region: a focusable element without keys of its own. */
const CELL: KeyEnvironment = { ...VIEWPORT, focus: "control", nativeKeys: new Set(["Tab"]) };

for (const { name, contexts } of EDITORS) {
    const [gesture, state, focus] = contexts;

    interface Fixture {
        registry: CommandRegistry<string, string>;
        /** Adds a command; its condition is "not in `disabled`". */
        add(id: string, shortcut: string | string[], context?: KeyContext | KeyContext[]): void;
        disabled: Set<string>;
    }

    const fixture = (): Fixture => {
        const registry = createCommandRegistry<string, string>({
            menus: ["View", "Help"],
            contexts,
        });
        const disabled = new Set<string>();
        return {
            registry,
            disabled,
            add(id, shortcut, context) {
                registry.register({
                    id,
                    title: id,
                    shortcut,
                    context,
                    enabled: () => !disabled.has(id),
                    run() {},
                });
            },
        };
    };

    /** The id the chord resolves to, or the action when it resolves to no command. */
    const resolved = (
        registry: CommandRegistry<string, string>,
        chord: string,
        environment: KeyEnvironment,
        active: readonly string[] = [],
    ): string => {
        const resolution = resolveKey(registry, chord, environment, active);
        return resolution.action === "run"
            ? `${resolution.context}:${resolution.command.id}`
            : resolution.action;
    };

    const order = fixture().registry.contexts;

    describe(`applicable contexts: ${name}`, () => {
        it("orders the editor's contexts between text and canvas, global", () => {
            expect(order).toEqual(["text", gesture, state, focus, "canvas", "global"]);
            expect(applicableContexts(order, [focus, state, gesture], CELL)).toEqual([
                gesture,
                state,
                focus,
                "canvas",
                "global",
            ]);
        });

        it("applies canvas and global in the normal state", () => {
            for (const environment of [VIEWPORT, BUTTON, BODY]) {
                expect(applicableContexts(order, [], environment)).toEqual(["canvas", "global"]);
            }
        });

        it("adds each editor context while it is active", () => {
            expect(applicableContexts(order, [focus], CELL)).toEqual([focus, "canvas", "global"]);
            expect(applicableContexts(order, [state], VIEWPORT)).toEqual([
                state,
                "canvas",
                "global",
            ]);
            expect(applicableContexts(order, [gesture], VIEWPORT)).toEqual([
                gesture,
                "canvas",
                "global",
            ]);
        });

        it("ignores active names that are not editor contexts", () => {
            expect(applicableContexts(order, ["text", "canvas", "elsewhere"], VIEWPORT)).toEqual([
                "canvas",
                "global",
            ]);
        });

        it("applies only text while a text field has focus", () => {
            expect(applicableContexts(order, [focus, state], TEXT)).toEqual(["text"]);
        });

        it("applies none while a menu, dialog or popover is open", () => {
            expect(applicableContexts(order, [state], { ...VIEWPORT, overlayOpen: true })).toEqual(
                [],
            );
            expect(applicableContexts(order, [], { ...TEXT, overlayOpen: true })).toEqual([]);
        });
    });

    describe(`key resolution follows context priority: ${name}`, () => {
        it("resolves a key in the first context that applies and binds it", () => {
            const { registry, add } = fixture();
            add("play", "Enter", ["canvas", focus]);
            add("apply", "Enter", state);
            add("close-gesture", "Enter", gesture);

            expect(resolved(registry, "Enter", VIEWPORT)).toBe("canvas:play");
            expect(resolved(registry, "Enter", CELL, [focus])).toBe(`${focus}:play`);
            expect(resolved(registry, "Enter", VIEWPORT, [state])).toBe(`${state}:apply`);
            expect(resolved(registry, "Enter", CELL, [focus, state])).toBe(`${state}:apply`);
            expect(resolved(registry, "Enter", VIEWPORT, [state, gesture])).toBe(
                `${gesture}:close-gesture`,
            );
        });

        it("orders every pair of contexts: the higher one wins", () => {
            const withoutText = order.filter((context) => context !== "text");
            for (const [index, higher] of withoutText.entries()) {
                for (const lower of withoutText.slice(index + 1)) {
                    const { registry, add } = fixture();
                    add("lower", "Ctrl+J", lower);
                    add("higher", "Ctrl+J", higher);
                    expect(
                        resolved(registry, "Ctrl+J", VIEWPORT, [higher, lower]),
                        `${higher} over ${lower}`,
                    ).toBe(`${higher}:higher`);
                }
            }
        });

        it("falls back to canvas and global for keys a higher context does not bind", () => {
            const { registry, add } = fixture();
            add("move-cell", "ArrowLeft", focus);
            add("pencil", "B", "canvas");
            add("save", "Ctrl+S", ["global", "text"]);
            expect(resolved(registry, "ArrowLeft", CELL, [focus])).toBe(`${focus}:move-cell`);
            expect(resolved(registry, "B", CELL, [focus])).toBe("canvas:pencil");
            expect(resolved(registry, "Ctrl+S", CELL, [focus])).toBe("global:save");
            expect(resolved(registry, "B", VIEWPORT, [state])).toBe("canvas:pencil");
        });

        it("does not try a lower context when the winning binding is disabled", () => {
            const { registry, add, disabled } = fixture();
            add("cancel", "Ctrl+Z", state);
            add("undo", "Ctrl+Z", "global");
            disabled.add("cancel");
            const resolution = resolveKey(registry, "Ctrl+Z", VIEWPORT, [state]);
            expect(resolution).toMatchObject({ action: "run", context: state });
            expect(resolution.action === "run" && resolution.command.enabled()).toBe(false);
            expect(resolved(registry, "Ctrl+Z", VIEWPORT)).toBe("global:undo");
        });

        it("runs the first enabled command among several that share a chord in one context", () => {
            const { registry, add, disabled } = fixture();
            add("nudge", "ArrowLeft", "canvas");
            add("previous", "ArrowLeft", "canvas");
            expect(resolved(registry, "ArrowLeft", VIEWPORT)).toBe("canvas:nudge");
            disabled.add("nudge");
            expect(resolved(registry, "ArrowLeft", VIEWPORT)).toBe("canvas:previous");
            disabled.delete("nudge");
            disabled.add("previous");
            expect(resolved(registry, "ArrowLeft", VIEWPORT)).toBe("canvas:nudge");
        });

        it("passes a key nothing binds", () => {
            const { registry } = fixture();
            for (const chord of ["B", "Ctrl+S", "F5", "Tab", "Alt"]) {
                expect(resolved(registry, chord, VIEWPORT), chord).toBe("pass");
            }
        });

        it("suppresses a browser shortcut bound only where it does not act", () => {
            const { registry, add } = fixture();
            add("apply", "Alt+Enter", state);
            add("rename", "F2", focus);
            add("close-gesture", "C", gesture);
            expect(resolved(registry, "Alt+Enter", VIEWPORT)).toBe("suppress");
            expect(resolved(registry, "F2", VIEWPORT, [state])).toBe("suppress");
            expect(resolved(registry, "Alt+Enter", VIEWPORT, [state])).toBe(`${state}:apply`);
            // Not a browser shortcut: the key is left alone.
            expect(resolved(registry, "C", VIEWPORT)).toBe("pass");
        });
    });

    describe(`text context: ${name}`, () => {
        const setup = () => {
            const value = fixture();
            value.add("pencil", "B", "canvas");
            value.add("zoom-tool", "Z", "canvas");
            value.add("new-layer", "Shift+N", "global");
            value.add("undo", "Ctrl+Z", "global");
            value.add("redo", ["Ctrl+Y", "Ctrl+Shift+Z"], "global");
            value.add("select-all", "Ctrl+A", "global");
            value.add("deselect", "Ctrl+D", "global");
            value.add("onion", "F3", "global");
            value.add("new-frame", "Alt+N", "global");
            value.add("delete", "Delete", "global");
            value.add("play", "Enter", "canvas");
            value.add("save", "Ctrl+S", ["global", "text"]);
            value.add("next-region", "F6", ["global", "text"]);
            value.add("close", "Alt+W", ["global", "text"]);
            return value;
        };

        it("leaves typing to the field", () => {
            const { registry } = setup();
            for (const chord of [
                "B",
                "Z",
                "Shift+N",
                "Enter",
                "Delete",
                "Escape",
                "Tab",
                "ArrowLeft",
            ]) {
                expect(resolved(registry, chord, TEXT, [focus]), chord).toBe("pass");
            }
        });

        it("leaves Ctrl+Z/Y/A and Ctrl+Shift+Z to the field", () => {
            const { registry } = setup();
            for (const chord of ["Ctrl+Z", "Ctrl+Y", "Ctrl+Shift+Z", "Ctrl+A"]) {
                expect(resolved(registry, chord, TEXT), chord).toBe("pass");
            }
        });

        it("still runs the chords bound in text", () => {
            const { registry } = setup();
            expect(resolved(registry, "Ctrl+S", TEXT)).toBe("text:save");
            expect(resolved(registry, "F6", TEXT, [state])).toBe("text:next-region");
            expect(resolved(registry, "Alt+W", TEXT)).toBe("text:close");
        });

        it("suppresses the browser default of other bound Ctrl, Alt and F-key chords", () => {
            const { registry } = setup();
            for (const chord of ["Ctrl+D", "F3", "Alt+N"]) {
                expect(resolved(registry, chord, TEXT), chord).toBe("suppress");
            }
            // Not bound by anything: the browser keeps it.
            expect(resolved(registry, "Ctrl+P", TEXT)).toBe("pass");
            expect(resolved(registry, "F5", TEXT)).toBe("pass");
        });
    });

    describe(`keys a focused control consumes natively: ${name}`, () => {
        const setup = () => {
            const value = fixture();
            value.add("play", "Enter", ["canvas", focus]);
            value.add("hand", "Space", "canvas");
            value.add("toggle-panel", "Tab", "canvas");
            value.add("cancel", "Escape", "canvas");
            value.add("previous-frame", "ArrowLeft", "canvas");
            value.add("pencil", "B", "canvas");
            value.add("zoom-1", "1", "canvas");
            value.add("save", "Ctrl+S", "global");
            value.add("move-cell", "ArrowLeft", focus);
            value.add("rename", "F2", focus);
            value.add("nudge", "ArrowRight", state);
            value.add("apply", "Enter", state);
            value.add("cancel-state", "Escape", state);
            return value;
        };

        it("runs the canvas bindings of native keys only while the viewport itself is focused", () => {
            const { registry } = setup();
            const bindings: [chord: string, id: string][] = [
                ["Enter", "play"],
                ["Space", "hand"],
                ["Tab", "toggle-panel"],
                ["Escape", "cancel"],
                ["ArrowLeft", "previous-frame"],
            ];
            for (const [chord, id] of bindings) {
                expect(resolved(registry, chord, VIEWPORT), chord).toBe(`canvas:${id}`);
                expect(resolved(registry, chord, BUTTON), chord).toBe("pass");
                expect(resolved(registry, chord, SLIDER), chord).toBe("pass");
                expect(resolved(registry, chord, BODY), chord).toBe("pass");
            }
        });

        it("runs letter, digit and modified chords throughout the canvas context", () => {
            const { registry } = setup();
            for (const environment of [VIEWPORT, BUTTON, SLIDER, BODY, CELL]) {
                expect(resolved(registry, "B", environment)).toBe("canvas:pencil");
                expect(resolved(registry, "1", environment)).toBe("canvas:zoom-1");
                expect(resolved(registry, "Ctrl+S", environment)).toBe("global:save");
            }
        });

        it("gives a select its typeahead characters and still runs modified chords", () => {
            const { registry } = setup();
            expect(resolved(registry, "B", SELECT)).toBe("pass");
            expect(resolved(registry, "1", SELECT)).toBe("pass");
            expect(resolved(registry, "Ctrl+S", SELECT)).toBe("global:save");
        });

        it(`in the ${focus} region a focused button takes Enter, a focused item leaves it`, () => {
            const { registry } = setup();
            expect(resolved(registry, "Enter", BUTTON, [focus])).toBe("pass");
            expect(resolved(registry, "Enter", CELL, [focus])).toBe(`${focus}:play`);
            expect(resolved(registry, "F2", CELL, [focus])).toBe(`${focus}:rename`);
            // Arrows are not a button's keys: they move the active item.
            expect(resolved(registry, "ArrowLeft", BUTTON, [focus])).toBe(`${focus}:move-cell`);
            // A splitter or a tab strip keeps its arrows.
            expect(resolved(registry, "ArrowLeft", SLIDER, [focus])).toBe("pass");
            // Tab is never the region's: it moves focus.
            expect(resolved(registry, "Tab", CELL, [focus])).toBe("pass");
        });

        it(`lets a focused control keep its keys while ${state} is active`, () => {
            const { registry } = setup();
            expect(resolved(registry, "Enter", BUTTON, [state])).toBe("pass");
            expect(resolved(registry, "ArrowRight", SLIDER, [state])).toBe("pass");
            expect(resolved(registry, "ArrowRight", BUTTON, [state])).toBe(`${state}:nudge`);
            expect(resolved(registry, "Escape", BUTTON, [state])).toBe(`${state}:cancel-state`);
            expect(resolved(registry, "Enter", VIEWPORT, [state])).toBe(`${state}:apply`);
        });
    });

    describe(`open menu, dialog or popover: ${name}`, () => {
        it("runs nothing and suppresses the default of bound Ctrl, Alt and F-key chords", () => {
            const { registry, add } = fixture();
            add("pencil", "B", "canvas");
            add("save", "Ctrl+S", ["global", "text"]);
            add("onion", "F3", "global");
            add("undo", "Ctrl+Z", "global");
            add("play", "Enter", "canvas");
            add("apply", "Alt+Enter", state);
            const open = { ...VIEWPORT, overlayOpen: true };
            expect(resolved(registry, "Ctrl+S", open)).toBe("suppress");
            expect(resolved(registry, "F3", open)).toBe("suppress");
            expect(resolved(registry, "Ctrl+Z", open)).toBe("suppress");
            expect(resolved(registry, "Alt+Enter", open, [state])).toBe("suppress");
            expect(resolved(registry, "B", open)).toBe("pass");
            expect(resolved(registry, "Enter", open)).toBe("pass");
            // A text field inside a dialog keeps its own undo.
            expect(resolved(registry, "Ctrl+Z", { ...TEXT, overlayOpen: true })).toBe("pass");
            expect(resolved(registry, "Ctrl+S", { ...TEXT, overlayOpen: true })).toBe("suppress");
        });
    });
}
