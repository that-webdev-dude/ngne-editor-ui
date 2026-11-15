# NGNE Editor UI

The shared interface of the NGNE editor suite: design tokens, primitives, the application
shell, command and key handling, registries, the PWA update flow, the About and Open Source
Licences dialogs, colour maths, and the suite's design canon. The NGNE Sprite Editor, the NGNE
Tilemap Editor and the NGNE Game Editor build on it, so every editor of the suite looks and
behaves the same.

Not yet published: the first version is being cut from the NGNE Sprite Editor. Until
`@ngne/editor-ui` 0.1.0 is on npm, the commands below describe the intended use.

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
    <UiRoot ui={editorUi}>
        <AppShell viewport={<Viewport />} noDocument={<EmptyState />} />
    </UiRoot>,
);
```

The build adds the About facts and the licences file, and the service worker entry calls the
package's worker:

```ts
// vite.config.ts
import { appInfoDefines } from "@ngne/editor-ui/about/build";
import { generateLicences } from "@ngne/editor-ui/licences/build";

// src/app/pwa/sw.ts
import { installServiceWorker } from "@ngne/editor-ui/pwa/worker";
installServiceWorker({ id: "ngne-sprite-editor", manifest: self.__WB_MANIFEST });
```

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
dispatch from `main`; it is not yet deployed (the first deploy follows the first full licence
audit).

Locally, with the package built first:

```sh
npm run gallery
```

The development server serves it at `http://localhost:5173/ngne-editor-ui/`. It runs the
built package, so a change under `src/` shows after `npm run build`. `npm run build:gallery`
writes the Pages site to `gallery/dist/`, with `licences.txt` beside `index.html`.

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
