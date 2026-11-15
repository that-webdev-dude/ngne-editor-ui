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
| `src/styles/base.css` | NGNE Sprite Editor | `src/ui/styles/base.css` | `f681adc` | Comment references rewritten to this package's docs; a header comment added | derived and noticed |
| `src/styles/tokens.css` | NGNE Sprite Editor | `src/ui/styles/tokens.css` | `f681adc` | Comment references rewritten to this package's docs | derived and noticed |
| `src/ui/gallery/Gallery.tsx` | NGNE Sprite Editor | `src/ui/gallery/Gallery.tsx` | `f681adc` | Frame only: the header and one section per entry kept, the primitive demos, theme store and toasts dropped; entries from a list (`entries.ts`); the theme switch made the frame's own radio group; the licences link and input modality added | derived and noticed |
| `src/ui/gallery/gallery.css` | NGNE Sprite Editor | `src/ui/gallery/gallery.css` | `f681adc` | Frame rules kept, demo rules dropped; theme switch, licences link and Tokens entry rules added | derived and noticed |
| `tests/e2e/gallery.spec.ts` | NGNE Sprite Editor | `tests/e2e/se-006-gallery.spec.ts` | `f681adc` | The axe audit and its on-screen check kept; the primitive, theme-store and keyboard cases left to their entries; Tokens entry, window-size and licences-link cases written for the package | derived and noticed |
| `tests/unit/colour-contrast.test.ts` | NGNE Sprite Editor | `tests/unit/se-023-contrast.test.ts` | `f681adc` | Import from the colour subpath; the app's preset tag colours left out of the grid case; comment references rewritten | derived and noticed |
| `tests/unit/colour-conversions.test.ts` | NGNE Sprite Editor | `tests/unit/se-016-color.test.ts` | `f681adc` | Import from the colour subpath; header comment rewritten | derived and noticed |
| `tests/unit/colour-hex-text.test.ts` | NGNE Sprite Editor | `tests/unit/se-064-preferences.test.ts` | `f681adc` | The "hex colour text" cases only; import from the colour subpath; header comment added | derived and noticed |
| `tests/unit/colour-oklab.test.ts` | NGNE Sprite Editor | `tests/unit/se-043-oklab.test.ts` | `f681adc` | Import from the colour subpath; the primaries checked to 3 decimals (§4); a same-coordinates case added; comments rewritten | derived and noticed |
| `tests/unit/licences-build-excluded.test.ts` | NGNE Sprite Editor | `tests/unit/licences-excluded.test.ts` | `f681adc` | The gifenc rule replaced by a fixture rule passed as an option; the bundle built with the helper's plugin | derived and noticed |
| `tests/unit/licences-build-generator.test.ts` | NGNE Sprite Editor | `tests/unit/licences-generator.test.ts` | `f681adc` | Cases moved to the options form; repository cases for this package | derived and noticed |
| `tests/unit/licences-build-generator.test.ts` | NGNE Tilemap Editor | `tests/unit/cleanup-licences-generator.test.ts` | `eb07938` | Build-only package and `THIRD-PARTY-LICENSE` cases moved to the options form | derived and noticed |
| `tests/unit/licences-build-repository.test.ts` | NGNE Sprite Editor | `tests/unit/licences-excluded.test.ts` | `f681adc` | Its in-memory build helper taken; the gallery build's and the peer fixtures' cases written for the package | derived and noticed |
| `tests/unit/tokens-canon.test.ts` | NGNE Sprite Editor | `tests/unit/se-006-tokens.test.ts` | `f681adc` | Token path moved; DESIGN §3.1 read from its own section; the contrast pairs checked against the canon's wording; the raw-colour scan made a function, run on fixture trees and over `gallery/`; the stylesheet list reduced to this package's; comment references rewritten | derived and noticed |
| `tests/unit/tokens-canon.test.ts` | NGNE Tilemap Editor | `tests/unit/te-003-tokens.test.ts` | `eb07938` | Tilemap case taken: the dark values the apps read (`--bg-workspace`, `--bg-panel`, `--accent`), cited to DESIGN §3.1 and §10 | derived and noticed |
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
