import { existsSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// The open-source licences file of an editor's build (`licences.txt` beside `index.html`,
// SPEC §11): the program's licence, its THIRD_PARTY_NOTICES.md, and the full licence text of
// every npm package whose code ends up in the build. `generateLicences` (./plugin.ts) writes
// it: the build lists the packages of the modules it bundled (the app and its web workers),
// and the build-only packages whose virtual modules it rendered (`VIRTUAL_MODULES`); the
// development server, which bundles nothing, lists the runtime dependencies of
// package-lock.json and every build-only package.
//
// Every package listed must carry a licence of the allowlist and a licence file whose text is
// that licence's (`LICENCE_PHRASES`); a package without them fails the build (`LicenceError`).
// The build also fails on a rendered module it cannot place (`unknownModules`) and on a
// written licences file that does not list exactly the build's packages
// (`licencesFileMismatch`); a later build, such as the service worker's, fails on code of a
// package the file does not list (`unlistedPackages`). A package that publishes no licence
// file of its own may have a stand-in text, named after the package (`@scope/name` as
// `@scope__name.txt`) and copied from the package's own repository: the exception is
// explicit and approved by the owner, never made up here. This package ships the approved
// stand-ins under licence-texts/ (PROVENANCE §4); an app may add directories of its own.

/** The file the build writes, relative to the app's base. */
export const LICENCES_FILE = "licences.txt";

/** SPDX identifiers a shipped package may carry, unless the app passes its own list. */
export const ALLOWED_LICENCES: readonly string[] = [
    "MIT",
    "ISC",
    "0BSD",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "Apache-2.0",
];

/**
 * Phrases of the text of each licence of `ALLOWED_LICENCES`. A package's licence files must
 * hold every phrase of the licence it declares (of one alternative of an OR, of every part of
 * an AND). They are compared as lower-case words: every run of other characters, line breaks
 * and comment marks included, reads as one space.
 */
export const LICENCE_PHRASES: Readonly<Record<string, readonly string[]>> = {
    MIT: ["Permission is hereby granted, free of charge, to any person obtaining a copy"],
    ISC: [
        "distribute this software for any purpose with or without fee is hereby granted",
        "provided that the above copyright notice and this permission notice appear in all copies",
    ],
    "0BSD": ["distribute this software for any purpose with or without fee is hereby granted"],
    "BSD-2-Clause": [
        "Redistributions of source code must retain the above copyright notice",
        "Redistributions in binary form must reproduce the above copyright notice",
    ],
    "BSD-3-Clause": [
        "Redistributions of source code must retain the above copyright notice",
        "Redistributions in binary form must reproduce the above copyright notice",
        "Neither the name of",
    ],
    "Apache-2.0": ["Apache License", "Version 2.0"],
};

/**
 * The virtual modules (ids that name no file) a build may render, unless the app passes its
 * own list, each with the build-only package whose code it is, by its place under the
 * project: rolldown's module runtime and the modulepreload polyfill its native plugin builds.
 */
export const VIRTUAL_MODULES: Readonly<Record<string, string>> = {
    "\0rolldown/runtime.js": "node_modules/rolldown",
    "\0vite/modulepreload-polyfill.js": "node_modules/rolldown",
};

/** Licence files, NOTICE and third-party licence files among them, at a package's top. */
const LICENCE_FILE_NAME = /^(licen[cs]e|copying|notice|third-party-licen[cs]e)([.-].*)?$/i;

/** The stand-in licence texts this package ships (PROVENANCE §4). */
export const PACKAGE_STAND_IN_TEXTS: StandInTexts = {
    dir: fileURLToPath(new URL("../licence-texts/", import.meta.url)),
    label: "@ngne/editor-ui/licence-texts",
};

/** Why a package cannot be listed. */
export class LicenceError extends Error {
    override name = "LicenceError";
}

/** A directory of stand-in licence texts, and how the licences file names its files. */
export interface StandInTexts {
    /** The directory that holds `<name>.txt` files (`fallbackFileOf`). */
    dir: string;
    /** The directory as the licences file names it: "scripts/licence-texts", … */
    label: string;
}

/** One file of a package's licence. */
export interface LicenceText {
    /** The file name: "LICENSE", "LICENSE.md", … or the stand-in's labelled path. */
    file: string;
    text: string;
}

/** A package as the licences file lists it. */
export interface PackageLicence {
    name: string;
    version: string;
    /** The package's SPDX licence expression. */
    licence: string;
    texts: readonly LicenceText[];
}

/**
 * Code of a bundled package that the build must leave out: the program does not use it, and
 * the package credits it to a source of its own. Each is found in the built JavaScript by
 * string literals that survive minification.
 */
export interface ExcludedCode {
    /** What the code is, as the build's error names it. */
    what: string;
    /** Patterns any of which, found in a built file, means the code is there. */
    markers: readonly RegExp[];
}

/** Orders strings by UTF-16 code unit, as `Array.prototype.sort` does by default. */
function byCodeUnit(a: string, b: string): number {
    if (a === b) return 0;
    return a < b ? -1 : 1;
}

/**
 * The directory of the npm package a bundled module belongs to, or null for a module of the
 * program itself (or a virtual one). The innermost `node_modules` counts, so a nested copy
 * of a package is that copy.
 */
export function packageDirOf(moduleId: string): string | null {
    const id = moduleId.startsWith("\0") ? moduleId.slice(1) : moduleId;
    const query = id.search(/[?#]/);
    const path = (query < 0 ? id : id.slice(0, query)).replaceAll("\\", "/");
    const marker = "/node_modules/";
    const at = path.lastIndexOf(marker);
    if (at < 0) return null;
    const rest = path.slice(at + marker.length).split("/");
    const parts = rest[0]?.startsWith("@") ? rest.slice(0, 2) : rest.slice(0, 1);
    if (parts.length === 0 || parts.includes("")) return null;
    return `${path.slice(0, at + marker.length)}${parts.join("/")}`;
}

/** The package directories of the modules, each once, in order of name (by code unit). */
export function packageDirsOf(moduleIds: Iterable<string>): string[] {
    const dirs = new Set<string>();
    for (const id of moduleIds) {
        const dir = packageDirOf(id);
        if (dir) dirs.add(dir);
    }
    return [...dirs].sort((a, b) => byCodeUnit(nameFromDir(a), nameFromDir(b)) || byCodeUnit(a, b));
}

function nameFromDir(dir: string): string {
    return dir.slice(dir.lastIndexOf("/node_modules/") + "/node_modules/".length);
}

/** Where the code of a rendered module comes from. */
export type ModuleSource =
    /** A file of the program, under the project and outside `node_modules`. */
    | { kind: "program" }
    /** A file of the npm package in `dir`. */
    | { kind: "package"; dir: string }
    /** A declared virtual module: code of the build-only package at `path` under the project. */
    | { kind: "bundler"; path: string }
    /** Anything else: an undeclared virtual module, or a file outside the project. */
    | { kind: "unknown" };

/**
 * Where the code of the module `moduleId` of a build of the project at `root` comes from, with
 * `virtualModules` the virtual modules the build may render (`VIRTUAL_MODULES`).
 */
export function moduleSource(
    moduleId: string,
    root: string,
    virtualModules: Readonly<Record<string, string>> = VIRTUAL_MODULES,
): ModuleSource {
    const bundler = virtualModules[moduleId];
    if (bundler !== undefined) return { kind: "bundler", path: bundler };
    const dir = packageDirOf(moduleId);
    if (dir !== null) return { kind: "package", dir };
    const id = moduleId.startsWith("\0") ? moduleId.slice(1) : moduleId;
    const query = id.search(/[?#]/);
    const path = query < 0 ? id : id.slice(0, query);
    // A file is an absolute path, POSIX or Windows; any other id names no file.
    if (!/^([a-z]:)?[\\/]/i.test(path)) return { kind: "unknown" };
    const inside = relative(root, path);
    if (inside === "" || inside.startsWith("..") || isAbsolute(inside)) return { kind: "unknown" };
    return { kind: "program" };
}

/** The modules among `moduleIds` whose code no licence covers (`moduleSource` "unknown"). */
export function unknownModules(
    moduleIds: Iterable<string>,
    root: string,
    virtualModules: Readonly<Record<string, string>> = VIRTUAL_MODULES,
): string[] {
    return [...moduleIds].filter((id) => moduleSource(id, root, virtualModules).kind === "unknown");
}

/**
 * The build-only packages, by their place under the project, of the virtual modules of
 * `virtualModules` among `moduleIds`, each once, in order by code unit.
 */
export function bundlerPackagesOf(
    moduleIds: Iterable<string>,
    virtualModules: Readonly<Record<string, string>> = VIRTUAL_MODULES,
): string[] {
    const used = new Set<string>();
    for (const id of moduleIds) {
        const path = virtualModules[id];
        if (path !== undefined) used.add(path);
    }
    return [...used].sort(byCodeUnit);
}

/**
 * Whether an SPDX expression is allowed: one identifier of `allowed`, or an expression of
 * them with OR (one allowed alternative suffices), AND (every part must be allowed) and
 * brackets.
 */
export function licenceAllowed(
    expression: string,
    allowed: readonly string[] = ALLOWED_LICENCES,
): boolean {
    return satisfies(expression, (id) => allowed.includes(id));
}

/**
 * Whether `texts` hold the text of an SPDX expression's licence, by `phrases`: of one
 * alternative of an OR that is in `allowed`, of every part of an AND. A licence without
 * phrases is never held.
 */
export function licenceTextMatches(
    expression: string,
    texts: readonly string[],
    allowed: readonly string[] = ALLOWED_LICENCES,
    phrases: Readonly<Record<string, readonly string[]>> = LICENCE_PHRASES,
): boolean {
    const words = texts.map(wordsOf).join(" | ");
    return satisfies(expression, (id) => {
        const wanted = phrases[id];
        if (!allowed.includes(id) || !wanted?.length) return false;
        return wanted.every((phrase) => words.includes(wordsOf(phrase)));
    });
}

/** Lower-case words, each run of other characters as one space. */
function wordsOf(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

/**
 * Whether an SPDX expression holds when each identifier holds as `holds` says: identifiers
 * joined by AND (every part must hold), which binds tighter than OR (one alternative
 * suffices), grouped by brackets anywhere. Anything else, `WITH` included, is not an
 * expression and never holds.
 */
function satisfies(expression: string, holds: (id: string) => boolean): boolean {
    const tokens = expression
        .replaceAll(/[()]/g, " $& ")
        .split(/\s+/)
        .filter((token) => token !== "");
    let at = 0;

    // Each reader returns null for a token sequence that is not an expression. Both sides
    // of an operator are read in full, so a malformed part is never skipped.
    const either = (): boolean | null => {
        let value = both();
        while (value !== null && tokens[at] === "OR") {
            at += 1;
            const next = both();
            value = next === null ? null : value || next;
        }
        return value;
    };
    const both = (): boolean | null => {
        let value = operand();
        while (value !== null && tokens[at] === "AND") {
            at += 1;
            const next = operand();
            value = next === null ? null : value && next;
        }
        return value;
    };
    const operand = (): boolean | null => {
        const token = tokens[at];
        at += 1;
        if (token === "(") {
            const value = either();
            const closed = tokens[at] === ")";
            at += 1;
            return closed ? value : null;
        }
        if (token === undefined || [")", "AND", "OR", "WITH"].includes(token)) return null;
        return holds(token);
    };

    return either() === true && at === tokens.length;
}

/** An SPDX identifier as `package.json` gives one: a string, or an object with a string `type`. */
function spdxOf(value: unknown): string | null {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "type" in value && typeof value.type === "string") {
        return value.type;
    }
    return null;
}

/**
 * The licence of a `package.json`: `license`, or the older `licenses` list (its entries as
 * alternatives). Null when neither states one, or when an entry of the list is no identifier.
 */
function licenceOf(manifest: Record<string, unknown>): string | null {
    const { license, licenses } = manifest;
    const single = spdxOf(license);
    if (single !== null) return single;
    if (Array.isArray(licenses) && licenses.length > 0) {
        const entries = licenses.map(spdxOf);
        if (entries.includes(null)) return null;
        return entries.join(" OR ");
    }
    return null;
}

/** The stand-in file that stands in for a package's missing licence file. */
export function fallbackFileOf(name: string): string {
    return `${name.replace("/", "__")}.txt`;
}

/** The `package.json` of the package in `dir`, with its name (or its directory's) and version. */
function readManifest(dir: string): {
    manifest: Record<string, unknown>;
    name: string;
    version: string;
} {
    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Record<
        string,
        unknown
    >;
    const name =
        typeof manifest.name === "string" ? manifest.name : nameFromDir(dir.replaceAll("\\", "/"));
    const version = typeof manifest.version === "string" ? manifest.version : "";
    return { manifest, name, version };
}

/**
 * Reads the package in `dir`: its name, version and licence from `package.json`, and the text
 * of each licence file at its top (or of its stand-in, from the first directory of
 * `standIns` that has one). Throws `LicenceError` when the licence is missing or not allowed,
 * when no licence text is found, or when no licence text holds the declared licence's
 * `phrases` (`licenceTextMatches`).
 */
export function readPackageLicence(
    dir: string,
    standIns: readonly StandInTexts[],
    allowed: readonly string[] = ALLOWED_LICENCES,
    phrases: Readonly<Record<string, readonly string[]>> = LICENCE_PHRASES,
): PackageLicence {
    const { manifest, name, version } = readManifest(dir);
    const licence = licenceOf(manifest);
    if (licence === null) {
        throw new LicenceError(`${name}@${version} states no licence in its package.json.`);
    }
    if (!licenceAllowed(licence, allowed)) {
        throw new LicenceError(
            `${name}@${version} is licensed ${licence}, which is not one of ${allowed.join(", ")}.`,
        );
    }
    let texts: LicenceText[] = readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && LICENCE_FILE_NAME.test(entry.name))
        .map((entry) => entry.name)
        .sort(byCodeUnit)
        .map((file) => ({ file, text: normalise(readFileSync(join(dir, file), "utf8")) }));
    if (texts.length === 0) {
        const file = fallbackFileOf(name);
        const standIn = standIns.find(({ dir: standInDir }) => existsSync(join(standInDir, file)));
        if (standIn) {
            texts = [
                {
                    file: `${standIn.label}/${file}`,
                    text: normalise(readFileSync(join(standIn.dir, file), "utf8")),
                },
            ];
        }
    }
    if (texts.length === 0) {
        throw new LicenceError(
            `${name}@${version} (${licence}) has no licence file. Add its licence text, from ` +
                `the package's repository, as ${fallbackFileOf(name)} in a stand-in directory.`,
        );
    }
    if (
        !licenceTextMatches(
            licence,
            texts.map(({ text }) => text),
            allowed,
            phrases,
        )
    ) {
        throw new LicenceError(
            `${name}@${version} declares ${licence}, but none of its licence files ` +
                `(${texts.map(({ file }) => file).join(", ")}) holds that licence's text.`,
        );
    }
    return { name, version, licence, texts };
}

/** Line endings LF, no trailing spaces, one final newline. */
function normalise(text: string): string {
    return `${text
        .replace(/^\uFEFF/, "")
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n")
        .trim()}\n`;
}

/**
 * The runtime dependencies of a `package-lock.json` (lockfile version 2 or 3): the directory
 * of every package it does not mark `dev`, relative to the project, in order of name.
 * Packages that hold only type declarations (`@types/*`, or a package with types and no
 * entry point) are left out: none of their code can reach a build.
 */
export function runtimePackageDirs(lockText: string, root: string): string[] {
    const lock = JSON.parse(lockText) as { packages?: Record<string, { dev?: boolean }> };
    if (!lock.packages)
        throw new LicenceError("package-lock.json has no `packages` (lockfile v2+).");
    const dirs: string[] = [];
    for (const [path, entry] of Object.entries(lock.packages)) {
        if (path === "" || entry.dev || !path.includes("node_modules/")) continue;
        const dir = `${trimRoot(root)}/${path}`;
        if (typesOnly(dir)) continue;
        dirs.push(dir);
    }
    return packageDirsOf(dirs.map((dir) => `${dir}/package.json`));
}

function trimRoot(root: string): string {
    return root.replaceAll("\\", "/").replace(/\/$/, "");
}

/** A package's place under the project: "node_modules/a" or "node_modules/a/node_modules/b". */
function packageKey(dir: string): string {
    const path = dir.replaceAll("\\", "/");
    return path.slice(path.indexOf("/node_modules/") + 1);
}

/**
 * The packages of `dirs` that are not among `runtimeDirs` (as `runtimePackageDirs` gives
 * them), by their place under the project: code the build bundles from a development
 * dependency, which the licences file would not vouch for.
 */
export function strayPackages(dirs: readonly string[], runtimeDirs: readonly string[]): string[] {
    const runtime = new Set(runtimeDirs.map(packageKey));
    return dirs.map(packageKey).filter((key) => !runtime.has(key));
}

/**
 * The packages whose code `moduleIds` render and that `listedDirs` (the packages a licences
 * file lists) do not list, each once, by their place under the project: npm packages and the
 * build-only packages of their virtual modules (`virtualModules`). For a build that runs
 * after the licences file was made, such as the service worker's; `listedDirs` is null while
 * the file has not been made, which leaves every package unlisted.
 */
export function unlistedPackages(
    moduleIds: Iterable<string>,
    listedDirs: readonly string[] | null,
    virtualModules: Readonly<Record<string, string>> = VIRTUAL_MODULES,
): string[] {
    const ids = [...moduleIds];
    const listed = new Set((listedDirs ?? []).map(packageKey));
    const keys = [...packageDirsOf(ids).map(packageKey), ...bundlerPackagesOf(ids, virtualModules)];
    return [...new Set(keys)].filter((key) => !listed.has(key));
}

/**
 * The directories under `root` of the build-only packages, given by their place under the
 * project ("node_modules/rolldown"): development packages whose own code the bundler writes
 * into a build as virtual modules (`VIRTUAL_MODULES`), which `packageDirOf` cannot place. The
 * stray check leaves them alone. Throws `LicenceError` when one is not installed.
 */
export function buildPackageDirs(root: string, buildPackages: readonly string[]): string[] {
    const base = trimRoot(root);
    return buildPackages.map((path) => {
        const dir = `${base}/${path}`;
        if (!existsSync(join(dir, "package.json"))) {
            throw new LicenceError(`${path} is not installed; run npm ci.`);
        }
        return dir;
    });
}

/** A package entry of a lockfile, as far as `peerPackageDirs` reads it. */
interface LockEntry {
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
}

/**
 * Where the lockfile installs the package `name` that the package at `from` ("" for the
 * project, "node_modules/a", …) requires: its own `node_modules` first, then each enclosing
 * one, as Node resolves it. Null when the lockfile has none (an optional peer left out).
 */
function installedFrom(
    packages: Record<string, LockEntry>,
    from: string,
    name: string,
): string | null {
    let base = from;
    for (;;) {
        const path = base === "" ? `node_modules/${name}` : `${base}/node_modules/${name}`;
        if (path in packages) return path;
        if (base === "") return null;
        const at = base.lastIndexOf("/node_modules/");
        base = at < 0 ? "" : base.slice(0, at);
    }
}

/**
 * The project's peer dependencies and every package they require, from a `package-lock.json`
 * (lockfile version 2 or 3), as directories under `root` in order of name, without type-only
 * packages. A library installs its peers as development dependencies, and its own site (the
 * gallery, SPEC §12) bundles them; an app has no peers, so this is empty for it.
 */
export function peerPackageDirs(lockText: string, root: string): string[] {
    const lock = JSON.parse(lockText) as { packages?: Record<string, LockEntry> };
    const packages = lock.packages;
    if (!packages) throw new LicenceError("package-lock.json has no `packages` (lockfile v2+).");
    const found = new Set<string>();
    const pending: [string, string][] = Object.keys(packages[""]?.peerDependencies ?? {}).map(
        (name) => ["", name],
    );
    for (let next = pending.pop(); next; next = pending.pop()) {
        const path = installedFrom(packages, ...next);
        if (path === null || found.has(path)) continue;
        found.add(path);
        const entry = packages[path] ?? {};
        for (const names of [
            entry.dependencies,
            entry.optionalDependencies,
            entry.peerDependencies,
        ]) {
            for (const name of Object.keys(names ?? {})) pending.push([path, name]);
        }
    }
    const dirs = [...found]
        .map((path) => `${trimRoot(root)}/${path}`)
        .filter((dir) => !typesOnly(dir));
    return packageDirsOf(dirs.map((dir) => `${dir}/package.json`));
}

function typesOnly(dir: string): boolean {
    const name = nameFromDir(dir);
    if (name.startsWith("@types/")) return true;
    const file = join(dir, "package.json");
    if (!existsSync(file)) return false;
    const manifest = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    const hasTypes = Boolean(manifest.types ?? manifest.typings);
    const hasEntry = Boolean(
        manifest.main || manifest.module || manifest.exports || manifest.browser,
    );
    return hasTypes && !hasEntry;
}

/** What the licences file is made of. */
export interface LicencesInput {
    /** The program's name, as the file's title. */
    title: string;
    /** The text of the program's LICENSE. */
    licence: string;
    /** The text of THIRD_PARTY_NOTICES.md. */
    notices: string;
    packages: readonly PackageLicence[];
}

const RULE = "=".repeat(78);
const THIN = "-".repeat(78);

/** The text of the licences file; the same input always gives the same text. */
export function licencesText(input: LicencesInput): string {
    const packages = [...input.packages].sort(
        (a, b) => byCodeUnit(a.name, b.name) || byCodeUnit(a.version, b.version),
    );
    const sections = [
        `${input.title}: open source licences`,
        RULE,
        "This file holds the licence of this program, the notices of third-party code it",
        "contains, and the licence of every npm package whose code is part of this build.",
        "",
        RULE,
        input.title,
        RULE,
        normalise(input.licence),
        RULE,
        "Third-party notices (THIRD_PARTY_NOTICES.md)",
        RULE,
        normalise(input.notices),
        RULE,
        `npm packages in this build (${packages.length})`,
        RULE,
        ...packages.map((entry) => `${entry.name} ${entry.version} (${entry.licence})`),
        "",
        ...packages.flatMap((entry) => [
            THIN,
            `${entry.name} ${entry.version} (${entry.licence})`,
            THIN,
            ...entry.texts.flatMap(({ file, text }) => [`[${file}]`, "", text]),
        ]),
    ];
    return `${sections
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()}\n`;
}

/** The options of `generateLicences` and `buildLicencesFile` (SPEC §11). */
export interface LicencesOptions {
    /** The project directory: its package-lock.json and node_modules. */
    root: string;
    /** The program's name, as the file's title. */
    title: string;
    /** The program's licence, relative to `root`. Default "LICENSE". */
    licencePath?: string;
    /** The program's notices, relative to `root`. Default "THIRD_PARTY_NOTICES.md". */
    noticesPath?: string;
    /** Build-only packages by their place under `root` (`buildPackageDirs`). Default none. */
    buildPackages?: readonly string[];
    /**
     * The virtual modules the build may render, each with its package of `buildPackages`
     * (`moduleSource`). Default `VIRTUAL_MODULES`.
     */
    virtualModules?: Readonly<Record<string, string>>;
    /** Code the build must leave out (`excludedCodeIn`). Default none. */
    excludedCode?: readonly ExcludedCode[];
    /** SPDX identifiers a listed package may carry. Default `ALLOWED_LICENCES`. */
    allowedLicences?: readonly string[];
    /** The phrases of each allowed licence's text (`licenceTextMatches`). Default `LICENCE_PHRASES`. */
    licencePhrases?: Readonly<Record<string, readonly string[]>>;
    /** The app's stand-in directories, searched before this package's own. Default none. */
    standInTexts?: readonly StandInTexts[];
}

/**
 * The licences file for the packages in `dirs`, with the program's licence and notices from
 * `options.root`. Throws `LicenceError` as `readPackageLicence` does.
 */
export function buildLicencesFile(dirs: readonly string[], options: LicencesOptions): string {
    const standIns = [...(options.standInTexts ?? []), PACKAGE_STAND_IN_TEXTS];
    const allowed = options.allowedLicences ?? ALLOWED_LICENCES;
    return licencesText({
        title: options.title,
        licence: readFileSync(join(options.root, options.licencePath ?? "LICENSE"), "utf8"),
        notices: readFileSync(
            join(options.root, options.noticesPath ?? "THIRD_PARTY_NOTICES.md"),
            "utf8",
        ),
        packages: dirs.map((dir) =>
            readPackageLicence(dir, standIns, allowed, options.licencePhrases),
        ),
    });
}

/**
 * The packages a licences file lists, as "name version", in its order. Throws `LicenceError`
 * when the file has no package list or its count is not the number of packages listed.
 */
export function listedPackages(text: string): string[] {
    const heading = /\nnpm packages in this build \((\d+)\)\n={78}\n/.exec(text);
    if (!heading) throw new LicenceError("The licences file has no list of npm packages.");
    const start = heading.index + heading[0].length;
    const end = text.indexOf("\n\n", start);
    const lines = text.slice(start, end < 0 ? undefined : end).split("\n");
    const listed = lines
        .filter((line) => line !== "")
        .map((line) => {
            const entry = /^(\S+) (\S*) \(.+\)$/.exec(line);
            if (!entry) throw new LicenceError(`The licences file lists "${line}", not a package.`);
            return `${entry[1]} ${entry[2]}`;
        });
    if (listed.length !== Number(heading[1])) {
        throw new LicenceError(
            `The licences file counts ${heading[1]} npm packages but lists ${listed.length}.`,
        );
    }
    return listed;
}

/**
 * The directories of `dirs` whose package, by name and version read from its `package.json`,
 * the licences file `text` lists (`listedPackages`), in the order of `dirs`.
 */
export function listedDirsIn(text: string, dirs: readonly string[]): string[] {
    const listed = new Set(listedPackages(text));
    return dirs.filter((dir) => {
        const { name, version } = readManifest(dir);
        return listed.has(`${name} ${version}`);
    });
}

/** How the packages a licences file lists differ from a build's. */
export interface LicencesMismatch {
    /** Packages of the build the file does not list, as "name version". */
    missing: string[];
    /** Packages the file lists that are not the build's, as "name version". */
    extra: string[];
}

/**
 * How the packages a licences file lists (`listedPackages`) differ from the packages in `dirs`,
 * the build's, read from their `package.json`. Both lists are empty when they agree.
 */
export function licencesFileMismatch(text: string, dirs: readonly string[]): LicencesMismatch {
    const listed = new Set(listedPackages(text));
    const bundled = new Set(
        dirs.map((dir) => {
            const { name, version } = readManifest(dir);
            return `${name} ${version}`;
        }),
    );
    return {
        missing: [...bundled].filter((entry) => !listed.has(entry)).sort(byCodeUnit),
        extra: [...listed].filter((entry) => !bundled.has(entry)).sort(byCodeUnit),
    };
}

/** What of `excluded` the JavaScript `code` holds, each once. */
export function excludedCodeIn(code: string, excluded: readonly ExcludedCode[]): string[] {
    return excluded
        .filter(({ markers }) => markers.some((marker) => marker.test(code)))
        .map(({ what }) => what);
}
