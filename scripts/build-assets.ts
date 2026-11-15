import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// The build's non-TypeScript files (SPEC §4):
// - dist/styles.css, the package's one CSS entry: src/styles/tokens.css, src/styles/base.css,
//   then every other stylesheet under src/ in path order (UTF-16 code units, so the order does
//   not depend on the machine's locale). Each file is preceded by a comment naming it. A new
//   stylesheet joins by being under src/; no list is edited. Package modules import no CSS.
// - dist/build/licence-texts/, the approved stand-in licence texts of the licences helper.

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

/** The stylesheets that open the entry, in this order. */
const FIRST_STYLESHEETS = ["src/styles/tokens.css", "src/styles/base.css"];

/** Every file under `dir`, as paths relative to the repository with "/" separators. */
function filesUnder(dir: string): string[] {
    return readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)).replaceAll("\\", "/"));
}

/** The stylesheets of the entry, in order. */
function stylesheetOrder(paths: readonly string[]): string[] {
    for (const first of FIRST_STYLESHEETS) {
        if (!paths.includes(first)) throw new Error(`build-assets: ${first} is missing.`);
    }
    const rest = paths
        .filter((path) => !FIRST_STYLESHEETS.includes(path))
        .sort((a, b) => (a === b ? 0 : a < b ? -1 : 1));
    return [...FIRST_STYLESHEETS, ...rest];
}

const stylesheets = stylesheetOrder(filesUnder(SRC).filter((path) => path.endsWith(".css")));
mkdirSync(DIST, { recursive: true });
writeFileSync(
    join(DIST, "styles.css"),
    stylesheets
        .map((path) => `/* ${path} */\n${readFileSync(join(ROOT, path), "utf8").trimEnd()}\n`)
        .join("\n"),
);

for (const path of filesUnder(join(SRC, "build", "licence-texts"))) {
    const target = join(DIST, relative(SRC, join(ROOT, path)));
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(ROOT, path), target);
}
