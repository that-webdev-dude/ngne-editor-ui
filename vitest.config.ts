import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["tests/unit/**/*.test.ts"],
        // Builds dist/ once before the tests that read the built package, then installs its
        // tarball into a scratch consumer project (tests/unit/setup).
        globalSetup: ["tests/unit/setup/build.ts", "tests/unit/setup/consumer.ts"],
        coverage: {
            provider: "v8",
            include: ["src/**"],
            reporter: ["text", "lcov"],
            reportsDirectory: "coverage",
        },
    },
});
