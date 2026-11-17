import { readFileSync } from "node:fs";

// The build facts the About dialog shows (SPEC §11, DESIGN §7), read from the app's
// package.json when its bundler starts and handed to the app as `define` constants, so a
// release that bumps package.json updates the dialog with no other edit. The app's
// `vite.config.ts` passes them to Vite (and its `vitest.config.ts` to Vitest); the app builds
// its `AppInfo` from `import.meta.env` (README, Use).

/** The engine whose pinned version the About dialog names. */
const ENGINE_PACKAGE = "@ngne/core";

interface PackageJson {
    name?: unknown;
    version?: unknown;
    license?: unknown;
    dependencies?: unknown;
}

/** `value` when it is a non-empty string; otherwise throws, naming the file and the field. */
function field(path: string, value: unknown, name: string): string {
    if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`appInfoDefines: ${path}: ${name} is not a non-empty string.`);
    }
    return value;
}

function readPackageJson(path: string): PackageJson {
    let text: string;
    try {
        text = readFileSync(path, "utf8");
    } catch (error) {
        throw new Error(`appInfoDefines: ${path} cannot be read: ${(error as Error).message}`, {
            cause: error,
        });
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (error) {
        throw new Error(`appInfoDefines: ${path} is not JSON: ${(error as Error).message}`, {
            cause: error,
        });
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error(`appInfoDefines: ${path} is not a package.json object.`);
    }
    return parsed as PackageJson;
}

/**
 * The `define` entries of the app's build facts, from the package.json at `packageJsonPath`:
 * `APP_PACKAGE`, `APP_VERSION` and `APP_LICENSE` (its name, version and licence),
 * `ENGINE_PACKAGE` and `ENGINE_VERSION` (`@ngne/core` and the version it pins in
 * `dependencies`), each under `import.meta.env.` as a JSON string. Throws an error naming the
 * file and the field when one is missing or empty.
 *
 *     // vite.config.ts
 *     define: appInfoDefines(fileURLToPath(new URL("package.json", import.meta.url))),
 */
export function appInfoDefines(packageJsonPath: string): Record<string, string> {
    const pkg = readPackageJson(packageJsonPath);
    const dependencies =
        typeof pkg.dependencies === "object" && pkg.dependencies !== null
            ? (pkg.dependencies as Record<string, unknown>)
            : {};
    const values = {
        APP_PACKAGE: field(packageJsonPath, pkg.name, "name"),
        APP_VERSION: field(packageJsonPath, pkg.version, "version"),
        APP_LICENSE: field(packageJsonPath, pkg.license, "license"),
        ENGINE_PACKAGE,
        ENGINE_VERSION: field(
            packageJsonPath,
            dependencies[ENGINE_PACKAGE],
            `dependencies["${ENGINE_PACKAGE}"]`,
        ),
    };
    return Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
            `import.meta.env.${key}`,
            JSON.stringify(value),
        ]),
    );
}
