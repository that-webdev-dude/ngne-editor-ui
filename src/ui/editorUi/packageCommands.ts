import type { CommandModule } from "../../model/commands/types.js";
import type { ModuleMap } from "../../model/modules.js";

// The package's own command modules (SPEC §1.3), which `createEditorUi` registers before the
// editor's: command palette, Help → Keyboard Shortcuts…, Help → About, F6 regions and View →
// Open Source Licences…. Each joins with one line here, keyed by a path under
// `PACKAGE_COMMAND_SOURCE`. They name only the `View` and `Help` menus, which every menu bar
// has (SPEC §5), and bind only the package's contexts.

/** The prefix of the package modules' paths, which an editor's module map never uses. */
export const PACKAGE_COMMAND_SOURCE = "@ngne/editor-ui/";

/** The menus a package command may name. */
export type PackageMenu = "View" | "Help";

export const PACKAGE_COMMAND_MODULES: ModuleMap<CommandModule<PackageMenu, never>> = {};
