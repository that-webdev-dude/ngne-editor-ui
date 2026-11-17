import type { PlannedToolSpec } from "@ngne/editor-ui/shell";
import { Hand, RotateCw, Ruler, ZoomIn } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DemoTool } from "./tools.ts";

// The demo editor's navigation tools (SPEC §1.3 `*.tools.ts`, §8): the rail's last group, in
// every tool set, with a planned slot.

export const plannedTools: PlannedToolSpec<LucideIcon>[] = [
    { id: "ruler", label: "Ruler", icon: Ruler, railOrder: 530 },
];

export const tools: DemoTool[] = [
    { id: "hand", label: "Hand", icon: Hand, shortcut: "H", railOrder: 500 },
    { id: "magnifier", label: "Magnifier", icon: ZoomIn, shortcut: "Z", railOrder: 510 },
    { id: "rotate", label: "Rotate view", icon: RotateCw, shortcut: "R", railOrder: 520 },
];
