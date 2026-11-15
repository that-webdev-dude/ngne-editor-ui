# NGNE Editor UI — Specification

Behaviour, architecture and public API of the package. [BRIEF.md](BRIEF.md) wins when the two
disagree. The interface it draws is specified in [DESIGN.md](DESIGN.md) (the suite canon).
Source paths in this file are the sprite editor's, under `src/`, at the cut (BRIEF D14).

## 1. Architecture

### 1.1 Layers

| Layer | Folder | Runs in | May import |
| --- | --- | --- | --- |
| Model | `src/model/` | Anywhere (pure TS) | Nothing outside itself |
| Colour | `src/colour/` | Anywhere (pure TS) | Nothing outside itself |
| UI | `src/ui/` | Browser, React | Model, Colour, peers (BRIEF D4) |
| Worker | `src/worker/` | Service worker | Model |
| Build | `src/build/` | Node | `node:*` |
| Styles | `src/styles/` | CSS | — |

- Model holds everything that needs no DOM: command registry, chords, menu model, key
  resolution, fuzzy matching, palette and shortcut-sheet models, layout maths, precache logic,
  wheel steps, the registry factories.
- No layer imports `@ngne/core` or any app (BRIEF D2). Lint enforces the table, as in the apps.
- Model, Colour and Worker run under Vitest in Node; UI is tested through the gallery (§3).

### 1.2 The editor UI instance

Everything that depends on the app is built once, at startup, by `createEditorUi(config)`
(§5). The app keeps the result in one module of its own (by convention
`src/app/editorUi.ts`) and passes it to `UiRoot`; React components read it from context,
non-React app code imports the app's module.

Identity-free services stay module-level in the package, one copy per app (exact pins and
peers guarantee it): toasts, notices, command dialog requests, storage-failure reporting,
input modality. Identity-bound state never is: theme, layout, recent commands, the command
registry, surfaces.

### 1.3 Registries

Every registry is a factory over a module map (BRIEF D15). The app discovers its modules with
one `import.meta.glob` line and passes the map; the package validates, orders and registers.
Module order is by path, compared by UTF-16 code unit (locale-independent). Registration
errors (duplicate ids, chord conflicts, unknown menus) throw at startup, as today.

| Registry | Module suffix | Factory |
| --- | --- | --- |
| Commands, keymap and menus | `*.commands.ts(x)` | `createCommandRegistry` + `registerCommandModules(map)` |
| Dialogs | `*.dialog.tsx` | `collectCommandDialogs(map)` |
| Dock panels | `*.dock.tsx` | `collectDockPanels(map)` |
| Context bar | `*.contextbar.tsx` | `collectContextBarContent(map)` |
| Tools | `*.tools.ts(x)` | `createToolRegistry<Tool>()` + `registerToolModules(map)` |
| Overlay layers | `*.overlay.ts(x)` | `collectOverlayLayers<Frame>(map)` |
| Status fields | `*.status.ts` | `collectStatusFields(map)` |

The package's own commands (command palette, Help → Keyboard Shortcuts…, Help → About,
F6 regions, View → Open Source Licences…) are registered by `createEditorUi` before the app's
modules. There is no theme command: the theme store (`useTheme`, `setTheme`) is exported from
`@ngne/editor-ui`, and each app sets the theme from its Preferences.

## 2. Performance

The package has no frame budgets of its own; it must not move the apps' (BRIEF §8).

| Budget | Value | How measured |
| --- | --- | --- |
| App bundle growth at migration | ≤ 2% of the production bundle | Build size before and after, per app |
| App budget rows at migration | No row of the app's ENGINE §6 / SPEC §14 moves beyond its noise | The app's benchmarks, reference hardware, by the owner |
| Command refresh | A store change re-renders only components that read a command whose `enabled()` or `title()` result changed | Render-count test on the gallery |
| Startup | `createEditorUi` with 300 commands and 30 modules per other registry takes ≤ 5 ms | Node benchmark, report-only on CI |

## 3. Quality

- Done: every acceptance item backed by a named test; `npm run check` (typecheck, lint,
  format, unit tests, build) passes; the gallery E2E specs of the touched area pass.
- Unit tests: `tests/unit/<feature>-*.test.ts` for Model, Colour, Worker and Build.
- E2E: Playwright with installed Chrome on the gallery, every export in both themes, at
  1280×720 and 125% zoom, with axe; keyboard specs for focus, menus, palette and sheet.
- API surface: `tests/unit/api-surface.test.ts` lists every subpath and every exported name;
  a change to the list is a deliberate edit with a CHANGELOG entry (§13).
- Notices: the licence build helper (§11) runs on this repository too, with the same test.
- Consumers: a release candidate is installed into each consuming app (packed tarball) and
  their `npm run check` and full E2E suites pass before the tag (§13).

## 4. Packaging

- ESM only, built by `tsc` (JS and declarations) plus a copy of the CSS (BRIEF D10); source
  maps included. Node ≥ 24 for the build helper; browsers as the apps (desktop Chrome or Edge,
  current stable, WebGPU).
- Peer dependencies, exact ranges matching SUITE §5 of the apps: `react`, `react-dom`,
  `radix-ui`, `lucide-react`, `zustand`. No runtime dependencies.
- `sideEffects`: CSS files only.

| Subpath | Layer | Contents |
| --- | --- | --- |
| `@ngne/editor-ui` | UI | `createEditorUi`, `UiRoot`, `EditorUiConfig` and the types of §5 |
| `@ngne/editor-ui/styles.css` | Styles | `tokens.css`, `base.css` and every component stylesheet, in one entry |
| `@ngne/editor-ui/styles/check` | Build | `checkStylesheets` (§9.2) |
| `@ngne/editor-ui/primitives` | UI | §9.1 |
| `@ngne/editor-ui/focus` | UI | Modality, inert outside, menu opener, return focus |
| `@ngne/editor-ui/messages` | UI | Toasts, dialog host and registry, notices, discard question, region boundary |
| `@ngne/editor-ui/shell` | UI | §8 |
| `@ngne/editor-ui/commands` | UI + Model | §7 |
| `@ngne/editor-ui/overlay` | Model | Overlay layer registry, wheel steps |
| `@ngne/editor-ui/platform` | UI | Window size, WebGPU check, storage access |
| `@ngne/editor-ui/pwa` | UI + Model | Update flow and toast, precache logic |
| `@ngne/editor-ui/pwa/worker` | Worker | §10 |
| `@ngne/editor-ui/about` | UI | About dialog and command, `AppInfo` |
| `@ngne/editor-ui/about/build` | Build | §11: the build facts the About dialog shows |
| `@ngne/editor-ui/licences` | UI | Licences dialog and command |
| `@ngne/editor-ui/licences/build` | Build | §11 |
| `@ngne/editor-ui/colour` | Colour | `hex`, `hsv`, `rgba`, `oklab`, `contrast`, `#rrggbb` text format |
| `@ngne/editor-ui/gallery` | UI | §12 |

A worker or the build never loads React or the DOM: their subpaths import only Model or
`node:*`.

## 5. Identity and setup

```ts
const editorUi = createEditorUi({
    id: "ngne-sprite-editor",           // storage, cache and message prefix
    productName: "NGNE Sprite Editor",
    about: appInfo,                     // build facts (§11)
    menus: ["File", "Edit", "Sprite", "Layer", "Frame", "Select", "View", "Help"],
    keyContexts: { order: [...], state: [...], focus: { panel: '[data-region="timeline"]' } },
    bottomRegion: { id: "timeline", label: "Timeline" },   // or null
    railFooterHeight: 54,
    modules: { commands, dialogs, dock, contextBars, tools, overlays, statusFields },
    refreshOn: [editorStore, sessionStore],   // stores whose changes refresh commands
    commandGate: (command) => boolean,        // e.g. "no project open" allow-list
    beforeRun: (command) => void,             // e.g. stop playback
    surfaces: { preferences: PreferencesDialog },
});
```

| Field | Meaning | Default |
| --- | --- | --- |
| `id` | Lowercase prefix of every persisted name (table below) | Required |
| `productName` | Shown in notices (WebGPU required), the About command's title and the licences dialog | Required |
| `about` | `AppInfo`: package name, version, licence, engine package and version, repository and changelog URLs | Required |
| `menus` | Menu bar order; also the type of every command's menu placement. Must contain `View` and end with `Help`, or `createEditorUi` throws | Required |
| `keyContexts` | App contexts and their order around the package's `text`, `canvas`, `global` (§7.2); state contexts; focus selectors | `text`, `canvas`, `global` only |
| `bottomRegion` | Id and label of the bottom region, or `null` for none | `null` |
| `railFooterHeight` | Height reserved under the tool rail's groups | `0` |
| `modules` | The module maps of §1.3 | Empty maps |
| `refreshOn` | Stores whose change triggers a command refresh | None |
| `commandGate` | Disables commands the gate rejects | All enabled |
| `beforeRun` | Runs before every command | None |
| `surfaces` | App surfaces beside the command palette and shortcut sheet | None |

Persisted names keep their current values, so a migrating app keeps its users' data:

| Name | Value |
| --- | --- |
| Theme | `<id>.theme` |
| Layout | `<id>.layout`; stored fields unchanged, including `timelineHeight` for the bottom region |
| Recent commands | `<id>.recent-commands` |
| Cache prefix | `<id>-` |
| Worker messages | `<id>:skip-waiting`, `<id>:started` |
| Older-windows key | `<id>-older-windows` |

The public API calls the bottom region "bottom" (`BOTTOM_HEIGHT`, `resolveBottomHeight`);
only the stored field keeps its old name.

## 6. Messages, focus and platform

- **Toasts, dialog host, notices, discard question, region boundary:** as the sprite editor at
  the cut. `DiscardChangesRequest` moves with its dialog.
- **Return focus:** pointer activation of a non-text control returns focus to the viewport
  target the app names (`data-viewport-focus`), except inside the app's panel selector.
- **WebGPU check:** each `requestAdapter()` is limited to 5 s, with one retry; a check that
  times out shows the WebGPU-required notice (tilemap fix, BRIEF D14).
- **Storage:** key-value access with failure reporting; keys always come from callers.

## 7. Commands and keys

### 7.1 Commands

- Command specs, chords, menu placement, context-menu placement and planned commands as the
  sprite editor at the cut; the menu placement type is the app's `menus` (§5).
- Two render paths: `useCommands` re-renders only when a command the component read changed
  (tilemap tracker), and `useCommandValue(read)` re-renders only when the read value changes
  (sprite editor). Both are kept (BRIEF D14).
- `commandGate` and `beforeRun` replace the apps' edits of `appCommands.ts` and `invoke.ts`.
- Command palette with fuzzy matching and recent commands; shortcut sheet; open-surface
  tracking with the package's surfaces plus the app's.

### 7.2 Keys

- Key classes, chord parsing and display, installation and resolution are the package's.
- Contexts: the package owns `text`, `canvas` and `global`; apps add state contexts (sprite:
  `gesture`, `floating`; tilemap: `gesture`, `markers`) and focus contexts (sprite:
  `timeline`; tilemap: `panel`, each with its focus selector) and give their order.
- Applicable contexts, as today: none while an overlay (menu, dialog, popover) is open; only
  `text` while a text field has focus; otherwise the app's active contexts in their order, then
  `canvas`, then `global`.
- A key runs the first enabled command bound in the first applicable context that binds it.
  `canvas` takes a native key only while the viewport has focus. A key the focused control
  handles natively, or a typed character during typeahead, is left to the control. A browser
  shortcut bound somewhere but not acting here is suppressed.

## 8. Shell

- **`UiRoot`:** mounts theme, modality, inert-outside, tooltip provider, dialog host, toasts,
  and provides the editor UI instance.
- **`AppShell`:** the frame with named slots (BRIEF D17):

| Slot | Filled by the app with |
| --- | --- |
| `menuCentre` | The tab strip, or nothing |
| `railFooter` | Colour chips, stamp preview, … (height `railFooterHeight`) |
| `viewport` | The viewport region content |
| `bottom` | The bottom region content (when `bottomRegion` is set) |
| `noDocument` | What the viewport shows when no document is open; gates the bottom region and the dock |

- **Layout:** minimum window 1280×720; dock width 264 (220–360); bottom-region and rail sizes
  as the sprite editor at the cut; the tool rail full height beside the bottom region, which
  spans the viewport and dock columns (DESIGN §2, BRIEF D22); the window-too-small notice.
- **Tool rail:** columns from the tool registry's groups; one or two columns by height. An
  optional filter chooses the tools shown (the tilemap shows the tools of the active layer's
  kind).
- **Context bar:** the active tool's options from the registry, then an optional trailing
  readouts slot (the tilemap's tool readouts).
- **Dock, menu bar:** from their registries; menus from the command registry.
- **Status bar:** the frame renders the `*.status.ts` fields in registry order, left to right,
  then the hint on the right; a field declares its reserved width.
- **Tab strip (BRIEF D18):** presentational. The app passes items (`id`, `label`, `tooltip`,
  `dirty`), the active id, a leading label (project name) and callbacks (`activate`, `close`,
  `move`); the strip owns metrics, keyboard (arrows, Home, End, Delete), drag to reorder and
  the overflow menu, whose label the app passes.
- **Tools (BRIEF D18):** `ToolBase` holds what the rail and context bar need: id, title, icon,
  key, group, variant-of, option specs. Apps extend it with pointer and stroke behaviour; the
  registry is generic over `Tool extends ToolBase`.
- **F6 regions:** found by `data-region`; F6 / Shift+F6 cycle them.

## 9. Primitives and styles

### 9.1 Primitives

Button, IconButton, ToolButton, Toggle, SegmentedControl, NumberField, Slider, Select,
Popover, Dialog, ContextMenu, Tooltip, Splitter, Icon (over `lucide-react`), `cx`, and the
closing-popover hook, as the sprite editor at the cut.

### 9.2 Styles

- `tokens.css` is the only file with raw colours; dark default, light under
  `[data-theme="light"]`.
- `@ngne/editor-ui/styles/check` exports `checkStylesheets(paths)`, which apps run in a unit
  test over their own CSS: it fails on a raw colour outside `tokens.css`.

## 10. PWA

- **Window side:** update detection, the update toast ("A new version of the editor is
  ready."), skip-waiting and started messages named from `id`.
- **Worker side:** `installServiceWorker({ id, manifest })` holds the sprite editor's `sw.ts`
  logic; the app's worker entry calls it with `self.__WB_MANIFEST`, which the app's
  `vite-plugin-pwa` build injects.

## 11. About and licences

- **Help menu:** Keyboard Shortcuts… (`?`) first; About <productName>… last, in a group of its
  own; app commands placed in Help go between them.
- **About dialog:** as DESIGN §7, from the `about` config. `about/build` exports
  `appInfoDefines(packageJsonPath)`, which reads the app's `package.json` (name, version,
  licence, the pinned `@ngne/core`) into the build-time constants `APP_PACKAGE`,
  `APP_VERSION`, `APP_LICENSE`, `ENGINE_PACKAGE`, `ENGINE_VERSION` for the app's
  `vite.config.ts`, so a release that bumps `package.json` changes the dialog with no other
  edit.
- **Licences dialog and command:** View → Open Source Licences…, last group of the View menu, enabled
  without a document; shows `licences.txt` from beside `index.html`.
- **Build helper:** `generateLicences(options)` writes `licences.txt` from the lockfile and
  the bundle. Options: project licence and notices paths, title, build-only packages listed
  outside the stray check (rolldown), excluded-code rules (gifenc's quantizer in the sprite
  editor), licence allowlist, stand-in licence texts. It fails on a bundled package missing
  from the list, a listed package no longer bundled, a missing licence text, a licence outside
  the allowlist, or excluded code found in the bundle.
- The approved stand-in text for `react-remove-scroll-bar` 2.3.8 ships with the helper.

## 12. Gallery

- Renders every export of §4 in both themes, with the app's own entries appended when an app
  mounts it (`<Gallery entries={…} />`).
- This repository's Pages site serves the gallery from each release tag (BRIEF D13).

## 13. Versioning

- Semantic versions, 0.x until BRIEF §2 goal 5. In 0.x, a minor version may break the API;
  a patch never does.
- Every release has a CHANGELOG section. A change to tokens or a component's look names the
  gallery entries it changes.
- A release candidate passes §3 in this repository and in every consuming app before the
  owner tags and publishes it.

## 14. Migration contract

What an app does to move onto the package, one app per change (BRIEF D11):

1. Pin the package and its peers exactly (owner approves the `package.json` change).
2. Create `src/app/editorUi.ts` with `createEditorUi(config)`: identity, menus, contexts,
   module maps (the existing `import.meta.glob` lines), gate and hooks.
3. Delete every file the package replaces (inventory §2); keep the app's region contents,
   tools, panels, dialogs and stores. Imports move to the package's subpaths.
4. Retire the PROVENANCE copy rows and drift entries of the deleted files; the app's notices
   list the package.
5. Its DESIGN.md names the package version it targets and keeps only its own interface.

Acceptance in every migration:

- Persisted names unchanged (§5): an existing user's theme, layout and recent commands load,
  and an installed PWA updates without losing its cache (the app's storage-key and PWA
  update tests).
- The app's `npm run check` and full E2E suite pass with no assertion changed except imports,
  the inventory's listed placeholders, and the menu lists of an app that gains the Help menu
  and About dialog (the tilemap editor), each listed before and after.
- BRIEF §8 budgets met.
