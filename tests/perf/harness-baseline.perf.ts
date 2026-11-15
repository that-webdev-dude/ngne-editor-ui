import { test } from "vitest";
import { createEditorUiModules } from "./fixtures/editorUiModules.ts";

// The harness's own number (tests/perf/README.md): building the synthetic module maps of the
// startup budget (docs/SPEC.md §2). It has no budget; the owner records it on reference
// hardware, so a later startup number can be read against the machine's baseline.
test("harness-baseline", async ({ bench }) => {
    await bench("build the synthetic module maps", () => createEditorUiModules()).run();
});
