# NGNE Editor UI — Brief

## 1. Summary

`ngne-editor-ui` is the shared interface package of the NGNE editor suite: design tokens,
primitives, the application shell, the registries every editor builds on, and the suite's
design canon. The NGNE Sprite Editor and NGNE Tilemap Editor share this code today as
verbatim and adapted copies (tilemap DESIGN §3.2–3.3, drift-checked); the NGNE Game Editor
will consume it from its scaffold. Apps pin it exactly and keep only their own
interface in their DESIGN.md.

| Item | Value |
| --- | --- |
| Repository | `ngne-editor-ui`, public |
| npm name | `@ngne/editor-ui` (D9) |
| Licence | MIT, "Copyright (c) 2026 Fabio Barracano" (§5) |
| Consumers | NGNE Sprite Editor, NGNE Tilemap Editor, NGNE Game Editor |
| Visual canon | The gallery, deployed to Pages: every token and component in both themes |

## 2. Goals (v1)

1. One source for the suite's look and manners: tokens, type, space, motion, icons,
   components, message channels, focus and keyboard rules, accessibility rules.
2. Replace the copies: every file that tilemap DESIGN §3.2 lists as verbatim, and the
   §3.3 adapted ones whose change is only a name, a storage key or a list, come from the
   package; the drift check and PROVENANCE copy rows for them retire.
3. Parametrise identity instead of adapting files: product name, storage-key prefix, cache
   names, menu bar, key contexts and dock sections are passed in by the app.
4. The game editor scaffolds on it (WORKFLOW §5 item 2) with no copied UI file.
5. v1.0 is reached when all three apps consume the same version and none carries a copy of a
   package file.

## 3. Non-goals (v1)

- Domain code: the sprite core (`core/sprite`, 59 files in the tilemap), codecs, compositor,
  tools' behaviour. A later `ngne-sprite-core` package may take the sprite core.
- Anything that imports `@ngne/core`: the viewport, renderer lifecycle, preview. The package
  never depends on the engine.
- App panels, menus' contents, tools, dialogs specific to one app.
- A general-purpose component library for other products; it serves the suite only.
- Theming beyond the suite's dark and light sets.

## 4. Feature scope

Grouped by the package's own layers (SPEC §1 will fix them). Sources are sprite editor paths
under `src/`, as tilemap DESIGN §3.2–3.3 lists them.

| Group | Contents |
| --- | --- |
| Styles | `tokens.css` (only file with raw colours), `base.css`, the token test |
| Primitives | Button, IconButton, ToolButton, Toggle, SegmentedControl, NumberField, Slider, Select, Popover, Dialog, ContextMenu, Tooltip, Splitter, the `Icon` wrapper over `lucide-react`, popovers that apply on close |
| Focus | Modality, inert outside, menu opener, return focus to the viewport (panel selector and focus target passed in) |
| Messages | Toasts; dialog host and `*.dialog.tsx` registry; notices (WebGPU required, window too small); discard-changes question; region error boundary |
| Shell | `UiRoot`; `AppShell` frame with named slots (D17); region layout and sizes; menu bar from the command registry; presentational tab strip (D18); dock sections and `*.dock.tsx` registry; context bar and generic tool registry (D18); status bar frame and `*.status.ts` field registry (D15); F6 regions |
| Commands and keys | Command registry, menu model, chords and their display, key classes, base contexts and resolution (D16), command palette with fuzzy matching and recent commands, shortcut sheet, open-surface tracking |
| Overlay and view | `*.overlay.ts` layer registry with draw orders, wheel → zoom and pan steps |
| Platform and PWA | Window size, WebGPU check, storage access, PWA update toast and flow, precache naming |
| About | Help menu frame (Keyboard Shortcuts… first, About last); About dialog from the app's build facts; the build helper that puts them in |
| Licences | View → Open Source Licences… dialog; the build helper that generates `licences.txt` from the lockfile and fails on a missing or unlisted package |
| Colour | Colour maths (`hex`, `hsv`, `rgba`, `oklab`, `contrast`) and the `#rrggbb` text format, under its own subpath (D12) |
| Gallery | The dev gallery, extended to every export, deployed as the visual canon |
| Canon docs | `docs/DESIGN.md`: principles, tokens, components, overflow rules, shared surfaces, viewport chrome rules, interaction rules, accessibility; merged from sprite DESIGN §1–4, §6–8 and tilemap SUITE §1–4 |

Later (not v1): the colour picker (D19), the app icon generator (7×7 mark grid, `--accent`),
shared Playwright helpers (`settleTimers`, readback), the sprite core.

## 5. Licences

- Package licence: MIT, as both editors. It generates no code into users' projects, so no
  generated-code licence is needed.
- The first version is moved from the sprite editor, the owner's own MIT code, at a named
  commit. The sprite editor has no full licence audit recorded and records Aseprite source as
  read without approval (its PROVENANCE, Owner decisions 2026-11-13). The first full audit of
  this package (WORKFLOW §4, before the first publish or deploy) therefore classifies every
  moved file, with the sprite editor's PROVENANCE as input.
- `licenses.md` applies: the package is built from files of a repository that itself carries
  upstream code (its Scope, third criterion).
- Upstreams: none expected beyond npm dependencies. Any file found to derive from an upstream
  gets a PROVENANCE row and its notice, or is rewritten.
- Notices: the package ships its own `THIRD_PARTY_NOTICES.md`; apps list it with their other
  bundled packages through their generated `licences.txt`.

## 6. Decisions

| # | Decision | Reason |
| --- | --- | --- |
| D1 | A separate public repository, `ngne-editor-ui` | Owner, 2026-11-15: the canon lives in code, apps adopt changes by version |
| D2 | No dependency on `@ngne/core`; no domain code | Keeps the package releasable on its own and usable by every editor whatever its engine version |
| D3 | Identity and app lists are parameters, never edits | Removes the "adapt" class of copies; a consumer never forks a package file |
| D4 | `react`, `react-dom`, `radix-ui`, `lucide-react` and `zustand` (toasts and surface tracking use it) are peer dependencies; apps pin them and the package exactly | One copy of React and Radix per app; exact pins as SUITE §5 requires |
| D5 | Ships compiled ESM, type declarations and one CSS entry, with subpath exports per group of §4 | Apps import only what they use; no source compilation in consumers |
| D6 | The canon DESIGN.md lives here; each app's DESIGN.md names the package version it targets and holds only its deltas | Owner, 2026-11-15 |
| D7 | Semantic versions; 0.x until v1.0 (§2 goal 5); a token or component change that alters an app's look is at least a minor version with a CHANGELOG entry and gallery update | Apps see every design change as a deliberate bump |
| D8 | The first version is cut from the sprite editor at a named commit; once cut, shared files change only here, and neither editor edits its copies until it migrates | One source from day one; no third drift path |
| D9 | npm name `@ngne/editor-ui`, beside `@ngne/core`; the owner can publish under the `@ngne` scope | Owner, 2026-11-15: scope access confirmed before EU-001 |
| D10 | Built with `tsc` (JS and declarations) plus a CSS copy step; no bundler | Apps bundle; the package stays a plain ESM tree |
| D11 | Order: package v0.1 → sprite editor migration → tilemap editor migration, one change per app; the game editor scaffolds on the published package, with no copies, once its repository exists; an app's migration merges only after its release hold is lifted, or waits on its branch | Each released app moves alone; owner, 2026-11-26: the game editor's repository does not exist yet, and the migrations do not wait on it |
| D12 | Colour maths is in v1, under its own subpath | Every editor's pickers need it; it has no domain meaning |
| D13 | The gallery is deployed to this repo's Pages on each `v*` release tag and by manual dispatch from `main`; never on every push | It is the visual canon reviewers compare against; the walking skeleton needs one deploy before the first tag |
| D14 | The cut is the sprite editor's HEAD at cut time plus the tilemap's fixes to shared files: time-limited WebGPU check, command-refresh tracker, licences dialog accessible region, locale-independent module sort, `Readonly` props. Each taken fix is recorded in PROVENANCE and covered by a test | Owner, 2026-11-15: keeps both apps' fixes (inventory §3, §7) |
| D15 | Registries are factories that take the app's `import.meta.glob` module map; the app keeps the one-line glob. Status-bar fields are such a registry (`*.status.ts`) | Owner, 2026-11-15: a compiled package cannot glob the app (D10); registration rules unchanged |
| D16 | The package owns the command registry, chords, key classes, the `text`, `canvas` and `global` contexts and key resolution; apps pass their ordered context list, state contexts, focus selectors and menu bar | Owner, 2026-11-15: resolver and key classes are identical in both apps; only the lists differ |
| D17 | `AppShell` is a frame with named slots (menu centre, rail footer, bottom region, region contents, "no document" gate); region contents, including the viewport, stay in the apps | Owner, 2026-11-15 |
| D18 | v1 includes a presentational tab strip (keys, drag, overflow; items, labels and close policy passed in) and a tool registry generic over a package `ToolBase`; pointer and stroke types stay in the apps | Owner, 2026-11-15: the game editor needs both |
| D19 | The colour picker comes after v1. The About dialog and the Help menu are suite-wide: every editor has them, from the package | Owner, 2026-11-15: every app shows its version, engine and licence the same way |
| D20 | At the cut, source comments cite this package's docs and carry no app ticket or issue IDs | Owner, 2026-11-15: app references would mislead in this repository |
| D21 | `oklab.ts` is not moved: EU-004 rewrites it clean-room, by an implementer given only the published OKLab matrices and formulas, the sRGB standard and the behaviour tests, never the sprite editor's file or the post's code; the rewrite is recorded in PROVENANCE §3 | Owner, 2026-11-15: whether the post's code was read is not known (licenses.md §2), and a pending file would block the release |
| D22 | The canon layout puts the tool rail full height beside the bottom region, which spans the viewport and dock columns (DESIGN §2, the tilemap's grid); the sprite editor's timeline moves beside the rail at its migration, listed as a visible change | Owner, 2026-11-15 |
| D23 | The consumer trials (EU-025, EU-026) are committed by the owner, unmerged, as each editor's migration branch | Owner, 2026-11-15: the trial is the migration's starting point |
| D24 | The package exports the persisted names (derived from `id`), the theme, layout and recent-commands store factories with injectable storage, and `DEFAULT_THEME` | Owner, 2026-11-22: the editors' storage-key, preferences and PWA tests check the package's own names and stores (GAP-01) |
| D25 | `createEditorUi` takes optional app-created state sources (state contexts, bottom-region visibility) and the tool registry the app creates with the package factory; app modules run commands without importing the instance | Owner, 2026-11-22: removes the load-order cycle and the second tool catalogue both trials needed (GAP-03, GAP-04) |
| D26 | Tools and planned slots declare the tool sets they belong to; a key must be unique within a set, not across sets | Owner, 2026-11-22: the tilemap's per-layer-kind sets share keys by design; a clash inside one set stays refused (GAP-05) |
| D27 | A tool may declare context bar command buttons, drawn by the package; a tool's variant choice stays in the readouts slot | Owner, 2026-11-22: every editor's tools may need actions; only the tilemap has variants so far (GAP-06) |
| D28 | A status field's action button is marked `data-status-action` with the field id, a public DOM hook | Owner, 2026-11-22: no API field for one editor's two locators; the sprite's specs change at its migration (GAP-07) |
| D29 | The licence build helper checks the service-worker bundle, licence texts against declared licences, module placement and the written list against the bundle, and exports these checks for tests | Owner, 2026-11-22: licenses.md §5 asks for these failures; both editors had them before the move (GAP-08) |
| D30 | The gallery's styles ship as a separate stylesheet export, imported only by an app's development gallery route; `styles.css` carries none | Owner, 2026-11-22: keeps the gallery out of every editor's bundle (GAP-09) |
| D31 | SPEC §14 names the kinds of test change a migration may make, each listed before and after. App tests of replaced modules are retired against a named package test on the owner's approved list or rewritten against the public API; internals are never exported for tests. App unit tests that need fresh package state inline the package in Vitest | Owner, 2026-11-22: neither trial could meet the import-only contract (GAP-02, GAP-10, GAP-14) |

## 7. Consumers and migration

| App | Today | Migration |
| --- | --- | --- |
| Sprite editor | Owns the source files | Replace the files by imports; keep app-specific ones; full E2E suite; cold-load and tab-switch rows re-measured |
| Tilemap editor | Verbatim and adapted copies from sprite commits `ea5c91d` (351 PROVENANCE references) and `4987001` (12, the licences dialog) | Same; verbatim PROVENANCE rows and `npm run drift` entries for these files retire; `te-002-provenance` keeps covering the sprite core |
| Game editor | Not started | Consumes the package from its first ticket |

Each migration is a stack change in that app (`package.json`), approved by the owner, and
touches startup, layout and the shell, so it runs the app's full E2E suite.

## 8. Quality and budgets

- Unit tests (Vitest) for the pure modules; Playwright with axe on the gallery for every
  component, in both themes, at 1280×720 and 125% zoom.
- Each consumer's E2E suite is the integration test: a release candidate is tried in all
  consuming apps before it is tagged.
- Budgets: an app's migration moves no ENGINE §6 / SPEC §14 row of that app beyond its noise,
  and its production bundle grows by no more than 2%. Measured by the owner on reference
  hardware.

## 9. Workflow

The kit's workflow, reduced for a library:

- Phase 1 is an inventory, not a behaviour study: every shared file, its consumers, and the
  adaptations each app made (tilemap DESIGN §3.2–3.5, sprite editor sources).
- Docs set: BRIEF, SPEC (layers, public API, parameters, exports, versioning), DESIGN (the
  canon), MIGRATION (adopting and upgrading in an editor), PROVENANCE, README (install and
  use). No FORMAT, ENGINE or GUIDE.
- The first full licence audit comes before the first npm publish and the first gallery deploy.
- npm publish, tags and deploys are owner actions.
