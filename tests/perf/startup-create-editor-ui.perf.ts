import { test } from "vitest";
import { createEditorUi } from "../../src/ui/index.ts";
import type { EditorUiConfig, EditorUiModules } from "../../src/ui/index.ts";
import { createEditorUiModules, SYNTHETIC_MENUS } from "./fixtures/editorUiModules.ts";

// The startup budget (docs/SPEC.md §2): `createEditorUi` with 300 commands in 30 modules and
// 30 modules for each other registry, ≤ 5 ms on reference hardware. Report-only here; the owner
// records the number (tests/perf/README.md). The maps are built once, outside the measured
// function: `createEditorUi` reads them and builds new registries on every call.

type Menu = (typeof SYNTHETIC_MENUS)[number];

// The fixture's entry types are structural and local to it (its header); they match the
// registries' at run time, and the menu paths name only `SYNTHETIC_MENUS`.
const modules = createEditorUiModules() as unknown as EditorUiModules<Menu>;

const config: EditorUiConfig<Menu> = {
    id: "ngne-startup-editor",
    productName: "NGNE Startup Editor",
    about: {
        packageName: "ngne-startup-editor",
        version: "0.0.0",
        licence: "MIT",
        engine: { packageName: "@ngne/core", version: "0.0.0" },
        repositoryUrl: "https://example.com",
        changelogUrl: "https://example.com/CHANGELOG.md",
    },
    menus: SYNTHETIC_MENUS,
    modules,
};

test("startup-create-editor-ui", async ({ bench }) => {
    await bench("createEditorUi: 300 commands, 30 modules per other registry", () =>
        createEditorUi(config),
    ).run();
});
