// Entry module of `@ngne/editor-ui` (SPEC §4, §5): the editor UI instance, its configuration,
// `UiRoot`, the theme store, the persisted names of an editor's id, and the factories of the
// theme and recent-commands stores the instance builds, over a storage the caller passes.

export { persistedNames } from "../model/persistedNames.js";
export type { PersistedNames } from "../model/persistedNames.js";
export type {
    AppInfo,
    BottomRegion,
    CommandRefreshSource,
    EditorUiConfig,
    EditorUiKeyContexts,
    EditorUiModules,
    ResolvedEditorUiConfig,
} from "./editorUi/config.js";
export { useEditorUi } from "./editorUi/context.js";
export { createEditorUi } from "./editorUi/createEditorUi.js";
export type { AnyEditorUi, EditorUi } from "./editorUi/createEditorUi.js";
export { createRecentCommandsStore } from "./editorUi/recentCommands.js";
export type { RecentCommandsState } from "./editorUi/recentCommands.js";
export type { SurfaceState, Surfaces } from "./editorUi/surfaces.js";
export { createThemeStore, DEFAULT_THEME, setTheme, useTheme } from "./editorUi/theme.js";
export type { Theme, ThemeState } from "./editorUi/theme.js";
export { UiRoot } from "./editorUi/UiRoot.js";
export type { UiRootProps } from "./editorUi/UiRoot.js";
