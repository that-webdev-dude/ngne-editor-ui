import { readFileSync } from "node:fs";
import { describe, expect, expectTypeOf, it } from "vitest";
import { createToolRegistry, registerToolModules } from "../../src/model/tools/registry.ts";
import { RegistrationError } from "../../src/model/modules.ts";
import type {
    PlannedToolSpec,
    RailSlot,
    RegisteredTool,
    ToolAction,
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
            | "actions"
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
        expectTypeOf<ToolBase["actions"]>().toEqualTypeOf<readonly ToolAction[] | undefined>();
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
        expectTypeOf<Extract<Values<Required<ToolAction<string>>>, Callable>>().toBeNever();
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

describe("a tool's command buttons", () => {
    it("name a command, a label and an optional icon of the tool's icon type", () => {
        expectTypeOf<keyof ToolAction>().toEqualTypeOf<"commandId" | "label" | "icon">();
        expectTypeOf<ToolAction["commandId"]>().toEqualTypeOf<string>();
        expectTypeOf<ToolAction["label"]>().toEqualTypeOf<string>();
        expectTypeOf<ToolAction["icon"]>().toEqualTypeOf<unknown>();
        expectTypeOf<ToolBase<"icon">["actions"]>().toEqualTypeOf<
            readonly ToolAction<"icon">[] | undefined
        >();
        // Always present on the tool the registry hands back.
        expectTypeOf<RegisteredTool<ToolBase<"icon">>["actions"]>().toEqualTypeOf<
            readonly ToolAction<"icon">[]
        >();
        expectTypeOf<{ commandId: string; label: string }>().toExtend<ToolAction>();
        // @ts-expect-error No command id.
        const noCommand: ToolAction = { label: "Flip H" };
        // @ts-expect-error No label.
        const noLabel: ToolAction = { commandId: "stamp.flipHorizontal" };
        const otherIcon: ToolBase<"icon"> = {
            id: "s",
            label: "S",
            // @ts-expect-error The icon must be the tool's icon type.
            actions: [{ commandId: "c", label: "C", icon: 1 }],
        };
        expect([noCommand, noLabel, otherIcon]).toHaveLength(3);
    });

    it("are kept in the tool's order, and none when the tool lists none", () => {
        const registry = createToolRegistry<ToolBase<string>>();
        const actions: ToolAction<string>[] = [
            { commandId: "stamp.rotateLeft", label: "Rotate Stamp Left", icon: "rotate-left" },
            { commandId: "stamp.flipHorizontal", label: "Flip H" },
        ];
        registry.register({ id: "stamp", label: "Stamp", actions });
        registry.register({ id: "fill", label: "Fill" });
        expect(registry.get("stamp")?.actions).toEqual(actions);
        expect(registry.get("fill")?.actions).toEqual([]);
    });

    it("are refused at registration without a command id or a label, or with a command twice", () => {
        const registry = createToolRegistry<ToolBase>();
        const refused = (actions: unknown) => () =>
            registry.register(
                { id: "stamp", label: "Stamp", actions: actions as ToolAction[] },
                "stamp.tools.ts",
            );
        expect(refused([{ commandId: " ", label: "Flip H" }])).toThrow(
            'Tool "stamp" (stamp.tools.ts) has an action without a command id.',
        );
        expect(refused([{ label: "Flip H" }])).toThrow(/without a command id/);
        expect(refused([{ commandId: "stamp.flip", label: "" }])).toThrow(
            'Tool "stamp" (stamp.tools.ts) has action "stamp.flip" without a label.',
        );
        expect(
            refused([
                { commandId: "stamp.flip", label: "Flip" },
                { commandId: "stamp.flip", label: "Flip again" },
            ]),
        ).toThrow('Tool "stamp" (stamp.tools.ts) lists action "stamp.flip" twice.');
        expect(refused("stamp.flip")).toThrow(/actions that are not a list/);
        expect(refused([{ label: "Flip H" }])).toThrow(RegistrationError);
        // Nothing refused was registered; a valid list is.
        expect(registry.list()).toEqual([]);
        expect(refused([{ commandId: "stamp.flip", label: "Flip" }])).not.toThrow();
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
