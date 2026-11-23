import { describe, expect, expectTypeOf, it } from "vitest";
import { RegistrationError } from "../../src/model/modules.ts";
import {
    createToolRegistry,
    railGroups,
    registerToolModules,
    slotOf,
} from "../../src/model/tools/registry.ts";
import type { ToolRegistry } from "../../src/model/tools/registry.ts";
import type {
    PlannedToolSpec,
    RegisteredTool,
    ToolBase,
    ToolOptionSpec,
} from "../../src/model/tools/types.ts";

// The tool registry (SPEC §1.3, §8, BRIEF D18). A tool comes from a module of its own
// (`*.tools.ts`, passed in a module map), takes the rail slot planned for its id with its key,
// icon and position, and brings its options; a slot lists its variants. The registry is
// generic over the editor's tool type and hands that type back. Icons are strings here: the
// model layer knows no icon package.

/** An editor's tool: `ToolBase` with fields of the editor's own. */
interface FixtureTool extends ToolBase<string> {
    /** The tool writes pixels (the sprite editor's own field). */
    paints?: boolean;
    /** A handler with the editor's own pointer type. */
    onDown?(pointer: { readonly pixel: { readonly x: number; readonly y: number } }): void;
}

const tool = (id: string, extra: Partial<FixtureTool> = {}): FixtureTool => ({
    id,
    label: id,
    ...extra,
});

/** The sprite editor's planned rail at the cut: draw · shapes · select · navigate. */
const plannedTools: PlannedToolSpec<string>[] = [
    { id: "pencil", label: "Pencil", shortcut: "B", icon: "pencil", railOrder: 100 },
    { id: "eraser", label: "Eraser", shortcut: "E", icon: "eraser", railOrder: 110 },
    { id: "bucket", label: "Paint bucket", shortcut: "G", icon: "bucket", railOrder: 120 },
    { id: "eyedropper", label: "Eyedropper", shortcut: "I", icon: "pipette", railOrder: 130 },
    { id: "line", label: "Line", shortcut: "L", icon: "slash", railOrder: 200 },
    { id: "rectangle", label: "Rectangle", shortcut: "U", icon: "square", railOrder: 210 },
    { id: "ellipse", label: "Ellipse", shortcut: "Shift+U", icon: "circle", railOrder: 220 },
    { id: "marquee", label: "Marquee", shortcut: "M", icon: "dashed", railOrder: 300 },
    { id: "lasso", label: "Lasso", shortcut: "Q", icon: "lasso", railOrder: 310 },
    { id: "wand", label: "Magic wand", shortcut: "W", icon: "wand", railOrder: 320 },
    { id: "move", label: "Move", shortcut: "V", icon: "move", railOrder: 330 },
    { id: "hand", label: "Hand", shortcut: "H", icon: "hand", railOrder: 400 },
    { id: "zoom", label: "Zoom", shortcut: "Z", icon: "zoom", railOrder: 410 },
];

/** A registry with the planned rail and the tools given. */
function rail(...tools: FixtureTool[]): ToolRegistry<FixtureTool> {
    const registry = createToolRegistry<FixtureTool>();
    registerToolModules(registry, { "./planned.tools.ts": { plannedTools } });
    for (const spec of tools) registry.register(spec);
    return registry;
}

const slotIn = (registry: ToolRegistry<FixtureTool>, id: string) => {
    const found = registry.railSlots().find((slot) => slot.id === id);
    if (!found) throw new Error(`no slot ${id}`);
    return found;
};

describe("registry", () => {
    it("lets a tool take its planned slot, and gives it back when the tool is removed", () => {
        const registry = createToolRegistry<FixtureTool>();
        registerToolModules(registry, { "./planned.tools.ts": { plannedTools } });
        expect(registry.railSlots().every((slot) => slot.tool === null)).toBe(true);
        let notified = 0;
        registry.subscribe(() => notified++);
        const version = registry.version();

        const remove = registry.register(tool("pencil", { label: "Pencil", paints: true }));
        const pencil = registry.railSlots()[0];
        expect(pencil?.id).toBe("pencil");
        expect(pencil?.tool?.paints).toBe(true);
        expect(pencil?.tool?.shortcut).toBe("B");
        expect(pencil?.tool?.icon).toBe("pencil");
        expect(registry.version()).not.toBe(version);
        remove();
        expect(registry.railSlots()[0]?.tool).toBeNull();
        expect(notified).toBe(2);
    });

    it("places a tool by its own position and key, and leaves a tool without one out of the rail", () => {
        const registry = createToolRegistry<FixtureTool>();
        registerToolModules(registry, {
            "./b.tools.ts": {
                tools: [tool("curve", { shortcut: "Shift+L", railOrder: 230, icon: "brush" })],
            },
            "./a.tools.ts": { plannedTools },
            "./c.tools.ts": { tools: [tool("hidden")] },
        });
        const ids = registry.railSlots().map((slot) => slot.id);
        expect(ids.indexOf("curve")).toBe(ids.indexOf("ellipse") + 1);
        expect(ids).not.toContain("hidden");
        expect(registry.get("hidden")?.railOrder).toBeUndefined();
        expect(registry.get("curve")?.source).toBe("./b.tools.ts");
        expect(registry.list().map((entry) => entry.id)).toEqual(["curve", "hidden"]);
    });

    it("groups the rail by the hundreds of the positions", () => {
        const registry = createToolRegistry<FixtureTool>();
        for (const [id, railOrder] of [
            ["a", 100],
            ["b", 150],
            ["c", 200],
            ["d", 410],
            ["e", 400],
        ] as const) {
            registry.register(tool(id, { railOrder, icon: "brush" }));
        }
        expect(
            railGroups(registry.railSlots()).map((group) => group.map((slot) => slot.id)),
        ).toEqual([["a", "b"], ["c"], ["e", "d"]]);
        // The planned rail's groups: draw, shapes, select, navigate.
        expect(railGroups(rail().railSlots()).map((group) => group.length)).toEqual([4, 3, 4, 2]);
    });

    it("refuses what cannot form one set of tools, naming the module", () => {
        const registry = createToolRegistry<FixtureTool>();
        registry.register(tool("one"), "first.tools.ts");
        const refused = (spec: FixtureTool) => () => registry.register(spec, "second.tools.ts");
        expect(refused(tool("one"))).toThrow(/first\.tools\.ts and second\.tools\.ts/);
        expect(refused(tool(" "))).toThrow(RegistrationError);
        expect(refused(tool("x", { label: "" }))).toThrow(/no label/);
        expect(refused(tool("x", { shortcut: "Ctrl+Nope" }))).toThrow(/invalid key/);
        expect(refused(tool("x", { hold: { key: "Shift+" } }))).toThrow(/invalid key/);
        expect(refused(tool("x", { railOrder: 100 }))).toThrow(/no icon/);
        expect(refused(tool("x", { railOrder: Number.NaN, icon: "i" }))).toThrow(/not a number/);
        const options = (...list: ToolOptionSpec[]) => tool("x", { options: list });
        const size: ToolOptionSpec = {
            kind: "number",
            key: "size",
            label: "Size",
            min: 1,
            max: 64,
            default: 0,
        };
        expect(refused(options(size))).toThrow(/default outside 1\.\.64/);
        expect(refused(options({ ...size, default: 1 }, { ...size, default: 2 }))).toThrow(/twice/);
        expect(refused(options({ ...size, key: " ", default: 1 }))).toThrow(/without a key/);
        expect(
            refused(
                options({
                    kind: "toggle",
                    key: "on",
                    label: "On",
                    default: "yes" as unknown as boolean,
                }),
            ),
        ).toThrow(/true or false default/);
        expect(
            refused(
                options({
                    kind: "choice",
                    key: "ink",
                    label: "Ink",
                    choices: [{ value: "simple", label: "Simple" }],
                    default: "alpha",
                }),
            ),
        ).toThrow(/not one of its choices/);
        expect(
            refused(options({ kind: "slider", key: "k", label: "K" } as unknown as ToolOptionSpec)),
        ).toThrow(/unknown kind/);
        expect(() => registerToolModules(createToolRegistry(), { "./x.tools.ts": {} })).toThrow(
            /exports neither/,
        );
        expect(() =>
            registerToolModules(createToolRegistry<FixtureTool>(), {
                "./a.tools.ts": { plannedTools },
                "./b.tools.ts": { plannedTools },
            }),
        ).toThrow(/Planned tool id "pencil"/);
        try {
            registry.register(tool("one"), "second.tools.ts");
        } catch (error) {
            expect((error as RegistrationError).path).toBe("second.tools.ts");
        }
        // Nothing refused was registered.
        expect(registry.list().map((entry) => entry.id)).toEqual(["one"]);
    });

    it("refuses a planned slot without a position or with an invalid key", () => {
        const registry = createToolRegistry<FixtureTool>();
        const slot = { id: "s", label: "S", icon: "i", railOrder: 100 };
        expect(() => registry.plan({ ...slot, railOrder: Number.NaN }, "p.tools.ts")).toThrow(
            'Planned tool "s" (p.tools.ts) has no rail position.',
        );
        expect(() => registry.plan({ ...slot, shortcut: "Ctrl+" }, "p.tools.ts")).toThrow(
            /Planned tool "s" \(p\.tools\.ts\) has an invalid key/,
        );
        expect(registry.railSlots()).toEqual([]);
    });

    it("hands back the editor's own tool type and fields", () => {
        const onDown = () => undefined;
        const registry = rail(tool("pencil", { paints: true, onDown }));
        const pencil = registry.get("pencil");
        expect(pencil?.paints).toBe(true);
        expect(pencil?.onDown).toBe(onDown);
        expectTypeOf(pencil).toEqualTypeOf<RegisteredTool<FixtureTool> | undefined>();
        expectTypeOf(pencil!.paints).toEqualTypeOf<boolean | undefined>();
        expectTypeOf(pencil!.icon).toEqualTypeOf<string | undefined>();
        expectTypeOf(registry.list()[0]!.onDown).toEqualTypeOf<FixtureTool["onDown"]>();
        const slot = slotIn(registry, "pencil");
        expectTypeOf(slot.tool).toEqualTypeOf<RegisteredTool<FixtureTool> | null>();
        expectTypeOf(slot.icon).toEqualTypeOf<string | undefined>();
        expect(slot.variants[0]?.paints).toBe(true);
    });
});

describe("tools registered after creation", () => {
    /** The ids added at each notification, in order. */
    function additions(registry: ToolRegistry<FixtureTool>): string[][] {
        const added: string[][] = [];
        let known = new Set(registry.list().map((entry) => entry.id));
        registry.subscribe(() => {
            const ids = registry.list().map((entry) => entry.id);
            added.push(ids.filter((id) => !known.has(id)));
            known = new Set(ids);
        });
        return added;
    }

    it("notifies subscribers of a tool registered and removed after the modules", () => {
        const registry = createToolRegistry<FixtureTool>();
        const added = additions(registry);
        // Inserted out of path order: the modules still register by path.
        registerToolModules(registry, {
            "./b.tools.ts": { tools: [tool("brush", { icon: "brush", railOrder: 110 })] },
            "./a.tools.ts": { tools: [tool("airbrush", { icon: "spray", railOrder: 100 })] },
        });
        expect(added).toEqual([["airbrush"], ["brush"]]);
        expect(registry.get("brush")?.source).toBe("./b.tools.ts");

        let notified = 0;
        registry.subscribe(() => notified++);
        const version = registry.version();
        const remove = registry.register(
            tool("probe", { icon: "probe", shortcut: "K", railOrder: 105 }),
            "test fixture",
        );
        expect(notified).toBe(1);
        expect(registry.version()).not.toBe(version);
        expect(added.at(-1)).toEqual(["probe"]);
        expect(registry.get("probe")?.source).toBe("test fixture");
        expect(registry.railSlots().map((slot) => slot.id)).toEqual(["airbrush", "probe", "brush"]);

        remove();
        expect(notified).toBe(2);
        expect(registry.get("probe")).toBeUndefined();
        expect(registry.railSlots().map((slot) => slot.id)).toEqual(["airbrush", "brush"]);
        // The modules' tools keep their sources: the first user of an id is still named by path.
        expect(() => registry.register(tool("airbrush"), "test fixture")).toThrow(
            /"airbrush" is used by \.\/a\.tools\.ts and test fixture/,
        );
        expect(notified).toBe(2);
    });

    it("lets a tool registered after creation take a planned slot, and frees it when removed", () => {
        const registry = rail();
        let notified = 0;
        registry.subscribe(() => notified++);
        const remove = registry.register(tool("wand", { label: "Magic wand" }), "test fixture");
        expect(slotIn(registry, "wand").tool?.id).toBe("wand");
        expect(slotIn(registry, "wand").tool?.shortcut).toBe("W");
        remove();
        expect(slotIn(registry, "wand").tool).toBeNull();
        expect(notified).toBe(2);
    });
});

describe("keys", () => {
    it("refuses a key two tools use, naming both modules", () => {
        const registry = createToolRegistry<FixtureTool>();
        registry.register(tool("brush", { shortcut: "Ctrl+Shift+B" }), "./a.tools.ts");
        expect(() =>
            registry.register(tool("other", { shortcut: "shift+ctrl+b" }), "./b.tools.ts"),
        ).toThrow(
            'Tool "other" (./b.tools.ts) uses key "Ctrl+Shift+B", as "brush" (./a.tools.ts) does.',
        );
        registry.register(tool("hand", { hold: { key: "Space" } }), "./a.tools.ts");
        expect(() => registry.register(tool("pan", { shortcut: "Space" }), "./b.tools.ts")).toThrow(
            /uses key "Space", as "hand" \(\.\/a\.tools\.ts\) does/,
        );
        expect(() =>
            registry.register(tool("pick", { hold: { key: "Ctrl+Shift+B" } }), "./b.tools.ts"),
        ).toThrow(/as "brush"/);
        expect(registry.list().map((entry) => entry.id)).toEqual(["brush", "hand"]);
    });

    it("keeps a planned slot's key for its id, also while its tool names its own", () => {
        const registry = rail();
        expect(() => registry.register(tool("brush", { shortcut: "B" }), "./b.tools.ts")).toThrow(
            'Tool "brush" (./b.tools.ts) uses key "B", as "pencil" (./planned.tools.ts) does.',
        );
        registry.register(tool("pencil"));
        registry.register(tool("eraser", { shortcut: "Shift+E" }));
        expect(registry.get("pencil")?.shortcut).toBe("B");
        expect(() => registry.register(tool("rubber", { shortcut: "E" }))).toThrow(/as "eraser"/);
        expect(() =>
            registry.plan({
                id: "spray",
                label: "Spray",
                shortcut: "Shift+E",
                icon: "s",
                railOrder: 140,
            }),
        ).toThrow(/Planned tool "spray" \(runtime\) uses key "Shift\+E", as "eraser"/);
    });

    it("frees a key when the tool or slot that used it is removed", () => {
        const registry = createToolRegistry<FixtureTool>();
        const remove = registry.register(tool("a", { shortcut: "A" }));
        const unplan = registry.plan({
            id: "s",
            label: "S",
            shortcut: "S",
            icon: "i",
            railOrder: 1,
        });
        remove();
        unplan();
        registry.register(tool("b", { shortcut: "A" }));
        registry.register(tool("c", { shortcut: "S" }));
        expect(registry.list().map((entry) => entry.shortcut)).toEqual(["A", "S"]);
    });

    it("lets a slot's variants use keys of the same letter", () => {
        const registry = rail(
            tool("marquee"),
            tool("ellipse-marquee", { variantOf: "marquee", shortcut: "Shift+M", railOrder: 301 }),
        );
        expect(slotIn(registry, "marquee").variants.map((variant) => variant.shortcut)).toEqual([
            "M",
            "Shift+M",
        ]);
    });
});

describe("keys per tool set", () => {
    /** The tilemap's shared letters: the tile shapes and the marker shapes on U and Shift+U. */
    const tileAndMarkerPlans: PlannedToolSpec<string>[] = [
        {
            id: "shapeFill",
            label: "Shape fill",
            shortcut: "U",
            icon: "square",
            railOrder: 100,
            toolSets: ["tile"],
        },
        {
            id: "markerRectangle",
            label: "Rectangle",
            shortcut: "U",
            icon: "square",
            railOrder: 200,
            toolSets: ["marker"],
        },
    ];

    it("lets tools and planned slots of two sets share a key", () => {
        const registry = createToolRegistry<FixtureTool>();
        registerToolModules(registry, {
            "./planned.tools.ts": { plannedTools: tileAndMarkerPlans },
            "./shapes.tools.ts": {
                tools: [
                    tool("shapeFill"),
                    tool("ellipseFill", {
                        variantOf: "shapeFill",
                        shortcut: "Shift+U",
                        toolSets: ["tile"],
                    }),
                    tool("markerEllipse", {
                        variantOf: "markerRectangle",
                        shortcut: "Shift+U",
                        toolSets: ["marker"],
                    }),
                ],
            },
        });
        expect(registry.railSlots().map((slot) => [slot.id, slot.shortcut, slot.toolSets])).toEqual(
            [
                ["shapeFill", "U", ["tile"]],
                ["markerRectangle", "U", ["marker"]],
            ],
        );
        // The key reaches each tool unchanged: an editor's key commands read it from there.
        expect(registry.get("shapeFill")?.shortcut).toBe("U");
        expect(registry.get("markerEllipse")?.shortcut).toBe("Shift+U");
        expect(slotIn(registry, "markerRectangle").variants.map((variant) => variant.id)).toEqual([
            "markerEllipse",
        ]);
        // A hold key is checked per set too.
        registry.register(
            tool("pick", { hold: { key: "Alt" }, toolSets: ["tile"] }),
            "./pick.tools.ts",
        );
        registry.register(tool("measure", { shortcut: "Alt", toolSets: ["marker"] }));
        expect(registry.list().map((entry) => entry.id)).toContain("measure");
    });

    it("refuses a key two tools of one set use, naming both and their modules", () => {
        const registry = createToolRegistry<FixtureTool>();
        registerToolModules(registry, {
            "./planned.tools.ts": { plannedTools: tileAndMarkerPlans },
        });
        // In both sets: it meets the marker rectangle in "marker".
        expect(() =>
            registry.register(
                tool("stamp", { shortcut: "U", toolSets: ["object", "marker"] }),
                "./stamp.tools.ts",
            ),
        ).toThrow(
            'Tool "stamp" (./stamp.tools.ts) uses key "U", as "markerRectangle" (./planned.tools.ts) does.',
        );
        registry.register(tool("brush", { shortcut: "B", toolSets: ["tile"] }), "./a.tools.ts");
        expect(() =>
            registry.register(tool("other", { shortcut: "b", toolSets: ["tile"] }), "./b.tools.ts"),
        ).toThrow('Tool "other" (./b.tools.ts) uses key "B", as "brush" (./a.tools.ts) does.');
        expect(() =>
            registry.plan(
                {
                    id: "spray",
                    label: "Spray",
                    shortcut: "B",
                    icon: "s",
                    railOrder: 300,
                    toolSets: ["tile"],
                },
                "./c.tools.ts",
            ),
        ).toThrow(
            'Planned tool "spray" (./c.tools.ts) uses key "B", as "brush" (./a.tools.ts) does.',
        );
        expect(() =>
            registry.register(
                tool("dab", { hold: { key: "B" }, toolSets: ["tile"] }),
                "./d.tools.ts",
            ),
        ).toThrow(/Tool "dab" \(\.\/d\.tools\.ts\) uses key "B", as "brush"/);
        expect(registry.list().map((entry) => entry.id)).toEqual(["brush"]);
        expect(registry.railSlots().map((slot) => slot.id)).toEqual([
            "shapeFill",
            "markerRectangle",
        ]);
    });

    it("treats a tool or planned slot in no set as in every set, as before", () => {
        const registry = createToolRegistry<FixtureTool>();
        registry.register(tool("fill", { shortcut: "G", toolSets: ["tile"] }), "./a.tools.ts");
        expect(() => registry.register(tool("bucket", { shortcut: "G" }), "./b.tools.ts")).toThrow(
            'Tool "bucket" (./b.tools.ts) uses key "G", as "fill" (./a.tools.ts) does.',
        );
        registry.register(tool("hand", { shortcut: "H" }), "./a.tools.ts");
        expect(() =>
            registry.register(
                tool("hold", { shortcut: "H", toolSets: ["marker"] }),
                "./b.tools.ts",
            ),
        ).toThrow('Tool "hold" (./b.tools.ts) uses key "H", as "hand" (./a.tools.ts) does.');
        expect(() =>
            registry.plan({ id: "zoom", label: "Zoom", shortcut: "H", icon: "z", railOrder: 1 }),
        ).toThrow(/Planned tool "zoom" \(runtime\) uses key "H", as "hand"/);
        expect(registry.list().map((entry) => entry.id)).toEqual(["fill", "hand"]);
    });

    it("refuses tool sets that are empty or unnamed", () => {
        const registry = createToolRegistry<FixtureTool>();
        expect(() => registry.register(tool("x", { toolSets: [] }), "./x.tools.ts")).toThrow(
            'Tool "x" (./x.tools.ts) lists no tool set; leave the sets out for every set.',
        );
        expect(() => registry.register(tool("x", { toolSets: ["tile", " "] }))).toThrow(
            /a tool set without a name/,
        );
        expect(() =>
            registry.register(tool("x", { toolSets: "tile" as unknown as string[] })),
        ).toThrow(/tool sets that are not a list/);
        const slot = { id: "s", label: "S", icon: "i", railOrder: 100 };
        expect(() => registry.plan({ ...slot, toolSets: [] }, "p.tools.ts")).toThrow(
            /Planned tool "s" \(p\.tools\.ts\) lists no tool set/,
        );
        expect(registry.list()).toEqual([]);
        expect(registry.railSlots()).toEqual([]);
    });

    it("gives a tool its planned slot's sets unless it names its own, its keys checked in them", () => {
        const registry = createToolRegistry<FixtureTool>();
        registry.register(tool("rect", { shortcut: "K", toolSets: ["marker"] }), "./a.tools.ts");
        registry.register(tool("fill", { toolSets: ["marker"] }), "./b.tools.ts");
        // The planned key is free in "tile", but the tool of its id is a marker tool.
        expect(() =>
            registry.plan({ ...tileAndMarkerPlans[0]!, id: "fill", shortcut: "K" }, "./p.tools.ts"),
        ).toThrow('Tool "fill" (./b.tools.ts) uses key "K", as "rect" (./a.tools.ts) does.');
        expect(registry.get("fill")?.shortcut).toBeUndefined();
        expect(registry.railSlots()).toEqual([]);

        // A tool naming no sets of its own takes the slot's, and keeps them while the plan holds.
        const unplan = registry.plan(
            { ...tileAndMarkerPlans[0]!, id: "line", shortcut: "L" },
            "./p.tools.ts",
        );
        registry.register(tool("line", { shortcut: "J" }), "./c.tools.ts");
        expect(registry.get("line")?.toolSets).toEqual(["tile"]);
        const removeJump = registry.register(
            tool("jump", { shortcut: "J", toolSets: ["marker"] }),
            "./d.tools.ts",
        );
        // Without the plan the line would be in every set, with the marker tool's key: refused,
        // and the plan stays.
        expect(unplan).toThrow(
            'Tool "line" (./c.tools.ts) uses key "J", as "jump" (./d.tools.ts) does.',
        );
        expect(slotIn(registry, "line").toolSets).toEqual(["tile"]);
        removeJump();
        unplan();
        expect(registry.get("line")?.toolSets).toBeUndefined();
        expect(registry.get("line")?.shortcut).toBe("J");
    });
});

describe("slots with variants", () => {
    it("lists a slot's own tool first, then its variants by position and id; variants take no slot", () => {
        const registry = rail(
            tool("marquee"),
            tool("c", { variantOf: "marquee" }),
            tool("b", { variantOf: "marquee", railOrder: 302 }),
            tool("a", { variantOf: "marquee", railOrder: 302 }),
        );
        const marquee = slotIn(registry, "marquee");
        expect(marquee.tool?.id).toBe("marquee");
        expect(marquee.variants.map((variant) => variant.id)).toEqual(["marquee", "a", "b", "c"]);
        const ids = registry.railSlots().map((slot) => slot.id);
        expect(ids).toEqual(plannedTools.map((plan) => plan.id));
        expect(railGroups(registry.railSlots()).map((group) => group.length)).toEqual(
            railGroups(rail().railSlots()).map((group) => group.length),
        );
        expect(slotOf(registry.get("a")!)).toBe("marquee");
        expect(slotOf(registry.get("marquee")!)).toBe("marquee");
    });

    it("gives a planned slot its first variant when the slot's own tool is not registered", () => {
        const registry = rail(tool("polygon", { variantOf: "lasso", icon: "brush" }));
        const lasso = slotIn(registry, "lasso");
        expect(lasso.tool?.id).toBe("polygon");
        expect(lasso.variants.map((variant) => variant.id)).toEqual(["polygon"]);
        // A slot alone: the tool of its id, or none.
        const move = slotIn(registry, "move");
        expect(move.tool).toBeNull();
        expect(move.variants).toEqual([]);
    });

    it("leaves out a variant of a slot that does not exist, and lets a variant go without an icon", () => {
        const registry = rail(
            tool("orphan", { variantOf: "nowhere", railOrder: 999 }),
            tool("lasso"),
            tool("bare", { variantOf: "lasso", railOrder: 311 }),
        );
        expect(
            registry.railSlots().flatMap((slot) => slot.variants.map((v) => v.id)),
        ).not.toContain("orphan");
        expect(slotIn(registry, "lasso").variants.map((variant) => variant.id)).toEqual([
            "lasso",
            "bare",
        ]);
        expect(() => registry.register(tool("x", { variantOf: " " }))).toThrow(
            /slot without an id/,
        );
    });

    it("takes a slot planned after its tool, and gives it back when the plan is removed", () => {
        const registry = createToolRegistry<FixtureTool>();
        registry.register(tool("pencil", { paints: true }));
        expect(registry.railSlots()).toEqual([]);
        const unplan = registry.plan(plannedTools[0]!, "./planned.tools.ts");
        expect(registry.get("pencil")).toMatchObject({
            shortcut: "B",
            icon: "pencil",
            railOrder: 100,
        });
        expect(registry.railSlots().map((slot) => slot.tool?.id)).toEqual(["pencil"]);
        unplan();
        expect(registry.get("pencil")?.railOrder).toBeUndefined();
        expect(registry.railSlots()).toEqual([]);
    });
});
