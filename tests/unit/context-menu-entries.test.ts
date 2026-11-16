import { afterEach, describe, expect, it, vi } from "vitest";
import { createCommandRegistry } from "../../src/model/commands/registry.ts";
import { contextMenuEntries } from "../../src/ui/commands/contextMenu.ts";
import { reportCommandError, runCommand } from "../../src/ui/commands/runCommand.ts";
import { toast } from "../../src/ui/messages/toast.ts";
import type { ContextMenuEntry } from "../../src/ui/primitives/ContextMenu.tsx";

// Running commands from the interface (SPEC §7.1; DESIGN §4 Context menu, Toast): the entries
// of a context menu built from the commands that name it, each with its first chord, disabled
// ones listed and inert; `runCommand` by id; a failing command reported by an error toast.
// tests/e2e/context-menu.spec.ts covers the same on the demo editor's rows.

function setup() {
    const registry = createCommandRegistry({ menus: ["Edit"] });
    const state = { canMove: false, runs: [] as string[] };
    registry.register({
        id: "row.duplicate",
        title: "Duplicate Row",
        shortcut: ["Ctrl+D", "Ctrl+Shift+D"],
        contextMenus: [{ menu: "row", order: 100 }],
        run: () => void state.runs.push("duplicate"),
    });
    registry.register({
        id: "row.move-up",
        title: "Move Row Up",
        shortcut: "Alt+ArrowUp",
        contextMenus: [{ menu: "row", order: 200 }],
        enabled: () => state.canMove,
        run: () => void state.runs.push("move-up"),
    });
    registry.register({
        id: "row.export",
        title: "Export Row",
        contextMenus: [{ menu: "row", order: 300 }],
        run: () => {
            throw new Error("no exporter");
        },
    });
    registry.register({
        id: "row.reject",
        title: "Upload Row",
        contextMenus: [{ menu: "row", order: 310 }],
        run: () => Promise.reject(new Error("offline")),
    });
    registry.register({
        id: "cel.clear",
        title: "Clear Cel",
        contextMenus: [{ menu: "cel" }],
        run: () => void state.runs.push("clear"),
    });
    return { registry, state };
}

const items = (entries: readonly ContextMenuEntry[]) =>
    entries.filter((entry) => entry.type !== "separator");

const errorToasts = () =>
    toast.store
        .getState()
        .toasts.filter((item) => item.kind === "error")
        .map((item) => item.message);

describe("context-menu entries", () => {
    afterEach(() => {
        for (const item of toast.store.getState().toasts) toast.dismiss(item.id);
        vi.restoreAllMocks();
    });

    it("list the commands that name the menu, in order, with separators between hundreds", () => {
        const { registry } = setup();
        const entries = contextMenuEntries("row", registry.list());
        expect(entries.map((entry) => (entry.type === "separator" ? "—" : entry.label))).toEqual([
            "Duplicate Row",
            "—",
            "Move Row Up",
            "—",
            "Export Row",
            "Upload Row",
        ]);
    });

    it("show each command's first chord as menus show it", () => {
        const { registry } = setup();
        const shortcuts = items(contextMenuEntries("row", registry.list())).map(
            (entry) => entry.shortcut ?? null,
        );
        expect(shortcuts).toEqual(["Ctrl+D", "Alt+↑", null, null]);
    });

    it("keep disabled commands, marked disabled and inert", () => {
        const { registry, state } = setup();
        const moveUp = () =>
            items(contextMenuEntries("row", registry.list())).find(
                (entry) => entry.id === "row.move-up",
            )!;
        const entry = moveUp();
        expect(entry.disabled).toBe(true);
        entry.onSelect();
        expect(state.runs).toEqual([]);

        state.canMove = true;
        const enabled = moveUp();
        expect(enabled.disabled).toBe(false);
        enabled.onSelect();
        expect(state.runs).toEqual(["move-up"]);
    });

    it("run the chosen command, and report a failure as an error toast", async () => {
        const { registry, state } = setup();
        vi.spyOn(console, "error").mockImplementation(() => {});
        for (const entry of items(contextMenuEntries("row", registry.list()))) entry.onSelect();
        expect(state.runs).toEqual(["duplicate"]);
        await Promise.resolve();
        expect(errorToasts()).toEqual([
            "Export Row failed: no exporter",
            "Upload Row failed: offline",
        ]);
    });
});

describe("runCommand", () => {
    afterEach(() => {
        for (const item of toast.store.getState().toasts) toast.dismiss(item.id);
        vi.restoreAllMocks();
    });

    it("runs an enabled command of the registry by id", () => {
        const { registry, state } = setup();
        expect(runCommand(registry, "cel.clear")).toBe(true);
        expect(state.runs).toEqual(["clear"]);
    });

    it("returns false for a missing or disabled command, without running it", () => {
        const { registry, state } = setup();
        expect(runCommand(registry, "cel.missing")).toBe(false);
        expect(runCommand(registry, "row.move-up")).toBe(false);
        expect(state.runs).toEqual([]);
    });

    it("reports a failure in the console and as an error toast, and returns true", () => {
        const { registry } = setup();
        const logged = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(runCommand(registry, "row.export")).toBe(true);
        expect(errorToasts()).toEqual(["Export Row failed: no exporter"]);
        expect(logged).toHaveBeenCalledWith("Command row.export failed:", expect.any(Error));
    });

    it("reports what is not an Error by its text", () => {
        const { registry } = setup();
        vi.spyOn(console, "error").mockImplementation(() => {});
        reportCommandError("disk full", registry.get("cel.clear")!);
        expect(errorToasts()).toEqual(["Clear Cel failed: disk full"]);
    });
});
