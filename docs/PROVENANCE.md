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
| `src/build/licence-texts/react-remove-scroll-bar.txt` | NGNE Sprite Editor | `scripts/licence-texts/react-remove-scroll-bar.txt` | `f681adc` | none | pending |
| `src/build/licences/licences.ts` | NGNE Sprite Editor | `scripts/licences.ts` | `f681adc` | App lists made options (allowlist, excluded code, stand-in directories, licence and notices paths); package and module order by code unit instead of locale; comment references rewritten to this package's docs | pending |
| `src/build/licences/licences.ts` | NGNE Tilemap Editor | `scripts/licences.ts` | `eb07938` | Tilemap fix taken: build-only packages (`BUILD_PACKAGES`, now an option) and `THIRD-PARTY-LICENSE` files; test `licences-build-generator` (`buildPackageDirs`, `readPackageLicence`) | pending |
| `src/build/licences/plugin.ts` | NGNE Sprite Editor | `vite.config.ts` | `f681adc` | The app's module collection, excluded-code check, stray check and development-server route moved into `generateLicences(options)` | pending |
| `src/build/licences/plugin.ts` | NGNE Tilemap Editor | `vite.config.ts` | `eb07938` | Tilemap fix taken: build-only packages added to the listed packages (`withBuildPackages`); test `licences-build-generator` (`buildPackageDirs`) | pending |
| `tests/unit/licences-build-excluded.test.ts` | NGNE Sprite Editor | `tests/unit/licences-excluded.test.ts` | `f681adc` | The gifenc rule replaced by a fixture rule passed as an option; the bundle built with the helper's plugin | pending |
| `tests/unit/licences-build-generator.test.ts` | NGNE Sprite Editor | `tests/unit/licences-generator.test.ts` | `f681adc` | Cases moved to the options form; repository cases for this package | pending |
| `tests/unit/licences-build-generator.test.ts` | NGNE Tilemap Editor | `tests/unit/cleanup-licences-generator.test.ts` | `eb07938` | Build-only package and `THIRD-PARTY-LICENSE` cases moved to the options form | pending |

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
| `src/colour/oklab.ts` | OKLab matrices and formulas as published in the 2020 post; sRGB transfer functions (IEC 61966-2-1); the behaviour tests | Spec and tests only (EU-004) | The sprite editor's `core/color/oklab.ts` and its history; any code from the post | At EU-004 |

### Audits

| Date | Revision | Scope | Result |
| --- | --- | --- | --- |
| — | — | No full audit yet. The first runs before the first npm publish and the first gallery deploy (BRIEF §9), by a fresh auditor, and classifies every file of §2 with the sprite editor's PROVENANCE and the inventory as input | — |

## 4. Owner decisions

| Date | Decision |
| --- | --- |
| 2026-11-13 | Stand-in licence text approved for `react-remove-scroll-bar` 2.3.8, whose npm package ships no licence file: the `LICENSE` of its repository at commit `7301c160`, compared byte for byte (decided for the sprite editor; it moves here with the licences build helper) |
| 2026-11-15 | `src/colour/oklab.ts` is rewritten clean-room in EU-004 from the published matrices and formulas, not moved from the sprite editor, because whether the post's code was read is not known (BRIEF D21) |

## 5. Open items

- The cut: §2 rows.
- The first full audit (§3).
- The clean-room rewrite of `oklab.ts` (§3, EU-004).
- `THIRD_PARTY_NOTICES.md` for the package: peers are not bundled by the package; the notices
  list what its build ships (none at present) and the stand-in text.
