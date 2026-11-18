import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

// npm, run by this Node executable from the absolute path of its CLI script, so no command is
// looked up on PATH (as tests/unit/setup/build.ts runs the build).

/** The npm CLI script that ships with this Node: npm's own when npm runs the tests. */
export function npmCli(): string {
    const candidates = [
        process.env["npm_execpath"] ?? "",
        // Windows installs npm beside node.exe; Unix installs it under lib/ of the prefix.
        join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
        join(dirname(process.execPath), "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
    ];
    const cli = candidates.find((path) => path.endsWith("npm-cli.js") && existsSync(path));
    if (!cli) throw new Error("tests/unit: no npm-cli.js beside this Node executable.");
    return cli;
}

/** Runs `npm <args>` in `cwd` and returns its standard output. */
export function npm(args: readonly string[], cwd: string): string {
    return execFileSync(process.execPath, [npmCli(), ...args], {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
    });
}

/** One file of `npm pack --json`. */
export interface PackedFile {
    path: string;
}

/** `npm pack --json` of the package at `root`, with `args` added: its tarball and files. */
export function pack(root: string, args: readonly string[]): { filename: string; files: string[] } {
    const [result] = JSON.parse(npm(["pack", "--json", ...args], root)) as {
        filename: string;
        files: PackedFile[];
    }[];
    if (!result) throw new Error("tests/unit: npm pack printed no result.");
    return { filename: result.filename, files: result.files.map((file) => file.path) };
}
