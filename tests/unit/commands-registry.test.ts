import { describe, expect, it } from "vitest";
import {
    BASE_CONTEXTS,
    createCommandRegistry,
    findChordConflicts,
    invokeCommand,
    keyContextOrder,
    RegistrationError,
    registerCommandModules,
} from "../../src/ui/commands/index.ts";
import type {
    Command,
    CommandModule,
    CommandRegistryOptions,
    CommandSpec,
    MenuPath,
} from "../../src/ui/commands/index.ts";

// The command registry (SPEC §1.3, §7.1): commands and planned commands from the editor's
// `*.commands.ts(x)` module maps, generic over its menus and key contexts (BRIEF D16), with
// its command gate and its hook before every command (SPEC §5).

const MENUS = ["File", "Edit", "Sprite", "Layer", "Frame", "Select", "View", "Help"] as const;
type Menu = (typeof MENUS)[number];
const CONTEXTS = ["gesture", "floating", "timeline"] as const;
type Context = (typeof CONTEXTS)[number];

const registryWith = (options: Partial<CommandRegistryOptions<Menu, Context>> = {}) =>
    createCommandRegistry<Menu, Context>({ menus: MENUS, contexts: CONTEXTS, ...options });

const run = () => {};
const spec = (
    id: string,
    rest: Partial<CommandSpec<Menu, Context>> = {},
): CommandSpec<Menu, Context> => ({ id, title: id, run, ...rest });

/** A menu path the types refuse, to check the registry refuses it at run time too. */
const badPath = (...names: string[]) => names as unknown as MenuPath<Menu>;

/** What `action` throws; fails the test when it throws nothing. */
function thrown(action: () => void): unknown {
    try {
        action();
    } catch (error) {
        return error;
    }
    throw new Error("expected an error");
}

describe("command registry", () => {
    it("holds the key contexts in priority order around the editor's", () => {
        expect(BASE_CONTEXTS).toEqual(["text", "canvas", "global"]);
        expect(registryWith().contexts).toEqual([
            "text",
            "gesture",
            "floating",
            "timeline",
            "canvas",
            "global",
        ]);
        expect(createCommandRegistry({ menus: MENUS }).contexts).toEqual([
            "text",
            "canvas",
            "global",
        ]);
        expect(registryWith().menus).toEqual(MENUS);
    });

    it("refuses an editor context that is empty, repeated or the package's", () => {
        expect(keyContextOrder(["markers", "panel"])).toEqual([
            "text",
            "markers",
            "panel",
            "canvas",
            "global",
        ]);
        expect(() => keyContextOrder([" "])).toThrow(/empty name/);
        expect(() => keyContextOrder(["panel", "panel"])).toThrow(/"panel" is listed twice/);
        for (const context of BASE_CONTEXTS) {
            expect(() => keyContextOrder([context]), context).toThrow(/is the package's/);
        }
        expect(() => createCommandRegistry({ menus: MENUS, contexts: ["canvas"] })).toThrow(
            /is the package's/,
        );
    });

    it("resolves the optional fields of a command", () => {
        const registry = registryWith();
        registry.register(spec("plain"));
        registry.register(
            spec("full", {
                title: () => "Dynamic",
                enabled: () => false,
                shortcut: ["ctrl+y", "Ctrl+Shift+Z"],
                context: "canvas",
                menuPath: ["Edit"],
                menuOrder: 110,
                contextMenus: [{ menu: "layer" }, { menu: "cel", order: 20 }],
            }),
        );
        expect(registry.get("plain")).toMatchObject({
            id: "plain",
            planned: false,
            source: "runtime",
            shortcuts: [],
            contexts: ["global"],
            menuPath: null,
            menuOrder: 1000,
            contextMenus: [],
            release: null,
        });
        expect(registry.get("plain")?.title()).toBe("plain");
        expect(registry.get("plain")?.enabled()).toBe(true);

        const full = registry.get("full");
        expect(full?.title()).toBe("Dynamic");
        expect(full?.enabled()).toBe(false);
        expect(full?.shortcuts).toEqual(["Ctrl+Y", "Ctrl+Shift+Z"]);
        expect(full?.contexts).toEqual(["canvas"]);
        expect(full).toMatchObject({ menuPath: ["Edit"], menuOrder: 110 });
        expect(full?.contextMenus).toEqual([
            { menu: "layer", order: 1000 },
            { menu: "cel", order: 20 },
        ]);
    });

    it("lists commands by id and finds bindings by context and chord", () => {
        const registry = registryWith();
        registry.register(spec("b", { shortcut: "Enter", context: ["canvas", "timeline"] }));
        registry.register(spec("a", { shortcut: "Ctrl+S", context: ["global", "text"] }));
        registry.register(spec("c", { shortcut: "Enter", context: "floating" }));
        registry.register(spec("B", { shortcut: "F2", context: "timeline" }));
        // By UTF-16 code unit: upper case before lower case, whatever the locale.
        expect(registry.list().map((command) => command.id)).toEqual(["B", "a", "b", "c"]);
        expect(registry.bindings("canvas", "Enter").map((command) => command.id)).toEqual(["b"]);
        expect(registry.bindings("floating", "Enter").map((command) => command.id)).toEqual(["c"]);
        expect(registry.bindings("global", "Enter")).toEqual([]);
        expect(registry.bindings("text", "Ctrl+S").map((command) => command.id)).toEqual(["a"]);
        expect(registry.isBound("Enter")).toBe(true);
        expect(registry.isBound("Ctrl+P")).toBe(false);
    });

    it("removes a command with the function `register` returns", () => {
        const registry = registryWith();
        const remove = registry.register(spec("a", { shortcut: "B", context: "canvas" }));
        remove();
        expect(registry.get("a")).toBeUndefined();
        expect(registry.isBound("B")).toBe(false);
        remove();
        registry.register(spec("a"));
        expect(registry.list()).toHaveLength(1);
    });

    it("notifies subscribers of every change and on refresh", () => {
        const registry = registryWith();
        let notified = 0;
        const stop = registry.subscribe(() => notified++);
        const before = registry.version();
        const remove = registry.register(spec("a"));
        remove();
        registry.refresh();
        expect(notified).toBe(3);
        expect(registry.version()).toBe(before + 3);
        stop();
        registry.refresh();
        expect(notified).toBe(3);
    });

    it("applies a subscription made or stopped during a notification from the next one", () => {
        const registry = registryWith();
        const calls: string[] = [];
        let stopLate = () => {};
        registry.subscribe(() => {
            calls.push("first");
            stopLate();
            registry.subscribe(() => calls.push("added"));
        });
        stopLate = registry.subscribe(() => calls.push("late"));
        registry.refresh();
        expect(calls).toEqual(["first", "late"]);
        calls.length = 0;
        stopLate = () => {};
        registry.refresh();
        expect(calls).toEqual(["first", "added"]);
    });

    it("rejects a second command with the same id, naming both modules", () => {
        const registry = registryWith();
        registry.register(spec("edit.undo"), "./a.commands.ts");
        const error = thrown(() => registry.register(spec("edit.undo"), "./b.commands.ts"));
        expect(error).toBeInstanceOf(RegistrationError);
        expect((error as RegistrationError).message).toMatch(
            /"edit\.undo".*\.\/a\.commands\.ts.*\.\/b\.commands\.ts/,
        );
        expect((error as RegistrationError).path).toBe("./b.commands.ts");
    });

    it("rejects commands it cannot use, naming the command and its module", () => {
        const registry = registryWith();
        const register = (rest: Partial<CommandSpec<Menu, Context>>) => () =>
            registry.register(spec("bad", rest), "./bad.commands.ts");
        expect(register({ shortcut: "Hyper+Q" })).toThrow(RegistrationError);
        expect(register({ shortcut: "Hyper+Q" })).toThrow(/"bad" \(\.\/bad\.commands\.ts\)/);
        expect(register({ shortcut: ["Ctrl+S", "ctrl+s"] })).toThrow(/shortcut twice/);
        expect(register({ context: [] })).toThrow(/contexts/);
        expect(register({ context: ["canvas", "canvas"] })).toThrow(/contexts/);
        expect(register({ context: "nowhere" as "canvas" })).toThrow(/unknown context/);
        // A context of another editor is unknown here.
        expect(register({ context: "markers" as "canvas" })).toThrow(/unknown context "markers"/);
        expect(register({ menuPath: badPath() })).toThrow(/empty menu path/);
        expect(register({ menuPath: badPath("Window") })).toThrow(/names the menu "Window"/);
        expect(register({ menuPath: ["File", " "] })).toThrow(/empty menu path/);
        expect(register({ contextMenus: [{ menu: "" }] })).toThrow(/empty context menu/);
        expect(() => registry.register(spec(" "))).toThrow(/has no id/);
        expect(registry.list()).toEqual([]);
    });

    it("binds in the text context only the chords a text field does not need", () => {
        const registry = registryWith();
        const bind = (shortcut: string) =>
            registry.register({ id: shortcut, title: "x", shortcut, context: "text", run() {} });
        for (const chord of [
            "B",
            "Enter",
            "Shift+N",
            "Delete",
            "Ctrl+Z",
            "Ctrl+V",
            "Ctrl+Shift+Z",
        ]) {
            expect(() => bind(chord), chord).toThrow(/in the text context/);
        }
        for (const chord of ["Ctrl+S", "F6", "Shift+F6", "Alt+W", "Ctrl+K", "Ctrl+Shift+S"]) {
            expect(() => bind(chord), chord).not.toThrow();
        }
    });

    it("runs a command only while it is enabled", () => {
        const registry = registryWith();
        let enabled = false;
        let runs = 0;
        registry.register(spec("a", { enabled: () => enabled, run: () => void runs++ }));
        const command = registry.get("a")!;
        const fail = () => {
            throw new Error("unexpected error");
        };
        expect(invokeCommand(command, fail)).toBe(false);
        enabled = true;
        expect(invokeCommand(command, fail)).toBe(true);
        expect(runs).toBe(1);
    });

    it("hands what a command throws, or rejects with, to the error handler", async () => {
        const registry = registryWith();
        const thrownError = new Error("thrown");
        const rejected = new Error("rejected");
        registry.register(
            spec("throws", {
                run: () => {
                    throw thrownError;
                },
            }),
        );
        registry.register(spec("rejects", { run: () => Promise.reject(rejected) }));
        const errors: [unknown, string][] = [];
        const onError = (error: unknown, command: Command<Menu, Context>) =>
            void errors.push([error, command.id]);
        expect(invokeCommand(registry.get("throws")!, onError)).toBe(true);
        expect(invokeCommand(registry.get("rejects")!, onError)).toBe(true);
        await Promise.resolve();
        expect(errors).toEqual([
            [thrownError, "throws"],
            [rejected, "rejects"],
        ]);
    });
});

describe("command gate (SPEC §5)", () => {
    it("disables a command the gate rejects, whatever its own condition", () => {
        let projectOpen = false;
        const asked: string[] = [];
        const registry = registryWith({
            commandGate: (command) => {
                asked.push(command.id);
                return command.id === "file.open" || projectOpen;
            },
        });
        let ownCondition = 0;
        registry.register(spec("file.open"));
        registry.register(spec("layer.new", { enabled: () => (ownCondition++, true) }));
        registry.register(spec("layer.delete", { enabled: () => false }));

        expect(registry.get("file.open")?.enabled()).toBe(true);
        expect(registry.get("layer.new")?.enabled()).toBe(false);
        // The gate is asked first: a command's own condition may assume what it checks.
        expect(ownCondition).toBe(0);
        expect(asked).toEqual(["file.open", "layer.new"]);
        expect(invokeCommand(registry.get("layer.new")!, run)).toBe(false);

        projectOpen = true;
        expect(registry.get("layer.new")?.enabled()).toBe(true);
        expect(ownCondition).toBe(1);
        // An open gate leaves the command's own condition in charge.
        expect(registry.get("layer.delete")?.enabled()).toBe(false);
    });

    it("never enables a planned command", () => {
        const registry = registryWith({ commandGate: () => true });
        registry.plan({ id: "file.save", title: "Save", menuPath: ["File"] });
        expect(registry.get("file.save")?.enabled()).toBe(false);
    });
});

describe("before every command (SPEC §5)", () => {
    it("runs `beforeRun` before the command, from every caller", () => {
        const calls: string[] = [];
        const registry = registryWith({
            beforeRun: (command) => void calls.push(`before ${command.id}`),
        });
        registry.register(spec("frame.next", { run: () => void calls.push("frame.next") }));
        registry.register(spec("view.zoomIn", { run: () => void calls.push("view.zoomIn") }));

        expect(invokeCommand(registry.get("frame.next")!, run)).toBe(true);
        registry.get("view.zoomIn")!.run();
        expect(calls).toEqual([
            "before frame.next",
            "frame.next",
            "before view.zoomIn",
            "view.zoomIn",
        ]);
    });

    it("does not run for a disabled command, and hands what it throws to the error handler", () => {
        const failure = new Error("before");
        let runs = 0;
        const registry = registryWith({
            beforeRun: (command) => {
                if (command.id === "fails") throw failure;
                runs++;
            },
        });
        registry.register(spec("disabled", { enabled: () => false }));
        registry.register(spec("fails", { run: () => void runs++ }));

        expect(invokeCommand(registry.get("disabled")!, run)).toBe(false);
        expect(runs).toBe(0);
        const errors: unknown[] = [];
        expect(invokeCommand(registry.get("fails")!, (error) => void errors.push(error))).toBe(
            true,
        );
        expect(errors).toEqual([failure]);
        expect(runs).toBe(0);
    });
});

describe("planned commands", () => {
    const plan = { id: "file.save", title: "Save", menuPath: ["File"], menuOrder: 200 } as const;

    it("are listed disabled, without a shortcut, at their menu position", () => {
        const registry = registryWith();
        registry.plan(plan, "./planned.commands.ts");
        const command = registry.get("file.save");
        expect(command).toMatchObject({
            planned: true,
            shortcuts: [],
            menuPath: ["File"],
            menuOrder: 200,
        });
        expect(command?.enabled()).toBe(false);
        expect(command?.title()).toBe("Save");
        expect(command && invokeCommand(command, run)).toBe(false);
    });

    it("are implemented by a command with the same id, which keeps the menu position", () => {
        for (const order of ["plan first", "command first"]) {
            const registry = registryWith();
            const implementation = spec("file.save", { title: "Save", shortcut: "Ctrl+S" });
            if (order === "plan first") registry.plan(plan);
            const remove = registry.register(implementation, "./files.commands.ts");
            if (order === "command first") registry.plan(plan);

            expect(registry.list()).toHaveLength(1);
            expect(registry.get("file.save"), order).toMatchObject({
                planned: false,
                source: "./files.commands.ts",
                shortcuts: ["Ctrl+S"],
                menuPath: ["File"],
                menuOrder: 200,
            });
            expect(registry.get("file.save")?.enabled()).toBe(true);

            // Without its implementation the plan is back.
            remove();
            expect(registry.get("file.save")?.planned).toBe(true);
        }
    });

    it("let the implementation choose another menu position", () => {
        const registry = registryWith();
        registry.plan(plan);
        const remove = registry.register(spec("file.save", { menuPath: ["Edit"], menuOrder: 5 }));
        expect(registry.get("file.save")).toMatchObject({ menuPath: ["Edit"], menuOrder: 5 });
        remove();
        // Another order in the planned menu.
        const again = registry.register(spec("file.save", { menuOrder: 230 }));
        expect(registry.get("file.save")).toMatchObject({ menuPath: ["File"], menuOrder: 230 });
        again();
        // The planned order belongs to the planned menu: it does not follow to another one.
        registry.register(spec("file.save", { menuPath: ["File", "More"] }));
        expect(registry.get("file.save")).toMatchObject({
            menuPath: ["File", "More"],
            menuOrder: 1000,
        });
    });

    it("disappear when a command replaces them", () => {
        const registry = registryWith();
        registry.plan({ id: "view.symmetry", title: "Symmetry", menuPath: ["View"] });
        registry.plan({ id: "view.tiled", title: "Tiled Mode", menuPath: ["View"] });
        const remove = registry.register(
            spec("view.symmetryX", { menuPath: ["View", "Symmetry"], replaces: ["view.symmetry"] }),
        );
        expect(registry.list().map((command) => command.id)).toEqual([
            "view.symmetryX",
            "view.tiled",
        ]);
        expect(registry.get("view.symmetry")).toBeUndefined();
        remove();
        expect(registry.get("view.symmetry")?.planned).toBe(true);
    });

    it("reject a second plan with the same id and a path outside the menu bar", () => {
        const registry = registryWith();
        registry.plan(plan, "./a.commands.ts");
        expect(() => registry.plan(plan, "./b.commands.ts")).toThrow(
            /"file\.save".*\.\/a\.commands\.ts.*\.\/b\.commands\.ts/,
        );
        expect(() => registry.plan({ id: "x", title: "X", menuPath: badPath("Window") })).toThrow(
            /names the menu "Window"/,
        );
        expect(() => registry.plan({ id: " ", title: "X", menuPath: ["File"] })).toThrow(
            /has no id/,
        );
    });
});

describe("command modules (SPEC §1.3)", () => {
    type Module = CommandModule<Menu, Context>;

    it("registers the modules in UTF-16 code-unit order of their paths", () => {
        const sources: string[] = [];
        const registry = registryWith();
        const modules: Record<string, Module> = {};
        for (const path of [
            "./b.commands.ts",
            "./Z.commands.ts",
            "./a/x.commands.tsx",
            "./a.commands.ts",
        ]) {
            modules[path] = { commands: [spec(`from ${path}`)] };
        }
        const register = registry.register;
        registerCommandModules(
            {
                ...registry,
                register: (entry, source) => {
                    sources.push(source!);
                    return register(entry, source);
                },
            },
            modules,
        );
        // "Z" (U+005A) before "a" (U+0061), "." (U+002E) before "/" (U+002F): no locale order.
        expect(sources).toEqual([
            "./Z.commands.ts",
            "./a.commands.ts",
            "./a/x.commands.tsx",
            "./b.commands.ts",
        ]);
        expect(registry.get("from ./Z.commands.ts")?.source).toBe("./Z.commands.ts");
    });

    it("registers plans before commands, whatever the module order", () => {
        const registry = registryWith();
        registerCommandModules(registry, {
            "./a.commands.ts": { commands: [spec("file.save", { shortcut: "Ctrl+S" })] },
            "./z.commands.ts": {
                plannedCommands: [{ id: "file.save", title: "Save", menuPath: ["File"] }],
            },
        });
        expect(registry.get("file.save")).toMatchObject({
            planned: false,
            source: "./a.commands.ts",
            menuPath: ["File"],
        });
    });

    it("rejects a module that exports neither commands nor plans", () => {
        const error = thrown(() =>
            registerCommandModules(registryWith(), { "./a.commands.ts": {} }),
        );
        expect(error).toBeInstanceOf(RegistrationError);
        expect((error as RegistrationError).message).toBe(
            './a.commands.ts exports neither "commands" nor "plannedCommands".',
        );
        expect((error as RegistrationError).path).toBe("./a.commands.ts");
    });

    it("throws naming the module for a command id used twice", () => {
        const error = thrown(() =>
            registerCommandModules(registryWith(), {
                "./edit.commands.ts": { commands: [spec("edit.undo")] },
                "./history.commands.ts": { commands: [spec("edit.undo")] },
            }),
        );
        expect(error).toBeInstanceOf(RegistrationError);
        expect((error as RegistrationError).path).toBe("./history.commands.ts");
        expect((error as RegistrationError).message).toBe(
            'Command id "edit.undo" is used by ./edit.commands.ts and ./history.commands.ts.',
        );
    });

    it("throws naming the module for a menu the menu bar does not have", () => {
        for (const module of [
            { commands: [spec("window.tile", { menuPath: badPath("Window") })] },
            {
                plannedCommands: [
                    { id: "window.tile", title: "Tile", menuPath: badPath("Window") },
                ],
            },
        ] satisfies Module[]) {
            const error = thrown(() =>
                registerCommandModules(registryWith(), { "./window.commands.ts": module }),
            );
            expect(error).toBeInstanceOf(RegistrationError);
            expect((error as RegistrationError).path).toBe("./window.commands.ts");
            expect((error as RegistrationError).message).toBe(
                'Command "window.tile" (./window.commands.ts) names the menu "Window"; the menu ' +
                    "bar has File, Edit, Sprite, Layer, Frame, Select, View, Help.",
            );
        }
    });

    it("throws naming the modules for a chord two commands always share in one context", () => {
        const error = thrown(() =>
            registerCommandModules(registryWith(), {
                "./tools.commands.ts": {
                    commands: [spec("tool.pencil", { shortcut: "B", context: "canvas" })],
                },
                "./view.commands.ts": {
                    commands: [
                        spec("view.brush", { shortcut: "b", context: ["timeline", "canvas"] }),
                    ],
                },
            }),
        );
        expect(error).toBeInstanceOf(RegistrationError);
        expect((error as RegistrationError).path).toBe("./view.commands.ts");
        expect((error as RegistrationError).message).toBe(
            'Commands "tool.pencil" (./tools.commands.ts) and "view.brush" (./view.commands.ts) ' +
                'both bind "B" in the "canvas" context, and neither has an enabled condition.',
        );
    });

    it("lets commands share a chord in different contexts, or when a condition tells them apart", () => {
        const registry = registryWith();
        registerCommandModules(registry, {
            "./a.commands.ts": {
                commands: [
                    spec("play", { shortcut: "Enter", context: "canvas" }),
                    spec("apply", { shortcut: "Enter", context: "floating" }),
                    spec("nudge", {
                        shortcut: "ArrowLeft",
                        context: "canvas",
                        enabled: () => true,
                    }),
                ],
            },
            "./b.commands.ts": {
                commands: [
                    spec("open-cell", { shortcut: "Enter", context: "timeline" }),
                    spec("previous-frame", { shortcut: "ArrowLeft", context: "canvas" }),
                ],
            },
        });
        expect(registry.list()).toHaveLength(5);
    });
});

describe("chord conflicts in a state", () => {
    it("reports enabled commands that share a chord in a context", () => {
        const registry = registryWith();
        let selection = false;
        registry.register(
            spec("nudge", { shortcut: "ArrowLeft", context: "canvas", enabled: () => selection }),
        );
        registry.register(
            spec("previous-frame", {
                shortcut: "ArrowLeft",
                context: ["canvas", "timeline"],
                enabled: () => !selection,
            }),
        );
        registry.register(spec("cell-left", { shortcut: "ArrowLeft", context: "floating" }));
        // One chord in three contexts, and in canvas the conditions exclude each other.
        expect(findChordConflicts(registry)).toEqual([]);
        selection = true;
        expect(findChordConflicts(registry)).toEqual([]);

        registry.register(spec("pan-left", { shortcut: "ArrowLeft", context: "canvas" }));
        expect(findChordConflicts(registry)).toEqual([
            { context: "canvas", chord: "ArrowLeft", commands: ["nudge", "pan-left"] },
        ]);
        selection = false;
        expect(findChordConflicts(registry)).toEqual([
            { context: "canvas", chord: "ArrowLeft", commands: ["pan-left", "previous-frame"] },
        ]);
    });
});
