/// <reference types="vite/client" />
import { createEditorUi } from "@ngne/editor-ui";
import type { EditorUiModules } from "@ngne/editor-ui";

// The gallery's demo editor (SPEC §5): its editor UI instance, configured as an editor's
// `src/app/editorUi.ts` is. Each registry's modules are found by one `import.meta.glob` line
// under demo/, so a demo feature joins as a new file with the registry's suffix.

const MENUS = ["File", "Edit", "View", "Help"] as const;
type Menu = (typeof MENUS)[number];
type Modules = EditorUiModules<Menu>;

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
});
