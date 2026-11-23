# Rules

Binding for every contributor. Docs index: [docs/README.md](docs/README.md).

## Code

1. Layer boundaries: each folder under `src/` imports only what the table of
   [docs/SPEC.md](docs/SPEC.md) §1.1 allows (lint enforces it). No layer imports `@ngne/core`
   or an editor; `src/model` and `src/colour` import nothing outside themselves; `src/worker`
   imports only `src/model`; `src/build` imports only `node:*`; only `src/ui` imports the peers.
2. Dependencies are exactly those of [docs/SPEC.md](docs/SPEC.md) §4: the peers and the
   development toolchain, pinned exactly, and no runtime dependency. Anything else needs an
   owner decision.
3. Registries are factories over the editor's module maps ([docs/SPEC.md](docs/SPEC.md) §1.3):
   an editor's feature registers through its suffix (`*.commands.ts(x)`, `*.dialog.tsx`,
   `*.dock.tsx`, `*.contextbar.tsx`, `*.tools.ts(x)`, `*.overlay.ts(x)`, `*.status.ts`) without
   editing a package file. Identity and app lists are parameters, never edits.
4. Code taken from another project keeps its notice and a row in
   [docs/PROVENANCE.md](docs/PROVENANCE.md) §2, and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
   lists what the package ships. Code under a copyleft licence, under a restrictive licence
   (proprietary, source-available) or under no known licence is never copied, ported or
   translated: its program's behaviour is reproduced from manuals, file formats and observed
   use.
5. Package modules import no CSS. A stylesheet under `src/` joins the package's CSS entry
   (`@ngne/editor-ui/styles.css`) by its path, after `src/styles/tokens.css` and
   `src/styles/base.css`; one under `src/ui/gallery/` joins the gallery's entry
   (`@ngne/editor-ui/gallery.css`) instead ([docs/SPEC.md](docs/SPEC.md) §4). Only
   `src/styles/tokens.css` holds raw colours.

## Quality

6. Done = every acceptance item backed by a named test or a recorded measurement, and
   `npm run check` plus the gallery E2E specs of the touched area pass. Never weaken, skip or
   delete a test to get there.
7. Performance numbers that decide anything come from reference hardware
   ([docs/SPEC.md](docs/SPEC.md) §2). CI numbers are report-only.
8. Code and docs agree: a change to documented behaviour, interface or public API updates
   those docs and `tests/unit/api-surface.test.ts` in the same change, and after the first
   release adds a [CHANGELOG.md](CHANGELOG.md) entry.
