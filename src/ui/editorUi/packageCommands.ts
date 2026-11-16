import type { CommandModule } from "../../model/commands/types.js";
import type { ModuleMap } from "../../model/modules.js";
import { commandPaletteCommands } from "../commands/commandPalette.commands.js";
import { shortcutSheetCommands } from "../commands/shortcutSheet.commands.js";
import type { Surfaces } from "./surfaces.js";

// The package's own command modules (SPEC §1.3), which `createEditorUi` registers before the
// editor's: command palette, Help → Keyboard Shortcuts…, Help → About, F6 regions and View →
// Open Source Licences…. Each joins with one line here, keyed by a path under
// `PACKAGE_COMMAND_SOURCE`. They name only the `View` and `Help` menus, which every menu bar
// has (SPEC §5), and bind only the package's contexts. A module is a function of the instance
// it registers in, as its commands act on that instance's state (SPEC §1.2).

/** The prefix of the package modules' paths, which an editor's module map never uses. */
export const PACKAGE_COMMAND_SOURCE = "@ngne/editor-ui/";

/** The menus a package command may name. */
export type PackageMenu = "View" | "Help";

/** What a package command reaches of the editor UI instance it is registered in. */
export interface PackageCommandScope {
    /** The instance's surfaces, which the palette and sheet commands open. */
    readonly surfaces: Surfaces;
}

/** A package command module: its commands and plans for one editor UI instance. */
export type PackageCommandModule = (
    scope: PackageCommandScope,
) => CommandModule<PackageMenu, never>;

export const PACKAGE_COMMAND_MODULES: ModuleMap<PackageCommandModule> = {
    [`${PACKAGE_COMMAND_SOURCE}commands/commandPalette.commands.ts`]: commandPaletteCommands,
    [`${PACKAGE_COMMAND_SOURCE}commands/shortcutSheet.commands.ts`]: shortcutSheetCommands,
};
