import { defineConfig } from "vitest/config";

// Node benchmarks (docs/SPEC.md §2), measured and reported, never asserted: `npm run check`
// does not run them. Run one at a time with `npm run perf -- <name>` (tests/perf/README.md).
export default defineConfig({
    test: {
        environment: "node",
        include: [],
        benchmark: { include: ["tests/perf/**/*.perf.ts"] },
        fileParallelism: false,
        testTimeout: 300_000,
    },
});
