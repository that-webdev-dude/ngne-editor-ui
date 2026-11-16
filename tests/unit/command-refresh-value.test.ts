import { createElement } from "react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createCommandRegistry } from "../../src/model/commands/registry.ts";
import type { CommandRegistry } from "../../src/model/commands/registry.ts";
import {
    commandValueSource,
    useCommands,
    useCommandValue,
} from "../../src/ui/commands/useCommands.ts";
import { EditorUiContext } from "../../src/ui/editorUi/context.ts";
import type { AnyEditorUi } from "../../src/ui/editorUi/createEditorUi.ts";
import { mount } from "./support/external-store.ts";

// `useCommandValue(read)` renders a component again only when the value `read` returns changes
// (SPEC §2 Command refresh, §7.1): the registry is refreshed at every change of the editor's
// stores, so a component that shows one command's state must not render at each of them. The
// source the hook hands to `useSyncExternalStore` is mounted as React mounts it. Both hooks
// read the registry of the instance `UiRoot` provides unless one is passed (SPEC §1.2),
// checked by rendering them on the server.

function setup() {
    const registry = createCommandRegistry({ menus: ["View"] });
    const state = { zoom: 1, pointer: 0 };
    registry.register({
        id: "view.zoom-in",
        title: "Zoom In",
        enabled: () => state.zoom < 8,
        run() {},
    });
    registry.register({ id: "view.fit", title: "Fit", run() {} });
    return { registry, state };
}

const canZoom = (registry: CommandRegistry) => registry.get("view.zoom-in")?.enabled() ?? false;

describe("useCommandValue", () => {
    it("reads the value from the registry", () => {
        const { registry, state } = setup();
        const source = commandValueSource(registry, canZoom);
        expect(source.snapshot()).toBe(true);
        state.zoom = 8;
        expect(source.snapshot()).toBe(false);
        expect(source.subscribe).toBe(registry.subscribe);
    });

    it("re-renders when the read value changes, once per change", () => {
        const { registry, state } = setup();
        const source = commandValueSource(registry, canZoom);
        const reader = mount(source.subscribe, source.snapshot);
        state.zoom = 8;
        registry.refresh();
        expect(reader.renders).toBe(2);
        registry.refresh();
        expect(reader.renders).toBe(2);
        state.zoom = 1;
        registry.refresh();
        expect(reader.renders).toBe(3);
        reader.unmount();
    });

    it("does not re-render when a refresh leaves the read value as it was", () => {
        const { registry, state } = setup();
        const source = commandValueSource(registry, canZoom);
        const reader = mount(source.subscribe, source.snapshot);
        state.pointer += 1;
        registry.refresh();
        state.zoom = 2;
        registry.refresh();
        expect(reader.renders).toBe(1);
        reader.unmount();
    });

    it("does not re-render when a command is added or removed and the value stays", () => {
        const { registry } = setup();
        const source = commandValueSource(registry, canZoom);
        const reader = mount(source.subscribe, source.snapshot);
        const remove = registry.register({ id: "view.grid", title: "Grid", run() {} });
        remove();
        expect(reader.renders).toBe(1);
        reader.unmount();
    });
});

describe("the registry the command hooks read", () => {
    /** The markup of `children` under the context `UiRoot` provides, for `registry`'s instance. */
    function underUiRoot(registry: CommandRegistry, children: ReactNode): string {
        const editorUi = { commands: registry } as unknown as AnyEditorUi;
        return renderToStaticMarkup(
            createElement(EditorUiContext.Provider, { value: editorUi }, children),
        );
    }

    function Titles({ registry }: Readonly<{ registry?: CommandRegistry }>) {
        const titles = useCommands(registry).map((command) => command.title());
        return createElement("p", null, titles.join(", "));
    }

    function ZoomState({ registry }: Readonly<{ registry?: CommandRegistry }>) {
        return createElement("p", null, useCommandValue(canZoom, registry) ? "zoom" : "no zoom");
    }

    it("is the instance's that UiRoot provides", () => {
        const { registry } = setup();
        expect(underUiRoot(registry, createElement(Titles))).toBe("<p>Fit, Zoom In</p>");
        expect(underUiRoot(registry, createElement(ZoomState))).toBe("<p>zoom</p>");
    });

    it("is the one passed in, inside UiRoot or outside it", () => {
        const { registry, state } = setup();
        const other = createCommandRegistry({ menus: ["View"] });
        other.register({
            id: "view.zoom-in",
            title: "Zoom In Further",
            enabled: () => false,
            run() {},
        });
        expect(underUiRoot(registry, createElement(Titles, { registry: other }))).toBe(
            "<p>Zoom In Further</p>",
        );
        state.zoom = 8;
        expect(renderToStaticMarkup(createElement(ZoomState, { registry }))).toBe("<p>no zoom</p>");
    });

    it("is missing outside UiRoot without one passed: the hooks throw", () => {
        expect(() => renderToStaticMarkup(createElement(Titles))).toThrow(
            "useCommands: no command registry here; render the component under UiRoot or pass one.",
        );
        expect(() => renderToStaticMarkup(createElement(ZoomState))).toThrow(
            "useCommandValue: no command registry here",
        );
    });
});
