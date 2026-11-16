# Provenance

Where the code of this package comes from, how each file is classified, and the audits of that
classification. Licence texts and copyright lines are in `THIRD_PARTY_NOTICES.md`, which the
package ships; this file is not shipped. `licenses.md` applies to this repository (BRIEF §5).

Classes: **independent** (written for the suite, no upstream), **behaviour-dictated** (its form
follows a published standard or formula), **derived and noticed** (from a permissive upstream,
with its notice), **pending** (not yet classified by an audit). Copyleft, restricted or unknown
sources are never copied, ported or translated.

## 1. Upstream register

| Upstream | URL | Version | Licence | Class | Used in |
| --- | --- | --- | --- | --- | --- |
| NGNE Sprite Editor (owner's own code) | <https://github.com/that-webdev-dude/ngne-sprite-editor> | `f681adc`, the cut commit (§2) | MIT, Copyright (c) 2026 Fabio Barracano | Permissive, same holder | Every file of the first version |
| NGNE Tilemap Editor (owner's own code) | <https://github.com/that-webdev-dude/ngne-tilemap-editor> | `eb07938`, the commit of the taken fixes (§2) | MIT, Copyright (c) 2026 Fabio Barracano | Permissive, same holder | The fixes of BRIEF D14 |
| OKLab (Björn Ottosson, "A perceptual color space for image processing", 2020) | <https://bottosson.github.io/posts/oklab/> | 2020 post | Matrices and formulas only (published constants); the post's code is not used | Behaviour-dictated, clean-room rewrite (D21) | `src/colour/oklab.ts` |
| WCAG 2.1 relative luminance and contrast ratio | <https://www.w3.org/TR/WCAG21/> | 2.1 | W3C document (formula only) | Behaviour-dictated | `src/colour/contrast.ts` |
| sRGB transfer functions (IEC 61966-2-1) | — | 1999 | Standard (formula only) | Behaviour-dictated | `src/colour/oklab.ts`, `src/colour/contrast.ts` |
| `react-remove-scroll-bar` licence text (stand-in) | <https://github.com/theKashey/react-remove-scroll-bar> | `LICENSE` at commit `7301c160` | MIT, Copyright (c) 2025 Anton Korzunov | Data, approved stand-in | `src/build/licence-texts/react-remove-scroll-bar.txt` |

The sprite editor's own upstreams (Aseprite Document Library, pixman, Allegro 4, Zingl) and its
restricted Aseprite application code reach none of the files in scope: none of them appears in
the sprite editor's PROVENANCE Files table, and none names Aseprite (inventory §7, at sprite
commit `f681adc`). The first full audit confirms this per file (§3).

## 2. Copies

Filled by the cut (BRIEF D8, D14): one row per file, written in the cut change.

| Package file | Source repository | Source path | Source commit | Change at the cut | Class |
| --- | --- | --- | --- | --- | --- |
| `.gitattributes` | NGNE Sprite Editor | `.gitattributes` | `f681adc` | none | derived and noticed |
| `.gitignore` | NGNE Sprite Editor | `.gitignore` | `f681adc` | The app's test-output entry dropped; `*.tgz` added for the packed package | derived and noticed |
| `.prettierrc.json` | NGNE Sprite Editor | `.prettierrc.json` | `f681adc` | none | derived and noticed |
| `docs/DESIGN.md` | NGNE Sprite Editor | `docs/DESIGN.md` | `f681adc` | §1–4 and §8 merged into the canon with the tilemap's SUITE §1–4; principle 4 rewritten; no reference program named | derived and noticed |
| `eslint.config.js` | NGNE Tilemap Editor | `eslint.config.js` | `eb07938` | The base configuration kept; the app's rules replaced by the layer import rule of SPEC §1.1 | derived and noticed |
| `playwright.config.ts` | NGNE Sprite Editor | `playwright.config.ts` | `f681adc` | The free-port and launch settings kept; the app's projects dropped; the gallery's preview as the web server | derived and noticed |
| `src/build/licence-texts/react-remove-scroll-bar.txt` | NGNE Sprite Editor | `scripts/licence-texts/react-remove-scroll-bar.txt` | `f681adc` | none | derived and noticed |
| `src/build/licences/licences.ts` | NGNE Sprite Editor | `scripts/licences.ts` | `f681adc` | App lists made options (allowlist, excluded code, stand-in directories, licence and notices paths); package and module order by code unit instead of locale; comment references rewritten to this package's docs | derived and noticed |
| `src/build/licences/licences.ts` | NGNE Tilemap Editor | `scripts/licences.ts` | `eb07938` | Tilemap fix taken: build-only packages (`BUILD_PACKAGES`, now an option) and `THIRD-PARTY-LICENSE` files; test `licences-build-generator` (`buildPackageDirs`, `readPackageLicence`) | derived and noticed |
| `src/build/licences/plugin.ts` | NGNE Sprite Editor | `vite.config.ts` | `f681adc` | The app's module collection, excluded-code check, stray check and development-server route moved into `generateLicences(options)` | derived and noticed |
| `src/build/licences/plugin.ts` | NGNE Tilemap Editor | `vite.config.ts` | `eb07938` | Tilemap fix taken: build-only packages added to the listed packages (`withBuildPackages`); test `licences-build-generator` (`buildPackageDirs`) | derived and noticed |
| `src/colour/contrast.ts` | NGNE Sprite Editor | `src/core/color/contrast.ts` | `f681adc` | Comment references rewritten to this package's docs and WCAG 2.1; the app's label use left out of the comments | derived and noticed |
| `src/colour/hex.ts` | NGNE Sprite Editor | `src/core/color/hex.ts` | `f681adc` | Comment references rewritten to this package's docs; `Number.parseInt` for the global `parseInt` | derived and noticed |
| `src/colour/hexColour.ts` | NGNE Sprite Editor | `src/ui/preferences/hexColour.ts` | `f681adc` | Moved from the UI to the colour layer; header comment rewritten to this package's docs; `Number.parseInt` for the global `parseInt` | derived and noticed |
| `src/colour/hsv.ts` | NGNE Sprite Editor | `src/core/color/hsv.ts` | `f681adc` | Comment references rewritten to this package's docs | derived and noticed |
| `src/colour/index.ts` | NGNE Sprite Editor | `src/core/color/index.ts` | `f681adc` | Exports of `contrast.ts` and `hexColour.ts` added; the OKLab names re-exported from the clean-room `oklab.ts` (§3); import paths name the built file (`./x.js`); header comment added | derived and noticed |
| `src/colour/rgba.ts` | NGNE Sprite Editor | `src/core/color/rgba.ts` | `f681adc` | Comment references rewritten to this package's docs | derived and noticed |
| `src/model/commands/chord.ts` | NGNE Sprite Editor | `src/app/commands/chord.ts` | `f681adc` | Header comment cites SPEC §7.2; the event-key spellings a map and the modifier names a set | derived and noticed |
| `src/model/commands/contexts.ts` | NGNE Sprite Editor | `src/app/commands/types.ts` | `f681adc` | The app's `KEY_CONTEXTS` list made `keyContextOrder`, which puts the editor's contexts between `text` and `canvas`, `global` (BRIEF D16) and refuses an empty, repeated or package context | derived and noticed |
| `src/model/commands/fuzzy.ts` | NGNE Sprite Editor | `src/app/commandPalette/fuzzy.ts` | `f681adc` | none | derived and noticed |
| `src/model/commands/invoke.ts` | NGNE Sprite Editor | `src/app/commands/invoke.ts` | `f681adc` | The playback stop replaced by the registry's `beforeRun`, part of the command's `run`; generic over the editor's menus and contexts; comment rewritten to this package's docs | derived and noticed |
| `src/model/commands/keyClasses.ts` | NGNE Sprite Editor | `src/app/keymap/keyClasses.ts` | `f681adc` | Moved beside the chords; import path names the built file; comments cite SPEC §7.2 | derived and noticed |
| `src/model/commands/menuModel.ts` | NGNE Sprite Editor | `src/app/commands/menuModel.ts` | `f681adc` | Generic over the editor's menus and contexts; ties by the shared code-unit comparison; `buildMenuBar` (menus in the editor's order) and `menuBarProblems` (DESIGN §8: a View menu, Help last) added | derived and noticed |
| `src/model/commands/palette.ts` | NGNE Sprite Editor | `src/app/commandPalette/paletteModel.ts` | `f681adc` | `MENU_BAR` replaced by the editor's `menus`, a parameter of `paletteEntries`; generic over the editor's menus and contexts; the recent list a required parameter of `runPaletteCommand` (`RecentCommandsRecorder`) instead of the module-level store; each row flags whether its command was enabled (`enabled`); equal titles by id in code-unit order; import paths name the built file; header comment added | derived and noticed |
| `src/model/commands/recentCommands.ts` | NGNE Sprite Editor | `src/app/commandPalette/recentCommands.ts` | `f681adc` | The list's rules only (`MAX_RECENT_COMMANDS`, `parseRecentCommands`, `withRecentCommand` for the store's record step); the fixed storage key and the `zustand` store left to the editor UI instance (SPEC §1.2, §5); the storage and the key parameters of `readRecentCommands` and `writeRecentCommands`, which take the storage helpers' read and best-effort write, a failed write handed to a callback instead of the app's storage-failure notice; comment references rewritten to this package's docs | derived and noticed |
| `src/model/commands/registry.ts` | NGNE Sprite Editor | `src/app/commands/registry.ts` | `f681adc` | `MENU_BAR` and `KEY_CONTEXTS` made the options `menus` and `contexts`, `commandGate` and `beforeRun` added (SPEC §5); `CommandRegistryError` replaced by the shared `RegistrationError`; `registerCommandModules` over a module map through the shared `registerModules`; a chord two commands without a condition share in one context refused at registration (SPEC §7.1); `findChordConflicts` over the registry's contexts; comments rewritten to this package's docs | derived and noticed |
| `src/model/commands/registry.ts` | NGNE Tilemap Editor | `src/app/commands/appCommands.ts` | `eb07938` | The project gate (`withProjectGate`) made the `commandGate` option, asked before the command's own condition; test `commands-registry` (command gate) | derived and noticed |
| `src/model/commands/resolve.ts` | NGNE Sprite Editor | `src/app/keymap/resolve.ts` | `f681adc` | The environment's context flags (`inTimeline`, `gesture`, `floating`) replaced by the active editor contexts, passed as a list; `applicableContexts` over the registry's context order; comments cite SPEC §7.2 | derived and noticed |
| `src/model/commands/shortcutSheet.ts` | NGNE Sprite Editor | `src/app/shortcuts/shortcutSheet.ts` | `f681adc` | `MENU_BAR` replaced by the editor's `menus`, a parameter of `shortcutGroups`; generic over the editor's menus and contexts, a group titled by a menu or `OTHER_SHORTCUTS`; equal titles by id in code-unit order; import paths name the built file; comment references rewritten to this package's docs | derived and noticed |
| `src/model/commands/types.ts` | NGNE Sprite Editor | `src/app/commands/types.ts` | `f681adc` | Generic over the editor's menus and contexts instead of `MENU_BAR` and `KEY_CONTEXTS`; `BASE_CONTEXTS` and `MenuPath` added; comments rewritten to this package's docs | derived and noticed |
| `src/model/modules.ts` | NGNE Sprite Editor | `src/app/overlay/overlayLayers.ts` | `f681adc` | The validation of `collectOverlayLayers` (missing export, id, finite order, an id used twice naming both modules) made one step shared by every registry factory, over module maps instead of a glob, throwing `RegistrationError` with the module's path; `registerModules` added for registries that register module by module | derived and noticed |
| `src/model/modules.ts` | NGNE Tilemap Editor | `src/app/commands/appCommands.ts` | `eb07938` | Tilemap fix taken: module paths ordered by UTF-16 code unit, not by locale (`commandModulePaths`, as `toolModulePaths` in `src/app/tools/toolRegistry.ts`); the tilemap has no test for it, so test `registries-module-order` is written here | derived and noticed |
| `src/model/overlay/layers.ts` | NGNE Sprite Editor | `src/app/overlay/overlayLayers.ts` | `f681adc` | Glob replaced by a module map; generic over the editor's frame type; `OverlayLayerError` replaced by the shared `RegistrationError`; comment references rewritten to this package's docs | derived and noticed |
| `src/model/overlay/layers.ts` | NGNE Sprite Editor | `src/app/overlay/types.ts` | `f681adc` | `OverlayLayer` and `OverlayLayerModule` only, generic over the frame; the frame, cursor and theme types stay in the editor; draw orders cited to DESIGN §6 | derived and noticed |
| `src/model/overlay/wheel.ts` | NGNE Sprite Editor | `src/app/view/wheel.ts` | `f681adc` | Header comment rewritten to this package's docs | derived and noticed |
| `src/model/registries/contextBar.ts` | NGNE Sprite Editor | `src/ui/tools/contextBarRegistry.ts` | `f681adc` | Moved from the UI to the model layer, generic over the component type; glob and module-level registry replaced by a module map, so `shownContextBarContent` and `subscribeContextBarContent` take the entries; shared validation (an id and a finite order are checked as well); equal orders by id in code-unit order instead of `localeCompare`; comment references rewritten | derived and noticed |
| `src/model/registries/dialogs.ts` | NGNE Sprite Editor | `src/ui/dialogs/registry.ts` | `f681adc` | Moved from the UI to the model layer, generic over the component type; glob and module-level registry replaced by a module map; the `commandDialog` helper, typed by a React component and the request type, left to the messages subpath; shared validation (a kind is checked as well, an export that is not a list is refused); comment references rewritten | derived and noticed |
| `src/model/registries/dock.ts` | NGNE Sprite Editor | `src/ui/dock/registry.ts` | `f681adc` | Moved from the UI to the model layer, generic over the component type; glob and module-level registry replaced by a module map; shared validation (an id and a finite order are checked as well); equal orders by id in code-unit order instead of `localeCompare`; comment references rewritten | derived and noticed |
| `src/model/registries/dock.ts` | NGNE Sprite Editor | `src/ui/shell/regions/Dock.tsx` | `f681adc` | The default-collapsed rule only, as `collapsedByDefault` | derived and noticed |
| `src/model/registries/statusFields.ts` | NGNE Tilemap Editor | `src/ui/status/statusFields.ts` | `eb07938` | Tilemap registry taken (BRIEF D15): glob replaced by a module map; generic over what a field reads instead of the tilemap's session, map and cursor; `StatusFieldError` replaced by the shared `RegistrationError`; comment references rewritten; test `registries-status-fields` (from `te-014-status`) | derived and noticed |
| `src/model/tools/registry.ts` | NGNE Sprite Editor | `src/app/tools/registry.ts` | `f681adc` | Generic over the editor's tool type (`Tool extends ToolBase`, BRIEF D18), tools handed back as `RegisteredTool<Tool>`; `ToolRegistryError` replaced by the shared `RegistrationError`; `registerToolModules` over a module map through the shared `registerModules`; a key that two tools or planned slots use refused at registration, and a planned slot's key checked as a chord; ties by the shared code-unit comparison; comments rewritten to this package's docs | derived and noticed |
| `src/model/tools/registry.ts` | NGNE Tilemap Editor | `src/app/tools/toolRegistry.ts` | `eb07938` | Tilemap fix taken: tool module paths ordered by UTF-16 code unit with a compare function (`toolModulePaths`), here in `registerToolModules` through the shared `orderedModules`; the tilemap has no test for it, so test `tools-module-order` is written here | derived and noticed |
| `src/model/tools/types.ts` | NGNE Sprite Editor | `src/app/tools/types.ts` | `f681adc` | The parts the rail and the context bar read only, as `ToolBase` (id, label, icon, shortcut, hold key, rail position, variant-of, options), generic over the icon type instead of `LucideIcon`; the option specs unchanged; `Tool` made `RegisteredTool<Tool>`, and `PlannedToolSpec`, `ToolModule` and `RailSlot` generic over the editor's tool or icon type; the pointer, key, stroke, context, cursor and handler types and the hold condition left to the editor (BRIEF D18); comments rewritten to this package's docs | derived and noticed |
| `src/model/tools/types.ts` | NGNE Sprite Editor | `src/app/tools/toolRegistry.ts` | `f681adc` | Its account of how a module adds a tool, in the header comment, for a module map instead of the glob; the glob and the module-level registry left to the editor (BRIEF D15) | derived and noticed |
| `src/styles/base.css` | NGNE Sprite Editor | `src/ui/styles/base.css` | `f681adc` | Comment references rewritten to this package's docs; a header comment added | derived and noticed |
| `src/styles/tokens.css` | NGNE Sprite Editor | `src/ui/styles/tokens.css` | `f681adc` | Comment references rewritten to this package's docs | derived and noticed |
| `src/ui/gallery/Gallery.tsx` | NGNE Sprite Editor | `src/ui/gallery/Gallery.tsx` | `f681adc` | Frame only: the header and one section per entry kept, the primitive demos, theme store and toasts dropped; entries from a list (`entries.ts`); the theme switch made the frame's own radio group; the licences link and input modality added | derived and noticed |
| `src/ui/gallery/gallery.css` | NGNE Sprite Editor | `src/ui/gallery/gallery.css` | `f681adc` | Frame rules kept, demo rules dropped; theme switch, licences link and Tokens entry rules added | derived and noticed |
| `tests/e2e/gallery.spec.ts` | NGNE Sprite Editor | `tests/e2e/se-006-gallery.spec.ts` | `f681adc` | The axe audit and its on-screen check kept; the primitive, theme-store and keyboard cases left to their entries; Tokens entry, window-size and licences-link cases written for the package | derived and noticed |
| `tests/unit/colour-contrast.test.ts` | NGNE Sprite Editor | `tests/unit/se-023-contrast.test.ts` | `f681adc` | Import from the colour subpath; the app's preset tag colours left out of the grid case; comment references rewritten | derived and noticed |
| `tests/unit/colour-conversions.test.ts` | NGNE Sprite Editor | `tests/unit/se-016-color.test.ts` | `f681adc` | Import from the colour subpath; header comment rewritten | derived and noticed |
| `tests/unit/colour-hex-text.test.ts` | NGNE Sprite Editor | `tests/unit/se-064-preferences.test.ts` | `f681adc` | The "hex colour text" cases only; import from the colour subpath; header comment added | derived and noticed |
| `tests/unit/colour-oklab.test.ts` | NGNE Sprite Editor | `tests/unit/se-043-oklab.test.ts` | `f681adc` | Import from the colour subpath; the primaries checked to 3 decimals (§4); a same-coordinates case added; comments rewritten | derived and noticed |
| `tests/unit/commands-chord.test.ts` | NGNE Sprite Editor | `tests/unit/se-007-chord.test.ts` | `f681adc` | Import from the commands subpath; `parseChord`, Meta and `Ctrl+Plus` cases added; header comment rewritten | derived and noticed |
| `tests/unit/commands-menu-model.test.ts` | NGNE Sprite Editor | `tests/unit/se-007-registry.test.ts` | `f681adc` | The generated-menu and context-menu cases, over fixture plans instead of the app's; menu-bar order for both editors' lists and `menuBarProblems` cases added | derived and noticed |
| `tests/unit/commands-registry.test.ts` | NGNE Sprite Editor | `tests/unit/se-007-registry.test.ts` | `f681adc` | The registry, planned-command, module and conflict cases over the sprite editor's lists as parameters; the app's own registry cases left in the app; code-unit order, command gate, `beforeRun` and the module-naming startup errors added | derived and noticed |
| `tests/unit/commands-registry.test.ts` | NGNE Sprite Editor | `tests/unit/se-007-keymap.test.ts` | `f681adc` | The case refusing a text binding that takes a key from the field | derived and noticed |
| `tests/unit/commands-registry.test.ts` | NGNE Sprite Editor | `tests/unit/se-007-spec-keys.test.ts` | `f681adc` | The registry accepting text-context chords, over a fixture list instead of the app's key table | derived and noticed |
| `tests/unit/commands-registry.test.ts` | NGNE Tilemap Editor | `tests/unit/te-007-resolve.test.ts` | `eb07938` | The error-handler case, at `invokeCommand` instead of the keyboard listener | derived and noticed |
| `tests/unit/commands-resolve.test.ts` | NGNE Sprite Editor | `tests/unit/se-007-keymap.test.ts` | `f681adc` | The applicable-context and resolution cases, run for both editors' context lists with the active contexts as a parameter; the environment-reading and listener cases left to the key environment | derived and noticed |
| `tests/unit/commands-resolve.test.ts` | NGNE Tilemap Editor | `tests/unit/te-007-resolve.test.ts` | `eb07938` | The `markers` and `panel` context list; the panel case (F2 in a focused item, a tab strip keeping its arrows) | derived and noticed |
| `tests/unit/licences-build-excluded.test.ts` | NGNE Sprite Editor | `tests/unit/licences-excluded.test.ts` | `f681adc` | The gifenc rule replaced by a fixture rule passed as an option; the bundle built with the helper's plugin | derived and noticed |
| `tests/unit/licences-build-generator.test.ts` | NGNE Sprite Editor | `tests/unit/licences-generator.test.ts` | `f681adc` | Cases moved to the options form; repository cases for this package | derived and noticed |
| `tests/unit/licences-build-generator.test.ts` | NGNE Tilemap Editor | `tests/unit/cleanup-licences-generator.test.ts` | `eb07938` | Build-only package and `THIRD-PARTY-LICENSE` cases moved to the options form | derived and noticed |
| `tests/unit/licences-build-repository.test.ts` | NGNE Sprite Editor | `tests/unit/licences-excluded.test.ts` | `f681adc` | Its in-memory build helper taken; the gallery build's and the peer fixtures' cases written for the package | derived and noticed |
| `tests/unit/overlay-layers.test.ts` | NGNE Sprite Editor | `tests/unit/se-013-layers.test.ts` | `f681adc` | The registry cases only, over a fixture frame type and fixture layers instead of the app's grid and outline layers; a case for the DESIGN §6 draw orders added; comments rewritten | derived and noticed |
| `tests/unit/overlay-wheel.test.ts` | NGNE Sprite Editor | `tests/unit/se-012-navigate.test.ts` | `f681adc` | The "wheel travel" cases only; import from the overlay subpath's entry; the zoom step's arity checked with `toHaveLength`; header comment rewritten | derived and noticed |
| `tests/unit/palette-model.test.ts` | NGNE Sprite Editor | `tests/unit/se-064-palette.test.ts` | `f681adc` | The fuzzy, search, row and running cases, over registries with the sprite editor's menu list as a parameter; the recent-list cases moved to `palette-recent`; the enabled flag, command gate, editor menu order, capped recent list, code-unit tie and `beforeRun` cases added; header comment rewritten | derived and noticed |
| `tests/unit/palette-model.test.ts` | NGNE Tilemap Editor | `tests/unit/te-008-commands.test.ts` | `eb07938` | The `cmdpal` fuzzy case and the case putting a command run from the palette first, over a fixture registry instead of the app's | derived and noticed |
| `tests/unit/palette-recent.test.ts` | NGNE Sprite Editor | `tests/unit/se-064-palette.test.ts` | `f681adc` | The recent-command cases, over `withRecentCommand`, `readRecentCommands` and `writeRecentCommands` with the storage and key as parameters instead of the store; the key-per-editor, stored-value, failing-read, write-report and failing-storage palette cases added | derived and noticed |
| `tests/unit/palette-recent.test.ts` | NGNE Tilemap Editor | `tests/unit/te-008-commands.test.ts` | `eb07938` | The cap case that records the newest command again | derived and noticed |
| `tests/unit/registries-context-bar.test.ts` | NGNE Sprite Editor | `tests/unit/se-033-commands.test.ts` | `f681adc` | The registry case; `shownContextBarContent` checked over fixture entries instead of the app's transform content; subscription and invalid-entry cases added | derived and noticed |
| `tests/unit/registries-dialogs.test.ts` | NGNE Sprite Editor | `tests/unit/se-034-commands.test.ts` | `f681adc` | The refusal case; the app's discovery case replaced by a fixture map in declared order; invalid-entry cases added | derived and noticed |
| `tests/unit/registries-dock.test.ts` | NGNE Sprite Editor | `tests/unit/se-006-dock-registry.test.ts` | `f681adc` | Order, duplicate and missing-export cases kept; the app's discovery and section cases replaced by a fixture map and `collapsedByDefault`; invalid-entry case added | derived and noticed |
| `tests/unit/registries-status-fields.test.ts` | NGNE Tilemap Editor | `tests/unit/te-014-status.test.ts` | `eb07938` | The registry cases; the app's own registry case replaced by a fixture case with text, reserved width, action and subscription; the tile-field and status-store cases left in the app | derived and noticed |
| `tests/unit/shortcut-sheet-model.test.ts` | NGNE Sprite Editor | `tests/unit/se-064-shortcut-sheet.test.ts` | `f681adc` | The sheet cases over fixture registries with the menu list as a parameter; the app's own registry case left in the app; menu-order cases for both editors' lists and the chord-display case added; header comment rewritten | derived and noticed |
| `tests/unit/shortcut-sheet-model.test.ts` | NGNE Tilemap Editor | `tests/unit/te-008-commands.test.ts` | `eb07938` | The follow-the-registry case with a hold binding, over a fixture registry | derived and noticed |
| `tests/unit/tokens-canon.test.ts` | NGNE Sprite Editor | `tests/unit/se-006-tokens.test.ts` | `f681adc` | Token path moved; DESIGN §3.1 read from its own section; the contrast pairs checked against the canon's wording; the raw-colour scan made a function, run on fixture trees and over `gallery/`; the stylesheet list reduced to this package's; comment references rewritten | derived and noticed |
| `tests/unit/tokens-canon.test.ts` | NGNE Tilemap Editor | `tests/unit/te-003-tokens.test.ts` | `eb07938` | Tilemap case taken: the dark values the apps read (`--bg-workspace`, `--bg-panel`, `--accent`), cited to DESIGN §3.1 and §10 | derived and noticed |
| `tests/unit/tools-registry.test.ts` | NGNE Sprite Editor | `tests/unit/se-014-registry.test.ts` | `f681adc` | The registry cases, over a fixture tool type with fields of the editor's own and string icons instead of the app's tools and `lucide-react`; `RegistrationError` instead of `ToolRegistryError`; the discovery, option-value and active-tool cases left in the app; typed-return, key, planned-slot and late-plan cases added; header comment rewritten | derived and noticed |
| `tests/unit/tools-registry.test.ts` | NGNE Sprite Editor | `tests/unit/se-031-rail.test.ts` | `f681adc` | The slots-with-variants cases, over the fixture tool type; the shown-variant and next-variant key cases left in the app | derived and noticed |
| `tests/unit/tools-registry.test.ts` | NGNE Sprite Editor | `src/app/tools/planned.tools.ts` | `f681adc` | The planned rail and its keys as fixture data, icons as strings | derived and noticed |
| `tsconfig.base.json` | NGNE Sprite Editor | `tsconfig.json` | `f681adc` | The compiler options kept; `NodeNext`, declarations and source maps for the package build | derived and noticed |

Rules for the rows:

- Source commit: the sprite editor's commit at the cut, named once the cut happens; a taken
  tilemap fix names the tilemap commit and its test.
- Change at the cut: "none", or what changed (identity made a parameter, glob replaced by a
  module map, comment references rewritten to this package's docs, tilemap fix taken).
- Taken tilemap fixes, each with its test: time-limited WebGPU check
  (`webgpu-check-timeout`), command-refresh tracker (`cleanup-command-refresh`), licences
  dialog accessible region (`cleanup-licences`), locale-independent module sort, `Readonly`
  props. A fix without a test in the tilemap gets one in this repository.
- The canon `docs/DESIGN.md` is written from the sprite editor's DESIGN §1–4, §6–8 and the
  tilemap's SUITE §1–4 (inventory D1–D2); it names no reference program.

## 3. Clean-room and audit records

### Clean-room records

| File | Spec given | Implementer given | Not given | Date |
| --- | --- | --- | --- | --- |
| `src/colour/oklab.ts` | OKLab matrices M1 and M2 and the cube root, as published in the maths section of the 2020 post (read through an extract of that section only); sRGB transfer functions and primaries (IEC 61966-2-1); the expected values and signatures of the sprite editor's `tests/unit/se-043-oklab.test.ts` at `f681adc` | Spec and tests only (EU-004); test `tests/unit/colour-oklab.test.ts` | The sprite editor's `src/core/color/oklab.ts` and its history; any code from the post, including its linear-sRGB matrix | 2026-11-15 |

### Audits

| Date | Revision | Scope | Result |
| --- | --- | --- | --- |
| 2026-11-15 | `f39c470` (tree of `cae68d5`) | Full audit (licenses.md §6): all 74 tracked files; `dist/` (`npm run build`), the npm file list (`npm pack --dry-run`) and `gallery/dist/` with `licences.txt` (`npm run build:gallery`); sources compared with NGNE Sprite Editor `f681adc` and NGNE Tilemap Editor `eb07938`, except files their PROVENANCE or notices tie to an upstream; no comparison with Aseprite application source (not approved): the package was checked for its identifiers, file or line references and step structure instead | Nothing blocking. The 11 files of §2 derive from the sibling editors (MIT, same holder) as their rows state; class derived and noticed. Eight further files carry sibling-editor text without a §2 row (`.gitattributes`, `.prettierrc.json`, `.gitignore`, `playwright.config.ts`, `eslint.config.js`, `tsconfig.base.json`, `tests/unit/licences-build-repository.test.ts`, `docs/DESIGN.md`). No file derives from a copyleft or restricted source. `THIRD_PARTY_NOTICES.md` covers the package's shipped files. The gallery's `licences.txt` lists exactly react 19.3.0, react-dom 19.3.0, rolldown 1.2.19 and scheduler 0.28.0 with full licence texts. The rolldown-emitted module-preload polyfill's origin was not verified |

## 4. Owner decisions

| Date | Decision |
| --- | --- |
| 2026-11-13 | Stand-in licence text approved for `react-remove-scroll-bar` 2.3.8, whose npm package ships no licence file: the `LICENSE` of its repository at commit `7301c160`, compared byte for byte (decided for the sprite editor; it moves here with the licences build helper) |
| 2026-11-15 | `src/colour/oklab.ts` is rewritten clean-room in EU-004 from the published matrices and formulas, not moved from the sprite editor, because whether the post's code was read is not known (BRIEF D21) |
| 2026-11-15 | The OKLab reference values of the sRGB primaries are checked to 3 decimals in `tests/unit/colour-oklab.test.ts`: from the published M1 and the sRGB primaries they differ by up to 1.2e-4, and 5 decimals would need the post's linear-sRGB matrix, which is in its code only. White, black, greys, round trips and clipping stay exact |

## 5. Open items

- The cut: §2 rows.
- Before the first deploy and publish: the changes since the audited revision `f39c470` checked
  (licenses.md §6).
- `THIRD_PARTY_NOTICES.md` for the package: peers are not bundled by the package; the notices
  list what its build ships (none at present) and the stand-in text.
