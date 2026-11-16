import type { ComponentType } from "react";
import type { StoreApi } from "zustand/vanilla";
import { createCommandRegistry, registerCommandModules } from "../../model/commands/registry.js";
import type { CommandRegistry } from "../../model/commands/registry.js";
import type { CommandModule } from "../../model/commands/types.js";
import type { ModuleMap } from "../../model/modules.js";
import { collectOverlayLayers } from "../../model/overlay/layers.js";
import type { OverlayLayer } from "../../model/overlay/layers.js";
import { collectContextBarContent } from "../../model/registries/contextBar.js";
import type { ContextBarContent } from "../../model/registries/contextBar.js";
import { collectCommandDialogs } from "../../model/registries/dialogs.js";
import { collectDockPanels } from "../../model/registries/dock.js";
import type { DockPanel } from "../../model/registries/dock.js";
import { collectStatusFields } from "../../model/registries/statusFields.js";
import type { StatusField } from "../../model/registries/statusFields.js";
import { createToolRegistry, registerToolModules } from "../../model/tools/registry.js";
import type { ToolRegistry } from "../../model/tools/registry.js";
import type { ToolBase } from "../../model/tools/types.js";
import { createKeyContextStore } from "../commands/keyContextState.js";
import type { KeyContextState } from "../commands/keyContextState.js";
import type { CommandDialogs } from "../messages/dialogRegistry.js";
import { browserStorage } from "../platform/storage.js";
import { PACKAGE_SURFACES, resolveEditorUiConfig } from "./config.js";
import type { EditorUiConfig, ResolvedEditorUiConfig } from "./config.js";
import { PACKAGE_COMMAND_MODULES, PACKAGE_COMMAND_SOURCE } from "./packageCommands.js";
import type { PackageMenu } from "./packageCommands.js";
import { createRecentCommandsStore } from "./recentCommands.js";
import type { RecentCommandsState } from "./recentCommands.js";
import { createSurfaces } from "./surfaces.js";
import type { Surfaces } from "./surfaces.js";
import { createThemeStore } from "./theme.js";
import type { ThemeState } from "./theme.js";

// The editor UI instance (SPEC §1.2, §5): everything that depends on the editor, built once at
// startup from its configuration. The editor keeps it in one module of its own (by convention
// `src/app/editorUi.ts`) and passes it to `UiRoot`. Identity-bound state lives here, one copy
// per instance, under the editor's persisted names; identity-free services (toasts, notices,
// command dialog requests, storage-failure reporting, input modality) stay module-level in the
// package, one copy per app.

/** What `createEditorUi` builds (SPEC §5). */
export interface EditorUi<
    Menu extends string = string,
    Context extends string = never,
    Tool extends ToolBase = ToolBase,
    Frame = unknown,
    StatusInput = unknown,
> {
    /** The configuration, every optional field resolved to its value or default. */
    readonly config: ResolvedEditorUiConfig<Menu, Context, Tool, Frame, StatusInput>;
    /** The theme, kept under `<id>.theme`. */
    readonly theme: StoreApi<ThemeState>;
    /** The commands last run from the palette, kept under `<id>.recent-commands`. */
    readonly recentCommands: StoreApi<RecentCommandsState>;
    /** The package's commands, then the editor's `*.commands.ts(x)` modules. */
    readonly commands: CommandRegistry<Menu, Context>;
    /** The state contexts of `config.keyContexts.state`, all off at startup (`setKeyContext`). */
    readonly keyContextState: StoreApi<KeyContextState<Context>>;
    /** The command palette, the shortcut sheet and the editor's surfaces. */
    readonly surfaces: Surfaces;
    /** The `*.dialog.tsx` dialogs by request kind, for the dialog host. */
    readonly dialogs: CommandDialogs;
    /** The `*.dock.tsx` panels in dock order. */
    readonly dockPanels: readonly DockPanel<ComponentType>[];
    /** The `*.contextbar.tsx` content by precedence. */
    readonly contextBarContent: readonly ContextBarContent<ComponentType>[];
    /** The `*.tools.ts(x)` tools. */
    readonly tools: ToolRegistry<Tool>;
    /** The `*.overlay.ts(x)` layers in draw order. */
    readonly overlayLayers: readonly OverlayLayer<Frame>[];
    /** The `*.status.ts` fields in display order. */
    readonly statusFields: readonly StatusField<StatusInput>[];
}

/** Any editor's instance, as `UiRoot` and the package's components take it. */
export type AnyEditorUi = EditorUi<string, string, ToolBase, unknown, unknown>;

/** The persisted name `<id>.<name>` of SPEC §5. */
export const persistedName = (id: string, name: "theme" | "recent-commands"): string =>
    `${id}.${name}`;

/** What the package itself adds to every instance; a parameter so tests can pass fixtures. */
export interface PackageParts {
    /** The package's command modules, registered before the editor's. */
    commandModules: ModuleMap<CommandModule<PackageMenu, never>>;
}

/**
 * `createEditorUi` with the package's parts given. Package commands are registered first and
 * are not subject to the editor's `commandGate`: they act without a document (SPEC §11).
 */
export function buildEditorUi<
    Menu extends string,
    Context extends string = never,
    Tool extends ToolBase = ToolBase,
    Frame = unknown,
    StatusInput = unknown,
>(
    config: EditorUiConfig<Menu, Context, Tool, Frame, StatusInput>,
    parts: PackageParts,
): EditorUi<Menu, Context, Tool, Frame, StatusInput> {
    const resolved = resolveEditorUiConfig(config);
    const { id, modules } = resolved;
    const storage = browserStorage();

    const commands = createCommandRegistry<Menu, Context>({
        menus: resolved.menus,
        contexts: resolved.keyContexts.order,
        commandGate: (command) =>
            command.source.startsWith(PACKAGE_COMMAND_SOURCE) || resolved.commandGate(command),
        beforeRun: (command) => resolved.beforeRun(command),
    });
    // The menu bar has View and Help (checked above), the only menus a package command names.
    registerCommandModules(
        commands,
        parts.commandModules as unknown as ModuleMap<CommandModule<Menu, Context>>,
    );
    registerCommandModules(commands, modules.commands);
    // A command's condition may read a state context, as it may read the refreshOn stores.
    const keyContextState = createKeyContextStore(resolved.keyContexts.state);
    keyContextState.subscribe(() => commands.refresh());
    for (const source of resolved.refreshOn) source.subscribe(() => commands.refresh());

    const tools = createToolRegistry<Tool>();
    registerToolModules(tools, modules.tools);

    return {
        config: resolved,
        theme: createThemeStore(storage, persistedName(id, "theme")),
        recentCommands: createRecentCommandsStore(storage, persistedName(id, "recent-commands")),
        commands,
        keyContextState,
        surfaces: createSurfaces([...PACKAGE_SURFACES, ...Object.keys(resolved.surfaces)]),
        dialogs: collectCommandDialogs(modules.dialogs),
        dockPanels: collectDockPanels(modules.dock),
        contextBarContent: collectContextBarContent(modules.contextBars),
        tools,
        overlayLayers: collectOverlayLayers(modules.overlays),
        statusFields: collectStatusFields(modules.statusFields),
    };
}

/**
 * Builds an editor's interface from its configuration (SPEC §5), once, at startup. Throws an
 * error naming the field for an invalid configuration, and a `RegistrationError` naming the
 * module for a module that cannot be registered.
 */
export function createEditorUi<
    Menu extends string,
    Context extends string = never,
    Tool extends ToolBase = ToolBase,
    Frame = unknown,
    StatusInput = unknown,
>(
    config: EditorUiConfig<Menu, Context, Tool, Frame, StatusInput>,
): EditorUi<Menu, Context, Tool, Frame, StatusInput> {
    return buildEditorUi(config, { commandModules: PACKAGE_COMMAND_MODULES });
}
