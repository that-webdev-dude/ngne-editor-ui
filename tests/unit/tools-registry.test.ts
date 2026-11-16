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
