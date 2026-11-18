import { describe, expect, it } from "vitest";
import { createCommandRegistry } from "../../src/model/commands/registry.ts";
import type { Command } from "../../src/model/commands/types.ts";
import { createCommandTracker } from "../../src/ui/commands/commandTracker.ts";
import { mount } from "./support/external-store.ts";

// `useCommands` renders a component again only when a command it read changed (SPEC §2
// Command refresh, §7.1): every refresh of the registry used to render every component that
// lists commands. The tracker is the store `useCommands` reads; these cases pin when its
// snapshot changes, and mount it as `useSyncExternalStore` does to count a component's renders.

function setup() {
    const registry = createCommandRegistry({ menus: ["File", "Edit"] });
    const state = { save: true, open: true, title: "Undo", unread: 0 };
    registry.register({ id: "file.save", title: "Save", enabled: () => state.save, run() {} });
    registry.register({ id: "file.open", title: "Open", enabled: () => state.open, run() {} });
    registry.register({ id: "edit.undo", title: () => state.title, run() {} });
    const tracker = createCommandTracker(registry);
    const find = (id: string): Command => {
        const command = tracker.commands().find((each) => each.id === id);
        if (!command) throw new Error(`No command ${id}.`);
        return command;
    };
    return { registry, state, tracker, find };
}

/** A component reading Save's enabled state and Undo's title, mounted on the tracker. */
function mountReader(setupResult: ReturnType<typeof setup>) {
    const { registry, tracker, find } = setupResult;
    return mount(registry.subscribe, tracker.snapshot, () => {
        find("file.save").enabled();
        find("edit.undo").title();
    });
}

describe("useCommands tracker", () => {
    it("renders a component that read commands A and B again when A's enabled() changes", () => {
        const fixture = setup();
        const reader = mountReader(fixture);
        fixture.state.save = false;
        fixture.registry.refresh();
        expect(reader.renders).toBe(2);
        reader.unmount();
    });

    it("renders it again when B's title() changes", () => {
        const fixture = setup();
        const reader = mountReader(fixture);
        fixture.state.title = "Undo Stamp Brush";
        fixture.registry.refresh();
        expect(reader.renders).toBe(2);
        reader.unmount();
    });

    it("does not render it when only command C, which it did not read, changes", () => {
        const fixture = setup();
        const reader = mountReader(fixture);
        fixture.state.open = false;
        fixture.registry.refresh();
        expect(reader.renders).toBe(1);
        reader.unmount();
    });

    it("does not render it when a store changes without changing a read result", () => {
        const fixture = setup();
        const reader = mountReader(fixture);
        fixture.state.unread += 1;
        fixture.registry.refresh();
        fixture.registry.refresh();
        expect(reader.renders).toBe(1);
        reader.unmount();
    });

    it("keeps its snapshot through a refresh that changes nothing the component read", () => {
        const { registry, state, tracker, find } = setup();
        const before = tracker.snapshot();
        expect(find("file.save").enabled()).toBe(true);
        expect(find("edit.undo").title()).toBe("Undo");
        // `file.open` was never read: its change is not the component's.
        state.open = false;
        registry.refresh();
        expect(tracker.snapshot()).toBe(before);
    });

    it("changes its snapshot when a read command's enabled state changes, once", () => {
        const { registry, state, tracker, find } = setup();
        const before = tracker.snapshot();
        find("file.save").enabled();
        state.save = false;
        registry.refresh();
        const after = tracker.snapshot();
        expect(after).not.toBe(before);
        // Stable until the next change, as useSyncExternalStore needs.
        expect(tracker.snapshot()).toBe(after);
        expect(find("file.save").enabled()).toBe(false);
        expect(tracker.snapshot()).toBe(after);
    });

    it("changes its snapshot when a read command's title changes", () => {
        const { registry, state, tracker, find } = setup();
        const before = tracker.snapshot();
        find("edit.undo").title();
        state.title = "Undo Stamp Brush";
        registry.refresh();
        expect(tracker.snapshot()).not.toBe(before);
    });

    it("changes its snapshot when a command is added or removed", () => {
        const { registry, tracker } = setup();
        const before = tracker.snapshot();
        const remove = registry.register({ id: "view.fit", title: "Fit", run() {} });
        const added = tracker.snapshot();
        expect(added).not.toBe(before);
        remove();
        expect(tracker.snapshot()).not.toBe(added);
    });

    it("reads a command afresh when a registered command replaces its planned one", () => {
        const registry = createCommandRegistry({ menus: ["Edit"] });
        registry.plan({ id: "edit.fill", title: "Fill", menuPath: ["Edit"] });
        registry.register({ id: "edit.copy", title: "Copy", run() {} });
        const tracker = createCommandTracker(registry);
        const fill = () => tracker.commands().find((command) => command.id === "edit.fill")!;
        const reader = mount(registry.subscribe, tracker.snapshot, () => fill().enabled());
        expect(fill().enabled()).toBe(false);
        // The id list is unchanged; the planned command is replaced under its id.
        registry.register({ id: "edit.fill", title: "Fill", run() {} });
        expect(reader.renders).toBe(2);
        expect(fill().enabled()).toBe(true);
        reader.unmount();
    });

    it("keeps each command's identity across refreshes", () => {
        const { registry, tracker, find } = setup();
        const save = find("file.save");
        registry.refresh();
        expect(find("file.save")).toBe(save);
        expect(tracker.commands()).toHaveLength(3);
    });

    it("hands out commands that run and report as the registry's", async () => {
        const registry = createCommandRegistry({ menus: ["Edit"] });
        let ran = 0;
        registry.register({
            id: "edit.go",
            title: "Go",
            shortcut: "Ctrl+G",
            run: () => void ran++,
        });
        const tracker = createCommandTracker(registry);
        const [command] = tracker.commands();
        await command!.run();
        expect(ran).toBe(1);
        expect(command!.shortcuts).toEqual(registry.get("edit.go")!.shortcuts);
    });

    it("runs what the registry's command runs at the call, not when the copy was handed out", async () => {
        const registry = createCommandRegistry({ menus: ["Edit"] });
        const calls: string[] = [];
        registry.register({
            id: "edit.go",
            title: "Go",
            run: () => void calls.push("run"),
            release: () => void calls.push("release"),
        });
        const tracker = createCommandTracker(registry);
        const [copy] = tracker.commands();
        // An editor wraps the registry's command after the copy was handed out.
        const command = registry.get("edit.go")!;
        const { run } = command;
        command.run = () => {
            calls.push("wrapped run");
            return run();
        };
        await copy!.run();
        copy!.release?.();
        expect(calls).toEqual(["wrapped run", "run", "release"]);
    });
});
