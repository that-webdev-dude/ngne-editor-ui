import type { StatusField } from "@ngne/editor-ui/shell";
import type { DemoStatusInput } from "./status.ts";

// The demo editor's status fields (SPEC §1.3 `*.status.ts`, §8): the pointer's position over the
// canvas, which keeps its width while the pointer is elsewhere so the field after it does not
// move, then the zoom with Fit to Window as its action.

/** The width the pointer field keeps: "1023, 1023". */
export const POINTER_RESERVE = 10;

export const statusFields: StatusField<DemoStatusInput>[] = [
    {
        id: "pointer",
        order: 100,
        reserve: POINTER_RESERVE,
        text: ({ pointer }) => (pointer ? `${pointer.x}, ${pointer.y}` : ""),
    },
    {
        id: "zoom",
        order: 200,
        text: () => "100%",
        action: { commandId: "demo.view.fit" },
    },
];
