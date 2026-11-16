import { describe, expect, it } from "vitest";
import {
    createCommandRegistry,
    fuzzyScore,
    MAX_RECENT_COMMANDS,
    paletteEntries,
    paletteScore,
    runPaletteCommand,
    withRecentCommand,
} from "../../src/ui/commands/index.ts";
import type { Command, CommandRegistry, CommandSpec } from "../../src/ui/commands/index.ts";

// The command palette without the interface (SPEC §7.1, DESIGN §4): fuzzy search over the
// registry, the order of its rows (recent commands first, in the editor's menu order), and how
// a chosen command runs. Disabled commands are listed, flagged and inert.

const SPRITE_MENUS = ["File", "Edit", "Sprite", "Layer", "Frame", "Select", "View", "Help"];
/** The tilemap editor's menu bar, with the Help menu it gains at its migration. */
const TILEMAP_MENUS = ["File", "Edit", "Map", "Layer", "Tileset", "Select", "View", "Help"];

type Spec = CommandSpec<string, never>;

function spec(id: string, overrides: Partial<Spec> = {}): Spec {
    return { id, title: id, run() {}, ...overrides };
}

/** A registry over `menus` with the given commands, registered in this order. */
function registryOf(menus: readonly string[], ...specs: Spec[]): CommandRegistry<string, never> {
    const registry = createCommandRegistry({ menus });
    for (const each of specs) registry.register(each);
    return registry;
}

const spriteRegistry = (...specs: Spec[]) => registryOf(SPRITE_MENUS, ...specs);

function command(registry: CommandRegistry<string, never>, id: string): Command<string, never> {
    const found = registry.get(id);
    if (!found) throw new Error(`no command ${id}`);
    return found;
}

/** The ids of the palette rows for a query. */
function rows(
    registry: CommandRegistry<string, never>,
    query = "",
    recent: readonly string[] = [],
): string[] {
    return paletteEntries(registry.list(), registry.menus, recent, query).map(
        (entry) => entry.command.id,
    );
}

/** The score of a term that must match. */
function score(term: string, text: string): number {
    const value = fuzzyScore(term, text);
    if (value === null) throw new Error(`"${term}" does not match "${text}"`);
    return value;
}

describe("fuzzy matching", () => {
    it("matches the characters of the term in order, not necessarily adjacent", () => {
        expect(fuzzyScore("undo", "Undo")).not.toBeNull();
        expect(fuzzyScore("nsp", "New Sprite…")).not.toBeNull();
        expect(fuzzyScore("flh", "Flip Horizontal")).not.toBeNull();
        expect(fuzzyScore("e", "Paste")).not.toBeNull();
        expect(fuzzyScore("cmdpal", "Command Palette…")).not.toBeNull();
    });

    it("does not match characters that are missing or out of order", () => {
        expect(fuzzyScore("undox", "Undo")).toBeNull();
        expect(fuzzyScore("odnu", "Undo")).toBeNull();
        expect(fuzzyScore("z", "New Sprite…")).toBeNull();
        expect(fuzzyScore("uu", "Undo")).toBeNull();
        expect(fuzzyScore("a", "")).toBeNull();
    });

    it("ignores case", () => {
        expect(score("UNDO", "undo")).toBe(score("undo", "Undo"));
        expect(score("New", "NEW SPRITE")).toBe(score("new", "new sprite"));
    });

    it("matches everything with an empty term, with no preference", () => {
        expect(fuzzyScore("", "Undo")).toBe(0);
        expect(fuzzyScore("", "")).toBe(0);
    });

    it("prefers characters next to each other over scattered ones", () => {
        expect(score("save", "Save As…")).toBeGreaterThan(score("save", "Sprite: Advanced Values"));
        expect(score("und", "Undo")).toBeGreaterThan(score("und", "Duplicate Round"));
    });

    it("prefers the start of a word over its middle", () => {
        expect(score("s", "Save")).toBeGreaterThan(score("s", "Paste"));
        expect(score("ns", "New Sprite…")).toBeGreaterThan(score("ns", "Transform"));
        expect(score("f", "New Frame")).toBeGreaterThan(score("f", "Deflate"));
    });

    it("finds the best place for the term, not the first one", () => {
        // The letters of "save" are scattered before the word itself.
        const scattered = score("save", "Sprite: Advanced Values");
        expect(score("save", "Sprite: Advanced Values, Save")).toBeGreaterThan(scattered + 5);
        expect(score("save", "Sprite: Advanced Values, Save")).toBeGreaterThan(
            score("save", "Sprite: Advanced Values, S a v e"),
        );
    });

    it("prefers a match near the start of the text", () => {
        expect(score("grid", "Grid")).toBeGreaterThan(score("grid", "Pixel Grid"));
    });
});

describe("palette search", () => {
    it("needs every term of the query, in the title or in the menu path", () => {
        expect(paletteScore("sprite prop", "Properties…", "Sprite")).not.toBeNull();
        expect(paletteScore("prop sprite", "Properties…", "Sprite")).not.toBeNull();
        expect(paletteScore("new sp", "New Sprite…", "File")).not.toBeNull();
        expect(paletteScore("layer prop", "Properties…", "Sprite")).toBeNull();
        expect(paletteScore("file", "Focus Next Region", "")).toBeNull();
    });

    it("does not join the menu path and the title into one text", () => {
        // "pref" is in "Sprite Flip Canvas Horizontal" letter by letter, across both.
        expect(paletteScore("pref", "Flip Canvas Horizontal", "Sprite")).toBeNull();
        expect(paletteScore("pref", "Preferences…", "Edit")).not.toBeNull();
    });

    it("ignores white space around the query and matches all with an empty one", () => {
        expect(paletteScore("", "Undo", "Edit")).toBe(0);
        expect(paletteScore("   ", "Undo", "Edit")).toBe(0);
        expect(paletteScore("  undo ", "Undo", "Edit")).toBe(paletteScore("undo", "Undo", "Edit"));
    });

    it("counts a term in the title more than the same term in the menu path", () => {
        const inTitle = paletteScore("frame", "New Empty Frame", "Edit");
        const inPath = paletteScore("frame", "Play / Pause", "Frame");
        expect(inTitle).not.toBeNull();
        expect(inPath).not.toBeNull();
        expect(inTitle ?? 0).toBeGreaterThan(inPath ?? 0);
    });
});

describe("palette rows", () => {
    const registry = spriteRegistry(
        spec("view.zoomIn", { title: "Zoom In", menuPath: ["View"], menuOrder: 100 }),
        spec("file.save", { title: "Save", menuPath: ["File"], menuOrder: 200 }),
        spec("file.new", { title: "New Sprite…", menuPath: ["File"], menuOrder: 100 }),
        spec("file.recent.b", { title: "b.ngsprite", menuPath: ["File", "Open Recent"] }),
        spec("tool.pencil", { title: "Pencil", shortcut: "B", context: "canvas" }),
        spec("focus.next", { title: "Focus Next Region", shortcut: "F6" }),
        spec("edit.undo", {
            title: () => "Undo Pencil",
            menuPath: ["Edit"],
            enabled: () => false,
        }),
    );

    it("lists every command of the registry, enabled or not, once", () => {
        expect(rows(registry).sort()).toEqual(
            registry
                .list()
                .map((entry) => entry.id)
                .sort(),
        );
        expect(command(registry, "edit.undo").enabled()).toBe(false);
        expect(rows(registry)).toContain("edit.undo");
    });

    it("flags each row with the command's state when the list was made", () => {
        let enabled = false;
        const own = spriteRegistry(
            spec("edit.undo", { menuPath: ["Edit"], enabled: () => enabled }),
            spec("edit.fill", { menuPath: ["Edit"] }),
        );
        const flags = () =>
            Object.fromEntries(
                paletteEntries(own.list(), own.menus, [], "").map((entry) => [
                    entry.command.id,
                    entry.enabled,
                ]),
            );
        expect(flags()).toEqual({ "edit.undo": false, "edit.fill": true });
        enabled = true;
        expect(flags()).toEqual({ "edit.undo": true, "edit.fill": true });
    });

    it("flags a command the registry's gate rejects as disabled", () => {
        const gated = createCommandRegistry({
            menus: SPRITE_MENUS,
            commandGate: (each) => each.id !== "file.save",
        });
        gated.register(spec("file.save", { menuPath: ["File"] }));
        gated.register(spec("file.new", { menuPath: ["File"] }));
        const entries = paletteEntries(gated.list(), gated.menus, [], "");
        expect(entries.map((entry) => [entry.command.id, entry.enabled])).toEqual([
            ["file.new", true],
            ["file.save", false],
        ]);
    });

    it("lists planned commands too: they are in the registry, disabled", () => {
        const planned = spriteRegistry(spec("file.new", { menuPath: ["File"] }));
        planned.plan({ id: "file.open", title: "Open…", menuPath: ["File"] });
        const entries = paletteEntries(planned.list(), planned.menus, [], "");
        expect(entries.map((entry) => entry.command.id)).toEqual(["file.new", "file.open"]);
        expect(entries[1]?.command).toMatchObject({ planned: true });
        expect(entries[1]?.enabled).toBe(false);
        expect(entries[1]?.command.enabled()).toBe(false);
    });

    it("orders them as the menu bar does, then the commands outside the menus by title", () => {
        expect(rows(registry)).toEqual([
            "file.new",
            "file.save",
            "file.recent.b",
            "edit.undo",
            "view.zoomIn",
            "focus.next",
            "tool.pencil",
        ]);
    });

    it("follows the editor's menu order, not a fixed one", () => {
        const specs = [
            spec("view.grid", { menuPath: ["View"] }),
            spec("map.resize", { menuPath: ["Map"] }),
            spec("tileset.new", { menuPath: ["Tileset"] }),
            spec("layer.new", { menuPath: ["Layer"] }),
            spec("file.new", { menuPath: ["File"] }),
        ];
        expect(rows(registryOf(TILEMAP_MENUS, ...specs))).toEqual([
            "file.new",
            "map.resize",
            "layer.new",
            "tileset.new",
            "view.grid",
        ]);
        const reversed = registryOf(["View", "Tileset", "Layer", "Map", "File", "Help"], ...specs);
        expect(rows(reversed)).toEqual([
            "view.grid",
            "tileset.new",
            "layer.new",
            "map.resize",
            "file.new",
        ]);
    });

    it("gives each row its title and its place in the menus", () => {
        const entries = paletteEntries(registry.list(), registry.menus, [], "");
        const row = (id: string) => entries.find((entry) => entry.command.id === id);
        expect(row("edit.undo")).toMatchObject({ title: "Undo Pencil", group: "Edit" });
        expect(row("file.recent.b")).toMatchObject({ group: "File › Open Recent" });
        expect(row("tool.pencil")).toMatchObject({ title: "Pencil", group: "" });
        // The row holds the registry's own command: its shortcut and its state.
        expect(row("tool.pencil")?.command).toBe(registry.get("tool.pencil"));
    });

    it("puts recent commands first, newest first", () => {
        expect(rows(registry, "", ["tool.pencil", "view.zoomIn"])).toEqual([
            "tool.pencil",
            "view.zoomIn",
            "file.new",
            "file.save",
            "file.recent.b",
            "edit.undo",
            "focus.next",
        ]);
        // A recent command that is disabled now keeps its place and its state.
        expect(rows(registry, "", ["edit.undo"])[0]).toBe("edit.undo");
        const first = paletteEntries(registry.list(), registry.menus, ["edit.undo"], "")[0];
        expect(first?.enabled).toBe(false);
        // An id the registry no longer has is ignored.
        expect(rows(registry, "", ["gone", "file.save"]).slice(0, 2)).toEqual([
            "file.save",
            "file.new",
        ]);
    });

    it("puts the recent list first as it is kept: capped and each command once", () => {
        let recent: string[] = [];
        for (const id of ["file.new", "view.zoomIn", "file.new", "tool.pencil"]) {
            recent = withRecentCommand(recent, id);
        }
        expect(recent).toEqual(["tool.pencil", "file.new", "view.zoomIn"]);
        expect(rows(registry, "", recent).slice(0, 4)).toEqual([
            "tool.pencil",
            "file.new",
            "view.zoomIn",
            "file.save",
        ]);
        // More recent commands than the cap: only the newest stay ahead of the others.
        const many = spriteRegistry(
            ...Array.from({ length: 12 }, (_, index) =>
                spec(`command-${String(index).padStart(2, "0")}`),
            ),
        );
        let ran: string[] = [];
        for (const each of many.list()) ran = withRecentCommand(ran, each.id);
        expect(ran).toHaveLength(MAX_RECENT_COMMANDS);
        expect(rows(many, "", ran).slice(0, MAX_RECENT_COMMANDS + 1)).toEqual([
            "command-11",
            "command-10",
            "command-09",
            "command-08",
            "command-07",
            "command-06",
            "command-05",
            "command-04",
            "command-00",
        ]);
    });

    it("keeps only the commands that match the query, the best match first", () => {
        expect(rows(registry, "zoom")).toEqual(["view.zoomIn"]);
        expect(rows(registry, "pen")).toEqual(["tool.pencil", "edit.undo", "file.recent.b"]);
        expect(rows(registry, "no such command")).toEqual([]);
        // Through the menu path as well.
        expect(rows(registry, "file")).toEqual(["file.new", "file.save", "file.recent.b"]);
    });

    it("breaks a tie between equal matches by recency, then by menu order", () => {
        const flips = spriteRegistry(
            spec("edit.flipHorizontal", { title: "Flip A", menuPath: ["Edit"], menuOrder: 100 }),
            spec("edit.flipVertical", { title: "Flip B", menuPath: ["Edit"], menuOrder: 110 }),
            spec("edit.fill", { title: "Fill", menuPath: ["Edit"], menuOrder: 120 }),
        );
        expect(rows(flips, "flip")).toEqual(["edit.flipHorizontal", "edit.flipVertical"]);
        expect(rows(flips, "flip", ["edit.flipVertical"])).toEqual([
            "edit.flipVertical",
            "edit.flipHorizontal",
        ]);
        // A better match stays ahead of a recent command.
        expect(rows(flips, "fi", ["edit.flipVertical"])).toEqual([
            "edit.fill",
            "edit.flipVertical",
            "edit.flipHorizontal",
        ]);
    });

    it("orders commands outside the menus with equal titles by id, by code unit", () => {
        const twins = spriteRegistry(
            spec("tool.b", { title: "Same" }),
            spec("tool.B", { title: "Same" }),
            spec("tool.a", { title: "Same" }),
        );
        expect(rows(twins)).toEqual(["tool.B", "tool.a", "tool.b"]);
    });
});

describe("running a command from the palette", () => {
    const recorder = () => {
        const ids: string[] = [];
        return { ids, record: (id: string) => void ids.push(id) };
    };

    it("runs an enabled command through the registry's command and records it as recent", () => {
        let ran = 0;
        const registry = spriteRegistry(spec("edit.fill", { run: () => void ran++ }));
        const recent = recorder();
        expect(runPaletteCommand(command(registry, "edit.fill"), () => {}, recent)).toBe(true);
        expect(ran).toBe(1);
        expect(recent.ids).toEqual(["edit.fill"]);
    });

    it("does nothing for a disabled command: it is listed but inert", () => {
        let ran = 0;
        let enabled = false;
        const registry = spriteRegistry(
            spec("edit.undo", { enabled: () => enabled, run: () => void ran++ }),
        );
        registry.plan({ id: "file.open", title: "Open…", menuPath: ["File"] });
        const recent = recorder();
        expect(runPaletteCommand(command(registry, "edit.undo"), () => {}, recent)).toBe(false);
        expect(runPaletteCommand(command(registry, "file.open"), () => {}, recent)).toBe(false);
        expect(ran).toBe(0);
        expect(recent.ids).toEqual([]);
        // The state is read when the command is chosen.
        enabled = true;
        expect(runPaletteCommand(command(registry, "edit.undo"), () => {}, recent)).toBe(true);
        expect(ran).toBe(1);
    });

    it("runs the registry's beforeRun first, as menus and keys do", () => {
        const calls: string[] = [];
        const registry = createCommandRegistry({
            menus: SPRITE_MENUS,
            beforeRun: (each) => void calls.push(`before ${each.id}`),
        });
        registry.register(spec("edit.fill", { run: () => void calls.push("run") }));
        expect(runPaletteCommand(command(registry, "edit.fill"), () => {}, recorder())).toBe(true);
        expect(calls).toEqual(["before edit.fill", "run"]);
    });

    it("hands a failure to the error handler, as menus and keys do", async () => {
        const registry = spriteRegistry(
            spec("throws", {
                run() {
                    throw new Error("sync");
                },
            }),
            spec("rejects", { run: () => Promise.reject(new Error("async")) }),
        );
        const errors: string[] = [];
        const onError = (error: unknown, failed: Command<string, never>) =>
            void errors.push(`${failed.id}: ${(error as Error).message}`);
        const recent = recorder();
        expect(runPaletteCommand(command(registry, "throws"), onError, recent)).toBe(true);
        expect(runPaletteCommand(command(registry, "rejects"), onError, recent)).toBe(true);
        await Promise.resolve();
        expect(errors).toEqual(["throws: sync", "rejects: async"]);
    });

    it("releases a hold binding after running it, like a key that is pressed and let go", () => {
        const calls: string[] = [];
        const registry = spriteRegistry(
            spec("view.hand", {
                shortcut: "Space",
                context: "canvas",
                run: () => void calls.push("run"),
                release: () => void calls.push("release"),
            }),
        );
        expect(runPaletteCommand(command(registry, "view.hand"), () => {}, recorder())).toBe(true);
        expect(calls).toEqual(["run", "release"]);
    });

    it("puts a command run from the palette first in the next list", () => {
        const registry = spriteRegistry(
            spec("file.new", { menuPath: ["File"] }),
            spec("edit.shortcuts", { menuPath: ["Edit"] }),
        );
        let recent: string[] = [];
        const store = { record: (id: string) => void (recent = withRecentCommand(recent, id)) };
        expect(runPaletteCommand(command(registry, "edit.shortcuts"), () => {}, store)).toBe(true);
        expect(recent).toEqual(["edit.shortcuts"]);
        expect(rows(registry, "", recent)[0]).toBe("edit.shortcuts");
    });
});
