import type { StoreApi } from "zustand/vanilla";
import type { CommandModule } from "../../model/commands/types.js";
import type { ModuleMap } from "../../model/modules.js";
import { aboutCommands } from "../about/about.commands.js";
import { commandPaletteCommands } from "../commands/commandPalette.commands.js";
import { shortcutSheetCommands } from "../commands/shortcutSheet.commands.js";
import { licencesCommands } from "../licences/licences.commands.js";
import * as licencesDialog from "../licences/licences.dialog.js";
import type { CommandDialogModule } from "../messages/dialogRegistry.js";
import { bottomRegionCommands } from "../shell/bottomRegion.commands.js";
import type { BottomRegionState } from "../shell/bottomRegion.js";
import { regionCommands } from "../shell/regions.commands.js";
import type { BottomRegion } from "./config.js";
import type { Surfaces } from "./surfaces.js";

// The package's own command modules (SPEC §1.3), which `createEditorUi` registers before the
// editor's: command palette, Help → Keyboard Shortcuts…, Help → About, F6 regions, the bottom
// region's Tab toggle and View → Open Source Licences…; and the dialog modules its commands ask
// for, collected with the editor's `*.dialog.tsx` modules. Each joins with one line here, keyed
// by a path under `PACKAGE_COMMAND_SOURCE`. They name only the `View` and `Help` menus, which
// every menu bar has (SPEC §5), and bind only the package's contexts. A command module is a
// function of the instance it registers in, as its commands act on that instance's state
// (SPEC §1.2).

/** The prefix of the package modules' paths, which an editor's module map never uses. */
export const PACKAGE_COMMAND_SOURCE = "@ngne/editor-ui/";

/** The menus a package command may name. */
export type PackageMenu = "View" | "Help";

/** What a package command reaches of the editor UI instance it is registered in. */
export interface PackageCommandScope {
    /** The editor's product name, which titles the About command (SPEC §5 `productName`). */
    readonly productName: string;
    /** The instance's surfaces, which the palette, sheet and About commands open. */
    readonly surfaces: Surfaces;
    /**
     * The editor's bottom region and the instance whose visibility store its toggle switches;
     * null for an editor without one (SPEC §5 `bottomRegion`).
     */
    readonly bottomRegion: {
        readonly region: BottomRegion;
        readonly editorUi: { readonly bottomRegion: StoreApi<BottomRegionState> };
    } | null;
}

/** A package command module: its commands and plans for one editor UI instance. */
export type PackageCommandModule = (
    scope: PackageCommandScope,
) => CommandModule<PackageMenu, never>;

export const PACKAGE_COMMAND_MODULES: ModuleMap<PackageCommandModule> = {
    [`${PACKAGE_COMMAND_SOURCE}about/about.commands.ts`]: aboutCommands,
    [`${PACKAGE_COMMAND_SOURCE}commands/commandPalette.commands.ts`]: commandPaletteCommands,
    [`${PACKAGE_COMMAND_SOURCE}commands/shortcutSheet.commands.ts`]: shortcutSheetCommands,
    [`${PACKAGE_COMMAND_SOURCE}licences/licences.commands.ts`]: licencesCommands,
    [`${PACKAGE_COMMAND_SOURCE}shell/bottomRegion.commands.ts`]: bottomRegionCommands,
    [`${PACKAGE_COMMAND_SOURCE}shell/regions.commands.ts`]: regionCommands,
};

/**
 * The package's own dialog modules (SPEC §1.3, §11): the Open Source Licences dialog, which
 * its command asks for. `createEditorUi` collects them with the editor's `*.dialog.tsx`
 * modules, so an editor's dialog of the same kind fails at startup, naming the editor's module.
 */
export const PACKAGE_DIALOG_MODULES: ModuleMap<CommandDialogModule> = {
    [`${PACKAGE_COMMAND_SOURCE}licences/licences.dialog.tsx`]: licencesDialog,
};
