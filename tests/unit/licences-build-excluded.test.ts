import { fileURLToPath } from "node:url";
import type { Rollup } from "vite";
import { describe, expect, it } from "vitest";
import { excludedCodeIn, generateLicences } from "../../src/build/licences/index.ts";
import type { BundleContext, ExcludedCode } from "../../src/build/licences/index.ts";
import { buildEntry } from "./support/licences.ts";

// Code the build must leave out, passed as an option of the licences helper (SPEC §11): a
// bundle that holds it fails the build, one that does not passes and gets its licences file.
// The rule here stands for an app's own, such as a package's colour quantizer the app does not
// use: markers are string literals that survive minification.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

const QUANTIZER: ExcludedCode = {
    what: "the fixture's colour quantizer",
    markers: [/["'`](?:rgb565|rgb444)["'`]/],
};

/** The outputs of a minified build of `source` with the licences plugin and `excluded`. */
async function bundle(source: string, excluded: readonly ExcludedCode[]) {
    const { plugin } = generateLicences({ root: ROOT, title: "Fixture", excludedCode: excluded });
    return buildEntry(ROOT, source, [plugin], { minify: true });
}

const WITH_QUANTIZER = 'globalThis.formats = ["rgb565", "rgb444"];\n';
const WITHOUT_QUANTIZER = 'globalThis.formats = ["rgba"];\n';

describe("code the build leaves out", () => {
    it("is found by its markers", () => {
        expect(excludedCodeIn(WITH_QUANTIZER, [QUANTIZER])).toEqual([QUANTIZER.what]);
        expect(excludedCodeIn(WITHOUT_QUANTIZER, [QUANTIZER])).toEqual([]);
        expect(excludedCodeIn(WITH_QUANTIZER, [])).toEqual([]);
    });

    it("fails a bundle that holds it", async () => {
        await expect(bundle(WITH_QUANTIZER, [QUANTIZER])).rejects.toThrow(
            /The build bundles code it must leave out, in .*\.js: the fixture's colour quantizer\./,
        );
    }, 60_000);

    it("passes a bundle that does not, and writes its licences file", async () => {
        const outputs = await bundle(WITHOUT_QUANTIZER, [QUANTIZER]);
        const licences = outputs.find((output) => output.fileName === "licences.txt");
        expect(licences?.type).toBe("asset");
        const text = String((licences as Rollup.OutputAsset).source);
        expect(text.startsWith("Fixture: open source licences\n")).toBe(true);
        expect(text).toContain("npm packages in this build (0)\n");
    }, 60_000);

    it("fails a web worker's bundle that holds it", () => {
        const { workerPlugin } = generateLicences({
            root: ROOT,
            title: "Fixture",
            excludedCode: [QUANTIZER],
        });
        const context: BundleContext = {
            error(message: string): never {
                throw new Error(message);
            },
            emitFile: () => "",
        };
        const chunk = (code: string) => ({
            "worker.js": { type: "chunk" as const, fileName: "worker.js", code, modules: {} },
        });
        expect(() => workerPlugin.generateBundle.call(context, {}, chunk(WITH_QUANTIZER))).toThrow(
            /in worker\.js: the fixture's colour quantizer/,
        );
        expect(() =>
            workerPlugin.generateBundle.call(context, {}, chunk(WITHOUT_QUANTIZER)),
        ).not.toThrow();
    });
});
