import { rmSync } from "node:fs";

// Removes the previous build, so dist/ holds only what this build writes.
rmSync(new URL("../dist/", import.meta.url), { recursive: true, force: true });
