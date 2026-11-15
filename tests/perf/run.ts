import { spawnSync } from "node:child_process";
import {
    appendFileSync,
    existsSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The benchmark runner behind `npm run perf -- <name>` (tests/perf/README.md): runs the one
// benchmark `tests/perf/<name>.perf.ts` with Vitest's bench mode in Node, prints Vitest's table
// and one report-only line per measured function. Numbers are never compared with a budget
// here: CI prints them and the owner records them on reference hardware (docs/SPEC.md §2).

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PERF_DIR = join(ROOT, "tests", "perf");
const VITEST = join(ROOT, "node_modules", "vitest", "vitest.mjs");
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The latency statistics of one measured function, in milliseconds. */
export interface BenchmarkTask {
    name: string;
    meanMs: number;
    p50Ms: number;
    p75Ms: number;
    p99Ms: number;
    minMs: number;
    maxMs: number;
    /** Relative margin of error of the mean, in percent. */
    rmePercent: number;
    samples: number;
}

export interface BenchmarkRun {
    name: string;
    tasks: BenchmarkTask[];
}

/** The names `npm run perf` accepts: every `tests/perf/<name>.perf.ts`. */
export function benchmarkNames(): string[] {
    return readdirSync(PERF_DIR)
        .filter((file) => file.endsWith(".perf.ts"))
        .map((file) => file.slice(0, -".perf.ts".length))
        .sort((a, b) => Number(a > b) - Number(a < b));
}

/** The latency fields the runner reads from a task of Vitest's JSON report, in milliseconds. */
interface ReportLatency {
    mean: number;
    p50: number;
    p75: number;
    p99: number;
    min: number;
    max: number;
    rme: number;
    samplesCount: number;
}

/** The part of Vitest's JSON report that holds the benchmarks. */
interface JsonReport {
    testResults?: {
        assertionResults?: {
            benchmarks?: { tasks?: { name: string; latency: ReportLatency }[] }[];
        }[];
    }[];
}

/** The measured functions of a Vitest JSON report, in report order. */
export function tasksOf(report: JsonReport): BenchmarkTask[] {
    const tasks: BenchmarkTask[] = [];
    for (const file of report.testResults ?? []) {
        for (const test of file.assertionResults ?? []) {
            for (const benchmark of test.benchmarks ?? []) {
                for (const task of benchmark.tasks ?? []) {
                    const { latency } = task;
                    tasks.push({
                        name: task.name,
                        meanMs: latency.mean,
                        p50Ms: latency.p50,
                        p75Ms: latency.p75,
                        p99Ms: latency.p99,
                        minMs: latency.min,
                        maxMs: latency.max,
                        rmePercent: latency.rme,
                        samples: latency.samplesCount,
                    });
                }
            }
        }
    }
    return tasks;
}

/** The report-only console line of one measured function. */
export function taskLine(benchmark: string, task: BenchmarkTask): string {
    const ms = (value: number): string => `${value.toFixed(4)} ms`;
    return (
        `${benchmark} › ${task.name}: mean ${ms(task.meanMs)}, p75 ${ms(task.p75Ms)}, ` +
        `p99 ${ms(task.p99Ms)}, ±${task.rmePercent.toFixed(2)}%, ${task.samples} samples ` +
        `(report-only)`
    );
}

/**
 * Runs `tests/perf/<name>.perf.ts` alone and returns its measured functions. Throws for an
 * unknown name, a failed run or a run that measured nothing.
 */
export function runBenchmark(name: string): BenchmarkRun {
    const names = benchmarkNames();
    if (!NAME_PATTERN.test(name) || !names.includes(name)) {
        throw new Error(`No benchmark "${name}". Benchmarks: ${names.join(", ") || "none"}.`);
    }
    const outDir = mkdtempSync(join(tmpdir(), "editor-ui-perf-"));
    const report = join(outDir, "report.json");
    try {
        const result = spawnSync(
            process.execPath,
            [
                VITEST,
                "bench",
                "--run",
                "--config",
                "vitest.perf.config.ts",
                "--reporter=verbose",
                "--reporter=json",
                `--outputFile.json=${report}`,
                `tests/perf/${name}.perf.ts`,
            ],
            { cwd: ROOT, stdio: "inherit" },
        );
        if (result.error) throw result.error;
        if (result.status !== 0) {
            throw new Error(`Benchmark "${name}" failed (Vitest exit code ${result.status}).`);
        }
        if (!existsSync(report)) throw new Error(`Benchmark "${name}" wrote no report.`);
        const tasks = tasksOf(JSON.parse(readFileSync(report, "utf8")) as JsonReport);
        if (tasks.length === 0) throw new Error(`Benchmark "${name}" measured nothing.`);
        return { name, tasks };
    } finally {
        rmSync(outDir, { recursive: true, force: true });
    }
}

/** Prints the run's lines, and adds them to the job summary when run on GitHub Actions. */
export function printRun(run: BenchmarkRun): void {
    const lines = run.tasks.map((task) => taskLine(run.name, task));
    console.log(`\n${lines.join("\n")}`);
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) appendFileSync(summary, lines.map((line) => `- ${line}\n`).join(""));
}

function main(args: readonly string[]): number {
    if (args.length !== 1) {
        console.error(
            `Usage: npm run perf -- <name> (one benchmark at a time). ` +
                `Benchmarks: ${benchmarkNames().join(", ") || "none"}.`,
        );
        return 2;
    }
    try {
        printRun(runBenchmark(args[0]));
        return 0;
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        return 1;
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    process.exitCode = main(process.argv.slice(2));
}
