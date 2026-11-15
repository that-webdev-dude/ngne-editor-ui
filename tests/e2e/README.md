# E2E specs

Playwright specs of the gallery (docs/SPEC.md §3): every export in both themes at 1280×720 and
125% zoom, with axe (`@axe-core/playwright`), and keyboard specs for focus, menus, palette and
sheet. They run in the installed Google Chrome (`channel: "chrome"`), not Playwright's bundled
Chromium.

## Running

```sh
npx playwright test
```

- Server: Playwright builds the package and the gallery site, then serves the site with
  Vite's preview under its Pages base (`gallery/pages.ts`), as Pages serves it.
- Port: `PORT` from the environment, otherwise a free one; each checkout or worktree runs on
  its own.
- Headed or headless: headless by default; `E2E_HEADLESS=0` opens Chrome windows.
- Workers: `E2E_WORKERS=n` overrides the count; CI runs one worker per job.
- A headed-only CI failure is reproduced with `CI=1 E2E_HEADLESS=0`.

## Full suite

Before handing over a change to startup, layout or the shell, run every spec once, headless
and then headed:

```sh
npx playwright test
```

```sh
E2E_HEADLESS=0 npx playwright test
```

Specs are named after the feature: `tests/e2e/<feature>.spec.ts`.
