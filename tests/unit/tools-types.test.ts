import { readFileSync } from "node:fs";
import { describe, expect, expectTypeOf, it } from "vitest";
import { createToolRegistry, registerToolModules } from "../../src/model/tools/registry.ts";
import type {
    PlannedToolSpec,
    RailSlot,
    ToolBase,
    ToolHoldKey,
    ToolModule,
    ToolOptionSpec,
} from "../../src/model/tools/types.ts";

// The tool base (SPEC §8, BRIEF D18), checked at the type level: `ToolBase` holds what the tool
// rail and the context bar need and nothing an editor's behaviour brings (pointer samples,
// strokes, documents, handlers); a tool type that lacks one of its required fields is refused
// by the compiler. The `@ts-expect-error` lines fail the typecheck when they compile.

type Values<T> = T[keyof T];
type Callable = (...args: never[]) => unknown;

describe("ToolBase", () => {
    it("holds the rail's and the context bar's fields only", () => {
        expectTypeOf<keyof ToolBase>().toEqualTypeOf<
            | "id"
            | "label"
            | "icon"
            | "shortcut"
            | "hold"
            | "railOrder"
            | "variantOf"
            | "options"
            | "toolSets"
        >();
        expectTypeOf<ToolBase["id"]>().toEqualTypeOf<string>();
        expectTypeOf<ToolBase["label"]>().toEqualTypeOf<string>();
        expectTypeOf<ToolBase["icon"]>().toEqualTypeOf<unknown>();
        expectTypeOf<ToolBase<"icon">["icon"]>().toEqualTypeOf<"icon" | undefined>();
        expectTypeOf<ToolBase["shortcut"]>().toEqualTypeOf<string | undefined>();
        expectTypeOf<ToolBase["hold"]>().toEqualTypeOf<ToolHoldKey | undefined>();
        expectTypeOf<keyof ToolHoldKey>().toEqualTypeOf<"key">();
        expectTypeOf<ToolBase["railOrder"]>().toEqualTypeOf<number | undefined>();
        expectTypeOf<ToolBase["variantOf"]>().toEqualTypeOf<string | undefined>();
        expectTypeOf<ToolBase["options"]>().toEqualTypeOf<readonly ToolOptionSpec[] | undefined>();
        expectTypeOf<ToolBase["toolSets"]>().toEqualTypeOf<readonly string[] | undefined>();
    });

    it("gives tools, planned slots and rail slots the tool sets they are offered in", () => {
        expectTypeOf<PlannedToolSpec["toolSets"]>().toEqualTypeOf<readonly string[] | undefined>();
        expectTypeOf<RailSlot["toolSets"]>().toEqualTypeOf<readonly string[] | undefined>();
        // Optional on what an editor declares, always present on the slot the rail reads.
        expectTypeOf<{ id: string; label: string }>().toExtend<ToolBase>();
        expectTypeOf<{ id: string; label: string; icon: string; railOrder: number }>().toExtend<
            PlannedToolSpec<string>
        >();
        expectTypeOf<Omit<RailSlot, "toolSets">>().not.toExtend<RailSlot>();
        // @ts-expect-error The sets are a list of names, not one name.
        const one: ToolBase = { id: "fill", label: "Fill", toolSets: "tile" };
        // @ts-expect-error Nor a list of anything else.
        const numbers: ToolBase = { id: "fill", label: "Fill", toolSets: [1] };
        expect([one, numbers]).toHaveLength(2);

        const registry = createToolRegistry<ToolBase<string>>();
        registry.plan({ id: "fill", label: "Fill", icon: "f", railOrder: 100, toolSets: ["tile"] });
        registry.register({ id: "rect", label: "Rect", icon: "r", railOrder: 110 });
        registry.register({ id: "stamp", label: "Stamp", toolSets: ["tile", "marker"] });
        expect(registry.railSlots().map((slot) => [slot.id, slot.toolSets])).toEqual([
            ["fill", ["tile"]],
            ["rect", undefined],
        ]);
        expect(registry.get("stamp")?.toolSets).toEqual(["tile", "marker"]);
        // A tool takes its planned slot's sets.
        registry.register({ id: "fill", label: "Fill" });
        expect(registry.get("fill")?.toolSets).toEqual(["tile"]);
    });

    it("carries no handler, pointer, stroke or document type", () => {
        expectTypeOf<Extract<Values<Required<ToolBase<string>>>, Callable>>().toBeNever();
        expectTypeOf<Extract<Values<Required<ToolHoldKey>>, Callable>>().toBeNever();
        expectTypeOf<Extract<Values<Required<ToolOptionSpec>>, Callable>>().toBeNever();
        expectTypeOf<Extract<Values<Required<PlannedToolSpec<string>>>, Callable>>().toBeNever();
        // The types' module imports nothing, so no editor type can reach them.
        const source = readFileSync(
            new URL("../../src/model/tools/types.ts", import.meta.url),
            "utf8",
        );
        expect(source).not.toMatch(/^\s*(import|export\s+[^;]*\bfrom\b)/m);
    });

    it("lets an editor extend it with its own fields and narrow the icon", () => {
        interface EditorTool extends ToolBase<{ readonly glyph: string }> {
            paints?: boolean;
            onDown?(pointer: { readonly x: number; readonly y: number }): void;
        }
        expectTypeOf<EditorTool>().toExtend<ToolBase>();
        const registry = createToolRegistry<EditorTool>();
        registry.plan({ id: "pencil", label: "Pencil", icon: { glyph: "P" }, railOrder: 100 });
        // @ts-expect-error The planned slot's icon must be the editor's icon type.
        registry.plan({ id: "eraser", label: "Eraser", icon: "E", railOrder: 110 });
        expectTypeOf<RailSlot<EditorTool>["icon"]>().toEqualTypeOf<
            { readonly glyph: string } | undefined
        >();
        expectTypeOf<ToolModule<EditorTool>["tools"]>().toEqualTypeOf<
            readonly EditorTool[] | undefined
        >();
    });
});

describe("a tool missing a ToolBase field", () => {
    it("does not compile", () => {
        // @ts-expect-error No id.
        const noId: ToolBase = { label: "Pencil" };
        // @ts-expect-error No label.
        const noLabel: ToolBase = { id: "pencil" };
        expect([noId, noLabel]).toHaveLength(2);

        // @ts-expect-error A tool type without a label is not a tool type of the registry.
        createToolRegistry<{ id: string }>();
        // @ts-expect-error Nor is one whose field has another type.
        createToolRegistry<{ id: string; label: string; railOrder: string }>();

        const registry = createToolRegistry<ToolBase>();
        // @ts-expect-error No label: the registry also refuses it at run time.
        expect(() => registry.register({ id: "pencil" })).toThrow();
        expect(() =>
            // @ts-expect-error A module's tool without an id.
            registerToolModules(registry, { "./a.tools.ts": { tools: [{ label: "Pencil" }] } }),
        ).toThrow();
        expectTypeOf<{ id: string }>().not.toExtend<ToolBase>();
        expectTypeOf<{ label: string }>().not.toExtend<ToolBase>();
    });
});
