import type { PackageCommandModule } from "../editorUi/packageCommands.js";
import { openLicences } from "./openLicences.js";

// The Open Source Licences command (SPEC §11, DESIGN §7, §8): View → Open Source Licences…, the
// last item of the View menu, in a group of its own, and in the command palette. A package
// command, so the editor's `commandGate` leaves it enabled while no document is open. It keeps
// the id both editors gave it, so their recent commands carry over (SPEC §5). No key.

/** The id of the command that opens the licences dialog. */
export const LICENCES_COMMAND = "app.licences";

/**
 * Its place in the View menu: after every item an editor places there, and in a hundred of
 * its own, so a line sets it apart (`CommandSpec.menuOrder`).
 */
export const LICENCES_MENU_ORDER = Number.MAX_SAFE_INTEGER;

export const licencesCommands: PackageCommandModule = () => ({
    commands: [
        {
            id: LICENCES_COMMAND,
            title: "Open Source Licences…",
            menuPath: ["View"],
            menuOrder: LICENCES_MENU_ORDER,
            run: async () => {
                await openLicences();
            },
        },
    ],
});
