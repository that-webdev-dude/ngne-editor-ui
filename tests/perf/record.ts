import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { join, relative } from "node:path";
import { printRun, ROOT, runBenchmark } from "./run.ts";

// The owner's recording script (tests/perf/README.md): `node tests/perf/record.ts <name>` runs
// one benchmark as `npm run perf` does and writes its result, with the machine's facts, to
// `docs/evidence/<name>-<date>.json`. Only the owner records, on the reference hardware
// (docs/SPEC.md §2); implementers report the numbers `npm run perf` prints instead.

/** Runs a command and returns its trimmed output, or null when it cannot run. */
function output(command: string, args: readonly string[]): string | null {
    try {
        return execFileSync(command, args, { cwd: ROOT, encoding: "utf8", stdio: "pipe" }).trim();
    } catch {
        return null;
    }
}

function fileText(path: string): string | null {
    try {
        return readFileSync(path, "utf8").trim();
    } catch {
        return null;
    }
}

/** The active power plan, or how the system reports its power profile; "unknown" otherwise. */
function powerPlan(): string {
    switch (platform()) {
        case "win32": {
            // "Power Scheme GUID: <guid>  (Balanced)"
            const scheme = output("powercfg", ["/getactivescheme"]);
            if (scheme === null) return "unknown";
            const open = scheme.lastIndexOf("(");
            return open !== -1 && scheme.endsWith(")") ? scheme.slice(open + 1, -1) : scheme;
        }
        case "linux": {
            const profile = fileText("/sys/firmware/acpi/platform_profile");
            const governor = fileText("/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor");
            const parts = [
                profile && `platform profile ${profile}`,
                governor && `governor ${governor}`,
            ].filter(Boolean);
            return parts.length > 0 ? parts.join(", ") : "unknown";
        }
        case "darwin": {
            const settings = output("pmset", ["-g"]);
            const lowPower = settings && /lowpowermode\s+(\d)/.exec(settings)?.[1];
            if (!lowPower) return "unknown";
            return `low power mode ${lowPower === "1" ? "on" : "off"}`;
        }
        default:
            return "unknown";
    }
}

/** The machine facts a record carries. */
function machineFacts(): Record<string, unknown> {
    const processors = cpus();
    return {
        cpu: processors[0]?.model.trim() ?? "unknown",
        logicalCores: processors.length,
        memoryGb: Math.round(totalmem() / 2 ** 30),
        os: `${platform()} ${release()} ${arch()}`,
        node: process.version,
        powerPlan: powerPlan(),
    };
}

/** Today's date in the machine's time zone, `YYYY-MM-DD`. */
function today(): string {
    const now = new Date();
    const pad = (value: number): string => String(value).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function main(args: readonly string[]): number {
    if (args.length !== 1) {
        console.error("Usage: node tests/perf/record.ts <name> (one benchmark at a time).");
        return 2;
    }
    const name = args[0];
    const date = today();
    const directory = join(ROOT, "docs", "evidence");
    const file = join(directory, `${name}-${date}.json`);
    if (existsSync(file)) {
        console.error(`${relative(ROOT, file)} exists; move it away to record again today.`);
        return 1;
    }
    try {
        const run = runBenchmark(name);
        printRun(run);
        const commit = output("git", ["rev-parse", "--short", "HEAD"]);
        const changes = output("git", ["status", "--porcelain"]);
        const evidence = {
            benchmark: name,
            date,
            commit: commit ?? "unknown",
            workingTreeClean: changes === null ? "unknown" : changes === "",
            machine: machineFacts(),
            unit: "ms",
            reportOnly: true,
            tasks: run.tasks,
        };
        mkdirSync(directory, { recursive: true });
        writeFileSync(file, `${JSON.stringify(evidence, null, 4)}\n`);
        console.log(`Recorded ${relative(ROOT, file)}.`);
        return 0;
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        return 1;
    }
}

process.exitCode = main(process.argv.slice(2));
