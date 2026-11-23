// Entry module of `@ngne/editor-ui/commands` (SPEC §4, §7). The Model part: command registry,
// chords and their display, key classes, key contexts and resolution, the menu model, and the
// command palette, recent-command and shortcut-sheet models, generic over the editor's menus
// and contexts (BRIEF D16). The UI part: the hooks that read commands and render again only
// when what they read changed (SPEC §2 Command refresh), running a command with failures as
// error toasts, the chord key cap and the context-menu entries; each reads the editor UI
// instance `UiRoot` provides or takes the registry as an argument (SPEC §1.2), and the runner
// an editor creates to run its instance's commands from the modules the instance loads (SPEC
// §5 `sources`). The keys: the key environment read from the page, the state contexts of an
// instance and their store's factory, and the keymap installation `UiRoot` makes (SPEC §7.2). The surfaces: the command palette, its trigger, the
// shortcut sheet, the ids of the package commands that open them, and the host that shows the
// open surface of an instance, the package's or the editor's (SPEC §7.1).

export { RegistrationError } from "../../model/modules.js";
export {
    ChordError,
    chordFromEvent,
    chordKey,
    chordModifiers,
    eventKey,
    formatChord,
    normalizeChord,
    parseChord,
} from "../../model/commands/chord.js";
export type { ChordModifiers, ChordParts, KeyEventLike } from "../../model/commands/chord.js";
export { keyContextOrder } from "../../model/commands/contexts.js";
export { fuzzyScore } from "../../model/commands/fuzzy.js";
export { invokeCommand } from "../../model/commands/invoke.js";
export type { CommandErrorHandler } from "../../model/commands/invoke.js";
export {
    isBrowserChord,
    isCharacterChord,
    isNativeKeyChord,
    isTextEditingChord,
    NATIVE_KEYS,
} from "../../model/commands/keyClasses.js";
export {
    buildContextMenu,
    buildMenu,
    buildMenuBar,
    menuBarProblems,
    menuCommands,
} from "../../model/commands/menuModel.js";
export type { MenuBarEntry, MenuNode } from "../../model/commands/menuModel.js";
export { paletteEntries, paletteScore, runPaletteCommand } from "../../model/commands/palette.js";
export type { PaletteEntry, RecentCommandsRecorder } from "../../model/commands/palette.js";
export {
    MAX_RECENT_COMMANDS,
    parseRecentCommands,
    readRecentCommands,
    withRecentCommand,
    writeRecentCommands,
} from "../../model/commands/recentCommands.js";
export type { RecentCommandsStorage } from "../../model/commands/recentCommands.js";
export {
    createCommandRegistry,
    findChordConflicts,
    registerCommandModules,
} from "../../model/commands/registry.js";
export type {
    ChordConflict,
    CommandRegistry,
    CommandRegistryOptions,
} from "../../model/commands/registry.js";
export { applicableContexts, resolveKey } from "../../model/commands/resolve.js";
export type { KeyEnvironment, KeyResolution } from "../../model/commands/resolve.js";
export { OTHER_SHORTCUTS, shortcutGroups } from "../../model/commands/shortcutSheet.js";
export type { ShortcutGroup, ShortcutRow } from "../../model/commands/shortcutSheet.js";
export { BASE_CONTEXTS, DEFAULT_MENU_ORDER } from "../../model/commands/types.js";
export type {
    BaseContext,
    Command,
    CommandModule,
    CommandSpec,
    ContextMenuPlacement,
    KeyContext,
    MenuPath,
    PlannedCommandSpec,
} from "../../model/commands/types.js";

export { Chord } from "./Chord.js";
export type { ChordProps } from "./Chord.js";
export { COMMAND_PALETTE_COMMAND } from "./commandPalette.commands.js";
export { CommandPalette } from "./CommandPalette.js";
export { CommandPaletteTrigger } from "./CommandPaletteTrigger.js";
export { createCommandRunner } from "./commandRunner.js";
export type { CommandRunner } from "./commandRunner.js";
export { contextMenuEntries } from "./contextMenu.js";
export { installKeymap } from "./installKeymap.js";
export type { KeymapEvent, KeymapOptions, KeymapTarget } from "./installKeymap.js";
export { createKeyContextStore, setKeyContext } from "./keyContextState.js";
export type { KeyContextState, KeyContextTarget } from "./keyContextState.js";
export {
    activeKeyContexts,
    isTextField,
    nativeKeysOf,
    OVERLAY_ATTRIBUTE,
    OVERLAY_SELECTOR,
    readKeyEnvironment,
    VIEWPORT_FOCUS_ATTRIBUTE,
} from "./keyEnvironment.js";
export type { FocusedElement, KeyContextLists, KeymapDocument } from "./keyEnvironment.js";
export { reportCommandError, runCommand } from "./runCommand.js";
export { SHORTCUT_SHEET_COMMAND } from "./shortcutSheet.commands.js";
export { ShortcutSheet } from "./ShortcutSheet.js";
export { SurfaceHost } from "./SurfaceHost.js";
export { useCommands, useCommandValue } from "./useCommands.js";
