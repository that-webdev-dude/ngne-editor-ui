# Benchmarks

Node benchmarks of the package's budgets (docs/SPEC.md §2), on Vitest's bench mode
(`vitest.perf.config.ts`). They are measured and reported, never asserted: `npm run check`
does not run them, and no number fails a run (RULES 7). Numbers that decide anything come from
the owner's reference hardware; CI numbers and an implementer's numbers are report-only.

## Running

```sh
npm run perf -- harness-baseline
```

- One benchmark at a time, named by its file `tests/perf/<name>.perf.ts`; the runner
  (`run.ts`) stops on a missing, extra or unknown name and lists the names it knows.
- Nothing else loading the machine: no E2E run, no other benchmark, no build.
- It prints Vitest's table, then one line per measured function: mean, p75 and p99 in
  milliseconds, the margin of error of the mean and the sample count.

| Benchmark                  | Measures                                                                      | Budget                       |
| -------------------------- | ----------------------------------------------------------------------------- | ---------------------------- |
| `harness-baseline`         | Building the synthetic module maps of `fixtures/editorUiModules.ts`           | None: the machine's baseline |
| `startup-create-editor-ui` | `createEditorUi` over those maps: 300 commands, 30 modules per other registry | ≤ 5 ms (SPEC §2 Startup)     |

## Writing a benchmark

- File `tests/perf/<feature>-<what>.perf.ts`, named after the feature (tickets README).
- One test whose name is the file's name, measuring with the test context's `bench`:

    ```ts
    test("harness-baseline", async ({ bench }) => {
        await bench("build the synthetic module maps", () => createEditorUiModules()).run();
    });
    ```

- Build inputs outside the measured function; return the result from it so the work is not
  optimised away.
- The startup budget's maps come from `fixtures/editorUiModules.ts`: 300 command specs in 30
  `*.commands.ts` modules and 30 modules per other registry, keyed by glob paths, with the
  menus (`SYNTHETIC_MENUS`) a config built over them needs. `tests/unit/perf-fixtures.test.ts`
  holds its counts, unique ids, chords and path order.

## CI

The `perf` job of `.github/workflows/ci.yml` runs every benchmark, one at a time, and prints
its lines in the log and the job summary. It never fails the workflow: a benchmark that does
not finish shows as a warning.

## Recording (owner only)

On the reference hardware, from a clean working tree at the commit to record:

```sh
node tests/perf/record.ts harness-baseline
```

It runs the benchmark as `npm run perf` does and writes `docs/evidence/<name>-<date>.json`:
the benchmark, date, commit, whether the working tree was clean, the machine (CPU, logical
cores, memory, OS, Node version, power plan) and the measured functions. It does not overwrite
a record of the same day. Implementers do not record; they report the numbers `npm run perf`
prints.
