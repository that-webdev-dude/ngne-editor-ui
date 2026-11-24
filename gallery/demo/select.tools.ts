import type { ToolAction } from "@ngne/editor-ui/shell";
import {
    CircleDashed,
    Lasso,
    LassoSelect,
    Move,
    SquareDashed,
    SquareDashedMousePointer,
    SquareX,
    WandSparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
    CROP_TO_SELECTION_COMMAND,
    DESELECT_COMMAND,
    INVERT_SELECTION_COMMAND,
    SELECT_ALL_COMMAND,
} from "./selection.ts";
import { SELECT_SET } from "./tools.ts";
import type { DemoTool } from "./tools.ts";

// The demo editor's selection tools (SPEC §1.3 `*.tools.ts`, §8): the rail's first group, the
// Select tool set. The marquee and the lasso each have a variant on the same slot, with its own
// key, and a name in the variant choice the demo draws in the readouts slot. The magic wand's
// key, G, is the Paint set's fill's too: the sets are never offered together, so the registry
// lets them share it (SPEC §8 Tools). The marquees have command buttons, two icon buttons and
// two text buttons, which the context bar draws after their options; at 1280 px the last of
// them move into its overflow menu.

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

const feather = {
    key: "feather",
    label: "Feather",
    kind: "number",
    min: 0,
    max: 64,
    unit: "px",
    default: 0,
} as const;

const antiAlias = { key: "antiAlias", label: "Anti-alias", kind: "toggle", default: true } as const;

const selectionActions: ToolAction<LucideIcon>[] = [
    { commandId: SELECT_ALL_COMMAND, label: "Select All", icon: SquareDashedMousePointer },
    { commandId: DESELECT_COMMAND, label: "Deselect", icon: SquareX },
    { commandId: INVERT_SELECTION_COMMAND, label: "Invert" },
    { commandId: CROP_TO_SELECTION_COMMAND, label: "Crop" },
];

export const tools: DemoTool[] = [
    {
        id: "marquee",
        label: "Rectangular marquee",
        icon: SquareDashed,
        shortcut: "M",
        railOrder: 100,
        toolSets: SELECT_SET,
        variantLabel: "Rectangle",
        options: [mode, feather, antiAlias],
        actions: selectionActions,
    },
    {
        id: "ellipse-marquee",
        label: "Elliptical marquee",
        icon: CircleDashed,
        shortcut: "Shift+M",
        railOrder: 101,
        toolSets: SELECT_SET,
        variantOf: "marquee",
        variantLabel: "Ellipse",
        options: [mode, feather, antiAlias],
        actions: selectionActions,
    },
    {
        id: "lasso",
        label: "Lasso",
        icon: Lasso,
        shortcut: "Q",
        railOrder: 110,
        toolSets: SELECT_SET,
        variantLabel: "Freehand",
    },
    {
        id: "polygon-lasso",
        label: "Polygon lasso",
        icon: LassoSelect,
        shortcut: "Shift+Q",
        railOrder: 111,
        toolSets: SELECT_SET,
        variantOf: "lasso",
        variantLabel: "Polygon",
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
