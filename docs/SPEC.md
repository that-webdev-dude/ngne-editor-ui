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
`src/app/editorUi.ts`) and passes it to `UiRoot`; React components read it from context
(`useEditorUi()`), non-React app code imports the app's module.

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
F6 regions, the bottom region's Tab toggle, View → Open Source Licences…) are registered by `createEditorUi` before the app's
modules. There is no theme command: the theme store (`useTheme`, `setTheme`) is exported from
`@ngne/editor-ui`, and each app sets the theme from its Preferences. The theme belongs to the
instance: `useTheme()` reads it from the instance `UiRoot` provides, `setTheme(editorUi, theme)`
sets and stores it.

## 2. Performance

The package has no frame budgets of its own; it must not move the apps' (BRIEF §8).

| Budget | Value | How measured |
| --- | --- | --- |
| App bundle growth at migration | ≤ 2% of the production bundle | Build size before and after, per app |
| App budget rows at migration | No row of the app's ENGINE §6 / SPEC §14 moves beyond its noise | The app's benchmarks, reference hardware, by the owner |
| Command refresh | A store change re-renders only components that read a command whose `enabled()` or `title()` result changed | Render-count test on the gallery |
| Startup | `createEditorUi` with 300 commands and 30 modules per other registry takes ≤ 5 ms | Node benchmark `tests/perf/startup-create-editor-ui.perf.ts` over the synthetic module maps of `tests/perf/fixtures/editorUiModules.ts`, report-only on CI |

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
- Module resolution `NodeNext`: relative imports name the built file (`./x.js`), so the
  `dist/` tree runs unbundled in Node (build helpers) and in the apps' bundlers alike. Three
  `tsc` projects build it, one per runtime: UI, Model and Colour with the DOM library; Worker
  with the WebWorker library; Build with Node's types.
- CSS entry: `dist/styles.css` holds `src/styles/tokens.css`, then `src/styles/base.css`, then
  every other stylesheet under `src/` in path order (UTF-16 code units), each after a comment
  naming it. A stylesheet joins by its path; no list is edited. Package modules import no CSS.
- Development toolchain, pinned exactly: `@axe-core/playwright` 4.13.0, `@eslint/js` 10.0.1,
  `@playwright/test` 1.64.0, `@types/node` 24.19.2, `@types/react` 19.3.0, `@types/react-dom`
  19.3.0, `@vitejs/plugin-react` 6.1.2, `@vitest/coverage-v8` 5.0.3, `eslint` 10.12.0,
  `eslint-plugin-react-hooks` 7.1.1, `fast-check` 4.10.2, `globals` 17.13.0, `prettier`
  3.9.10, `typescript` 5.9.3, `typescript-eslint` 8.71.1, `vite` 8.3.4, `vitest` 5.0.3, and the
  peers at their pinned versions (owner approval 2026-11-15). `playwright-core` is held at the
  version of `@playwright/test` by an `overrides` entry, so axe and the test runner share one
  copy.

| Subpath | Layer | Contents |
| --- | --- | --- |
| `@ngne/editor-ui` | UI | `createEditorUi`, `UiRoot`, `EditorUiConfig` and the types of §5; `persistedNames`, the theme and recent-commands store factories and `DEFAULT_THEME` (§5) |
| `@ngne/editor-ui/styles.css` | Styles | `tokens.css`, `base.css` and every component stylesheet, in one entry |
| `@ngne/editor-ui/styles/check` | Build | `checkStylesheets` (§9.2) |
| `@ngne/editor-ui/primitives` | UI | §9.1 |
| `@ngne/editor-ui/focus` | UI | Modality, inert outside, menu opener, return focus |
| `@ngne/editor-ui/messages` | UI | Toasts, dialog host and registry, notices, discard question, region boundary |
| `@ngne/editor-ui/shell` | UI | §8; the layout store factory (§5) |
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
| `bottomRegion` | Id and label of the bottom region, or `null` for none. The id is lowercase words joined by hyphens and not another region's (§8); the label is in title case | `null` |
| `railFooterHeight` | Height reserved under the tool rail's groups | `0` |
| `modules` | The module maps of §1.3 | Empty maps |
| `refreshOn` | Stores whose change triggers a command refresh | None |
| `commandGate` | Disables the app's commands the gate rejects; the package's commands are outside it, as they act without a document | All enabled |
| `beforeRun` | Runs before every command | None |
| `surfaces` | App surfaces beside the command palette and shortcut sheet | None |

Persisted names keep their current values, so a migrating app keeps its users' data:

| Name | Value | `persistedNames(id)` field |
| --- | --- | --- |
| Theme | `<id>.theme` | `theme` |
| Layout | `<id>.layout`; stored fields unchanged, including `timelineHeight` for the bottom region | `layout` |
| Recent commands | `<id>.recent-commands` | `recentCommands` |
| Cache prefix | `<id>-` | `cachePrefix` |
| Worker messages | `<id>:skip-waiting`, `<id>:started` | `skipWaiting`, `started` |
| Older-windows key | `<id>-older-windows` | `olderWindows` |

An app names them without building an instance: `persistedNames(id)` (`@ngne/editor-ui`)
returns every name of the table for an id; `pwaNames(id)` (`@ngne/editor-ui/pwa`) returns the
worker's part. The instance builds its stores with the factories the package exports, each over
a storage and a key: `createThemeStore` and `createRecentCommandsStore` (`@ngne/editor-ui`),
`createLayoutStore` (`@ngne/editor-ui/shell`). An app's test drives them against a storage of
its own (`KeyValueStorage`; `null` keeps a store in memory). `DEFAULT_THEME` (`@ngne/editor-ui`)
is the theme a missing or unknown stored value gives.

The public API calls the bottom region "bottom" (`BOTTOM_HEIGHT`, `resolveBottomHeight`);
only the stored field keeps its old name.

## 6. Messages, focus and platform

- **Toasts, dialog host, notices, discard question, region boundary:** as the sprite editor at
  the cut. `DiscardChangesRequest` moves with its dialog.
- **Return focus:** pointer activation of a non-text control returns focus to the viewport
  target the app names (`data-viewport-focus`), except inside the app's panel selector: the
  selectors of its focus contexts (`keyContexts.focus`), joined. `UiRoot` applies it for its
  instance; a control inside `[data-keep-focus]` keeps the focus.
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
- The hooks and `contextMenuEntries(menu, commands)` read the registry of the instance
  `UiRoot` provides unless one is passed (`useCommands(registry?)`,
  `useCommandValue(read, registry?)`); `runCommand(registry, id)` takes it, as non-React code
  holds the app's instance. A failing command is reported by an error toast
  (`reportCommandError`); a context menu lists disabled commands, inert.
- `commandGate` and `beforeRun` replace the apps' edits of `appCommands.ts` and `invoke.ts`.
  A command's `enabled()` asks the gate first, then the command's own condition, which may
  assume what the gate checks; `beforeRun` is part of the command's `run`, so every caller
  runs it and what it throws reaches the caller's error handler.
- Registration throws a `RegistrationError` naming the module for a duplicate id, a menu the
  menu bar does not have, an unreadable shortcut or unknown context, and a chord conflict: two
  commands that bind one chord in one context and neither has an `enabled` condition, so both
  are enabled in every state. Commands whose conditions exclude each other may share a chord;
  `findChordConflicts(registry)` reports the enabled commands that share one now, and an app
  runs it in its tests in each state where its enabled commands differ.
- Command palette with fuzzy matching and recent commands; shortcut sheet; open-surface
  tracking with the package's surfaces plus the app's. `SurfaceHost` shows the instance's open
  surface; the app mounts it once under `UiRoot`, outside every region. The package's commands
  keep the apps' ids, so recent commands carry over: `edit.commandPalette`
  (`COMMAND_PALETTE_COMMAND`, Ctrl+K in `global` and `text`) names no menu, and an app places it
  with a planned command of that id; `edit.shortcuts` (`SHORTCUT_SHEET_COMMAND`, `?` in
  `canvas`) places itself in Help.

### 7.2 Keys

- Key classes, chord parsing and display, installation and resolution are the package's.
- Contexts: the package owns `text`, `canvas` and `global`; apps add state contexts (sprite:
  `gesture`, `floating`; tilemap: `gesture`, `markers`) and focus contexts (sprite:
  `timeline`; tilemap: `panel`, each with its focus selector) and give their order.
- Applicable contexts, as today: none while an overlay (menu, dialog, popover) is open; only
  `text` while a text field has focus; otherwise the app's active contexts in their order, then
  `canvas`, then `global`.
- Installation: `UiRoot` installs the keymap for its instance while its `keymap` prop holds
  (default on; an app turns it off while a notice stands in for the editor). The key
  environment is read from the page: the viewport target (`data-viewport-focus`), an open
  overlay (a Radix menu, dialog or list, or `data-keymap-overlay`), a text field, and the
  focused control's native keys and typeahead. A focus context is active while focus is inside
  an element its selector matches; a state context while it is on in the instance's store,
  switched by `setKeyContext(editorUi, context, active)`, which refreshes the commands.
- A key runs the first enabled command bound in the first applicable context that binds it.
  `canvas` takes a native key only while the viewport has focus. A key the focused control
  handles natively, or a typed character during typeahead, is left to the control. A browser
  shortcut bound somewhere but not acting here is suppressed.

## 8. Shell

- **`UiRoot`:** mounts theme, modality, inert-outside, the keymap (§7.2), return focus (§6),
  tooltip provider, dialog host, toasts, and provides the editor UI instance.
- **`AppShell`:** the frame with named slots (BRIEF D17):

| Slot | Filled by the app with |
| --- | --- |
| `menuCentre` | The tab strip, or nothing |
| `railFooter` | Colour chips, stamp preview, … (height `railFooterHeight`) |
| `viewport` | The viewport region content |
| `bottom` | The bottom region content (when `bottomRegion` is set) |
| `noDocument` | What the viewport shows when no document is open; gates the bottom region and the dock: given, it takes the viewport content's place and their frames stay, empty, so the layout does not move when a document opens (as the tilemap editor's no-project gate) |

- **Layout:** minimum window 1280×720; dock width 264 (220–360); bottom-region and rail sizes
  as the sprite editor at the cut; the tool rail full height beside the bottom region, which
  spans the viewport and dock columns (DESIGN §2, BRIEF D22). The splitter sizes are the
  instance's layout store (`editorUi.layout`, under `<id>.layout`). Below 1280×720 `AppShell`
  shows the window-too-small notice and keeps the frame mounted, hidden, so a resize loses no
  state; the app turns the keymap off meanwhile through `UiRoot`'s `keymap` prop
  (`useWindowTooSmall()`), as the sprite editor did.
- **Bottom region:** the region's `data-region` is `bottomRegion.id` and its accessible name
  the label. Whether it is shown is the instance's `editorUi.bottomRegion` store, shown at
  every start and not persisted (`setBottomRegionVisible`). Tab toggles it while the viewport
  has focus (`canvas`): the package command `view.` + the id in camel case, the id both editors
  gave it (`timeline` → `view.timeline`, `bottom-panel` → `view.bottomPanel`), titled
  "Hide <label>" or "Show <label>" by what it will do. It names no menu; an editor places it in
  View with a planned command of that id. An editor without a bottom region has no such
  command.
- **Tool rail:** columns from the tool registry's groups; one or two columns by height. An
  optional filter chooses the tools shown (the tilemap shows the tools of the active layer's
  kind): `AppShell`'s `railFilter`, over the rail's slots; a new function updates the rail and
  its columns. The rail and the context bar read the editor's active-tool store, `AppShell`'s
  `tools` (`ToolStateSource`: the active tool, the variant a slot shows, the option values,
  selecting a tool and setting an option, `subscribe`), as the status bar reads `status`;
  without it they show no tools. A tool chosen with the pointer sends the focus to
  `toolFocus()`, the viewport target (§6) by default; from the keyboard the focus stays.
- **Context bar:** the active tool's options from the registry, then the trigger of the overflow
  menu that holds the options that do not fit (from the last back), then an optional trailing
  readouts slot (`contextReadouts`, the tilemap's tool readouts), never in the overflow menu.
  `*.contextbar.tsx` content, while shown, takes the place of the options and the readouts.
- **Dock, menu bar:** from their registries; menus from the command registry.
- **Status bar:** the frame renders the `*.status.ts` fields in registry order, left to right,
  then the hint on the right; a field declares its reserved width. What the fields read and the
  hint come from `AppShell`'s `status` prop, a `StatusBarSource` the app keeps (`read()` the
  fields' input, `hint()` the hint, `subscribe(listener)`), as both editors fed their bars from
  their stores; the bar renders again only when a shown text changes. The hint is
  `{ text, kind }`: `feedback` (transient tool feedback) in `--warn`, `hint` in the bar's
  colour. Without `status` the fields read `undefined` and no hint is shown. A field's
  `action` is its command as a quiet button right after the field's text ("Fit" after the
  zoom), shown while the field has text, with the command's title. The button carries
  `data-status-action="<field id>"`: the field's own id, the one in its `data-status`, never
  the command's id or name. The marker is a public DOM hook; an editor's tests locate the
  button and order the bar's parts by it.
- **Tab strip (BRIEF D18):** presentational. The app passes items (`id`, `label`, `tooltip`,
  `dirty`), the active id, a leading label (project name, with its unsaved marker, as the
  tilemap editor shows it) and callbacks (`activate`, `close`, `move`); the strip owns metrics,
  keyboard (arrows, Home, End, Delete), drag to reorder and the overflow menu, whose label the
  app passes, as it passes the tab list's accessible name. `move(id, index)` receives the
  tab's place once moved. `close` may return a promise, for an editor that asks first; after
  Delete the focus goes to the tab now in the closed one's place, or the one before it, or
  with none left to the viewport target (`data-viewport-focus`).
- **Tools (BRIEF D18):** `ToolBase` holds what the rail and context bar need: id, title
  (`label`), icon, key (`shortcut`, and a `hold` key), group (`railOrder`, whose hundreds are
  the rail's groups), variant-of (`variantOf`), option specs (`options`). Apps extend it with
  pointer and stroke behaviour; the registry is generic over `Tool extends ToolBase`. A key that
  two tools or planned slots use is refused at registration.
- **F6 regions:** found by `data-region`; F6 / Shift+F6 cycle them (`focus.nextRegion`,
  `focus.previousRegion`, in `global` and `text`, the editors' ids).

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
- `paths` are files, read relative to the working directory; the app lists them (no directory
  search). A file named `tokens.css` is skipped. A raw colour is a hex colour, a colour function
  (`rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, `color()`,
  `color-mix()`, `light-dark()`) or a named or system colour in a declaration value, a
  `var()` fallback included; comments, strings and `url()` are not read, and `transparent`,
  `currentColor` and `var(--…)` are not raw colours. It throws one error listing every offence
  as `file:line property: value (colour)`; an empty list or an unreadable file throws too.

## 10. PWA

- **Window side:** update detection, the update toast ("A new version of the editor is
  ready."), skip-waiting and started messages named from `id`.
- **Worker side:** `installServiceWorker({ id, manifest })` holds the sprite editor's `sw.ts`
  logic; the app's worker entry calls it with `self.__WB_MANIFEST`, which the app's
  `vite-plugin-pwa` build injects.

## 11. About and licences

- **Help menu:** Keyboard Shortcuts… (`?`) first, at menu order 0; About <productName>… last,
  in a group of its own; app commands placed in Help go between them, at orders above 0.
- **About dialog:** as DESIGN §7, from the `about` config and `productName`; the instance's
  `about` surface (§7.1), which `SurfaceHost` shows, so an app's surface takes another id. The
  About command keeps the sprite editor's id `help.about` (`ABOUT_COMMAND`). `about/build`
  exports `appInfoDefines(packageJsonPath)`, which reads the app's `package.json` (name,
  version, licence, the pinned `@ngne/core`) into the build-time constants `APP_PACKAGE`,
  `APP_VERSION`, `APP_LICENSE`, `ENGINE_PACKAGE`, `ENGINE_VERSION` for the app's
  `vite.config.ts`, so a release that bumps `package.json` changes the dialog with no other
  edit.
- **Licences dialog and command:** View → Open Source Licences…, last group of the View menu, enabled
  without a document; shows `licences.txt` from beside `index.html` (resolved against the
  page's base URL). The command keeps the editors' id `app.licences` (`LICENCES_COMMAND`). The
  text sits in a section labelled "Licence text", which scrolls; when the file cannot be read,
  the line names the editor (`productName`) and links the file. The dialog is a package dialog
  module (`licences`): `createEditorUi` collects it with the editor's `*.dialog.tsx` modules, so
  an editor's dialog of that kind fails at startup, naming the editor's module.
- **Build helper:** `generateLicences(options)` writes `licences.txt` from the lockfile and
  the bundle. Options: project licence and notices paths, title, build-only packages listed
  outside the stray check (rolldown), excluded-code rules (gifenc's quantizer in the sprite
  editor), licence allowlist, stand-in licence texts. It fails on a bundled package missing
  from the list, a listed package no longer bundled, a missing licence text, a licence outside
  the allowlist, or excluded code found in the bundle. A build may bundle the lockfile's
  runtime dependencies and the project's peer dependencies with every package they require
  (a library's own site, such as this repository's gallery; an app has no peers); code of any
  other package fails it.
- The approved stand-in text for `react-remove-scroll-bar` 2.3.8 ships with the helper.

## 12. Gallery

- Renders every export of §4 in both themes, with the app's own entries appended when an app
  mounts it (`<Gallery entries={…} />`).
- This repository's Pages site serves the gallery from each release tag (BRIEF D13).
- The frame shows one theme at a time, switched in its header for the whole document (so
  surfaces rendered outside the frame follow it), with one section per entry and a link to
  `licences.txt` beside the page. The switch is the gallery's own and stores nothing.
- The site has a second page, `demo/`: the demo editor (`gallery/demo/`), with its own
  `createEditorUi` configuration and module maps from `import.meta.glob`, as an app writes
  them, mounted through `UiRoot`. Its theme is the instance's, stored under its id. The site's
  build copies `licences.txt` beside `demo/index.html`, which the demo's View → Open Source
  Licences… shows.
- The site under `gallery/` imports the package only through its subpaths and runs the built
  package; its CSS is not minified, so the Tokens entry shows values as `tokens.css` writes
  them, and its build adds no module-preload polyfill.

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
