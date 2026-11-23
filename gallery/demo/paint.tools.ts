import type { PlannedToolSpec } from "@ngne/editor-ui/shell";
import {
    Circle,
    Droplet,
    Eraser,
    PaintBucket,
    Pencil,
    Pentagon,
    Pipette,
    Slash,
    Spline,
    SprayCan,
    Square,
    StickyNote,
    Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PAINT_SET } from "./tools.ts";
import type { DemoTool } from "./tools.ts";

// The demo editor's painting, shape and text tools (SPEC §1.3 `*.tools.ts`, §8): three groups of
// the rail, the Paint tool set, with planned slots (disabled until a tool takes them) and a
// variant on the rectangle's slot. The airbrush has more options than the context bar holds at
// 1280 px, so the last of them move into its overflow menu.

const size = (max: number, initial: number) =>
    ({
        key: "size",
        label: "Size",
        kind: "number",
        min: 1,
        max,
        unit: "px",
        default: initial,
    }) as const;

const pixelPerfect = {
    key: "pixelPerfect",
    label: "Pixel perfect",
    kind: "toggle",
    default: true,
} as const;

const fill = {
    key: "fill",
    label: "Fill",
    kind: "choice",
    choices: [
        { value: "outline", label: "Outline" },
        { value: "filled", label: "Filled" },
    ],
    default: "outline",
} as const;

const percent = (key: string, label: string, min: number, initial: number) =>
    ({ key, label, kind: "number", min, max: 100, unit: "%", default: initial }) as const;

export const plannedTools: PlannedToolSpec<LucideIcon>[] = [
    { id: "smudge", label: "Smudge", icon: Droplet, railOrder: 250, toolSets: PAINT_SET },
    { id: "curve", label: "Curve", icon: Spline, railOrder: 330, toolSets: PAINT_SET },
    { id: "note", label: "Note", icon: StickyNote, railOrder: 410, toolSets: PAINT_SET },
];

export const tools: DemoTool[] = [
    {
        id: "pencil",
        label: "Pencil",
        icon: Pencil,
        shortcut: "B",
        railOrder: 200,
        toolSets: PAINT_SET,
        options: [size(16, 1), pixelPerfect],
    },
    {
        id: "airbrush",
        label: "Airbrush",
        icon: SprayCan,
        shortcut: "A",
        railOrder: 210,
        toolSets: PAINT_SET,
        options: [
            size(64, 8),
            percent("flow", "Flow", 1, 50),
            percent("spacing", "Spacing", 1, 25),
            {
                key: "shape",
                label: "Shape",
                kind: "choice",
                choices: [
                    { value: "round", label: "Round" },
                    { value: "square", label: "Square" },
                ],
                default: "round",
            },
            {
                key: "blend",
                label: "Blend",
                kind: "choice",
                display: "select",
                choices: [
                    { value: "normal", label: "Normal" },
                    { value: "multiply", label: "Multiply" },
                    { value: "screen", label: "Screen" },
                ],
                default: "normal",
            },
            { key: "pressure", label: "Pressure", kind: "toggle", default: false },
            percent("jitter", "Jitter", 0, 0),
            pixelPerfect,
        ],
    },
    {
        id: "eraser",
        label: "Eraser",
        icon: Eraser,
        shortcut: "E",
        railOrder: 220,
        toolSets: PAINT_SET,
        options: [size(16, 1)],
    },
    {
        id: "fill",
        label: "Fill",
        icon: PaintBucket,
        shortcut: "G",
        railOrder: 230,
        toolSets: PAINT_SET,
        options: [
            { key: "tolerance", label: "Tolerance", kind: "number", min: 0, max: 255, default: 0 },
            { key: "contiguous", label: "Contiguous", kind: "toggle", default: true },
        ],
    },
    {
        id: "eyedropper",
        label: "Eyedropper",
        icon: Pipette,
        shortcut: "I",
        railOrder: 240,
        toolSets: PAINT_SET,
        options: [
            {
                key: "sample",
                label: "Sample",
                kind: "choice",
                display: "select",
                choices: [
                    { value: "layer", label: "Current layer" },
                    { value: "all", label: "All layers" },
                ],
                default: "layer",
            },
        ],
    },
    {
        id: "line",
        label: "Line",
        icon: Slash,
        shortcut: "L",
        railOrder: 300,
        toolSets: PAINT_SET,
        options: [size(16, 1)],
    },
    {
        id: "rectangle",
        label: "Rectangle",
        icon: Square,
        shortcut: "U",
        railOrder: 310,
        toolSets: PAINT_SET,
        options: [fill],
    },
    {
        id: "ellipse",
        label: "Ellipse",
        icon: Circle,
        shortcut: "Shift+U",
        railOrder: 311,
        toolSets: PAINT_SET,
        variantOf: "rectangle",
        options: [fill],
    },
    {
        id: "polygon",
        label: "Polygon",
        icon: Pentagon,
        shortcut: "P",
        railOrder: 320,
        toolSets: PAINT_SET,
    },
    {
        id: "text",
        label: "Text",
        icon: Type,
        shortcut: "T",
        railOrder: 400,
        toolSets: PAINT_SET,
        options: [
            {
                key: "size",
                label: "Size",
                kind: "number",
                min: 6,
                max: 72,
                unit: "px",
                default: 12,
            },
        ],
    },
];
