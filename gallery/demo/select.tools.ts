import { CircleDashed, Lasso, LassoSelect, Move, SquareDashed, WandSparkles } from "lucide-react";
import type { DemoTool } from "./tools.ts";

// The demo editor's selection tools (SPEC §1.3 `*.tools.ts`, §8): the rail's first group. The
// marquee and the lasso each have a variant on the same slot, with its own key.

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
        options: [mode],
    },
    {
        id: "ellipse-marquee",
        label: "Elliptical marquee",
        icon: CircleDashed,
        shortcut: "Shift+M",
        railOrder: 101,
        variantOf: "marquee",
        options: [mode],
    },
    { id: "lasso", label: "Lasso", icon: Lasso, shortcut: "Q", railOrder: 110 },
    {
        id: "polygon-lasso",
        label: "Polygon lasso",
        icon: LassoSelect,
        shortcut: "Shift+Q",
        railOrder: 111,
        variantOf: "lasso",
    },
    {
        id: "wand",
        label: "Magic wand",
        icon: WandSparkles,
        shortcut: "W",
        railOrder: 120,
        options: [
            { key: "tolerance", label: "Tolerance", kind: "number", min: 0, max: 255, default: 0 },
        ],
    },
    { id: "move", label: "Move", icon: Move, shortcut: "V", railOrder: 130 },
];
