// Entry module of `@ngne/editor-ui/commands` (SPEC §4, §7). The Model part: command registry,
// chords and their display, key classes, key contexts and resolution, the menu model, and the
// command palette, recent-command and shortcut-sheet models, generic over the editor's menus
// and contexts (BRIEF D16).

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
