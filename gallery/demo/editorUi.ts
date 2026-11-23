/// <reference types="vite/client" />
import { createEditorUi } from "@ngne/editor-ui";
import type { EditorUiModules } from "@ngne/editor-ui";
import { appInfo } from "./appInfo.ts";
import { DEMO_CONTEXTS, PANEL_SELECTOR } from "./keys.ts";
import type { DemoContext } from "./keys.ts";
import { PreferencesDialog } from "./PreferencesDialog.tsx";
import { rowsStore } from "./rows.ts";
import { bottomRegionState, keyContextState, STATE_CONTEXTS, toolRegistry } from "./sources.ts";
import { RAIL_FOOTER_HEIGHT, toolSetStore } from "./tools.ts";
import type { DemoTool } from "./tools.ts";

// The gallery's demo editor (SPEC §5): its editor UI instance, configured as an editor's
// `src/app/editorUi.ts` is. Each registry's modules are found by one `import.meta.glob` line
// under demo/, so a demo feature joins as a new file with the registry's suffix. The stores the
// commands read refresh them. Its key contexts (SPEC §7.2): `gesture`, a state context, before
// `panel`, a focus context whose selector is also the panel selector of return focus (SPEC §6).
// Its own surface: a fixture Preferences dialog, beside the package's (SPEC §5 `surfaces`).
// Its bottom region (SPEC §5 `bottomRegion`): the Timeline, toggled by Tab as `view.timeline`.
// The page opened with `?bottom=none` builds the instance without one, the configuration of an
// editor that has no bottom region. The state contexts, the Timeline's visibility and the tool
// registry over its `*.tools.ts` modules are the demo's own (`sources.ts`, SPEC §5 `sources`).
// Its rail footer's height (SPEC §5 `railFooterHeight`), and its context-bar content
// (`*.contextbar.tsx`). Its
// build facts are a fixture (`appInfo.ts`), which Help → About NGNE Demo Editor… shows. The
// page opened with `?theme=dark` or `?theme=light` shows that theme without storing it, as the
// gallery's Demo editor entry opens it to follow the gallery's switch; a choice in Preferences
// is stored as usual.

const ADDRESS = new URLSearchParams(window.location.search);

/** The bottom region, or none when the page's address asks for none. */
const BOTTOM_REGION =
    ADDRESS.get("bottom") === "none" ? null : { id: "timeline", label: "Timeline" };

/** The theme the page's address asks for, or null. */
const ADDRESS_THEME = ADDRESS.get("theme");

const MENUS = ["File", "Edit", "View", "Help"] as const;
export type DemoMenu = (typeof MENUS)[number];
type Modules = EditorUiModules<DemoMenu, DemoContext, DemoTool>;

/** One module of a registry's map. */
type ModuleOf<Name extends keyof Modules> = Modules[Name][string];

export const editorUi = createEditorUi({
    id: "ngne-demo-editor",
    productName: "NGNE Demo Editor",
    about: appInfo,
    menus: MENUS,
    keyContexts: {
        order: DEMO_CONTEXTS,
        state: STATE_CONTEXTS,
        focus: { panel: PANEL_SELECTOR },
    },
    bottomRegion: BOTTOM_REGION,
    railFooterHeight: RAIL_FOOTER_HEIGHT,
    modules: {
        commands: import.meta.glob<ModuleOf<"commands">>("./**/*.commands.{ts,tsx}", {
            eager: true,
        }),
        dialogs: import.meta.glob<ModuleOf<"dialogs">>("./**/*.dialog.tsx", { eager: true }),
        dock: import.meta.glob<ModuleOf<"dock">>("./**/*.dock.tsx", { eager: true }),
        contextBars: import.meta.glob<ModuleOf<"contextBars">>("./**/*.contextbar.tsx", {
            eager: true,
        }),
        overlays: import.meta.glob<ModuleOf<"overlays">>("./**/*.overlay.{ts,tsx}", {
            eager: true,
        }),
        statusFields: import.meta.glob<ModuleOf<"statusFields">>("./**/*.status.ts", {
            eager: true,
        }),
    },
    refreshOn: [rowsStore, toolSetStore],
    surfaces: { preferences: PreferencesDialog },
    sources: { keyContextState, bottomRegion: bottomRegionState, tools: toolRegistry },
});

// The address's theme, set in the store without the write `setTheme` makes.
if (ADDRESS_THEME === "dark" || ADDRESS_THEME === "light") {
    editorUi.theme.setState({ theme: ADDRESS_THEME });
}
