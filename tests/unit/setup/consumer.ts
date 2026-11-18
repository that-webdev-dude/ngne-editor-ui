import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TestProject } from "vitest/node";
import { npm, pack } from "../support/npm.ts";

// A consumer of the packed package (SPEC §3, §4): after the build (tests/unit/setup/build.ts),
// `npm pack` writes the tarball and a scratch project installs it from that file, as an app
// does, with the peers and their type packages linked from this repository's node_modules.
// The API-surface tests resolve every subpath from that project, through Node and TypeScript.

declare module "vitest" {
    export interface ProvidedContext {
        /** The scratch project with the packed package installed. */
        consumerRoot: string;
    }
}

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** What an app installs beside the package: the peers and their type packages. */
function linkedPackages(): string[] {
    const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
        peerDependencies: Record<string, string>;
    };
    return [
        ...Object.keys(manifest.peerDependencies),
        "@types/react",
        "@types/react-dom",
        "@types/node",
    ];
}

export default function setup(project: TestProject): () => void {
    const scratch = realpathSync.native(mkdtempSync(join(tmpdir(), "ngne-editor-ui-consumer-")));
    const consumer = join(scratch, "consumer");
    mkdirSync(consumer);
    writeFileSync(
        join(consumer, "package.json"),
        `${JSON.stringify({ name: "consumer", private: true, type: "module" }, null, 4)}\n`,
    );
    const { filename } = pack(ROOT, ["--pack-destination", scratch]);
    // The tarball only: peers come from the links below, so nothing reaches the registry.
    npm(
        [
            "install",
            "--offline",
            "--ignore-scripts",
            "--legacy-peer-deps",
            "--no-package-lock",
            "--no-audit",
            "--no-fund",
            join(scratch, filename),
        ],
        consumer,
    );
    for (const name of linkedPackages()) {
        const link = join(consumer, "node_modules", name);
        mkdirSync(dirname(link), { recursive: true });
        symlinkSync(join(ROOT, "node_modules", name), link, "junction");
    }
    project.provide("consumerRoot", consumer);
    return () => rmSync(scratch, { recursive: true, force: true });
}
