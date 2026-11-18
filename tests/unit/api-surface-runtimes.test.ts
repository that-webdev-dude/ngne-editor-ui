import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, inject, it } from "vitest";

// A worker or the build never loads React or the DOM (SPEC §4): the worker and Build subpaths,
// loaded in Node from the consumer project that installed the packed tarball
// (tests/unit/setup), resolve only `node:*` modules and the package's own files, never React or
// `react-dom`, and read or define no DOM global while they load.

const CONSUMER = inject("consumerRoot");
const PACKAGE_URL = `${pathToFileURL(join(CONSUMER, "node_modules", "@ngne", "editor-ui")).href}/`;

/** The subpaths whose layer is Worker or Build in SPEC §4. */
const NODE_SUBPATHS = [
    "@ngne/editor-ui/styles/check",
    "@ngne/editor-ui/pwa/worker",
    "@ngne/editor-ui/about/build",
    "@ngne/editor-ui/licences/build",
];

/** Globals of a page or a worker that Node does not need: reading one at load is a DOM use. */
const DOM_GLOBALS = [
    "window",
    "self",
    "document",
    "navigator",
    "location",
    "localStorage",
    "sessionStorage",
    "HTMLElement",
    "Element",
    "customElements",
    "matchMedia",
    "requestAnimationFrame",
    "getComputedStyle",
];

interface Trace {
    /** Every import Node resolved while loading, and the URL it resolved to. */
    resolved: { specifier: string; url: string }[];
    /** The DOM globals read while loading. */
    read: string[];
    /** The DOM globals assigned while loading. */
    written: string[];
}

/** Loads `specifier` in a Node process of the consumer project of its own, tracing it. */
function trace(specifier: string): Trace {
    const script = join(CONSUMER, "trace-load.mjs");
    writeFileSync(
        script,
        [
            'import { registerHooks } from "node:module";',
            "const [specifier, globals] = [process.argv[2], JSON.parse(process.argv[3])];",
            "const trace = { resolved: [], read: [], written: [] };",
            "for (const name of globals) {",
            "    Object.defineProperty(globalThis, name, {",
            "        configurable: true,",
            "        get: () => void trace.read.push(name),",
            "        set: () => void trace.written.push(name),",
            "    });",
            "}",
            "registerHooks({",
            "    resolve(request, context, next) {",
            "        const result = next(request, context);",
            "        trace.resolved.push({ specifier: request, url: result.url });",
            "        return result;",
            "    },",
            "});",
            "await import(specifier);",
            "process.stdout.write(JSON.stringify(trace));",
            "",
        ].join("\n"),
    );
    const output = execFileSync(
        process.execPath,
        [script, specifier, JSON.stringify(DOM_GLOBALS)],
        { cwd: CONSUMER, encoding: "utf8" },
    );
    return JSON.parse(output) as Trace;
}

const REACT = /^(?:react|react-dom)(?:\/|$)/;

describe("worker and build subpaths in Node", () => {
    for (const subpath of NODE_SUBPATHS) {
        it(`${subpath} loads node:* and its own files only, with no React and no DOM`, () => {
            const { resolved, read, written } = trace(subpath);
            expect(resolved[0]?.specifier).toBe(subpath);
            expect(resolved[0]?.url.startsWith(`${PACKAGE_URL}dist/`), resolved[0]?.url).toBe(true);
            expect(resolved.filter(({ specifier }) => REACT.test(specifier))).toEqual([]);
            expect(
                resolved.filter(
                    ({ url }) => !url.startsWith("node:") && !url.startsWith(PACKAGE_URL),
                ),
            ).toEqual([]);
            expect(read).toEqual([]);
            expect(written).toEqual([]);
        }, 30_000);
    }

    it("would see React: the About dialog's UI subpath loads it", () => {
        const { resolved } = trace("@ngne/editor-ui/about");
        expect(resolved.map(({ specifier }) => specifier)).toEqual(
            expect.arrayContaining(["react", "react/jsx-runtime"]),
        );
    }, 30_000);

    it("would see a DOM global read or written while a module loads", () => {
        const fixture = join(CONSUMER, "dom-fixture.mjs");
        writeFileSync(
            fixture,
            "export const page = typeof document;\nglobalThis.window = {};\nexport const x = 1;\n",
        );
        const { read, written } = trace(pathToFileURL(fixture).href);
        expect(read).toEqual(["document"]);
        expect(written).toEqual(["window"]);
    }, 30_000);
});
