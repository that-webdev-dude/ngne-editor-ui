import { CircleDashed, Lasso, LassoSelect, Move, SquareDashed, WandSparkles } from "lucide-react";
import { SELECT_SET } from "./tools.ts";
import type { DemoTool } from "./tools.ts";

// The demo editor's selection tools (SPEC §1.3 `*.tools.ts`, §8): the rail's first group, the
// Select tool set. The marquee and the lasso each have a variant on the same slot, with its own
// key. The magic wand's key, G, is the Paint set's fill's too: the sets are never offered
// together, so the registry lets them share it (SPEC §8 Tools).

const mode = {
    key: "mode",
    label: "Mode",
    kind: "choice",
    choices: [
        { value: "replace", label: "Replace" },
        { value: "add", label: "Add" },
        { value: "subtract", label: "Subtract" },
    ],
    default: "replace",
} as const;

export const tools: DemoTool[] = [
    {
        id: "marquee",
        label: "Rectangular marquee",
        icon: SquareDashed,
        shortcut: "M",
        railOrder: 100,
        toolSets: SELECT_SET,
        options: [mode],
    },
    {
        id: "ellipse-marquee",
        label: "Elliptical marquee",
        icon: CircleDashed,
        shortcut: "Shift+M",
        railOrder: 101,
        toolSets: SELECT_SET,
        variantOf: "marquee",
        options: [mode],
    },
    {
        id: "lasso",
        label: "Lasso",
        icon: Lasso,
        shortcut: "Q",
        railOrder: 110,
        toolSets: SELECT_SET,
    },
    {
        id: "polygon-lasso",
        label: "Polygon lasso",
        icon: LassoSelect,
        shortcut: "Shift+Q",
        railOrder: 111,
        toolSets: SELECT_SET,
        variantOf: "lasso",
    },
    {
        id: "wand",
        label: "Magic wand",
        icon: WandSparkles,
        shortcut: "G",
        railOrder: 120,
        toolSets: SELECT_SET,
        options: [
            { key: "tolerance", label: "Tolerance", kind: "number", min: 0, max: 255, default: 0 },
        ],
    },
    { id: "move", label: "Move", icon: Move, shortcut: "V", railOrder: 130, toolSets: SELECT_SET },
];
