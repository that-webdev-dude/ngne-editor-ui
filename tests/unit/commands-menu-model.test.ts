import { describe, expect, it } from "vitest";
import {
    buildContextMenu,
    buildMenu,
    buildMenuBar,
    createCommandRegistry,
    menuBarProblems,
    menuCommands,
} from "../../src/ui/commands/index.ts";
import type { CommandSpec, MenuNode, PlannedCommandSpec } from "../../src/ui/commands/index.ts";

// The menu model (SPEC §7.1, DESIGN §8): the menu bar in the editor's order with groups,
// submenus and planned commands, context menus, and the rule every menu bar follows (a View
// menu, Help last).

const SPRITE_MENUS = ["File", "Edit", "Sprite", "Layer", "Frame", "Select", "View", "Help"];
/** The tilemap editor's menu bar; it gains Help at its migration onto the package. */
const TILEMAP_MENUS = ["File", "Edit", "Map", "Layer", "Tileset", "Select", "View"];

const run = () => {};
const spec = (
    id: string,
    rest: Partial<CommandSpec<string, never>> = {},
): CommandSpec<string, never> => ({
    id,
    title: id,
    run,
    ...rest,
});

/** A menu as text: ids, "---" for a separator, "Title > [...]" for a submenu. */
function outline(nodes: readonly MenuNode[]): (string | object)[] {
    return nodes.map((node) => {
        if (node.kind === "command") return node.command.id;
        if (node.kind === "separator") return "---";
        return { [node.title]: outline(node.children) };
    });
}

describe("menus generated from the registry", () => {
    it("orders items, separates groups and nests submenus", () => {
        const registry = createCommandRegistry({ menus: SPRITE_MENUS });
        const file = (id: string, menuOrder?: number, path: [string, ...string[]] = ["File"]) =>
            registry.register(spec(id, { menuPath: path, menuOrder }));
        file("save", 200);
        file("open", 110);
        file("new", 100);
        file("close", 500);
        file("recent-b", 125, ["File", "Open Recent"]);
        file("recent-a", 120, ["File", "Open Recent"]);
        file("clear-recent", 300, ["File", "Open Recent"]);
        file("unordered-b");
        file("unordered-a");
        registry.register(spec("undo", { menuPath: ["Edit"] }));
        registry.register(spec("no-menu"));

        expect(outline(buildMenu(registry.list(), ["File"]))).toEqual([
            "new",
            "open",
            { "Open Recent": ["recent-a", "recent-b", "---", "clear-recent"] },
            "---",
            "save",
            "---",
            "close",
            "---",
            "unordered-a",
            "unordered-b",
        ]);
        expect(outline(buildMenu(registry.list(), ["Edit"]))).toEqual(["undo"]);
        expect(buildMenu(registry.list(), ["View"])).toEqual([]);
        expect(
            menuCommands(buildMenu(registry.list(), ["File"])).map((command) => command.id),
        ).toContain("recent-a");
    });

    it("breaks ties between equal orders by id in code-unit order", () => {
        const registry = createCommandRegistry({ menus: SPRITE_MENUS });
        for (const id of ["view.b", "view.B", "view.a"]) {
            registry.register(spec(id, { menuPath: ["View"], menuOrder: 100 }));
        }
        expect(outline(buildMenu(registry.list(), ["View"]))).toEqual([
            "view.B",
            "view.a",
            "view.b",
        ]);
    });

    it("lays planned items out in separated groups, in the order planned", () => {
        const plans: PlannedCommandSpec[] = [
            { id: "file.new", title: "New…", menuPath: ["File"], menuOrder: 100 },
            { id: "file.open", title: "Open…", menuPath: ["File"], menuOrder: 110 },
            { id: "file.save", title: "Save", menuPath: ["File"], menuOrder: 200 },
            { id: "file.saveAs", title: "Save As…", menuPath: ["File"], menuOrder: 210 },
            { id: "file.close", title: "Close", menuPath: ["File"], menuOrder: 900 },
            { id: "edit.cut", title: "Cut", menuPath: ["Edit"], menuOrder: 200 },
        ];
        const registry = createCommandRegistry({ menus: SPRITE_MENUS });
        for (const plan of plans) registry.plan(plan, "./planned.commands.ts");
        expect(outline(buildMenu(registry.list(), ["File"]))).toEqual([
            "file.new",
            "file.open",
            "---",
            "file.save",
            "file.saveAs",
            "---",
            "file.close",
        ]);
        // Edit keeps its first group free for Undo and Redo.
        expect(outline(buildMenu(registry.list(), ["Edit"]))).toEqual(["edit.cut"]);
        registry.register(spec("edit.undo", { menuPath: ["Edit"], menuOrder: 100 }));
        expect(outline(buildMenu(registry.list(), ["Edit"]))).toEqual([
            "edit.undo",
            "---",
            "edit.cut",
        ]);
        const [save] = menuCommands(buildMenu(registry.list(), ["File"])).filter(
            (command) => command.id === "file.save",
        );
        expect(save).toMatchObject({ planned: true });
        expect(save?.enabled()).toBe(false);
    });
});

describe("the menu bar", () => {
    for (const [name, menus] of [
        ["sprite editor", SPRITE_MENUS],
        ["tilemap editor with Help", [...TILEMAP_MENUS, "Help"]],
    ] as const) {
        it(`lists the menus in the editor's order with groups and planned commands: ${name}`, () => {
            const registry = createCommandRegistry({ menus });
            registry.plan({ id: "file.save", title: "Save", menuPath: ["File"], menuOrder: 200 });
            registry.plan({ id: "layer.new", title: "New Layer", menuPath: ["Layer"] });
            registry.register(spec("file.open", { menuPath: ["File"], menuOrder: 100 }));
            registry.register(spec("help.about", { menuPath: ["Help"], menuOrder: 900 }));
            registry.register(spec("help.keys", { menuPath: ["Help"], menuOrder: 100 }));
            registry.register(spec("view.licences", { menuPath: ["View"], menuOrder: 900 }));

            const bar = buildMenuBar(registry);
            expect(bar.map((entry) => entry.menu)).toEqual(menus);
            const outlines = Object.fromEntries(
                bar.map((entry) => [entry.menu, outline(entry.items)]),
            );
            expect(outlines.File).toEqual(["file.open", "---", "file.save"]);
            expect(outlines.Layer).toEqual(["layer.new"]);
            expect(outlines.View).toEqual(["view.licences"]);
            expect(outlines.Help).toEqual(["help.keys", "---", "help.about"]);
            expect(outlines.Select).toEqual([]);

            // Each item is the registry's own entry, and each command with a menu path is in
            // the bar once.
            const items = bar.flatMap((entry) => menuCommands(entry.items));
            for (const command of items) expect(registry.get(command.id)).toBe(command);
            expect(items.map((command) => command.id).sort()).toEqual(
                registry.list().map((command) => command.id),
            );
        });
    }

    it("reports a menu bar without View, or not ending with Help (DESIGN §8)", () => {
        expect(menuBarProblems(SPRITE_MENUS)).toEqual([]);
        expect(menuBarProblems([...TILEMAP_MENUS, "Help"])).toEqual([]);
        expect(menuBarProblems(TILEMAP_MENUS)).toEqual([
            'The menu bar ends with "View"; it ends with "Help".',
        ]);
        expect(menuBarProblems(["File", "Edit", "Help"])).toEqual([
            'The menu bar has no "View" menu.',
        ]);
        expect(menuBarProblems(["File", "Help", "View"])).toEqual([
            'The menu bar ends with "View"; it ends with "Help".',
        ]);
        expect(menuBarProblems(["File"])).toEqual([
            'The menu bar has no "View" menu.',
            'The menu bar ends with "File"; it ends with "Help".',
        ]);
        expect(menuBarProblems([])).toEqual([
            'The menu bar has no "View" menu.',
            'The menu bar is empty; it ends with "Help".',
        ]);
    });
});

describe("context menus generated from the registry", () => {
    it("lists the commands of one context menu in order, with separators", () => {
        const registry = createCommandRegistry({ menus: SPRITE_MENUS });
        registry.register(spec("layer.flatten", { contextMenus: [{ menu: "layer", order: 210 }] }));
        registry.register(
            spec("layer.mergeDown", {
                menuPath: ["Layer"],
                contextMenus: [{ menu: "layer", order: 200 }],
            }),
        );
        registry.register(
            spec("properties", {
                contextMenus: [
                    { menu: "layer", order: 100 },
                    { menu: "cel", order: 100 },
                ],
            }),
        );
        registry.register(spec("cel.clear", { contextMenus: [{ menu: "cel" }] }));
        expect(outline(buildContextMenu(registry.list(), "layer"))).toEqual([
            "properties",
            "---",
            "layer.mergeDown",
            "layer.flatten",
        ]);
        expect(outline(buildContextMenu(registry.list(), "cel"))).toEqual([
            "properties",
            "---",
            "cel.clear",
        ]);
        expect(buildContextMenu(registry.list(), "tag")).toEqual([]);
    });
});
