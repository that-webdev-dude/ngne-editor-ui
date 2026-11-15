import { describe, expect, it } from "vitest";
import { RegistrationError } from "../../src/model/modules.ts";
import { collectStatusFields } from "../../src/model/registries/statusFields.ts";
import type { StatusField } from "../../src/model/registries/statusFields.ts";

// The status bar's field registry (SPEC §1.3, §8, `*.status.ts`): fields of a fixture module
// map in registry order with their reserved widths, typed by what the editor's fields read.

/** What the fixture's fields read, as an editor defines it. */
interface Input {
    cursor: { x: number; y: number } | null;
}

const field = (
    id: string,
    order: number,
    extra: Partial<StatusField<Input>> = {},
): StatusField<Input> => ({
    id,
    order,
    text: () => id,
    ...extra,
});

describe("status field registry", () => {
    it("orders the fields of all modules by order, then id", () => {
        const fields = collectStatusFields({
            "a.status.ts": { statusFields: [field("b", 200), field("a", 200)] },
            "b.status.ts": { statusFields: [field("first", 100)] },
        });
        expect(fields.map((each) => each.id)).toEqual(["first", "a", "b"]);
    });

    it("keeps each field's text, reserved width, action and subscription", () => {
        const subscribe = () => () => undefined;
        const [cell, zoom] = collectStatusFields<Input>({
            "./view.status.ts": {
                statusFields: [
                    field("zoom", 300, { action: { commandId: "view.fit" } }),
                    field("cell", 100, {
                        reserve: 9,
                        text: ({ cursor }) => (cursor ? `${cursor.x}, ${cursor.y}` : ""),
                        subscribe,
                    }),
                ],
            },
        });
        expect(cell?.text({ cursor: { x: 2, y: 3 } })).toBe("2, 3");
        expect(cell?.text({ cursor: null })).toBe("");
        expect(cell?.reserve).toBe(9);
        expect(cell?.subscribe).toBe(subscribe);
        expect(zoom?.reserve).toBeUndefined();
        expect(zoom?.action).toEqual({ commandId: "view.fit" });
        expect(
            collectStatusFields({
                "./reserve.status.ts": { statusFields: [field("z", 1, { reserve: 0 })] },
            })[0]?.reserve,
        ).toBe(0);
    });

    it("names the module of a duplicate id, a missing export and a missing order", () => {
        expect(() =>
            collectStatusFields({
                "a.status.ts": { statusFields: [field("x", 1)] },
                "b.status.ts": { statusFields: [field("x", 2)] },
            }),
        ).toThrow('Status field id "x" is used by a.status.ts and b.status.ts.');
        expect(() => collectStatusFields({ "c.status.ts": {} })).toThrow(RegistrationError);
        expect(() => collectStatusFields({ "c.status.ts": {} })).toThrow(
            'c.status.ts does not export "statusFields".',
        );
        expect(() =>
            collectStatusFields({ "d.status.ts": { statusFields: [field("y", Number.NaN)] } }),
        ).toThrow(/d\.status\.ts/);
        expect(() =>
            collectStatusFields({ "e.status.ts": { statusFields: [field(" ", 1)] } }),
        ).toThrow("A field of e.status.ts has no id.");
    });
});
