# Migration guide

How an editor of the suite moves onto `@ngne/editor-ui` (§1–§3), and later from one version of
it to the next (§4). [SPEC.md](SPEC.md) §14 is the contract; this guide is the procedure. One
editor per change, started from a GitHub issue (§5).

## 1. Before you start

- The package version to adopt is released: tagged, published, its gallery deployed.
- The change to `package.json` (the package and its peers, pinned exactly) is approved by the
  owner.
- The editor's release hold, if it has one, is respected: the change may be prepared and merged
  on its branch, and ships only when the hold is lifted.
- Take a baseline on the editor's `main`: `npm run check`, the full E2E suite, the production
  bundle size, and the benchmarks of its budget rows (report-only).

## 2. Adopting the package

| # | Step | Result |
| - | ---- | ------ |
| 1 | **List the copies.** For every row of the package's copy table ([PROVENANCE.md](PROVENANCE.md) §2, source path per package file), find the editor's file: the owner of the code (sprite editor) has the source, a copying editor has a verbatim or adapted copy, or none | A table: editor file → package subpath, and what the editor changed in it |
| 2 | **Pin.** Add `@ngne/editor-ui` and its peers at exact versions | `package.json`, lockfile |
| 3 | **Create the instance.** `src/app/editorUi.ts` with `createEditorUi(config)` (SPEC §5): `id` = the editor's current storage prefix, product name, About facts, menus ending with Help, key contexts, module maps from the editor's existing `import.meta.glob` lines, `refreshOn`, `commandGate`, `beforeRun`, surfaces | One module; the old registry modules' globs move here |
| 4 | **Switch imports, group by group**, in this order: styles, primitives, focus, messages, platform, colour, commands and keys, shell, overlay, PWA, About and licences, gallery. The development gallery route's module, and no other, imports `@ngne/editor-ui/gallery.css` after `styles.css` (SPEC §12). After each group the editor builds and its unit tests pass | Imports from the package's subpaths |
| 5 | **Move what the editor adapted into configuration.** Storage keys, cache names, menus, contexts, the bottom region, rail footer, status fields, the "no document" gate, the pre-run hook: each becomes a config field or a slot, never an edited package file | No package file edited or copied |
| 6 | **Fill the shell's slots.** Viewport, bottom region, rail footer, menu centre (the tab strip with the editor's items), empty state | The editor's region contents stay in the editor |
| 7 | **Build.** `vite.config.ts` uses `appInfoDefines` and `generateLicences`, whose `buildPackages` lists `node_modules/rolldown`, and `node_modules/vite` when any build of the editor, in any mode, has a dynamic import (a development-only gallery route counts), for Vite's preload helper; the service-worker entry calls `installServiceWorker` with the same `id` | About facts and `licences.txt` from the package's helpers |
| 8 | **Delete the replaced files.** Only files the package now provides; never a test | The editor's copy of the package is gone |
| 9 | **Tests.** Every test stays, and every changed assertion is of a kind SPEC §14 names, listed before and after. Imports and the module paths pages load move to the subpaths. Locators of app hooks the package replaces take its public hooks; a status field's action is located by its field id. Assertions of values the canon fixes take the package's: the D22 layout's region sizes and rail columns, the package's menu items, the shell's element structure, the bottom region's title-case label, the tab close control with no title, the colour subpath's checked precision. Command `source` paths are the glob keys relative to `src/app/editorUi.ts`, where the globs moved: `../file/file.commands.ts` becomes `./file/file.commands.ts`. An import scan that matches every `@ngne/` package names the one it means; a fixture whose tool key clashes inside one tool set takes another key. The app's own gallery tests go with its gallery page, which the package's gallery replaces, each listed. Dependency and provenance tests keep their assertions: they pass once the pin is exact (step 2) and the docs of step 10 are current. A test of a module the package now keeps internal (number and splitter maths, dialog and context-bar collection, the surfaces, the About and licences flows, the command tracker, a scan of the deleted storage module), and a test of a moved module whose API changed where a package test checks the same behaviour, is retired: the owner approves the list, and each retired test names the package test that covers it. A test of a file the package now provides, such as the app's token stylesheet, is retired the same way. Any other test of a moved module, and a test of the editor's own behaviour through the registry, the keymap, precache or the update flow, is rewritten against the public API (registry options, the new arguments, the instance's or the editor's state sources), each change listed before and after. Otherwise a test of a moved module changes its import only; a menu-list or placeholder assertion that the package changes is changed and listed before and after: for an editor that had no Help menu, its menu lists and order, the items that move to Help, the shortcut sheet's groups and the About command among the commands its gate leaves enabled. Unit tests that reset modules (`vi.resetModules`) to start from a fresh page, such as one storage-failure report per page or a notice sent before the toasts, need the package inlined: `test.server.deps.inline: ["@ngne/editor-ui"]` in the editor's Vitest configuration. Vitest otherwise loads the package from `node_modules` once, and its module-level services (SPEC §1.2) keep one page's state across the reset | No weakened or skipped test; no test deleted but the editor's gallery tests and those on the owner's list, each against a package test |
| 10 | **Docs.** DESIGN.md names the package version and keeps only the editor's own interface (DESIGN §11); SUITE.md points to the canon for identity, design system, layout and interaction rules, and the editor's stack list names the package, so its dependency tests pass; PROVENANCE retires the copy rows of the deleted files, so its provenance tests pass; the drift report drops them; CHANGELOG names every user-visible change (Help menu, About dialog, the bottom region beside the full-height rail of BRIEF D22) | Docs match the code |

## 3. Acceptance

- **Persisted names unchanged** (SPEC §5): an existing user's theme, layout and recent commands
  load after the update; an installed PWA updates without losing its offline cache. The
  editor's storage-key and PWA-update tests prove it.
- **Same behaviour:** `npm run check` and the full E2E suite pass with only the assertion
  changes of step 9.
- **Budgets** (BRIEF §8): production bundle within 2% of the baseline; no budget row beyond its
  noise (reference hardware, recorded by the owner).
- **Licences:** the editor's `licences.txt` lists the package; its notices test passes; a
  licence delta check covers the change before the next release or deploy.
- **Nothing copied:** no file of the editor is byte-identical to a package file. The
  editor's own licence text (`LICENSE`) is not a copy: it is byte-identical to the package's
  because both are the owner's MIT text.

## 4. Upgrading to a newer version

1. Read the package's CHANGELOG from the pinned version to the new one, and the API-surface
   changes it names. In 0.x, a minor version may break the API.
2. Bump the pin exactly (owner approves the `package.json` change).
3. Fix imports and configuration for every changed export; nothing else of the editor changes
   for the upgrade itself.
4. `npm run check` and the full E2E suite. Look at the gallery entries the CHANGELOG names in
   the editor, in both themes.
5. DESIGN.md names the new version; CHANGELOG names the user-visible changes.
6. Budgets as §3.

A design change the editor needs is made in the package and released; the editor never patches
or copies a package file to get it.

## 5. Issue template

```markdown
## Move <Editor> onto @ngne/editor-ui <version>

Adopt | Upgrade from <old version>. Guide: ngne-editor-ui docs/MIGRATION.md.

### Acceptance
- [ ] `@ngne/editor-ui` and its peers pinned exactly
- [ ] Copies table (§2 step 1) in the report; no editor file byte-identical to a package file
- [ ] `src/app/editorUi.ts` with the editor's identity; persisted names unchanged (storage-key
      and PWA-update tests pass)
- [ ] `npm run check` and the full E2E suite pass; changed assertions listed before and after
- [ ] Bundle within 2% of the baseline; budget rows re-run (report-only), reference numbers
      left for the owner
- [ ] DESIGN, SUITE, PROVENANCE, drift report and CHANGELOG current
- [ ] `licences.txt` lists the package; notices test passes

### Out of scope
- Changes to the package (an issue in ngne-editor-ui)
- Behaviour changes beyond what the package version brings
```
