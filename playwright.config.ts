import { createServer } from "node:net";
import { defineConfig } from "@playwright/test";
import { PAGES_BASE } from "./gallery/pages.ts";

// The gallery's E2E specs (SPEC §3): installed Chrome, axe, both themes. How to run them:
// tests/e2e/README.md.

// One port per checkout: taken from PORT, otherwise a free one. It is written back to the
// environment so the worker processes, which load this file again, reuse the same value.
function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            server.close(() =>
                typeof address === "object" && address
                    ? resolve(address.port)
                    : reject(new Error("no port")),
            );
        });
    });
}
process.env.PORT ??= String(await freePort());
const port = Number(process.env.PORT);

const ci = !!process.env.CI;

/** E2E_WORKERS when set; otherwise one worker on CI, Playwright's default locally. */
function workerCount(): number | undefined {
    if (process.env.E2E_WORKERS) return Number(process.env.E2E_WORKERS);
    return ci ? 1 : undefined;
}

export default defineConfig({
    testDir: "tests/e2e",
    testMatch: "**/*.spec.ts",
    fullyParallel: true,
    forbidOnly: ci,
    retries: 0,
    // CI shows every worker's headed Chrome window on one X display, where two instances take
    // the pointer and the hover from each other; one worker per job there. E2E_WORKERS
    // overrides the count.
    workers: workerCount(),
    timeout: ci ? 60_000 : 30_000,
    expect: { timeout: ci ? 20_000 : 10_000 },
    reporter: ci ? [["github"], ["list"]] : "list",
    use: {
        // The gallery's build, served under its Pages base; specs open "./".
        baseURL: `http://127.0.0.1:${port}${PAGES_BASE}`,
        channel: "chrome",
        headless: process.env.E2E_HEADLESS !== "0",
        viewport: { width: 1280, height: 720 },
        launchOptions: {
            // The scale factor is fixed: a headed run on a scaled display otherwise lays out
            // in fractional pixels.
            args: ["--force-color-profile=srgb", "--force-device-scale-factor=1"],
        },
        trace: "retain-on-failure",
    },
    // The gallery as Pages serves it: the package's build, the site's build, then Vite's
    // preview of it (tests/e2e/README.md).
    webServer: {
        command: [
            "npm run build",
            "node node_modules/vite/bin/vite.js build --config gallery/vite.config.ts --logLevel warn",
            `node node_modules/vite/bin/vite.js preview --config gallery/vite.config.ts --host 127.0.0.1 --port ${port} --strictPort`,
        ].join(" && "),
        url: `http://127.0.0.1:${port}${PAGES_BASE}`,
        reuseExistingServer: !ci,
        timeout: 180_000,
    },
});
