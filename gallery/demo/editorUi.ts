/// <reference types="vite/client" />
import { createEditorUi } from "@ngne/editor-ui";
import type { EditorUiModules } from "@ngne/editor-ui";
import { DEMO_CONTEXTS, PANEL_SELECTOR } from "./keys.ts";
import type { DemoContext } from "./keys.ts";
import { PreferencesDialog } from "./PreferencesDialog.tsx";
import { rowsStore } from "./rows.ts";
import { RAIL_FOOTER_HEIGHT } from "./tools.ts";
import type { DemoTool } from "./tools.ts";

// The gallery's demo editor (SPEC §5): its editor UI instance, configured as an editor's
// `src/app/editorUi.ts` is. Each registry's modules are found by one `import.meta.glob` line
// under demo/, so a demo feature joins as a new file with the registry's suffix. The stores the
// commands read refresh them. Its key contexts (SPEC §7.2): `gesture`, a state context, before
// `panel`, a focus context whose selector is also the panel selector of return focus (SPEC §6).
// Its own surface: a fixture Preferences dialog, beside the package's (SPEC §5 `surfaces`).
// Its bottom region (SPEC §5 `bottomRegion`): the Timeline, toggled by Tab as `view.timeline`.
// The page opened with `?bottom=none` builds the instance without one, the configuration of an
// editor that has no bottom region. Its tools (`*.tools.ts`) with the height their rail footer
// takes (SPEC §5 `railFooterHeight`), and its context-bar content (`*.contextbar.tsx`).

/** The bottom region, or none when the page's address asks for none. */
const BOTTOM_REGION =
    new URLSearchParams(window.location.search).get("bottom") === "none"
        ? null
        : { id: "timeline", label: "Timeline" };

const MENUS = ["File", "Edit", "View", "Help"] as const;
export type DemoMenu = (typeof MENUS)[number];
type Modules = EditorUiModules<DemoMenu, DemoContext, DemoTool>;

/** One module of a registry's map. */
type ModuleOf<Name extends keyof Modules> = Modules[Name][string];

export const editorUi = createEditorUi({
    id: "ngne-demo-editor",
    productName: "NGNE Demo Editor",
    about: {
        packageName: "ngne-demo-editor",
        version: "0.0.0",
        licence: "MIT",
        engine: { packageName: "@ngne/core", version: "0.0.0" },
        repositoryUrl: "https://github.com/that-webdev-dude/ngne-editor-ui",
        changelogUrl: "https://github.com/that-webdev-dude/ngne-editor-ui/blob/main/CHANGELOG.md",
    },
    menus: MENUS,
    keyContexts: {
        order: DEMO_CONTEXTS,
        state: ["gesture"],
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
        tools: import.meta.glob<ModuleOf<"tools">>("./**/*.tools.{ts,tsx}", { eager: true }),
        overlays: import.meta.glob<ModuleOf<"overlays">>("./**/*.overlay.{ts,tsx}", {
            eager: true,
        }),
        statusFields: import.meta.glob<ModuleOf<"statusFields">>("./**/*.status.ts", {
            eager: true,
        }),
    },
    refreshOn: [rowsStore],
    surfaces: { preferences: PreferencesDialog },
});
