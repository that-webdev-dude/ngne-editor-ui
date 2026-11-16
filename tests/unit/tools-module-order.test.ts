import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RegistrationError } from "../../src/model/modules.ts";
import { createToolRegistry, registerToolModules } from "../../src/model/tools/registry.ts";
import type { ToolRegistry } from "../../src/model/tools/registry.ts";
import type { ToolBase, ToolModule } from "../../src/model/tools/types.ts";

// The module order of the tool registry (SPEC §1.3, BRIEF D14): `*.tools.ts(x)` modules
// register in UTF-16 code-unit order of their paths, whatever order the module map holds them
// in and never in the order of a locale compare; every module's planned slots before any tool.
// Equal rail positions and the tool list fall back to the id, by code unit as well.

/** Paths in code-unit order that a locale compare orders differently: a, B, é, f. */
const PATHS = ["./B.tools.ts", "./a.tools.tsx", "./f.tools.ts", "./é.tools.tsx"];

const mapOf = <Module>(entries: [string, Module][]) => Object.fromEntries(entries);

/** A registry that records each registration as "plan <path>" or "tool <path>". */
function recording(): { registry: ToolRegistry; seen: string[] } {
    const real = createToolRegistry();
    const seen: string[] = [];
    const registry: ToolRegistry = {
        ...real,
        register(spec, source) {
            seen.push(`tool ${source}`);
            return real.register(spec, source);
        },
        plan(spec, source) {
            seen.push(`plan ${source}`);
            return real.plan(spec, source);
        },
    };
    return { registry, seen };
}

/** A module with one planned slot and one tool, each with an id made from `path`. */
const moduleOf = (path: string): ToolModule => ({
    plannedTools: [{ id: `slot ${path}`, label: "Slot", icon: "i", railOrder: 100 }],
    tools: [{ id: `tool ${path}`, label: "Tool" }],
});

describe("tool module order", () => {
    it("uses fixture paths that a locale compare orders differently", () => {
        const byLocale = [...PATHS].sort((a, b) => a.localeCompare(b, "en"));
        expect(byLocale).toEqual([
            "./a.tools.tsx",
            "./B.tools.ts",
            "./é.tools.tsx",
            "./f.tools.ts",
        ]);
        expect(byLocale).not.toEqual(PATHS);
    });

    it("registers modules in code-unit order of their paths, every plan before any tool", () => {
        for (const insertion of [
            [...PATHS].reverse(),
            [PATHS[2]!, PATHS[0]!, PATHS[3]!, PATHS[1]!],
        ]) {
            const { registry, seen } = recording();
            registerToolModules(registry, mapOf(insertion.map((path) => [path, moduleOf(path)])));
            expect(seen).toEqual([
                ...PATHS.map((path) => `plan ${path}`),
                ...PATHS.map((path) => `tool ${path}`),
            ]);
        }
    });

    it("registers any set of paths in the default sort's order, in any insertion order", () => {
        fc.assert(
            fc.property(
                fc.uniqueArray(fc.string({ unit: "binary" }), { maxLength: 12 }),
                (paths) => {
                    const { registry, seen } = recording();
                    registerToolModules(
                        registry,
                        mapOf(
                            paths.map((path) => [
                                path,
                                { tools: [{ id: `#${path}`, label: "T" }] },
                            ]),
                        ),
                    );
                    // The default sort compares by UTF-16 code unit.
                    expect(seen).toEqual([...paths].sort().map((path) => `tool ${path}`));
                },
            ),
        );
    });

    it("names the first module in code-unit order as the first user of an id or a key", () => {
        const twice = (module: ToolModule) => () =>
            registerToolModules(
                createToolRegistry(),
                mapOf([
                    ["./a.tools.ts", module],
                    ["./B.tools.ts", module],
                ]),
            );
        expect(twice({ tools: [{ id: "same", label: "Same" }] })).toThrow(
            new RegistrationError(
                'Tool id "same" is used by ./B.tools.ts and ./a.tools.ts.',
                "./a.tools.ts",
            ),
        );
        expect(
            twice({ plannedTools: [{ id: "same", label: "Same", icon: "i", railOrder: 1 }] }),
        ).toThrow('Planned tool id "same" is used by ./B.tools.ts and ./a.tools.ts.');
        const keyed = (id: string): ToolModule => ({ tools: [{ id, label: id, shortcut: "K" }] });
        expect(() =>
            registerToolModules(
                createToolRegistry(),
                mapOf([
                    ["./a.tools.ts", keyed("a")],
                    ["./B.tools.ts", keyed("b")],
                ]),
            ),
        ).toThrow('Tool "a" (./a.tools.ts) uses key "K", as "b" (./B.tools.ts) does.');
    });

    it("reports the module that cannot register with its path", () => {
        try {
            registerToolModules(createToolRegistry(), mapOf([["./x.tools.ts", {}]]));
            expect.unreachable();
        } catch (error) {
            expect(error).toBeInstanceOf(RegistrationError);
            expect((error as RegistrationError).path).toBe("./x.tools.ts");
        }
    });
});

describe("tool order by id", () => {
    // "C" (0x43) comes before "b" (0x62); a locale compare puts "b" first.
    const ids = ["b", "C"];

    it("uses ids that a locale compare orders differently", () => {
        expect([...ids].sort((a, b) => a.localeCompare(b, "en"))).toEqual(["b", "C"]);
    });

    it("orders equal rail positions, variants and the tool list by id in code-unit order", () => {
        const registry = createToolRegistry<ToolBase>();
        registerToolModules(
            registry,
            mapOf([
                [
                    "./a.tools.ts",
                    {
                        tools: [
                            ...ids.map((id) => ({ id, label: id, icon: "i", railOrder: 100 })),
                            ...ids.map((id) => ({
                                id: `${id}-variant`,
                                label: id,
                                variantOf: "b",
                                railOrder: 101,
                            })),
                        ],
                    },
                ],
            ]),
        );
        expect(registry.railSlots().map((slot) => slot.id)).toEqual(["C", "b"]);
        expect(registry.railSlots()[1]?.variants.map((tool) => tool.id)).toEqual([
            "b",
            "C-variant",
            "b-variant",
        ]);
        expect(registry.list().map((tool) => tool.id)).toEqual([
            "C",
            "C-variant",
            "b",
            "b-variant",
        ]);
    });
});
