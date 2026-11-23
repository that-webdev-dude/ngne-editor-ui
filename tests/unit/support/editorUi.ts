import type { AppInfo, EditorUiConfig } from "../../../src/ui/index.ts";

// The required fields of a test editor's configuration (SPEC §5), for unit tests that build
// an editor UI instance and test something else of it.

/** Build facts of a test editor. */
export const TEST_APP_INFO: AppInfo = {
    packageName: "ngne-test-editor",
    version: "1.0.0",
    licence: "MIT",
    engine: { packageName: "@ngne/core", version: "0.1.0" },
    repositoryUrl: "https://example.com",
    changelogUrl: "https://example.com/CHANGELOG.md",
};

/** The identity of a test editor with the menus `View` and `Help`. */
export const TEST_EDITOR: Pick<
    EditorUiConfig<"View" | "Help">,
    "id" | "productName" | "about" | "menus"
> = {
    id: "ngne-test-editor",
    productName: "NGNE Test Editor",
    about: TEST_APP_INFO,
    menus: ["View", "Help"],
};
