import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// The API surface and stylesheet tests read the built package, so the tests build it first,
// whatever runs them (npm run check, the coverage run, one test file).
export default function setup(): void {
    execSync("npm run build", {
        cwd: fileURLToPath(new URL("../../../", import.meta.url)),
        stdio: "pipe",
    });
}
