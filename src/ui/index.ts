// Entry module of `@ngne/editor-ui` (SPEC §4, §5): the editor UI instance, its configuration,
// `UiRoot`, and the theme store.

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
export type { RecentCommandsState } from "./editorUi/recentCommands.js";
export type { SurfaceState, Surfaces } from "./editorUi/surfaces.js";
export { setTheme, useTheme } from "./editorUi/theme.js";
export type { Theme, ThemeState } from "./editorUi/theme.js";
export { UiRoot } from "./editorUi/UiRoot.js";
export type { UiRootProps } from "./editorUi/UiRoot.js";
