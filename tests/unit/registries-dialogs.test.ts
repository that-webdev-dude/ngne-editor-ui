import { describe, expect, it } from "vitest";
import { RegistrationError } from "../../src/model/modules.ts";
import { collectCommandDialogs } from "../../src/model/registries/dialogs.ts";
import type { CommandDialog } from "../../src/model/registries/dialogs.ts";

// The dialog registry (SPEC §1.3, `*.dialog.tsx`): the dialogs of a fixture module map by
// request kind, in declared order, and the errors it throws at startup.

/** A component stand-in: the registry keeps whatever the editor's component type is. */
type Component = (props: { request: { kind: string } }) => null;
const Body: Component = () => null;
const dialog = (kind: string, name = kind): CommandDialog<Component> => ({
    kind,
    name,
    Component: Body,
});

describe("dialog registry", () => {
    it("returns the dialogs of every module by kind, in declared order", () => {
        const dialogs = collectCommandDialogs({
            "./sprite/sprite.dialog.tsx": {
                commandDialogs: [
                    dialog("new-sprite", "New sprite"),
                    dialog("canvas-size", "Canvas size"),
                ],
            },
            "./file/export.dialog.tsx": { commandDialogs: [dialog("export", "Export")] },
        });
        expect([...dialogs.keys()]).toEqual(["export", "new-sprite", "canvas-size"]);
        expect(dialogs.get("canvas-size")?.name).toBe("Canvas size");
        expect(dialogs.get("new-sprite")?.Component).toBe(Body);
        expect(collectCommandDialogs({}).size).toBe(0);
    });

    it("refuses a module without dialogs and a kind registered twice, naming both modules", () => {
        expect(() => collectCommandDialogs({ "./a.dialog.tsx": {} })).toThrow(
            new RegistrationError(
                './a.dialog.tsx does not export "commandDialogs".',
                "./a.dialog.tsx",
            ),
        );
        expect(() =>
            collectCommandDialogs({
                "./a.dialog.tsx": { commandDialogs: [dialog("x", "X")] },
                "./b.dialog.tsx": { commandDialogs: [dialog("x", "Y")] },
            }),
        ).toThrow('Dialog kind "x" is used by ./a.dialog.tsx and ./b.dialog.tsx.');
        expect(() =>
            collectCommandDialogs({
                "./a.dialog.tsx": { commandDialogs: [dialog("x"), dialog("x")] },
            }),
        ).toThrow('Dialog kind "x" is used by ./a.dialog.tsx and ./a.dialog.tsx.');
    });

    it("refuses an export that is not a list and a dialog without a kind", () => {
        const notAList = { commandDialogs: dialog("x") } as unknown as {
            commandDialogs: CommandDialog<Component>[];
        };
        expect(() => collectCommandDialogs({ "./a.dialog.tsx": notAList })).toThrow(
            './a.dialog.tsx does not export "commandDialogs".',
        );
        expect(() =>
            collectCommandDialogs({ "./b.dialog.tsx": { commandDialogs: [dialog(" ")] } }),
        ).toThrow("A dialog of ./b.dialog.tsx has no kind.");
        expect(() =>
            collectCommandDialogs({
                "./c.dialog.tsx": { commandDialogs: [null as unknown as CommandDialog<Component>] },
            }),
        ).toThrow("A dialog of ./c.dialog.tsx has no kind.");
    });
});
