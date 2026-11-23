import { join } from "node:path";
import { build } from "vite";
import type { Plugin, Rollup } from "vite";
import type { BundleContext, BundleOutput } from "../../../src/build/licences/index.ts";

// Fixtures of the licences build helper's tests (SPEC §11): an in-memory build of one entry
// module, and the bundler's plugin context and bundle as far as the helper's plugins read them.

/** An output of a build. */
export type Output = Rollup.OutputChunk | Rollup.OutputAsset;

/**
 * The outputs of a build of `source` as its entry, not written to disk, with `plugins`. The
 * entry is `<root>/entry.js`, a file of the project, which the helper places as the program's
 * code.
 */
export async function buildEntry(
    root: string,
    source: string,
    plugins: readonly Plugin[],
    minify = false,
): Promise<Output[]> {
    const entryId = join(root, "entry.js").replaceAll("\\", "/");
    const entry: Plugin = {
        name: "entry",
        resolveId: (id) => (id === "virtual:entry" ? entryId : null),
        load: (id) => (id === entryId ? source : null),
    };
    const result = (await build({
        configFile: false,
        root,
        logLevel: "silent",
        plugins: [entry, ...plugins],
        build: { write: false, minify, rollupOptions: { input: "virtual:entry" } },
    })) as Rollup.RollupOutput | Rollup.RollupOutput[];
    return (Array.isArray(result) ? result : [result]).flatMap(({ output }) => output);
}

/** A plugin context that records the emitted files and throws on an error, as the bundler does. */
export function bundleContext(): {
    ctx: BundleContext;
    emitted: { fileName: string; source: string }[];
} {
    const emitted: { fileName: string; source: string }[] = [];
    const ctx: BundleContext = {
        error(message: string): never {
            throw new Error(message);
        },
        emitFile: (file) => {
            emitted.push(file);
            return file.fileName;
        },
    };
    return { ctx, emitted };
}

/** A bundle of one chunk, `index.js`, that renders code of each of `modules`. */
export function chunkOf(...modules: string[]): Record<string, BundleOutput> {
    return {
        "index.js": {
            type: "chunk",
            fileName: "index.js",
            code: "",
            modules: Object.fromEntries(modules.map((id) => [id, { renderedLength: 1 }])),
        },
    };
}
