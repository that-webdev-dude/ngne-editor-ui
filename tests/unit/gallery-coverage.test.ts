import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// The gallery shows every component the package exports (SPEC §12, BRIEF D13): each React
// component exported by a UI subpath of SPEC §4 appears in at least one gallery entry. An
// entry shows a component when the gallery's sources use it — the package's frame and entries
// (src/ui/gallery/) and the site with its demo editor (gallery/), whose entry the site passes
// to the gallery — or when a package component they show uses it (the surface host shows the
// command palette, `AppShell` shows the window-too-small notice). A use is a reference that
// resolves to the component's declaration; an import, a re-export or a reference from code that
// is not a component does not count.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

type Target = string | { types: string; default: string };
const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    name: string;
    exports: Record<string, Target>;
};

/** A subpath and the source file of its entry module. */
interface Subpath {
    name: string;
    file: string;
}

/** The subpaths whose layer in the SPEC §4 table is UI, with their entry modules' sources. */
function uiSubpaths(): Subpath[] {
    const spec = readFileSync(join(ROOT, "docs", "SPEC.md"), "utf8");
    const section = spec.slice(spec.indexOf("## 4. Packaging"), spec.indexOf("## 5."));
    const rows = [...section.matchAll(/^\| `(@ngne\/editor-ui[^`]*)` \| ([^|]+) \|/gm)];
    return rows
        .filter(([, , layer]) => /\bUI\b/.test(layer!))
        .map(([, name]) => {
            const key = name === manifest.name ? "." : `./${name!.slice(manifest.name.length + 1)}`;
            const target = manifest.exports[key]!;
            const built = typeof target === "string" ? target : target.default;
            const source = built.replace(/^\.\/dist\//, "src/").replace(/\.js$/, ".ts");
            return { name: name!, file: join(ROOT, source) };
        });
}

/** The TypeScript and TSX files under `dir`, but its build output. */
function sourcesUnder(dir: string): string[] {
    return readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
        .map((entry) => join(entry.parentPath, entry.name))
        .filter((file) => !relative(ROOT, file).replaceAll("\\", "/").includes("/dist/"));
}

/** The program of the repository's typecheck (tsconfig.json) over `files`. */
function repositoryProgram(files: readonly string[]): ts.Program {
    const { config } = ts.readConfigFile(join(ROOT, "tsconfig.json"), ts.sys.readFile);
    const { options } = ts.parseJsonConfigFileContent(config, ts.sys, ROOT);
    return ts.createProgram(files, { ...options, noEmit: true });
}

const resolved = (checker: ts.TypeChecker, symbol: ts.Symbol) =>
    symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;

const isComponentName = (name: string) => /^[A-Z][a-z]/.test(name);

/** Whether a class declaration extends React's `Component` or `PureComponent`. */
function extendsComponent(node: ts.ClassDeclaration): boolean {
    return (node.heritageClauses ?? []).some(
        (clause) =>
            clause.token === ts.SyntaxKind.ExtendsKeyword &&
            clause.types.some(({ expression }) => {
                const name = ts.isPropertyAccessExpression(expression)
                    ? expression.name.text
                    : expression.getText();
                return name === "Component" || name === "PureComponent";
            }),
    );
}

/** Whether a declaration is a React component: a function, a function value, or a class one. */
function isComponentDeclaration(node: ts.Declaration): boolean {
    if (ts.isFunctionDeclaration(node)) return node.getSourceFile().fileName.endsWith(".tsx");
    if (ts.isClassDeclaration(node)) return extendsComponent(node);
    if (ts.isVariableDeclaration(node) && node.initializer) {
        const { initializer } = node;
        const isFunction =
            ts.isArrowFunction(initializer) ||
            ts.isFunctionExpression(initializer) ||
            ts.isCallExpression(initializer);
        return isFunction && node.getSourceFile().fileName.endsWith(".tsx");
    }
    return false;
}

/** A component's key: the file that declares it and its name. */
const keyOf = (symbol: ts.Symbol) =>
    `${symbol.declarations![0]!.getSourceFile().fileName}#${symbol.name}`;

interface Component {
    /** "subpath: Name". */
    label: string;
    key: string;
    files: readonly string[];
}

/** The components each subpath exports, by key; one exported by two subpaths is listed once per subpath. */
function componentsOf(program: ts.Program, subpaths: readonly Subpath[]): Component[] {
    const checker = program.getTypeChecker();
    return subpaths.flatMap(({ name, file }) => {
        const source = program.getSourceFile(file);
        if (!source) throw new Error(`${file} is not in the program.`);
        const module = checker.getSymbolAtLocation(source);
        if (!module) return [];
        return checker
            .getExportsOfModule(module)
            .map((symbol) => resolved(checker, symbol))
            .filter(
                (symbol) =>
                    symbol.flags & ts.SymbolFlags.Value &&
                    isComponentName(symbol.name) &&
                    (symbol.declarations ?? []).some(isComponentDeclaration),
            )
            .map((symbol) => ({
                label: `${name}: ${symbol.name}`,
                key: keyOf(symbol),
                files: [...new Set(symbol.declarations!.map((d) => d.getSourceFile().fileName))],
            }));
    });
}

/** Whether `node` names what it declares, imports or re-exports rather than using it. */
function isDeclarationName(node: ts.Identifier): boolean {
    const { parent } = node;
    if (
        ts.isImportSpecifier(parent) ||
        ts.isImportClause(parent) ||
        ts.isNamespaceImport(parent) ||
        ts.isExportSpecifier(parent)
    ) {
        return true;
    }
    return (
        (ts.isFunctionDeclaration(parent) ||
            ts.isClassDeclaration(parent) ||
            ts.isVariableDeclaration(parent)) &&
        parent.name === node
    );
}

/** The keys of the declarations `file` uses. */
function usesOf(program: ts.Program, file: string): Set<string> {
    const checker = program.getTypeChecker();
    const source = program.getSourceFile(file);
    if (!source) throw new Error(`${file} is not in the program.`);
    const used = new Set<string>();
    const visit = (node: ts.Node) => {
        if (ts.isIdentifier(node) && !isDeclarationName(node)) {
            const symbol = checker.getSymbolAtLocation(node);
            if (symbol) {
                const target = resolved(checker, symbol);
                if (target.declarations?.length) used.add(keyOf(target));
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return used;
}

/**
 * The components no gallery entry shows, as "subpath: Name": those the gallery's `sources` do
 * not use, directly or through the package components they show.
 */
function missingFromGallery(
    program: ts.Program,
    subpaths: readonly Subpath[],
    sources: readonly string[],
): string[] {
    const components = componentsOf(program, subpaths);
    const byKey = new Map(components.map((component) => [component.key, component]));
    const shown = new Set<string>();
    const queue = sources.flatMap((file) => [...usesOf(program, file)]);
    while (queue.length > 0) {
        const key = queue.pop()!;
        const component = byKey.get(key);
        if (!component || shown.has(key)) continue;
        shown.add(key);
        for (const file of component.files) queue.push(...usesOf(program, file));
    }
    return components.filter(({ key }) => !shown.has(key)).map(({ label }) => label);
}

// --- The fixture: a subpath with a component no entry shows ---------------------------------

const FIXTURE_ROOT = join(ROOT, "__gallery-coverage-fixture__");

const FIXTURE: Readonly<Record<string, string>> = {
    "ui/widgets/Shown.tsx": "export function Shown() { return null; }",
    "ui/widgets/Hosted.tsx": "export function Hosted() { return null; }",
    "ui/widgets/Host.tsx": [
        'import { Hosted } from "./Hosted.js";',
        "const SURFACES = { hosted: Hosted };",
        "export function Host() { return SURFACES.hosted(); }",
    ].join("\n"),
    "ui/widgets/Orphan.tsx": "export function Orphan() { return null; }",
    "ui/widgets/helpers.ts": [
        'import { Orphan } from "./Orphan.js";',
        "export const REGISTRY = [Orphan];",
        "export function makeThing() { return 1; }",
        "export class WidgetError extends Error {}",
    ].join("\n"),
    "ui/widgets/index.ts": [
        'export { Shown } from "./Shown.js";',
        'export { Host } from "./Host.js";',
        'export { Hosted } from "./Hosted.js";',
        'export { Orphan } from "./Orphan.js";',
        'export { makeThing, REGISTRY, WidgetError } from "./helpers.js";',
    ].join("\n"),
    "gallery/entry.tsx": [
        'import { Host, REGISTRY, Shown } from "../ui/widgets/index.js";',
        "export const ENTRY = [Shown, Host, REGISTRY];",
    ].join("\n"),
};

/** A program over the fixture's files, kept in memory. */
function fixtureProgram(): ts.Program {
    const options: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        strict: true,
        noEmit: true,
        types: [],
    };
    const files = new Map(
        Object.entries(FIXTURE).map(([path, text]) => [join(FIXTURE_ROOT, path), text]),
    );
    const normal = (file: string) => join(file);
    const host = ts.createCompilerHost(options);
    const { getSourceFile, fileExists, readFile, directoryExists } = host;
    host.fileExists = (file) => files.has(normal(file)) || fileExists.call(host, file);
    host.readFile = (file) => files.get(normal(file)) ?? readFile.call(host, file);
    host.directoryExists = (dir) =>
        normal(dir).startsWith(FIXTURE_ROOT) || (directoryExists?.call(host, dir) ?? false);
    host.getSourceFile = (file, language, ...rest) => {
        const text = files.get(normal(file));
        return text === undefined
            ? getSourceFile.call(host, file, language, ...rest)
            : ts.createSourceFile(file, text, language, true);
    };
    return ts.createProgram([...files.keys()], options, host);
}

// --- Tests -----------------------------------------------------------------------------------

const subpaths = uiSubpaths();
const sources = [...sourcesUnder(join("src", "ui", "gallery")), ...sourcesUnder("gallery")];
const program = repositoryProgram([...subpaths.map(({ file }) => file), ...sources]);

describe("gallery coverage", () => {
    it("reads the UI subpaths of SPEC §4 and the gallery's sources", () => {
        expect(subpaths.map(({ name }) => name)).toEqual([
            "@ngne/editor-ui",
            "@ngne/editor-ui/primitives",
            "@ngne/editor-ui/focus",
            "@ngne/editor-ui/messages",
            "@ngne/editor-ui/shell",
            "@ngne/editor-ui/commands",
            "@ngne/editor-ui/platform",
            "@ngne/editor-ui/pwa",
            "@ngne/editor-ui/about",
            "@ngne/editor-ui/licences",
            "@ngne/editor-ui/gallery",
        ]);
        const names = sources.map((file) => relative(ROOT, file).replaceAll("\\", "/"));
        expect(names).toEqual(
            expect.arrayContaining([
                "src/ui/gallery/Gallery.tsx",
                "src/ui/gallery/entries/ShellEntry.tsx",
                "gallery/main.tsx",
                "gallery/DemoEditorEntry.tsx",
                "gallery/demo/main.tsx",
            ]),
        );
    });

    it("finds the components the UI subpaths export, and only components", () => {
        const labels = componentsOf(program, subpaths).map(({ label }) => label);
        expect(labels).toEqual(
            expect.arrayContaining([
                "@ngne/editor-ui: UiRoot",
                "@ngne/editor-ui/primitives: Button",
                "@ngne/editor-ui/primitives: TooltipProvider",
                "@ngne/editor-ui/messages: WindowTooSmall",
                "@ngne/editor-ui/shell: AppShell",
                "@ngne/editor-ui/shell: TabStrip",
                "@ngne/editor-ui/commands: CommandPalette",
                "@ngne/editor-ui/about: AboutDialog",
                "@ngne/editor-ui/licences: LicencesDialog",
                "@ngne/editor-ui/gallery: Gallery",
            ]),
        );
        expect(labels).toHaveLength(32);
        for (const name of ["RegistrationError", "cx", "ICON_SIZE", "useTheme", "toast"]) {
            expect(
                labels.some((label) => label.endsWith(`: ${name}`)),
                name,
            ).toBe(false);
        }
    });

    it("shows every component exported by a UI subpath in at least one entry", () => {
        expect(missingFromGallery(program, subpaths, sources)).toEqual([]);
    }, 60_000);

    it("fails a fixture export that no entry shows", () => {
        const fixture = fixtureProgram();
        const widgets = { name: "fixture", file: join(FIXTURE_ROOT, "ui/widgets/index.ts") };
        const entry = join(FIXTURE_ROOT, "gallery/entry.tsx");
        expect(componentsOf(fixture, [widgets]).map(({ label }) => label)).toEqual([
            "fixture: Shown",
            "fixture: Host",
            "fixture: Hosted",
            "fixture: Orphan",
        ]);
        // Hosted is shown through Host; Orphan only by a registry, which is not a component.
        expect(missingFromGallery(fixture, [widgets], [entry])).toEqual(["fixture: Orphan"]);
        expect(missingFromGallery(fixture, [widgets], [])).toEqual([
            "fixture: Shown",
            "fixture: Host",
            "fixture: Hosted",
            "fixture: Orphan",
        ]);
    });
});
