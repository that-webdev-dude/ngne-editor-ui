import { describe, expect, it } from "vitest";
import { createCommandRegistry, installKeymap } from "../../src/ui/commands/index.ts";
import type { CommandRegistry, KeyContext, KeyEnvironment } from "../../src/ui/commands/index.ts";

// Keymap installation (SPEC §7.2): the keyboard listener resolves each key in the environment
// and active contexts of the moment, runs what it resolves to and prevents the browser default
// of a key it takes or suppresses; hold bindings run once and are released on key up, on blur
// and on uninstall; failures reach the error handler.

/** Focus on the viewport, nothing open. */
const VIEWPORT: KeyEnvironment = {
    overlayOpen: false,
    focus: "viewport",
    nativeKeys: new Set(),
    typeahead: false,
};
const TEXT: KeyEnvironment = { ...VIEWPORT, focus: "text" };
const CELL: KeyEnvironment = { ...VIEWPORT, focus: "control", nativeKeys: new Set(["Tab"]) };

interface Pressed {
    prevented: boolean;
}

/** Dispatches a key event on `target` and reports whether its default was prevented. */
function dispatch(
    target: EventTarget,
    type: "keydown" | "keyup",
    key: string,
    init: Partial<
        Record<"ctrlKey" | "altKey" | "shiftKey" | "metaKey" | "repeat" | "isComposing", boolean>
    > = {},
    before?: (event: Event) => void,
): Pressed {
    const event = Object.assign(new Event(type, { cancelable: true }), {
        key,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        repeat: false,
        isComposing: false,
        ...init,
    });
    before?.(event);
    target.dispatchEvent(event);
    return { prevented: event.defaultPrevented };
}

function setup(environment: KeyEnvironment = VIEWPORT, active: readonly string[] = []) {
    const registry: CommandRegistry<string, string> = createCommandRegistry<string, string>({
        menus: ["View", "Help"],
        contexts: ["gesture", "floating", "timeline"],
    });
    const calls: string[] = [];
    const disabled = new Set<string>();
    const errors: string[] = [];
    const state = { environment, active };
    const target = new EventTarget();
    const uninstall = installKeymap({
        registry,
        target,
        environment: () => state.environment,
        activeContexts: () => state.active,
        onError: (error, command) => void errors.push(`${command.id}: ${String(error)}`),
    });
    const add = (id: string, shortcut: string | string[], context?: KeyContext | KeyContext[]) =>
        registry.register({
            id,
            title: id,
            shortcut,
            context,
            enabled: () => !disabled.has(id),
            run: () => void calls.push(id),
        });
    return { registry, calls, disabled, errors, state, target, uninstall, add };
}

describe("keyboard listener", () => {
    it("runs the command of a chord and prevents the browser default", () => {
        const { target, calls, add } = setup();
        add("save", "Ctrl+S");
        add("ellipse", "Shift+U", "canvas");
        expect(dispatch(target, "keydown", "s", { ctrlKey: true })).toEqual({ prevented: true });
        expect(dispatch(target, "keydown", "U", { shiftKey: true })).toEqual({ prevented: true });
        expect(calls).toEqual(["save", "ellipse"]);
    });

    it("resolves in the active contexts of the moment", () => {
        const { target, calls, add, state } = setup(CELL);
        add("play", "Enter", "canvas");
        add("open-cel", "Enter", "timeline");
        add("commit", "Enter", "floating");
        dispatch(target, "keydown", "Enter");
        state.active = ["timeline"];
        dispatch(target, "keydown", "Enter");
        state.active = ["floating", "timeline"];
        dispatch(target, "keydown", "Enter");
        state.environment = VIEWPORT;
        state.active = [];
        dispatch(target, "keydown", "Enter");
        // A cell has no Enter of its own; canvas takes native keys from the viewport only.
        expect(calls).toEqual(["open-cel", "commit", "play"]);
    });

    it("leaves an unbound key alone", () => {
        const { target, calls } = setup();
        expect(dispatch(target, "keydown", "p", { ctrlKey: true })).toEqual({ prevented: false });
        expect(dispatch(target, "keydown", "Tab")).toEqual({ prevented: false });
        expect(calls).toEqual([]);
    });

    it("prevents the default of a disabled command's chord without running it", () => {
        const { target, calls, add, disabled } = setup();
        add("deselect", "Ctrl+D");
        disabled.add("deselect");
        expect(dispatch(target, "keydown", "d", { ctrlKey: true })).toEqual({ prevented: true });
        expect(calls).toEqual([]);
    });

    it("prevents the default of a bound chord that does not act in a text field", () => {
        const { target, calls, add, state } = setup(TEXT);
        add("deselect", "Ctrl+D");
        add("undo", "Ctrl+Z");
        add("zoom-tool", "Z", "canvas");
        expect(dispatch(target, "keydown", "d", { ctrlKey: true })).toEqual({ prevented: true });
        expect(dispatch(target, "keydown", "z", { ctrlKey: true })).toEqual({ prevented: false });
        expect(dispatch(target, "keydown", "z")).toEqual({ prevented: false });
        expect(calls).toEqual([]);
        state.environment = VIEWPORT;
        dispatch(target, "keydown", "z", { ctrlKey: true });
        dispatch(target, "keydown", "z");
        expect(calls).toEqual(["undo", "zoom-tool"]);
    });

    it("suppresses a browser shortcut bound only in a context that does not apply", () => {
        const { target, calls, add, state } = setup(CELL);
        add("find-cel", "Ctrl+F", "timeline");
        expect(dispatch(target, "keydown", "f", { ctrlKey: true })).toEqual({ prevented: true });
        expect(calls).toEqual([]);
        state.active = ["timeline"];
        dispatch(target, "keydown", "f", { ctrlKey: true });
        expect(calls).toEqual(["find-cel"]);
    });

    it("leaves a key alone that a control has already handled", () => {
        const { target, calls, add } = setup();
        add("play", "Enter", "canvas");
        const handled = dispatch(target, "keydown", "Enter", {}, (event) => event.preventDefault());
        expect(handled.prevented).toBe(true);
        expect(calls).toEqual([]);
    });

    it("ignores keys of an input method composition", () => {
        const { target, calls, add } = setup();
        add("pencil", "B", "canvas");
        expect(dispatch(target, "keydown", "b", { isComposing: true })).toEqual({
            prevented: false,
        });
        expect(calls).toEqual([]);
    });

    it("repeats a command while its key repeats", () => {
        const { target, calls, add } = setup();
        add("undo", "Ctrl+Z");
        dispatch(target, "keydown", "z", { ctrlKey: true });
        dispatch(target, "keydown", "z", { ctrlKey: true, repeat: true });
        expect(calls).toEqual(["undo", "undo"]);
    });

    it("runs a hold binding once and releases it on key up", () => {
        const { target, registry } = setup();
        const log: string[] = [];
        registry.register({
            id: "hand",
            title: "Hand",
            shortcut: "Space",
            context: "canvas",
            run: () => void log.push("down"),
            release: () => void log.push("up"),
        });
        expect(dispatch(target, "keydown", " ")).toEqual({ prevented: true });
        expect(dispatch(target, "keydown", " ", { repeat: true })).toEqual({ prevented: true });
        expect(log).toEqual(["down"]);
        // Shift pressed in the meantime does not hide the release.
        expect(dispatch(target, "keyup", " ", { shiftKey: true })).toEqual({ prevented: true });
        expect(log).toEqual(["down", "up"]);
        dispatch(target, "keyup", " ");
        expect(log).toEqual(["down", "up"]);
    });

    it("holds and releases a modifier bound on its own", () => {
        const { target, registry } = setup();
        const log: string[] = [];
        registry.register({
            id: "eyedropper",
            title: "Eyedropper",
            shortcut: "Alt",
            context: "canvas",
            run: () => void log.push("down"),
            release: () => void log.push("up"),
        });
        expect(dispatch(target, "keydown", "Alt", { altKey: true })).toEqual({ prevented: true });
        expect(dispatch(target, "keyup", "Alt")).toEqual({ prevented: true });
        expect(log).toEqual(["down", "up"]);
    });

    it("prevents the default of a bound Alt on key up even when the binding did not act", () => {
        const { target, registry } = setup({ ...VIEWPORT, overlayOpen: true });
        const log: string[] = [];
        registry.register({
            id: "eyedropper",
            title: "Eyedropper",
            shortcut: "Alt",
            context: "canvas",
            run: () => void log.push("down"),
            release: () => void log.push("up"),
        });
        expect(dispatch(target, "keydown", "Alt", { altKey: true })).toEqual({ prevented: true });
        expect(dispatch(target, "keyup", "Alt")).toEqual({ prevented: true });
        expect(log).toEqual([]);
    });

    it("releases held bindings when the window loses focus and when it is removed", () => {
        const { target, registry, uninstall } = setup();
        const log: string[] = [];
        registry.register({
            id: "hand",
            title: "Hand",
            shortcut: "Space",
            context: "canvas",
            run: () => void log.push("down"),
            release: () => void log.push("up"),
        });
        dispatch(target, "keydown", " ");
        target.dispatchEvent(new Event("blur"));
        expect(log).toEqual(["down", "up"]);
        dispatch(target, "keydown", " ");
        uninstall();
        expect(log).toEqual(["down", "up", "down", "up"]);
        dispatch(target, "keydown", " ");
        expect(log).toHaveLength(4);
    });

    it("hands what a command throws, or rejects with, to the error handler", async () => {
        const { target, registry, errors } = setup();
        registry.register({
            id: "throws",
            title: "Throws",
            shortcut: "Ctrl+1",
            run() {
                throw new Error("sync");
            },
        });
        registry.register({
            id: "rejects",
            title: "Rejects",
            shortcut: "Ctrl+2",
            run: () => Promise.reject(new Error("async")),
        });
        expect(dispatch(target, "keydown", "1", { ctrlKey: true })).toEqual({ prevented: true });
        dispatch(target, "keydown", "2", { ctrlKey: true });
        await Promise.resolve();
        await Promise.resolve();
        expect(errors).toEqual(["throws: Error: sync", "rejects: Error: async"]);
    });
});
