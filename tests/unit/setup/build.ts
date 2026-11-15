import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The API surface and stylesheet tests read the built package, so the tests build it first,
// whatever runs them (npm run check, the coverage run, one test file). The steps are those of
// the `build` script of package.json, each run by this Node executable from its absolute path,
// so no command is looked up on PATH.

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** Where each command of the build script runs from, under this Node executable. */
const COMMANDS: Record<string, string[]> = {
    node: [],
    tsc: [join(ROOT, "node_modules", "typescript", "bin", "tsc")],
};

/** The steps of the `build` script: "node scripts/x.ts && tsc -p y.json && …". */
function buildSteps(script: string): string[][] {
    return script.split("&&").map((step) => {
        const [command, ...args] = step.trim().split(/\s+/);
        const prefix = COMMANDS[command ?? ""];
        if (!prefix) throw new Error(`tests/unit/setup: unknown build command "${command}".`);
        return [...prefix, ...args];
    });
}

export default function setup(): void {
    const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
        scripts: { build: string };
    };
    for (const args of buildSteps(manifest.scripts.build)) {
        execFileSync(process.execPath, args, { cwd: ROOT, stdio: "pipe" });
    }
}
