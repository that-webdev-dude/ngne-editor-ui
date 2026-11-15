import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateLicences } from "@ngne/editor-ui/licences/build";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { PAGES_BASE } from "./pages.ts";

// The gallery site (SPEC §12), deployed to this repository's Pages (BRIEF D13). It runs the
// built package: `@ngne/editor-ui` and its subpaths resolve through the `exports` map of
// package.json to dist/, so `npm run build` comes first. The build writes licences.txt beside
// index.html (SPEC §11).

const ROOT = fileURLToPath(new URL("../", import.meta.url));

type Target = string | { types: string; default: string };
const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    name: string;
    exports: Record<string, Target>;
};

/**
 * Resolves `@ngne/editor-ui` and its subpaths as a consumer's bundler does, through the
 * `exports` map; a specifier the map lacks fails the build.
 */
export function packageSubpaths(): Plugin {
    return {
        name: "ngne-editor-ui-subpaths",
        enforce: "pre",
        resolveId(id) {
            if (id !== manifest.name && !id.startsWith(`${manifest.name}/`)) return null;
            const key = id === manifest.name ? "." : `./${id.slice(manifest.name.length + 1)}`;
            const target = manifest.exports[key];
            if (!target)
                this.error(`${id} is not a subpath of the package (package.json exports).`);
            const file = typeof target === "string" ? target : target.default;
            return join(ROOT, file);
        },
    };
}

const licences = generateLicences({
    root: ROOT,
    title: "NGNE Editor UI gallery",
    // Rolldown writes its runtime helpers into every build (SPEC §11).
    buildPackages: ["node_modules/rolldown"],
});

export default defineConfig({
    root: fileURLToPath(new URL(".", import.meta.url)),
    // The development server and the preview serve the site where Pages does.
    base: PAGES_BASE,
    plugins: [packageSubpaths(), react(), licences.plugin],
    worker: { plugins: () => [licences.workerPlugin] },
    // The CSS is not minified: the minifier rewrites token values (`#ffffff` to `#fff`), and
    // the Tokens entry shows them as tokens.css and DESIGN §3 write them.
    build: { outDir: "dist", emptyOutDir: true, cssMinify: false },
});
