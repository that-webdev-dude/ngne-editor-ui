import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// The build's non-TypeScript files (SPEC §4):
// - dist/styles.css, the package's CSS entry: src/styles/tokens.css, src/styles/base.css, then
//   every other stylesheet under src/ outside src/ui/gallery/ in path order (UTF-16 code units,
//   so the order does not depend on the machine's locale).
// - dist/gallery.css, the gallery's entry: every stylesheet under src/ui/gallery/ in path order,
//   for an app's development gallery route only, after styles.css (SPEC §12).
// - dist/build/licence-texts/, the approved stand-in licence texts of the licences helper.
// Each file in a CSS entry is preceded by a comment naming it. A new stylesheet joins its entry
// by its path; no list is edited. Package modules import no CSS.

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

/** The stylesheets that open dist/styles.css, in this order. */
const FIRST_STYLESHEETS = new Set(["src/styles/tokens.css", "src/styles/base.css"]);

/** The directory whose stylesheets make dist/gallery.css instead of dist/styles.css. */
const GALLERY_DIR = "src/ui/gallery/";

/** Orders strings by UTF-16 code unit, whatever the machine's locale. */
function byCodeUnit(a: string, b: string): number {
    if (a === b) return 0;
    return a < b ? -1 : 1;
}

/** Every file under `dir`, as paths relative to the repository with "/" separators. */
function filesUnder(dir: string): string[] {
    return readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)).replaceAll("\\", "/"));
}

/** The stylesheets of dist/styles.css, in order. */
function stylesheetOrder(paths: readonly string[]): string[] {
    for (const first of FIRST_STYLESHEETS) {
        if (!paths.includes(first)) throw new Error(`build-assets: ${first} is missing.`);
    }
    const rest = paths.filter((path) => !FIRST_STYLESHEETS.has(path)).sort(byCodeUnit);
    return [...FIRST_STYLESHEETS, ...rest];
}

/** Writes `paths` to dist/`name`, each file after a comment naming it. */
function writeEntry(name: string, paths: readonly string[]): void {
    if (paths.length === 0) throw new Error(`build-assets: ${name} has no stylesheet.`);
    writeFileSync(
        join(DIST, name),
        paths
            .map((path) => `/* ${path} */\n${readFileSync(join(ROOT, path), "utf8").trimEnd()}\n`)
            .join("\n"),
    );
}

const all = filesUnder(SRC).filter((path) => path.endsWith(".css"));
const isGallery = (path: string) => path.startsWith(GALLERY_DIR);
mkdirSync(DIST, { recursive: true });
writeEntry("styles.css", stylesheetOrder(all.filter((path) => !isGallery(path))));
writeEntry("gallery.css", all.filter(isGallery).sort(byCodeUnit));

for (const path of filesUnder(join(SRC, "build", "licence-texts"))) {
    const target = join(DIST, relative(SRC, join(ROOT, path)));
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(ROOT, path), target);
}
