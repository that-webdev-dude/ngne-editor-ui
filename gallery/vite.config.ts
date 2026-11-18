import { copyFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateLicences, LICENCES_FILE } from "@ngne/editor-ui/licences/build";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { PAGES_BASE } from "./pages.ts";

// The gallery site (SPEC §12), deployed to this repository's Pages (BRIEF D13): the gallery
// page and the demo editor's page (demo/, SPEC §5). It runs the built package:
// `@ngne/editor-ui` and its subpaths resolve through the `exports` map of package.json to
// dist/, so `npm run build` comes first. The build writes licences.txt beside index.html
// (SPEC §11), and the same file beside demo/index.html, which the demo editor's View → Open
// Source Licences… shows (SPEC §12).

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SITE = fileURLToPath(new URL(".", import.meta.url));

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

/** The demo editor's page, under the site. */
const DEMO_DIR = "demo";

/**
 * The site's licences file beside the demo editor's page too, where an editor's command reads
 * it (SPEC §11): the build copies it, and the development server answers its address with the
 * site's file. Listed before the licences plugin, whose server middleware then sees the
 * rewritten address.
 */
function demoLicences(): Plugin {
    return {
        name: "ngne-gallery-demo-licences",
        configureServer(server) {
            const demoAddress = `${server.config.base}${DEMO_DIR}/${LICENCES_FILE}`;
            server.middlewares.use((request, _response, next) => {
                const path = (request.url ?? "").split("?")[0];
                if (path === demoAddress) request.url = `${server.config.base}${LICENCES_FILE}`;
                next();
            });
        },
        writeBundle(options) {
            const dir = options.dir ?? join(SITE, "dist");
            copyFileSync(join(dir, LICENCES_FILE), join(dir, DEMO_DIR, LICENCES_FILE));
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
    root: SITE,
    // The development server and the preview serve the site where Pages does.
    base: PAGES_BASE,
    plugins: [packageSubpaths(), react(), demoLicences(), licences.plugin],
    worker: { plugins: () => [licences.workerPlugin] },
    // The CSS is not minified: the minifier rewrites token values (`#ffffff` to `#fff`), and
    // the Tokens entry shows them as tokens.css and DESIGN §3 write them.
    // No module-preload polyfill: the browsers the suite targets preload modules themselves
    // (SPEC §4), and the bundle then holds no bundler-written code beyond Rolldown's runtime,
    // which licences.txt lists.
    build: {
        outDir: "dist",
        emptyOutDir: true,
        cssMinify: false,
        modulePreload: { polyfill: false },
        rolldownOptions: {
            input: { gallery: join(SITE, "index.html"), demo: join(SITE, DEMO_DIR, "index.html") },
        },
    },
});
