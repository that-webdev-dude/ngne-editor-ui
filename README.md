# NGNE Editor UI

The shared interface of the NGNE editor suite: design tokens, primitives, the application
shell, command and key handling, registries, the PWA update flow, the About and Open Source
Licences dialogs, colour maths, and the suite's design canon. The NGNE Sprite Editor, the NGNE
Tilemap Editor and the NGNE Game Editor build on it, so every editor of the suite looks and
behaves the same.

## Requirements

- An editor of the suite: React 19, desktop Chrome or Edge (current stable) with WebGPU, Vite
  with `vite-plugin-pwa`.
- Node.js ≥ 24 and npm for development, builds and tests.

## Install

Pin the package and its peers exactly, at the versions of the app's SUITE §5:

```sh
npm install --save-exact @ngne/editor-ui react react-dom radix-ui lucide-react zustand
```

The package has no runtime dependencies of its own and never depends on `@ngne/core`.

## Use

One module of the app creates the editor UI instance:

```ts
// src/app/editorUi.ts
import { createEditorUi } from "@ngne/editor-ui";
import { appInfo } from "./about/appInfo";

export const editorUi = createEditorUi({
    id: "ngne-sprite-editor",
    productName: "NGNE Sprite Editor",
    about: appInfo,
    menus: ["File", "Edit", "Sprite", "Layer", "Frame", "Select", "View", "Help"],
    modules: {
        commands: import.meta.glob("../**/*.commands.{ts,tsx}", { eager: true }),
        dialogs: import.meta.glob("../**/*.dialog.tsx", { eager: true }),
        dock: import.meta.glob("../**/*.dock.tsx", { eager: true }),
        // contextBars, tools, overlays, statusFields
    },
});
```

The root mounts it with the suite's stylesheet:

```tsx
import "@ngne/editor-ui/styles.css";
import { UiRoot } from "@ngne/editor-ui";
import { AppShell } from "@ngne/editor-ui/shell";

root.render(
    <UiRoot editorUi={editorUi}>
        <AppShell
            viewport={<Viewport />}
            noDocument={<EmptyState />}
            tools={toolState} // the editor's active-tool store: the rail and context bar read it
        />
    </UiRoot>,
);
```

The build adds the About facts and the licences file, and the service worker entry calls the
package's worker:

```ts
// vite.config.ts
import { fileURLToPath } from "node:url";
import { appInfoDefines } from "@ngne/editor-ui/about/build";
import { generateLicences } from "@ngne/editor-ui/licences/build";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// licences.txt beside index.html; the build fails on a package it cannot list (SPEC §11).
const licences = generateLicences({
    root: fileURLToPath(new URL(".", import.meta.url)),
    title: "NGNE Sprite Editor",
    // Build-only packages whose code the bundler writes: rolldown's runtime always, and Vite's
    // preload helper when any build of the app, in any mode, has a dynamic import.
    buildPackages: ["node_modules/rolldown", "node_modules/vite"],
});

export default defineConfig({
    // APP_PACKAGE, APP_VERSION, APP_LICENSE, ENGINE_PACKAGE, ENGINE_VERSION from package.json
    // (its name, version, licence and the pinned @ngne/core), under import.meta.env.
    define: appInfoDefines(fileURLToPath(new URL("package.json", import.meta.url))),
    plugins: [
        react(),
        licences.plugin,
        VitePWA({
            strategies: "injectManifest",
            srcDir: "src/app/pwa",
            filename: "sw.ts",
            // The service worker's own build checks its packages against licences.txt.
            injectManifest: { buildPlugins: { vite: [licences.serviceWorkerPlugin] } },
        }),
    ],
    // Web workers' modules join the same licences.txt.
    worker: { plugins: () => [licences.workerPlugin] },
});

// src/app/about/appInfo.ts: the About dialog's facts (Help → About <productName>…)
import type { AppInfo } from "@ngne/editor-ui/about";

const REPOSITORY_URL = "https://github.com/that-webdev-dude/ngne-sprite-editor";
export const appInfo: AppInfo = {
    packageName: import.meta.env.APP_PACKAGE,
    version: import.meta.env.APP_VERSION,
    licence: import.meta.env.APP_LICENSE,
    engine: {
        packageName: import.meta.env.ENGINE_PACKAGE,
        version: import.meta.env.ENGINE_VERSION,
    },
    repositoryUrl: REPOSITORY_URL,
    changelogUrl: `${REPOSITORY_URL}/blob/main/CHANGELOG.md`,
};

// src/app/pwa/sw.ts: vite-plugin-pwa (`injectManifest`) builds it into sw.js and puts the
// build's files where `self.__WB_MANIFEST` stands; the id is the one createEditorUi takes.
import { installServiceWorker } from "@ngne/editor-ui/pwa/worker";
import type { PrecacheEntry } from "@ngne/editor-ui/pwa/worker";

declare const self: { __WB_MANIFEST: PrecacheEntry[] };
installServiceWorker({ id: "ngne-sprite-editor", manifest: self.__WB_MANIFEST });
```

A unit test of the app keeps its own stylesheets to the canon: only the package's `tokens.css`
holds raw colours, so every colour of the app's CSS is a token (`var(--…)`):

```ts
// tests/unit/stylesheets.test.ts
import { globSync } from "node:fs";
import { checkStylesheets } from "@ngne/editor-ui/styles/check";
import { expect, it } from "vitest";

it("takes every colour of the app's CSS from the tokens", () => {
    // Throws on a hex colour, rgb(), hsl() or a named colour, naming file, line and value.
    expect(() => checkStylesheets(globSync("src/**/*.css"))).not.toThrow();
});
```

## Subpaths

| Subpath                          | Contents                                                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `@ngne/editor-ui`                | `createEditorUi`, `UiRoot`, `useEditorUi`, the configuration types, `persistedNames`, theme and recent-commands stores |
| `@ngne/editor-ui/styles.css`     | Tokens, base styles and every component stylesheet but the gallery's                                                   |
| `@ngne/editor-ui/styles/check`   | `checkStylesheets`, for an app's unit test                                                                             |
| `@ngne/editor-ui/primitives`     | Buttons, toggles, fields, slider, select, popovers, dialog, context menu, tooltip, splitter, icon                      |
| `@ngne/editor-ui/focus`          | Input modality, inert outside modal layers, menu opener, returning focus                                               |
| `@ngne/editor-ui/messages`       | Toasts, dialog host and registry, notices, the discard question, region boundary                                       |
| `@ngne/editor-ui/shell`          | `AppShell` and its regions: menu bar, tool rail, context bar, dock, tab strip, status bar, bottom region               |
| `@ngne/editor-ui/commands`       | Command registry, chords and keymap, menus, command palette, shortcut sheet                                            |
| `@ngne/editor-ui/overlay`        | Overlay layer registry, wheel pan and zoom steps                                                                       |
| `@ngne/editor-ui/platform`       | Window size, WebGPU check, storage access                                                                              |
| `@ngne/editor-ui/pwa`            | Update flow and toast, precache logic                                                                                  |
| `@ngne/editor-ui/pwa/worker`     | `installServiceWorker`, for the app's service worker                                                                   |
| `@ngne/editor-ui/about`          | About dialog and command, `AppInfo`                                                                                    |
| `@ngne/editor-ui/about/build`    | `appInfoDefines`, the build facts the About dialog shows                                                               |
| `@ngne/editor-ui/licences`       | Open Source Licences dialog and command                                                                                |
| `@ngne/editor-ui/licences/build` | `generateLicences`: writes `licences.txt` and fails the build on a missing or unlisted package                         |
| `@ngne/editor-ui/colour`         | Hex, HSV, RGBA, OKLab and contrast maths; the `#rrggbb` text format                                                    |
| `@ngne/editor-ui/gallery`        | `Gallery` and its entry types, for an app's development gallery                                                        |
| `@ngne/editor-ui/gallery.css`    | The gallery's stylesheets, imported after `styles.css` by the gallery route only                                       |

The worker and build subpaths (`pwa/worker`, `about/build`, `licences/build`, `styles/check`)
load neither React nor the DOM.

Every option, subpath and persisted name is in [docs/SPEC.md](docs/SPEC.md). Moving an
existing editor onto the package, or to a newer version of it: [docs/MIGRATION.md](docs/MIGRATION.md).

## Documents

| Doc                                      | Role                                                |
| ---------------------------------------- | --------------------------------------------------- |
| [docs/README.md](docs/README.md)         | Doc index and reading order                         |
| [docs/BRIEF.md](docs/BRIEF.md)           | Scope and decisions; wins when two docs disagree    |
| [docs/SPEC.md](docs/SPEC.md)             | Architecture, public API, configuration, versioning |
| [docs/DESIGN.md](docs/DESIGN.md)         | The suite design canon every editor follows         |
| [docs/MIGRATION.md](docs/MIGRATION.md)   | Adopting the package in an editor, and upgrading it |
| [docs/PROVENANCE.md](docs/PROVENANCE.md) | Where the code comes from; licence audits           |
| [CHANGELOG.md](CHANGELOG.md)             | Release notes                                       |
| [RULES.md](RULES.md)                     | Code rules for every contributor                    |

## Gallery

The gallery is the suite's visual canon: every token and component in both themes, with the
open-source licences of its build. It is deployed to
<https://that-webdev-dude.github.io/ngne-editor-ui/> from each release tag and by manual
dispatch from `main`.

Locally, with the package built first:

```sh
npm run gallery
```

The development server serves it at `http://localhost:5173/ngne-editor-ui/`. It runs the
built package, so a change under `src/` shows after `npm run build`. `npm run build:gallery`
writes the Pages site to `gallery/dist/`, with `licences.txt` beside `index.html`. The site
shows the package's entries, then its own: the demo editor (`gallery/demo/`), also served on
its own at `demo/`. A link `#<entry id>` opens the gallery at that entry.

### Mounting the gallery with app entries

An editor mounts the gallery on a development page of its own and passes its entries, which
follow the package's in a group of their own. Each entry has an id, unique in the gallery
(the section's anchor), a title and a component; the gallery shows each one in the theme of
its switch, which `useGalleryTheme()` reads.

```tsx
import "@ngne/editor-ui/styles.css";
import { Gallery } from "@ngne/editor-ui/gallery";
import type { GalleryEntry } from "@ngne/editor-ui/gallery";
import { createRoot } from "react-dom/client";
import { LayerRow } from "./ui/layers/LayerRow";

const entries: readonly GalleryEntry[] = [
    { id: "layer-row", title: "Layer row", Component: () => <LayerRow name="Background" /> },
];

createRoot(document.getElementById("root")!).render(<Gallery entries={entries} />);
```

The gallery mounts its own toasts and dialog host, which shows the package's entries'
dialogs only: an app entry renders its own dialogs itself, and provides the editor UI
instance its components read. An entry that needs the whole editor (its `UiRoot`, which sets
the document's theme and installs its keys) shows it in a frame, as the site's demo editor
entry does.

## Develop

```sh
npm ci --ignore-scripts
npm run check
```

`npm run check` runs typecheck, lint, formatting, unit tests and the build. The gallery's E2E
specs (Playwright, installed Chrome, axe) run with `npx playwright test`
([tests/e2e/README.md](tests/e2e/README.md)).

## Licence

MIT, Copyright (c) 2026 Fabio Barracano. Third-party notices: `THIRD_PARTY_NOTICES.md`.
