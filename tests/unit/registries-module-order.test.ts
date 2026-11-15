import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    compareCodeUnits,
    orderedModules,
    registerModules,
    RegistrationError,
} from "../../src/model/modules.ts";
import { collectCommandDialogs } from "../../src/model/registries/dialogs.ts";
import { collectDockPanels } from "../../src/model/registries/dock.ts";
import { collectContextBarContent } from "../../src/model/registries/contextBar.ts";
import { collectStatusFields } from "../../src/model/registries/statusFields.ts";
import { collectOverlayLayers } from "../../src/model/overlay/layers.ts";

// The module order of every registry (SPEC §1.3, BRIEF D14): modules come in UTF-16 code-unit
// order of their paths, whatever order the module map holds them in, and never in the order of
// a locale compare. Equal `order` values fall back to the id, by code unit as well.

/** Paths in code-unit order that a locale compare orders differently: a, B, é, f. */
const PATHS = ["./B.x.tsx", "./a.x.tsx", "./f.x.tsx", "./é.x.tsx"];

/** `entries` as a module map, in the given insertion order. */
const mapOf = <Module>(entries: [string, Module][]) => Object.fromEntries(entries);

describe("module order", () => {
    it("uses fixture paths that a locale compare orders differently", () => {
        const byLocale = [...PATHS].sort((a, b) => a.localeCompare(b, "en"));
        expect(byLocale).toEqual(["./a.x.tsx", "./B.x.tsx", "./é.x.tsx", "./f.x.tsx"]);
        expect(byLocale).not.toEqual(PATHS);
    });

    it("orders modules by the code units of their paths, whatever the insertion order", () => {
        for (const insertion of [[...PATHS].reverse(), [PATHS[2], PATHS[0], PATHS[3], PATHS[1]]]) {
            const map = mapOf(insertion.map((path) => [path!, path!]));
            expect(orderedModules(map).map(([path]) => path)).toEqual(PATHS);
            expect(orderedModules(map).map(([, module]) => module)).toEqual(PATHS);
        }
    });

    it("orders any set of paths as the default sort does, in any insertion order", () => {
        fc.assert(
            fc.property(
                fc.uniqueArray(fc.string({ unit: "binary" }), { maxLength: 12 }),
                (paths) => {
                    const map = mapOf(paths.map((path) => [path, path]));
                    // The default sort compares by UTF-16 code unit.
                    expect(orderedModules(map).map(([path]) => path)).toEqual([...paths].sort());
                },
            ),
        );
    });

    it("compares by code unit, numbers in paths included", () => {
        expect(["./10.x", "./9.x", "./Z.x", "./_.x", "./a.x"].sort(compareCodeUnits)).toEqual([
            "./10.x",
            "./9.x",
            "./Z.x",
            "./_.x",
            "./a.x",
        ]);
        expect(compareCodeUnits("a", "a")).toBe(0);
    });

    it("registers modules in path order", () => {
        const seen: string[] = [];
        registerModules(
            mapOf([...PATHS].reverse().map((path) => [path, { path }])),
            (module, path) => {
                expect(module.path).toBe(path);
                seen.push(path);
            },
        );
        expect(seen).toEqual(PATHS);
    });

    it("reports an error a module's registration throws with the module's path", () => {
        const register = (_: unknown, path: string) => {
            if (path === "./b.x.ts") throw new Error('Chord "Ctrl+K" is taken.');
        };
        const map = mapOf([
            ["./b.x.ts", {}],
            ["./a.x.ts", {}],
        ]);
        expect(() => registerModules(map, register)).toThrow(
            new RegistrationError('./b.x.ts: Chord "Ctrl+K" is taken.', "./b.x.ts"),
        );
        try {
            registerModules(map, register);
        } catch (error) {
            expect(error).toBeInstanceOf(RegistrationError);
            expect((error as RegistrationError).path).toBe("./b.x.ts");
            expect((error as RegistrationError).name).toBe("RegistrationError");
            expect((error as Error).cause).toEqual(new Error('Chord "Ctrl+K" is taken.'));
        }
        const own = new RegistrationError("Own message.", "./a.x.ts");
        expect(() =>
            registerModules(map, () => {
                throw own;
            }),
        ).toThrow(own);
    });
});

describe("every registry takes its modules in code-unit order", () => {
    const reversed = [...PATHS].reverse();

    it("dialogs: modules in path order, each module's dialogs as declared", () => {
        const dialogs = collectCommandDialogs(
            mapOf(
                reversed.map((path) => [
                    path,
                    {
                        commandDialogs: [
                            { kind: `${path}#2`, name: "two", Component: null },
                            { kind: `${path}#1`, name: "one", Component: null },
                        ],
                    },
                ]),
            ),
        );
        expect([...dialogs.keys()]).toEqual(PATHS.flatMap((path) => [`${path}#2`, `${path}#1`]));
    });

    it("dock, context bar, overlay and status: equal orders by id in code-unit order", () => {
        // "C" (0x43) comes before "b" (0x62); a locale compare puts "b" first.
        expect(["b", "C"].sort((a, b) => a.localeCompare(b, "en"))).toEqual(["b", "C"]);
        const ids = ["b", "C"];
        const dock = collectDockPanels(
            mapOf(
                ids.map((id) => [
                    `./${id}.dock.tsx`,
                    { dockPanel: { id, title: id, order: 1, Body: null } },
                ]),
            ),
        );
        const contextBar = collectContextBarContent(
            mapOf(
                ids.map((id) => [
                    `./${id}.contextbar.tsx`,
                    {
                        contextBarContent: {
                            id,
                            order: 1,
                            shown: () => true,
                            subscribe: () => () => undefined,
                            Body: null,
                        },
                    },
                ]),
            ),
        );
        const overlay = collectOverlayLayers(
            mapOf([
                [
                    "./grid.overlay.ts",
                    { overlayLayers: ids.map((id) => ({ id, order: 1, draw() {} })) },
                ],
            ]),
        );
        const status = collectStatusFields(
            mapOf([
                [
                    "./a.status.ts",
                    { statusFields: ids.map((id) => ({ id, order: 1, text: () => id })) },
                ],
            ]),
        );
        for (const list of [dock, contextBar, overlay, status]) {
            expect(list.map((entry) => entry.id)).toEqual(["C", "b"]);
        }
    });

    it("names the first module in code-unit order as the first user of a duplicate id", () => {
        const panel = { id: "same", title: "Same", order: 1, Body: null };
        expect(() =>
            collectDockPanels(
                mapOf([
                    ["./a.dock.tsx", { dockPanel: panel }],
                    ["./B.dock.tsx", { dockPanel: panel }],
                ]),
            ),
        ).toThrow('Dock panel id "same" is used by ./B.dock.tsx and ./a.dock.tsx.');
    });
});
