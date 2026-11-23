import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { describe, expect, inject, it } from "vitest";
import { pack } from "./support/npm.ts";

// The public API of the package (SPEC §3, §4), as a consumer resolves it: every subpath of the
// `exports` map and every name each one exports, types included, resolved through Node and
// TypeScript from a scratch project that installed the packed tarball (tests/unit/setup). A
// change to these lists is a deliberate edit, with a CHANGELOG entry once the package is
// released.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CONSUMER = inject("consumerRoot");
const INSTALLED = join(CONSUMER, "node_modules", "@ngne", "editor-ui");

/** Every subpath, in the order of SPEC §4, and its exported names, sorted by code unit. */
const API: Record<string, readonly string[]> = {
    "@ngne/editor-ui": [
        "AnyEditorUi",
        "AppInfo",
        "BottomRegion",
        "CommandRefreshSource",
        "DEFAULT_THEME",
        "EditorUi",
        "EditorUiConfig",
        "EditorUiKeyContexts",
        "EditorUiModules",
        "PersistedNames",
        "RecentCommandsState",
        "ResolvedEditorUiConfig",
        "SurfaceState",
        "Surfaces",
        "Theme",
        "ThemeState",
        "UiRoot",
        "UiRootProps",
        "createEditorUi",
        "createRecentCommandsStore",
        "createThemeStore",
        "persistedNames",
        "setTheme",
        "useEditorUi",
        "useTheme",
    ],
    "@ngne/editor-ui/styles.css": [],
    "@ngne/editor-ui/styles/check": ["checkStylesheets"],
    "@ngne/editor-ui/primitives": [
        "Button",
        "ButtonProps",
        "ClosingPopover",
        "ContextMenu",
        "ContextMenuEntry",
        "ContextMenuProps",
        "Dialog",
        "DialogProps",
        "ICON_SIZE",
        "ICON_STROKE",
        "Icon",
        "IconButton",
        "IconButtonProps",
        "NumberField",
        "NumberFieldProps",
        "Popover",
        "PopoverProps",
        "SegmentedControl",
        "SegmentedControlProps",
        "SegmentedOption",
        "Select",
        "SelectOption",
        "SelectProps",
        "Slider",
        "SliderProps",
        "Splitter",
        "SplitterProps",
        "TOOLTIP_DELAY_MS",
        "Toggle",
        "ToggleProps",
        "ToolButton",
        "ToolButtonProps",
        "Tooltip",
        "TooltipProps",
        "TooltipProvider",
        "cx",
        "useClosingPopover",
    ],
    "@ngne/editor-ui/focus": [
        "ControlElement",
        "KEEP_FOCUS_ATTRIBUTE",
        "Modality",
        "ModalityKey",
        "focusMenuOpener",
        "focusReturningControl",
        "focusReturningSelect",
        "inertOutsideModalLayers",
        "isKeyboardNavigation",
        "panelSelector",
        "returnFocusToViewport",
        "surfaceOpener",
        "trackFocusModality",
        "trackMenuOrigins",
    ],
    "@ngne/editor-ui/messages": [
        "CommandDialog",
        "CommandDialogModule",
        "CommandDialogs",
        "DialogComponent",
        "DialogHost",
        "DialogHostProps",
        "DialogRequestBase",
        "DialogRequests",
        "DialogState",
        "DialogView",
        "DiscardAction",
        "DiscardChangesDialog",
        "DiscardChangesRequest",
        "INFO_TOAST_MS",
        "NoticeKind",
        "NoticeOptions",
        "NoticeSink",
        "Notices",
        "RegionBoundary",
        "RegionBoundaryProps",
        "ToastAction",
        "ToastItem",
        "ToastKind",
        "ToastOptions",
        "ToastService",
        "ToastState",
        "ToastViewport",
        "WebGpuRequired",
        "WebGpuRequiredProps",
        "WindowTooSmall",
        "WindowTooSmallProps",
        "commandDialog",
        "commandDialogs",
        "createDialogRequests",
        "createNotices",
        "createToastService",
        "dialogView",
        "notices",
        "toast",
        "useDialogRequest",
    ],
    "@ngne/editor-ui/shell": [
        "AppShell",
        "AppShellProps",
        "BOTTOM_HEIGHT",
        "BottomRegionState",
        "ChoiceToolOption",
        "ContextBarContent",
        "ContextBarContentModule",
        "DOCK_WIDTH",
        "DockPanel",
        "DockPanelModule",
        "LayoutSizes",
        "LayoutState",
        "MIN_WINDOW_HEIGHT",
        "MIN_WINDOW_WIDTH",
        "NEXT_REGION_COMMAND",
        "NumberToolOption",
        "PREVIOUS_REGION_COMMAND",
        "PlannedToolSpec",
        "RAIL",
        "REGION_ATTRIBUTE",
        "REGION_FOCUS_ATTRIBUTE",
        "RailFilter",
        "RailSlot",
        "RegisteredTool",
        "RegistrationError",
        "SHELL_REGIONS",
        "ShellRegion",
        "StatusBarSource",
        "StatusField",
        "StatusFieldModule",
        "StatusHint",
        "TabStrip",
        "TabStripItem",
        "TabStripLeading",
        "TabStripProps",
        "ToggleToolOption",
        "ToolBase",
        "ToolHoldKey",
        "ToolIcon",
        "ToolModule",
        "ToolOptionControl",
        "ToolOptionSpec",
        "ToolOptionValue",
        "ToolRegistry",
        "ToolStateSource",
        "bottomMaxHeight",
        "bottomRegionCommand",
        "collapsedByDefault",
        "collectContextBarContent",
        "collectDockPanels",
        "collectStatusFields",
        "createLayoutStore",
        "createToolRegistry",
        "cycleFocusRegion",
        "defaultBottomHeight",
        "isWindowTooSmall",
        "optionControl",
        "optionValue",
        "optionValues",
        "parseStoredLayout",
        "railColumns",
        "railGroups",
        "railOneColumnHeight",
        "regionFocusTarget",
        "registerToolModules",
        "resolveBottomHeight",
        "resolveDockWidth",
        "setBottomRegionVisible",
        "slotOf",
        "storedLayout",
        "useToolState",
        "useWindowTooSmall",
    ],
    "@ngne/editor-ui/commands": [
        "BASE_CONTEXTS",
        "BaseContext",
        "COMMAND_PALETTE_COMMAND",
        "Chord",
        "ChordConflict",
        "ChordError",
        "ChordModifiers",
        "ChordParts",
        "ChordProps",
        "Command",
        "CommandErrorHandler",
        "CommandModule",
        "CommandPalette",
        "CommandPaletteTrigger",
        "CommandRegistry",
        "CommandRegistryOptions",
        "CommandSpec",
        "ContextMenuPlacement",
        "DEFAULT_MENU_ORDER",
        "FocusedElement",
        "KeyContext",
        "KeyContextLists",
        "KeyContextState",
        "KeyEnvironment",
        "KeyEventLike",
        "KeyResolution",
        "KeymapDocument",
        "KeymapEvent",
        "KeymapOptions",
        "KeymapTarget",
        "MAX_RECENT_COMMANDS",
        "MenuBarEntry",
        "MenuNode",
        "MenuPath",
        "NATIVE_KEYS",
        "OTHER_SHORTCUTS",
        "OVERLAY_ATTRIBUTE",
        "OVERLAY_SELECTOR",
        "PaletteEntry",
        "PlannedCommandSpec",
        "RecentCommandsRecorder",
        "RecentCommandsStorage",
        "RegistrationError",
        "SHORTCUT_SHEET_COMMAND",
        "ShortcutGroup",
        "ShortcutRow",
        "ShortcutSheet",
        "SurfaceHost",
        "VIEWPORT_FOCUS_ATTRIBUTE",
        "activeKeyContexts",
        "applicableContexts",
        "buildContextMenu",
        "buildMenu",
        "buildMenuBar",
        "chordFromEvent",
        "chordKey",
        "chordModifiers",
        "contextMenuEntries",
        "createCommandRegistry",
        "eventKey",
        "findChordConflicts",
        "formatChord",
        "fuzzyScore",
        "installKeymap",
        "invokeCommand",
        "isBrowserChord",
        "isCharacterChord",
        "isNativeKeyChord",
        "isTextEditingChord",
        "isTextField",
        "keyContextOrder",
        "menuBarProblems",
        "menuCommands",
        "nativeKeysOf",
        "normalizeChord",
        "paletteEntries",
        "paletteScore",
        "parseChord",
        "parseRecentCommands",
        "readKeyEnvironment",
        "readRecentCommands",
        "registerCommandModules",
        "reportCommandError",
        "resolveKey",
        "runCommand",
        "runPaletteCommand",
        "setKeyContext",
        "shortcutGroups",
        "useCommandValue",
        "useCommands",
        "withRecentCommand",
        "writeRecentCommands",
    ],
    "@ngne/editor-ui/overlay": [
        "OverlayLayer",
        "OverlayLayerModule",
        "RegistrationError",
        "WHEEL_ZOOM_TRAVEL",
        "collectOverlayLayers",
        "createWheelPan",
        "createWheelZoom",
        "wheelPixels",
    ],
    "@ngne/editor-ui/platform": [
        "ADAPTER_ATTEMPTS",
        "ADAPTER_TIMED_OUT",
        "ADAPTER_TIMEOUT_MS",
        "KeyValueStorage",
        "NavigatorLike",
        "STORAGE_WRITE_FAILED_MESSAGE",
        "StorageFailures",
        "WebGpuCheckLimits",
        "WebGpuSupport",
        "browserStorage",
        "checkWebGpu",
        "createStorageFailures",
        "detectWebGpu",
        "initialWebGpuSupport",
        "readItem",
        "readJson",
        "storageFailures",
        "useWebGpuSupport",
        "useWindowHeight",
        "useWindowWidth",
        "writeItem",
    ],
    "@ngne/editor-ui/pwa": [
        "AppUpdateOptions",
        "AppUpdates",
        "ContainerLike",
        "PrecacheEntry",
        "PwaNames",
        "RELOAD_KEPT_MS",
        "RegistrationLike",
        "RequestLike",
        "ResponseLike",
        "Route",
        "UPDATE_CHECK_MS",
        "UPDATE_MESSAGE",
        "UpdateState",
        "WorkerLike",
        "cacheName",
        "cacheable",
        "isOwnCache",
        "mayDeleteStale",
        "olderFile",
        "precacheUrls",
        "pwaNames",
        "registerAppUpdates",
        "route",
        "searchOrder",
        "showUpdateToast",
        "staleCaches",
        "uniqueEntries",
    ],
    "@ngne/editor-ui/pwa/worker": ["PrecacheEntry", "ServiceWorkerOptions", "installServiceWorker"],
    "@ngne/editor-ui/about": ["ABOUT_COMMAND", "AboutDialog", "AppInfo"],
    "@ngne/editor-ui/about/build": ["appInfoDefines"],
    "@ngne/editor-ui/licences": [
        "LICENCES_COMMAND",
        "LICENCES_PATH",
        "LicencesDialog",
        "LicencesRequest",
    ],
    "@ngne/editor-ui/licences/build": [
        "ALLOWED_LICENCES",
        "BundleContext",
        "BundleOutput",
        "DevServer",
        "ExcludedCode",
        "LICENCES_FILE",
        "LICENCE_PHRASES",
        "LicenceError",
        "LicenceText",
        "LicencesInput",
        "LicencesMismatch",
        "LicencesOptions",
        "LicencesPlugin",
        "LicencesPlugins",
        "LicencesServiceWorkerPlugin",
        "LicencesWorkerPlugin",
        "ModuleSource",
        "PACKAGE_STAND_IN_TEXTS",
        "PackageLicence",
        "StandInTexts",
        "VIRTUAL_MODULES",
        "WriteOptions",
        "buildLicencesFile",
        "buildPackageDirs",
        "bundlerPackagesOf",
        "excludedCodeIn",
        "fallbackFileOf",
        "generateLicences",
        "licenceAllowed",
        "licenceTextMatches",
        "licencesFileMismatch",
        "licencesText",
        "listedPackages",
        "moduleSource",
        "packageDirOf",
        "packageDirsOf",
        "readPackageLicence",
        "runtimePackageDirs",
        "strayPackages",
        "unknownModules",
        "unlistedPackages",
    ],
    "@ngne/editor-ui/colour": [
        "BLACK",
        "Hsv",
        "LabelColour",
        "Oklab",
        "Rgb",
        "Rgba",
        "WHITE",
        "contrastRatio",
        "formatHex",
        "formatHexColour",
        "hsvToRgb",
        "labelColourOn",
        "oklabToSrgb8",
        "packRgba",
        "parseHex",
        "parseHexColour",
        "relativeLuminance",
        "rgbToHsv",
        "srgb8ToOklab",
        "unpackRgba",
        "writeOklab",
    ],
    "@ngne/editor-ui/gallery": [
        "Gallery",
        "GalleryEntry",
        "GalleryProps",
        "GalleryTheme",
        "useGalleryTheme",
    ],
};

type Target = string | { types: string; default: string };
type Manifest = { name: string; exports: Record<string, Target> };

const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as Manifest;
const installed = JSON.parse(readFileSync(join(INSTALLED, "package.json"), "utf8")) as Manifest;
const keys = Object.keys(manifest.exports);

/** Orders strings by UTF-16 code unit, whatever the machine's locale. */
function byCodeUnit(a: string, b: string): number {
    if (a === b) return 0;
    return a < b ? -1 : 1;
}

const slash = (path: string) => path.replaceAll("\\", "/");

/** The subpath an `exports` key names: "." is the package itself. */
const subpathOf = (key: string) =>
    key === "." ? manifest.name : `${manifest.name}/${key.slice(2)}`;

/** The rows of the SPEC §4 table, in its order: subpath and layer. */
function specRows(): { subpath: string; layer: string }[] {
    const spec = readFileSync(join(ROOT, "docs", "SPEC.md"), "utf8");
    const section = spec.slice(spec.indexOf("## 4. Packaging"), spec.indexOf("## 5."));
    return [...section.matchAll(/^\| `(@ngne\/editor-ui[^`]*)` \| ([^|]+) \|/gm)].map((match) => ({
        subpath: match[1]!,
        layer: match[2]!.trim(),
    }));
}

/** A subpath's installed file of each kind; null for the types of the CSS entry. */
function installedFile(key: string, kind: "types" | "default"): string | null {
    const target = installed.exports[key]!;
    if (typeof target === "string") return kind === "default" ? join(INSTALLED, target) : null;
    return join(INSTALLED, target[kind]);
}

// --- TypeScript -----------------------------------------------------------------------------

type Runtime = "browser" | "worker" | "node";

/**
 * How a consumer compiles each layer (SPEC §4): UI, Model and Colour with the DOM library, the
 * worker with the WebWorker library, Build with Node's types. The CSS entry has no types.
 */
const RUNTIMES: Record<Runtime, { lib: string[]; types: string[] }> = {
    browser: { lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"], types: [] },
    worker: { lib: ["lib.es2022.d.ts", "lib.webworker.d.ts"], types: [] },
    node: { lib: ["lib.es2022.d.ts"], types: ["node"] },
};

/** The runtime a layer of the SPEC §4 table compiles for, or null for the CSS entry. */
function runtimeOf(layer: string): Runtime | null {
    if (layer === "Styles") return null;
    if (layer === "Worker") return "worker";
    if (layer === "Build") return "node";
    return "browser";
}

interface TypesView {
    /** The declaration file TypeScript resolves the subpath to, "/"-separated. */
    resolved: string | undefined;
    /** Every exported name, values and types. */
    names: string[];
    /** The exported names that are values at run time. */
    values: string[];
}

/** Whether an exported symbol is a value at run time: not a type, nor exported as a type only. */
function isValue(checker: ts.TypeChecker, entry: ts.Symbol): boolean {
    const target = entry.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(entry) : entry;
    const typeOnly = entry.declarations?.some(
        (declaration) =>
            ts.isExportSpecifier(declaration) &&
            (declaration.isTypeOnly || declaration.parent.parent.isTypeOnly),
    );
    return (target.flags & ts.SymbolFlags.Value) !== 0 && !typeOnly;
}

/** The subpaths of one runtime, resolved from a consumer module; problems pushed to `problems`. */
function runtimeView(runtime: Runtime, problems: string[]): Map<string, TypesView> {
    const subpaths = specRows()
        .filter((row) => runtimeOf(row.layer) === runtime)
        .map((row) => row.subpath);
    const file = join(CONSUMER, `${runtime}.ts`);
    const imports = subpaths.map((subpath, index) => `import * as s${index} from "${subpath}";\n`);
    writeFileSync(
        file,
        `${imports.join("")}export { ${subpaths.map((_, index) => `s${index}`).join(", ")} };\n`,
    );
    const options: ts.CompilerOptions = {
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        lib: RUNTIMES[runtime].lib,
        types: RUNTIMES[runtime].types,
    };
    const program = ts.createProgram([file], options);
    const checker = program.getTypeChecker();
    const source = program.getSourceFile(file)!;
    // The consumer module and every declaration file of the package it reaches compile cleanly.
    const checked = program
        .getSourceFiles()
        .filter(
            (sourceFile) =>
                sourceFile === source ||
                slash(sourceFile.fileName).startsWith(`${slash(INSTALLED)}/`),
        );
    for (const sourceFile of checked) {
        for (const diagnostic of [
            ...program.getSyntacticDiagnostics(sourceFile),
            ...program.getSemanticDiagnostics(sourceFile),
        ]) {
            const text = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
            problems.push(`${runtime}: ${slash(relative(CONSUMER, sourceFile.fileName))}: ${text}`);
        }
    }
    const views = new Map<string, TypesView>();
    for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement)) continue;
        const subpath = (statement.moduleSpecifier as ts.StringLiteral).text;
        const symbol = checker.getSymbolAtLocation(statement.moduleSpecifier);
        const exported = symbol ? checker.getExportsOfModule(symbol) : [];
        views.set(subpath, {
            resolved: ts.resolveModuleName(subpath, file, options, ts.sys).resolvedModule
                ?.resolvedFileName,
            names: exported.map((entry) => entry.name).sort(byCodeUnit),
            values: exported
                .filter((entry) => isValue(checker, entry))
                .map((entry) => entry.name)
                .sort(byCodeUnit),
        });
    }
    return views;
}

/** Every subpath with types, resolved by TypeScript as a consumer of its runtime compiles it. */
let typesView: { views: Map<string, TypesView>; problems: string[] } | undefined;

function typescriptView(): { views: Map<string, TypesView>; problems: string[] } {
    if (typesView) return typesView;
    const problems: string[] = [];
    const views = new Map<string, TypesView>();
    for (const runtime of Object.keys(RUNTIMES) as Runtime[]) {
        for (const [subpath, view] of runtimeView(runtime, problems)) views.set(subpath, view);
    }
    typesView = { views, problems };
    return typesView;
}

// --- Node -----------------------------------------------------------------------------------

/** Imports every subpath in a Node process of the consumer project: its URL and value names. */
function nodeView(subpaths: readonly string[]): Record<string, { url: string; names: string[] }> {
    const script = join(CONSUMER, "resolve-subpaths.mjs");
    writeFileSync(
        script,
        [
            "const view = {};",
            "for (const subpath of JSON.parse(process.argv[2])) {",
            "    const url = import.meta.resolve(subpath);",
            '    const names = url.endsWith(".css") ? [] : Object.keys(await import(subpath));',
            "    view[subpath] = { url, names };",
            "}",
            "process.stdout.write(JSON.stringify(view));",
            "",
        ].join("\n"),
    );
    const output = execFileSync(process.execPath, [script, JSON.stringify(subpaths)], {
        cwd: CONSUMER,
        encoding: "utf8",
    });
    return JSON.parse(output) as Record<string, { url: string; names: string[] }>;
}

describe("API surface", () => {
    it("lists exactly the subpaths of SPEC §4, as the installed package declares them", () => {
        expect(keys.map(subpathOf)).toEqual(Object.keys(API));
        expect(keys.map(subpathOf)).toEqual(specRows().map((row) => row.subpath));
        expect(installed.exports).toEqual(manifest.exports);
    });

    it("packs only dist/, LICENSE, THIRD_PARTY_NOTICES.md, README.md and package.json", () => {
        const { files } = pack(ROOT, ["--dry-run"]);
        const top = new Set(files.map((path) => slash(path).split("/")[0]));
        expect([...top].sort(byCodeUnit)).toEqual([
            "LICENSE",
            "README.md",
            "THIRD_PARTY_NOTICES.md",
            "dist",
            "package.json",
        ]);
        expect(files).toContain("dist/styles.css");
    }, 60_000);

    it("installs every subpath's files from the tarball, under dist/", () => {
        for (const key of keys) {
            for (const kind of ["types", "default"] as const) {
                const file = installedFile(key, kind);
                if (file === null) continue;
                expect(slash(relative(INSTALLED, file)).startsWith("dist/"), file).toBe(true);
                expect(existsSync(file), file).toBe(true);
            }
        }
    });

    it("resolves every subpath and name through TypeScript from the consumer, types included", () => {
        const { views, problems } = typescriptView();
        expect(problems).toEqual([]);
        for (const key of keys) {
            const subpath = subpathOf(key);
            const types = installedFile(key, "types");
            if (types === null) {
                expect(views.has(subpath), subpath).toBe(false);
                continue;
            }
            const view = views.get(subpath);
            expect(view?.resolved, subpath).toBe(slash(types));
            expect(view?.names, subpath).toEqual([...API[subpath]!].sort(byCodeUnit));
        }
    }, 120_000);

    it("resolves every subpath and value name through Node from the consumer", () => {
        const { views } = typescriptView();
        const resolved = nodeView(keys.map(subpathOf));
        for (const key of keys) {
            const subpath = subpathOf(key);
            expect(resolved[subpath]?.url, subpath).toBe(
                pathToFileURL(installedFile(key, "default")!).href,
            );
            const names = [...(resolved[subpath]?.names ?? [])].sort(byCodeUnit);
            expect(names, subpath).toEqual(views.get(subpath)?.values ?? []);
        }
        expect(resolved["@ngne/editor-ui/styles/check"]?.names).toEqual(["checkStylesheets"]);
        expect(resolved["@ngne/editor-ui"]?.names).toContain("createEditorUi");
    }, 120_000);

    it("ships styles.css with every stylesheet under src/, each whole", () => {
        const entry = readFileSync(installedFile("./styles.css", "default")!, "utf8");
        const stylesheets = readdirSync(join(ROOT, "src"), { recursive: true, withFileTypes: true })
            .filter((file) => file.isFile() && file.name.endsWith(".css"))
            .map((file) => slash(relative(ROOT, join(file.parentPath, file.name))));
        expect(stylesheets.length).toBeGreaterThan(10);
        for (const path of stylesheets) {
            expect(entry, path).toContain(`/* ${path} */\n`);
            expect(entry, path).toContain(readFileSync(join(ROOT, path), "utf8").trimEnd());
        }
    });
});
