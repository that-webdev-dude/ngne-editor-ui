import { describe, expect, it } from "vitest";
import {
    buildMenuBar,
    createCommandRegistry,
    formatChord,
    menuCommands,
    OTHER_SHORTCUTS,
    shortcutGroups,
} from "../../src/ui/commands/index.ts";
import type { CommandRegistry, CommandSpec, ShortcutGroup } from "../../src/ui/commands/index.ts";

// The shortcut sheet as generated from the registry (SPEC §7.1, DESIGN §7): exactly the
// registry's shortcuts, grouped by the editor's menus in their order, the commands outside the
// menus under "Other", last; each chord the canonical one the menus display.

const SPRITE_MENUS = ["File", "Edit", "Sprite", "Layer", "Frame", "Select", "View", "Help"];
/** The tilemap editor's menu bar, with the Help menu it gains at its migration. */
const TILEMAP_MENUS = ["File", "Edit", "Map", "Layer", "Tileset", "Select", "View", "Help"];

type Spec = CommandSpec<string, "timeline">;

function spec(id: string, overrides: Partial<Spec> = {}): Spec {
    return { id, title: id, run() {}, ...overrides };
}

function registryOf(
    menus: readonly string[],
    ...specs: Spec[]
): CommandRegistry<string, "timeline"> {
    const registry = createCommandRegistry<string, "timeline">({
        menus,
        contexts: ["timeline"],
    });
    for (const each of specs) registry.register(each);
    return registry;
}

const sheetOf = (registry: CommandRegistry<string, "timeline">) =>
    shortcutGroups(registry.list(), registry.menus);

/** Every binding as "command chord", sorted: what the sheet and the registry are compared by. */
function sheetBindings(groups: readonly ShortcutGroup[]): string[] {
    return groups
        .flatMap((group) =>
            group.rows.flatMap((row) => row.chords.map((chord) => `${row.command.id} ${chord}`)),
        )
        .sort();
}

function registryBindings(registry: CommandRegistry<string, "timeline">): string[] {
    return registry
        .list()
        .flatMap((command) => command.shortcuts.map((chord) => `${command.id} ${chord}`))
        .sort();
}

/** The sheet as `{ group: ["command: chord, chord"] }`. */
function outline(groups: readonly ShortcutGroup[]): Record<string, string[]> {
    return Object.fromEntries(
        groups.map((group) => [
            group.title,
            group.rows.map((row) => `${row.command.id}: ${row.chords.join(", ")}`),
        ]),
    );
}

const registry = registryOf(
    SPRITE_MENUS,
    spec("view.zoomIn", { shortcut: "Ctrl+Plus", menuPath: ["View"], menuOrder: 110 }),
    spec("view.fit", { shortcut: "0", context: "canvas", menuPath: ["View"], menuOrder: 100 }),
    spec("edit.redo", {
        title: "Redo",
        shortcut: ["Ctrl+Y", "Ctrl+Shift+Z"],
        menuPath: ["Edit"],
        menuOrder: 110,
    }),
    spec("edit.undo", {
        title: () => "Undo Pencil",
        shortcut: "Ctrl+Z",
        menuPath: ["Edit"],
        menuOrder: 100,
        enabled: () => false,
    }),
    spec("edit.fill", { menuPath: ["Edit"], menuOrder: 120 }),
    spec("file.recent.clear", { shortcut: "Alt+F8", menuPath: ["File", "Open Recent"] }),
    spec("tool.pencil", { title: "Pencil", shortcut: "B", context: "canvas" }),
    spec("tool.hand", {
        title: "Hand",
        shortcut: "Space",
        context: "canvas",
        release() {},
    }),
    spec("frame.next", {
        title: "Next Frame",
        shortcut: "ArrowRight",
        context: ["canvas", "timeline"],
    }),
    spec("no.shortcut"),
);

describe("the shortcut sheet", () => {
    it("lists exactly the registry's shortcuts", () => {
        const groups = sheetOf(registry);
        expect(sheetBindings(groups)).toEqual(registryBindings(registry));
        // Every command with a shortcut once, with all its chords in the order it lists them.
        const rows = groups.flatMap((group) => group.rows);
        expect(new Set(rows.map((row) => row.command.id)).size).toBe(rows.length);
        for (const row of rows) {
            expect(row.command).toBe(registry.get(row.command.id));
            expect(row.chords).toEqual(row.command.shortcuts);
            expect(row.chords.length).toBeGreaterThan(0);
        }
        expect(rows.map((row) => row.command.id)).not.toContain("no.shortcut");
        expect(rows.map((row) => row.command.id)).not.toContain("edit.fill");
    });

    it("follows the registry: a command registered later is on the sheet, a removed one is not", () => {
        const own = registryOf(
            SPRITE_MENUS,
            spec("edit.undo", { shortcut: "Ctrl+Z", menuPath: ["Edit"] }),
        );
        const sheet = () =>
            sheetOf(own).flatMap((group) =>
                group.rows.map(
                    (row) => `${group.title}: ${row.command.id} ${row.chords.join(",")}`,
                ),
            );
        expect(sheet()).toEqual(["Edit: edit.undo Ctrl+Z"]);
        const removeLayer = own.register(spec("layer.new", { shortcut: "Shift+N" }));
        const removeHand = own.register(
            spec("tool.hand", { shortcut: "Space", context: "canvas", release() {} }),
        );
        expect(sheet()).toEqual([
            "Edit: edit.undo Ctrl+Z",
            `${OTHER_SHORTCUTS}: layer.new Shift+N`,
            `${OTHER_SHORTCUTS}: tool.hand Space`,
        ]);
        expect(
            sheetOf(own)
                .at(-1)
                ?.rows.map((row) => row.hold),
        ).toEqual([false, true]);
        removeLayer();
        removeHand();
        expect(sheet()).toEqual(["Edit: edit.undo Ctrl+Z"]);
    });

    it("groups the commands by menu, in the order of the menu bar and of each menu", () => {
        expect(outline(sheetOf(registry))).toEqual({
            File: ["file.recent.clear: Alt+F8"],
            Edit: ["edit.undo: Ctrl+Z", "edit.redo: Ctrl+Y, Ctrl+Shift+Z"],
            View: ["view.fit: 0", "view.zoomIn: Ctrl++"],
            [OTHER_SHORTCUTS]: ["tool.hand: Space", "frame.next: ArrowRight", "tool.pencil: B"],
        });
        const titles = sheetOf(registry).map((group) => group.title);
        expect(titles).toEqual([
            ...SPRITE_MENUS.filter((menu) => titles.includes(menu)),
            OTHER_SHORTCUTS,
        ]);
    });

    it.each([
        ["sprite editor", SPRITE_MENUS],
        ["tilemap editor", TILEMAP_MENUS],
        ["reversed menu bar", ["View", "Select", "Layer", "Edit", "File", "Help"]],
    ])("groups in the %s's menu order, with Other last", (_, menus) => {
        const specs = [
            spec("tool.pencil", { shortcut: "B", context: "canvas" }),
            spec("help.shortcuts", { shortcut: "?", context: "canvas", menuPath: ["Help"] }),
            spec("view.grid", { shortcut: "Ctrl+'", menuPath: ["View"] }),
            spec("select.all", { shortcut: "Ctrl+A", menuPath: ["Select"] }),
            spec("layer.new", { shortcut: "Shift+N", menuPath: ["Layer"] }),
            spec("edit.undo", { shortcut: "Ctrl+Z", menuPath: ["Edit"] }),
            spec("file.new", { shortcut: "Ctrl+Alt+N", menuPath: ["File"] }),
        ];
        const titles = sheetOf(registryOf(menus, ...specs)).map((group) => group.title);
        const used = ["File", "Edit", "Layer", "Select", "View", "Help"];
        expect(titles).toEqual([...menus.filter((menu) => used.includes(menu)), OTHER_SHORTCUTS]);
    });

    it("puts the commands outside the menus in a last group, ordered by title", () => {
        const groups = sheetOf(registry);
        expect(groups.at(-1)?.title).toBe("Other");
        expect(groups.at(-1)?.rows.map((row) => row.title)).toEqual([
            "Hand",
            "Next Frame",
            "Pencil",
        ]);
    });

    it("leaves out a menu without shortcuts, and the last group when it is empty", () => {
        const own = registryOf(
            SPRITE_MENUS,
            spec("edit.undo", { shortcut: "Ctrl+Z", menuPath: ["Edit"] }),
            spec("layer.flatten", { menuPath: ["Layer"] }),
        );
        expect(Object.keys(outline(sheetOf(own)))).toEqual(["Edit"]);
        expect(sheetOf(registryOf(SPRITE_MENUS))).toEqual([]);
    });

    it("lists a disabled command too, with the title it has now", () => {
        const edit = sheetOf(registry).find((group) => group.title === "Edit");
        expect(edit?.rows[0]).toMatchObject({ title: "Undo Pencil", chords: ["Ctrl+Z"] });
        expect(edit?.rows[0]?.command.enabled()).toBe(false);
    });

    it("marks the bindings that act while the key is held", () => {
        const rows = sheetOf(registry).flatMap((group) => group.rows);
        expect(rows.filter((row) => row.hold).map((row) => row.command.id)).toEqual(["tool.hand"]);
    });

    it("gives the chords the menus display: the menu item's chord first, each shown alike", () => {
        const menuChord = new Map(
            buildMenuBar(registry)
                .flatMap((entry) => menuCommands(entry.items))
                .map((command) => [command.id, command.shortcuts[0]]),
        );
        const menuRows = sheetOf(registry)
            .filter((group) => group.title !== OTHER_SHORTCUTS)
            .flatMap((group) => group.rows);
        expect(menuRows.length).toBeGreaterThan(0);
        for (const row of menuRows) {
            expect(row.chords[0], row.command.id).toBe(menuChord.get(row.command.id));
        }
        const shown = Object.fromEntries(
            sheetOf(registry)
                .flatMap((group) => group.rows)
                .map((row) => [row.command.id, row.chords.map(formatChord)]),
        );
        expect(shown).toMatchObject({
            "view.zoomIn": ["Ctrl++"],
            "edit.redo": ["Ctrl+Y", "Ctrl+Shift+Z"],
            "frame.next": ["→"],
            "tool.hand": ["Space"],
        });
    });
});
