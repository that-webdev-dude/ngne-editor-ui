import type { AppInfo } from "@ngne/editor-ui/about";

// The demo editor's build facts (SPEC §5 `about`, §11): a fixture, where an editor builds its
// `AppInfo` from the constants `appInfoDefines` reads out of its package.json. Versions no other
// fixture uses, so the About dialog's specs can tell them apart.

const REPOSITORY_URL = "https://github.com/that-webdev-dude/ngne-editor-ui";

export const appInfo: AppInfo = {
    packageName: "ngne-demo-editor",
    version: "1.4.2",
    licence: "MIT",
    engine: { packageName: "@ngne/core", version: "0.9.3" },
    repositoryUrl: REPOSITORY_URL,
    changelogUrl: `${REPOSITORY_URL}/blob/main/CHANGELOG.md`,
};
