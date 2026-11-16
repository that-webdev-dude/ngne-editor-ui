import type { ComponentType } from "react";
import { keyContextOrder } from "../../model/commands/contexts.js";
import { menuBarProblems } from "../../model/commands/menuModel.js";
import type { Command, CommandModule } from "../../model/commands/types.js";
import type { ModuleMap } from "../../model/modules.js";
import type { ContextBarContentModule } from "../../model/registries/contextBar.js";
import type { DockPanelModule } from "../../model/registries/dock.js";
import type { StatusFieldModule } from "../../model/registries/statusFields.js";
import type { OverlayLayerModule } from "../../model/overlay/layers.js";
import type { ToolBase, ToolModule } from "../../model/tools/types.js";
import type { CommandDialogModule } from "../messages/dialogRegistry.js";
import { SHELL_REGIONS } from "../shell/regions.js";

// What an editor passes to `createEditorUi` (SPEC §5): its identity, its lists and its hooks,
// every optional field with its default, and the checks that stop the editor at startup when
// the configuration cannot form an editor UI. Identity and lists are parameters, never edits
// of a package file (BRIEF D3).

/** The build facts the About dialog shows (SPEC §5, §11). */
export interface AppInfo {
    /** package.json `name`. */
    readonly packageName: string;
    /** package.json `version`. */
    readonly version: string;
    /** package.json `license`. */
    readonly licence: string;
    /** The engine package and the version package.json pins. */
    readonly engine: { readonly packageName: string; readonly version: string };
    readonly repositoryUrl: string;
    readonly changelogUrl: string;
}

/** The editor's key contexts (SPEC §7.2), beside the package's `text`, `canvas` and `global`. */
export interface EditorUiKeyContexts<Context extends string = string> {
    /** The editor's own contexts, highest priority first; they go between `text` and `canvas`. */
    readonly order: readonly Context[];
    /** Contexts active while the editor's state says so (a gesture, a floating selection). */
    readonly state?: readonly Context[];
    /** Contexts active while focus is inside the element a selector matches. */
    readonly focus?: Readonly<Partial<Record<Context, string>>>;
}

/** The region under the viewport and the dock (SPEC §8): the sprite editor's timeline. */
export interface BottomRegion {
    /**
     * Its `data-region`, lowercase words joined by hyphens; its Tab toggle's command id is
     * `view.` and this id in camel case (`timeline` → `view.timeline`).
     */
    readonly id: string;
    /** Its accessible name, title case: the toggle is titled "Hide <label>" / "Show <label>". */
    readonly label: string;
}

/**
 * The module maps of the registries (SPEC §1.3), each what one `import.meta.glob(pattern,
 * { eager: true })` line of the editor returns.
 */
export interface EditorUiModules<
    Menu extends string = string,
    Context extends string = never,
    Tool extends ToolBase = ToolBase,
    Frame = unknown,
    StatusInput = unknown,
> {
    /** `*.commands.ts(x)` */
    readonly commands: ModuleMap<CommandModule<Menu, Context>>;
    /** `*.dialog.tsx` */
    readonly dialogs: ModuleMap<CommandDialogModule>;
    /** `*.dock.tsx` */
    readonly dock: ModuleMap<DockPanelModule<ComponentType>>;
    /** `*.contextbar.tsx` */
    readonly contextBars: ModuleMap<ContextBarContentModule<ComponentType>>;
    /** `*.tools.ts(x)` */
    readonly tools: ModuleMap<ToolModule<Tool>>;
    /** `*.overlay.ts(x)` */
    readonly overlays: ModuleMap<OverlayLayerModule<Frame>>;
    /** `*.status.ts` */
    readonly statusFields: ModuleMap<StatusFieldModule<StatusInput>>;
}

/** A store whose changes may change what commands' `enabled` and `title` return. */
export interface CommandRefreshSource {
    subscribe(listener: () => void): () => void;
}

/** The configuration of an editor's interface (SPEC §5). */
export interface EditorUiConfig<
    Menu extends string = string,
    Context extends string = never,
    Tool extends ToolBase = ToolBase,
    Frame = unknown,
    StatusInput = unknown,
> {
    /** Lowercase prefix of every persisted name: `ngne-sprite-editor`. Required. */
    readonly id: string;
    /** Shown in notices, the About command's title and the licences dialog. Required. */
    readonly productName: string;
    /** Build facts for the About dialog. Required. */
    readonly about: AppInfo;
    /** The menu bar, in order; contains `View` and ends with `Help`. Required. */
    readonly menus: readonly Menu[];
    /** The default is the package's contexts only. */
    readonly keyContexts?: EditorUiKeyContexts<Context>;
    /** The default is `null`: no bottom region. */
    readonly bottomRegion?: BottomRegion | null;
    /** Height reserved under the tool rail's groups, in CSS pixels; the default is 0. */
    readonly railFooterHeight?: number;
    /** The default is an empty map for each registry. */
    readonly modules?: Partial<EditorUiModules<Menu, Context, Tool, Frame, StatusInput>>;
    /** Stores whose change refreshes the commands; the default is none. */
    readonly refreshOn?: readonly CommandRefreshSource[];
    /** Disables the editor's commands it rejects; the default enables them all. */
    commandGate?(command: Command<Menu, Context>): boolean;
    /** Runs before every command; the default does nothing. */
    beforeRun?(command: Command<Menu, Context>): void;
    /** Surfaces of the editor beside the command palette and shortcut sheet, by id. */
    readonly surfaces?: Readonly<Record<string, ComponentType>>;
}

/** The configuration with every optional field resolved to its value or its default. */
export interface ResolvedEditorUiConfig<
    Menu extends string = string,
    Context extends string = never,
    Tool extends ToolBase = ToolBase,
    Frame = unknown,
    StatusInput = unknown,
> {
    readonly id: string;
    readonly productName: string;
    readonly about: AppInfo;
    readonly menus: readonly Menu[];
    readonly keyContexts: Required<EditorUiKeyContexts<Context>>;
    readonly bottomRegion: BottomRegion | null;
    readonly railFooterHeight: number;
    readonly modules: EditorUiModules<Menu, Context, Tool, Frame, StatusInput>;
    readonly refreshOn: readonly CommandRefreshSource[];
    commandGate(command: Command<Menu, Context>): boolean;
    beforeRun(command: Command<Menu, Context>): void;
    readonly surfaces: Readonly<Record<string, ComponentType>>;
}

/** The surfaces the package opens itself (SPEC §7.1); an editor's surface takes another id. */
export const PACKAGE_SURFACES = ["command-palette", "shortcut-sheet"] as const;

/** A persisted-name prefix (DESIGN §10): lowercase words joined by hyphens. */
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Throws the startup error of the field `field` for `problem`. */
function fail(field: string, problem: string): never {
    throw new Error(`createEditorUi: config.${field} ${problem}`);
}

const isText = (value: unknown): value is string =>
    typeof value === "string" && value.trim() !== "";

function checkIdentity(config: EditorUiConfig<string, string>): void {
    if (!isText(config.id)) fail("id", "is required: the prefix of every persisted name.");
    if (!ID_PATTERN.test(config.id)) {
        fail("id", `"${config.id}" is not lowercase words joined by hyphens (ngne-thing-editor).`);
    }
    if (!isText(config.productName)) fail("productName", "is required.");
    if (typeof config.about !== "object" || config.about === null) {
        fail("about", "is required: the build facts the About dialog shows.");
    }
}

function checkMenus(menus: unknown): void {
    if (!Array.isArray(menus)) fail("menus", "is required: the menu bar, in order.");
    const problems = menuBarProblems(menus as readonly string[]);
    if (problems.length > 0) fail("menus", `is not a menu bar: ${problems.join(" ")}`);
}

/** The editor's contexts, each listed in `order`; throws for one that is not. */
function resolveKeyContexts<Context extends string>(
    keyContexts: EditorUiKeyContexts<Context> | undefined,
): Required<EditorUiKeyContexts<Context>> {
    const order = keyContexts?.order ?? [];
    const state = keyContexts?.state ?? [];
    const focus = keyContexts?.focus ?? ({} as Readonly<Partial<Record<Context, string>>>);
    try {
        keyContextOrder(order);
    } catch (error) {
        fail("keyContexts.order", `is not a context list: ${(error as Error).message}`);
    }
    const known = new Set<string>(order);
    for (const context of state) {
        if (!known.has(context)) {
            fail("keyContexts.state", `names the unknown context "${context}"; list it in order.`);
        }
    }
    for (const [context, selector] of Object.entries(focus)) {
        if (!known.has(context)) {
            fail("keyContexts.focus", `names the unknown context "${context}"; list it in order.`);
        }
        if (!isText(selector)) fail("keyContexts.focus", `gives "${context}" no selector.`);
    }
    return { order, state, focus };
}

function resolveBottomRegion(region: BottomRegion | null | undefined): BottomRegion | null {
    if (region === undefined || region === null) return null;
    if (!isText(region.id) || !isText(region.label)) {
        fail("bottomRegion", "needs an id and a label, or is null.");
    }
    // The id is the region's `data-region` and names its toggle command (`view.<camelCase>`).
    if (!ID_PATTERN.test(region.id)) {
        fail("bottomRegion", `id "${region.id}" is not lowercase words joined by hyphens.`);
    }
    if ((SHELL_REGIONS as readonly string[]).includes(region.id)) {
        fail("bottomRegion", `id "${region.id}" is the id of another region of the shell.`);
    }
    return region;
}

function resolveRailFooterHeight(height: number | undefined): number {
    if (height === undefined) return 0;
    if (!Number.isFinite(height) || height < 0) {
        fail("railFooterHeight", `is ${height}; it is a height in CSS pixels, 0 or more.`);
    }
    return height;
}

function resolveSurfaces(
    surfaces: Readonly<Record<string, ComponentType>> | undefined,
): Readonly<Record<string, ComponentType>> {
    for (const id of Object.keys(surfaces ?? {})) {
        if ((PACKAGE_SURFACES as readonly string[]).includes(id)) {
            fail("surfaces", `names "${id}", a surface of the package.`);
        }
        if (id.trim() === "") fail("surfaces", "has a surface with an empty id.");
    }
    return { ...surfaces };
}

const allEnabled = (): boolean => true;
const nothing = (): void => undefined;

/**
 * The configuration with its defaults (SPEC §5). Throws an error naming the field when a
 * required field is missing, the menu bar has no `View` or does not end with `Help`, or a key
 * context is unknown.
 */
export function resolveEditorUiConfig<
    Menu extends string,
    Context extends string,
    Tool extends ToolBase,
    Frame,
    StatusInput,
>(
    config: EditorUiConfig<Menu, Context, Tool, Frame, StatusInput>,
): ResolvedEditorUiConfig<Menu, Context, Tool, Frame, StatusInput> {
    checkIdentity(config as EditorUiConfig<string, string>);
    checkMenus(config.menus);
    const modules = config.modules ?? {};
    return {
        id: config.id,
        productName: config.productName,
        about: config.about,
        menus: [...config.menus],
        keyContexts: resolveKeyContexts(config.keyContexts),
        bottomRegion: resolveBottomRegion(config.bottomRegion),
        railFooterHeight: resolveRailFooterHeight(config.railFooterHeight),
        modules: {
            commands: modules.commands ?? {},
            dialogs: modules.dialogs ?? {},
            dock: modules.dock ?? {},
            contextBars: modules.contextBars ?? {},
            tools: modules.tools ?? {},
            overlays: modules.overlays ?? {},
            statusFields: modules.statusFields ?? {},
        },
        refreshOn: [...(config.refreshOn ?? [])],
        commandGate: config.commandGate?.bind(config) ?? allEnabled,
        beforeRun: config.beforeRun?.bind(config) ?? nothing,
        surfaces: resolveSurfaces(config.surfaces),
    };
}
