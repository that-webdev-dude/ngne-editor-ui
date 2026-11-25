import { join } from "node:path";
import { build } from "vite";
import type { Plugin, Rolldown, Rollup } from "vite";
import type { BundleContext, BundleOutput } from "../../../src/build/licences/index.ts";

// Fixtures of the licences build helper's tests (SPEC §11): an in-memory build of one entry
// module, and the bundler's plugin context and bundle as far as the helper's plugins read them.

/** An output of a build. */
export type Output = Rollup.OutputChunk | Rollup.OutputAsset;

/** How `buildEntry` builds. */
export interface BuildEntryOptions {
    /** Whether the build minifies. Default false. */
    minify?: boolean;
    /** The build's mode. Default Vite's, "production". */
    mode?: string;
    /** Further files of the project by name, `<root>/<name>.js`, imported as `virtual:<name>`. */
    modules?: Readonly<Record<string, string>>;
}

/**
 * The outputs of a build of `source` as its entry, not written to disk, with `plugins`. The
 * entry is `<root>/entry.js`, a file of the project, which the helper places as the program's
 * code.
 */
export async function buildEntry(
    root: string,
    source: string,
    plugins: readonly Plugin[],
    { minify = false, mode, modules = {} }: BuildEntryOptions = {},
): Promise<Output[]> {
    const files = new Map<string, string>();
    for (const [name, code] of Object.entries({ ...modules, entry: source })) {
        files.set(join(root, `${name}.js`).replaceAll("\\", "/"), code);
    }
    const entry: Plugin = {
        name: "entry",
        resolveId: (id) => {
            if (!id.startsWith("virtual:")) return null;
            const file = join(root, `${id.slice("virtual:".length)}.js`).replaceAll("\\", "/");
            return files.has(file) ? file : null;
        },
        load: (id) => files.get(id) ?? null,
    };
    const result = (await build({
        configFile: false,
        root,
        mode,
        logLevel: "silent",
        plugins: [entry, ...plugins],
        build: { write: false, minify, rollupOptions: { input: "virtual:entry" } },
    })) as Rolldown.RolldownOutput | Rolldown.RolldownOutput[];
    return (Array.isArray(result) ? result : [result]).flatMap(({ output }) => output);
}

/** Runs `run` with NODE_ENV set to `mode`, as `vite build --mode <mode>` from a script. */
export async function withNodeEnv<T>(mode: string, run: () => Promise<T>): Promise<T> {
    const before = process.env.NODE_ENV;
    process.env.NODE_ENV = mode;
    try {
        return await run();
    } finally {
        process.env.NODE_ENV = before;
    }
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
