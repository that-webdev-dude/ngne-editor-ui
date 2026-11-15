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
| 4 | **Switch imports, group by group**, in this order: styles, primitives, focus, messages, platform, colour, commands and keys, shell, overlay, PWA, About and licences, gallery. After each group the editor builds and its unit tests pass | Imports from the package's subpaths |
| 5 | **Move what the editor adapted into configuration.** Storage keys, cache names, menus, contexts, the bottom region, rail footer, status fields, the "no document" gate, the pre-run hook: each becomes a config field or a slot, never an edited package file | No package file edited or copied |
| 6 | **Fill the shell's slots.** Viewport, bottom region, rail footer, menu centre (the tab strip with the editor's items), empty state | The editor's region contents stay in the editor |
| 7 | **Build.** `vite.config.ts` uses `appInfoDefines` and `generateLicences`; the service-worker entry calls `installServiceWorker` with the same `id` | About facts and `licences.txt` from the package's helpers |
| 8 | **Delete the replaced files.** Only files the package now provides; never a test | The editor's copy of the package is gone |
| 9 | **Tests.** Every test stays. A test of a moved module changes its import only; a menu-list or placeholder assertion that the package changes (the Help menu for an editor that had none) is changed and listed before and after | No weakened, skipped or deleted test |
| 10 | **Docs.** DESIGN.md names the package version and keeps only the editor's own interface (DESIGN §11); SUITE.md points to the canon for identity, design system, layout and interaction rules; PROVENANCE retires the copy rows of the deleted files; the drift report drops them; CHANGELOG names every user-visible change (Help menu, About dialog) | Docs match the code |

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
- **Nothing copied:** no file of the editor is byte-identical to a package file.

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
