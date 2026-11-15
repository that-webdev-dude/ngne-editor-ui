import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import type { Plugin, Rollup } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateLicences, packageDirsOf } from "../../src/build/licences/index.ts";

// The licences file of this repository's own build, the gallery site (SPEC §3, §11, §12;
// licenses.md §5): its licences.txt lists exactly the packages the build bundles, each with
// its licence text, and a build that bundles a package it cannot list fails.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const GALLERY_CONFIG = join(ROOT, "gallery", "vite.config.ts");

type Output = Rollup.OutputChunk | Rollup.OutputAsset;

/** The outputs of a build of the gallery site, not written to disk. */
async function buildGallery(): Promise<Output[]> {
    const result = (await build({
        configFile: GALLERY_CONFIG,
        logLevel: "silent",
        build: { write: false, emptyOutDir: false },
    })) as Rollup.RollupOutput | Rollup.RollupOutput[];
    return (Array.isArray(result) ? result : [result]).flatMap(({ output }) => output);
}

/** A build of `source` as its only module, with the licences plugin of `root`. */
async function buildSource(root: string, source: string): Promise<Output[]> {
    const entry: Plugin = {
        name: "entry",
        resolveId: (id) => (id === "virtual:entry" ? "\0entry" : null),
        load: (id) => (id === "\0entry" ? source : null),
    };
    const { plugin } = generateLicences({ root, title: "Fixture" });
    const result = (await build({
        configFile: false,
        root,
        logLevel: "silent",
        plugins: [entry, plugin],
        build: { write: false, minify: false, rollupOptions: { input: "virtual:entry" } },
    })) as Rollup.RollupOutput | Rollup.RollupOutput[];
    return (Array.isArray(result) ? result : [result]).flatMap(({ output }) => output);
}

/** The `name version (licence)` lines of the file's package list, in order. */
function listedPackages(text: string): string[] {
    const match = /^npm packages in this build \((\d+)\)\n=+\n([\s\S]*?)\n\n/m.exec(text);
    if (!match) throw new Error("licences.txt has no package list.");
    const lines = match[2]!.split("\n");
    expect(lines).toHaveLength(Number(match[1]));
    return lines;
}

/** The text of the package's section of the file, after its heading. */
function sectionOf(text: string, heading: string): string {
    const rule = "-".repeat(78);
    const start = text.indexOf(`${rule}\n${heading}\n${rule}\n`);
    if (start < 0) return "";
    const body = text.slice(start + 2 * (rule.length + 1) + heading.length);
    const end = body.indexOf(`\n${rule}\n`);
    return (end < 0 ? body : body.slice(0, end)).trimStart();
}

describe("the gallery build's licences file", () => {
    let outputs: Output[] = [];
    let text = "";

    beforeAll(async () => {
        outputs = await buildGallery();
        const file = outputs.find((output) => output.fileName === "licences.txt");
        expect(file?.type).toBe("asset");
        text = String((file as Rollup.OutputAsset).source);
    }, 120_000);

    it("is written beside index.html", () => {
        expect(outputs.map((output) => output.fileName)).toEqual(
            expect.arrayContaining(["index.html", "licences.txt"]),
        );
    });

    it("holds the project's licence and its notices", () => {
        expect(text.startsWith("NGNE Editor UI gallery: open source licences\n")).toBe(true);
        expect(text).toContain(readFileSync(join(ROOT, "LICENSE"), "utf8").split("\n")[0]);
        expect(text).toContain("Copyright (c) 2026 Fabio Barracano");
        expect(text).toContain(
            readFileSync(join(ROOT, "THIRD_PARTY_NOTICES.md"), "utf8").split("\n")[0],
        );
    });

    it("lists exactly the packages the build bundles, and the build-only one", () => {
        const modules = outputs
            .filter((output): output is Rollup.OutputChunk => output.type === "chunk")
            .flatMap((chunk) =>
                Object.entries(chunk.modules)
                    .filter(([, module]) => module.renderedLength > 0)
                    .map(([id]) => id),
            );
        const bundled = packageDirsOf(modules).map((dir) => {
            const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
                name: string;
                version: string;
                license: string;
            };
            return `${manifest.name} ${manifest.version} (${manifest.license})`;
        });
        const rolldown = JSON.parse(
            readFileSync(join(ROOT, "node_modules", "rolldown", "package.json"), "utf8"),
        ) as { version: string };
        expect(bundled.map((line) => line.split(" ")[0])).toEqual(
            expect.arrayContaining(["react", "react-dom", "scheduler"]),
        );
        expect(listedPackages(text)).toEqual(
            [...bundled, `rolldown ${rolldown.version} (MIT)`].sort(),
        );
    });

    it("gives every listed package its licence text", () => {
        for (const line of listedPackages(text)) {
            const section = sectionOf(text, line);
            expect(section, line).toMatch(/^\[[^\]\n]+\]\n\n\S/);
            expect(section, line).toMatch(/permission|licen[cs]e/i);
        }
    });
});

describe("a build that bundles a package it cannot list", () => {
    const temp = mkdtempSync(join(tmpdir(), "licences-repository-"));
    afterAll(() => rmSync(temp, { recursive: true, force: true }));

    it("fails on a development package that is neither a runtime dependency nor a peer", async () => {
        // fast-check and its pure-rand are development dependencies here, outside the peers.
        await expect(
            buildSource(ROOT, 'import fc from "fast-check";\nglobalThis.fc = fc;\n'),
        ).rejects.toThrow(
            /not runtime dependencies in package-lock\.json: node_modules\/fast-check, node_modules\/pure-rand\./,
        );
    }, 60_000);

    /** A library project with one peer, installed as a development package. */
    function library(name: string, peerFiles: Record<string, string>): string {
        const root = join(temp, name);
        const peer = join(root, "node_modules", "peer");
        mkdirSync(peer, { recursive: true });
        writeFileSync(
            join(peer, "package.json"),
            JSON.stringify({ name: "peer", version: "1.0.0", license: "MIT", main: "index.js" }),
        );
        writeFileSync(join(peer, "index.js"), "export const peer = 'peer';\n");
        for (const [file, content] of Object.entries(peerFiles)) {
            writeFileSync(join(peer, file), content);
        }
        writeFileSync(join(root, "LICENSE"), "Fixture licence\n");
        writeFileSync(join(root, "THIRD_PARTY_NOTICES.md"), "Fixture notices\n");
        writeFileSync(
            join(root, "package-lock.json"),
            JSON.stringify({
                lockfileVersion: 3,
                packages: {
                    "": {
                        name,
                        peerDependencies: { peer: "1.0.0" },
                        devDependencies: { peer: "1.0.0" },
                    },
                    "node_modules/peer": { version: "1.0.0", dev: true, license: "MIT" },
                },
            }),
        );
        return root;
    }

    const SOURCE = 'import { peer } from "peer";\nglobalThis.peer = peer;\n';

    it("lists a peer the build bundles, with its licence text", async () => {
        const root = library("listed", { LICENSE: "MIT License\n\nCopyright (c) 2026 Peer\n" });
        const outputs = await buildSource(root, SOURCE);
        const file = outputs.find((output) => output.fileName === "licences.txt");
        const text = String((file as Rollup.OutputAsset).source);
        expect(listedPackages(text)).toEqual(["peer 1.0.0 (MIT)"]);
        expect(sectionOf(text, "peer 1.0.0 (MIT)")).toContain("Copyright (c) 2026 Peer");
    }, 60_000);

    it("fails on a bundled package that has no licence text", async () => {
        const root = library("missing", {});
        await expect(buildSource(root, SOURCE)).rejects.toThrow(
            /peer@1\.0\.0 \(MIT\) has no licence file/,
        );
    }, 60_000);
});
