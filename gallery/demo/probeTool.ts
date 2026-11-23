import type { CommandRegistry } from "@ngne/editor-ui/commands";
import { Crosshair } from "lucide-react";
import { toolRegistry } from "./sources.ts";
import { toolKeyCommand } from "./toolKeys.ts";
import { PAINT_SET, selectTool, toolStore } from "./tools.ts";
import type { DemoTool } from "./tools.ts";

// A tool the demo editor registers at run time (SPEC §8 Tool rail), as an editor's test
// fixture does: the viewport's "Probe tool" toggle adds it to the registry the instance's rail
// and context bar read, with the command of its key, and takes both out again. It joins the
// text group of the Paint tool set.

export const PROBE_TOOL: DemoTool = {
    id: "probe",
    label: "Probe",
    icon: Crosshair,
    shortcut: "K",
    railOrder: 420,
    toolSets: PAINT_SET,
    options: [
        { key: "radius", label: "Radius", kind: "number", min: 1, max: 32, unit: "px", default: 4 },
        { key: "snap", label: "Snap to pixel", kind: "toggle", default: true },
    ],
};

const SOURCE = "probeTool.ts (run time)";

/** What takes the probe tool and its key command out, while they are registered. */
let removeProbe: (() => void) | null = null;

/** Whether the probe tool is registered. */
export const probeToolRegistered = (): boolean => toolRegistry.get(PROBE_TOOL.id) !== undefined;

/**
 * Registers the probe tool and its key command on `commands`, or takes both out, with the
 * pencil selected again when the probe was the active tool.
 */
export function setProbeTool(commands: CommandRegistry, registered: boolean): void {
    if (registered && removeProbe === null) {
        const removeTool = toolRegistry.register(PROBE_TOOL, SOURCE);
        const removeKeys = toolKeyCommand(PROBE_TOOL).map((spec) =>
            commands.register(spec, SOURCE),
        );
        removeProbe = () => {
            for (const remove of removeKeys) remove();
            removeTool();
        };
    }
    if (!registered && removeProbe !== null) {
        removeProbe();
        removeProbe = null;
        if (toolStore.getState().selected === PROBE_TOOL.id) selectTool("pencil");
    }
}
