// Module maps, the input of every registry factory (SPEC §1.3, BRIEF D15). An editor discovers
// the modules of one registry with one `import.meta.glob(pattern, { eager: true })` line and
// passes the result; the package orders the modules by path, compared by UTF-16 code unit so the
// order does not depend on the machine's locale (BRIEF D14), validates what they export and
// throws at startup, naming the module, when they cannot form one registry.

/** Modules by path, as `import.meta.glob(pattern, { eager: true })` returns them. */
export type ModuleMap<Module> = Readonly<Record<string, Module>>;

/** Thrown when the modules of a registry cannot be registered; `path` names the module. */
export class RegistrationError extends Error {
    override readonly name = "RegistrationError";

    constructor(
        message: string,
        /** The path of the module, as the module map keys it. */
        readonly path: string,
        options?: ErrorOptions,
    ) {
        super(message, options);
    }
}

/** Orders strings by UTF-16 code unit, as the default sort does, whatever the locale. */
export function compareCodeUnits(a: string, b: string): number {
    if (a === b) return 0;
    return a < b ? -1 : 1;
}

/** The modules of `map` with their paths, in UTF-16 code-unit order of the paths. */
export function orderedModules<Module>(
    map: ModuleMap<Module>,
): readonly (readonly [path: string, module: Module])[] {
    return Object.keys(map)
        .sort(compareCodeUnits)
        .map((path) => [path, map[path]!] as const);
}

/**
 * Calls `register` for each module of `map` in path order. An error it throws is reported as a
 * `RegistrationError` naming the module's path, with the original error as its cause; a
 * `RegistrationError` passes unchanged.
 */
export function registerModules<Module>(
    map: ModuleMap<Module>,
    register: (module: Module, path: string) => void,
): void {
    for (const [path, module] of orderedModules(map)) {
        try {
            register(module, path);
        } catch (error) {
            if (error instanceof RegistrationError) throw error;
            const message = error instanceof Error ? error.message : String(error);
            throw new RegistrationError(`${path}: ${message}`, path, { cause: error });
        }
    }
}

/** How the modules of one registry export their entries. */
export interface EntryRules {
    /** The export each module must have: `"dockPanel"`. */
    exportName: string;
    /** Whether the export is a list of entries (`overlayLayers`) or one entry (`dockPanel`). */
    list: boolean;
    /** The registry's entries in messages, capitalised: `"Dock panel"`. */
    noun: string;
    /** One entry in the message for a missing key: `"panel"` in "A panel of … has no id.". */
    item: string;
    /** The field that identifies an entry, unique in the registry. */
    key: "id" | "kind";
    /** Whether each entry has a numeric `order`, which must then be finite. */
    ordered: boolean;
}

/** An entry with the path of the module that exports it. */
export interface CollectedEntry<Entry> {
    readonly entry: Entry;
    readonly path: string;
}

/**
 * The entries of every module of `map`, modules in path order and each module's entries in
 * the order it declares them. Throws a `RegistrationError` naming the module when a module
 * lacks the export, an entry has no key or no finite order, or a key is used twice (the message
 * then names both modules).
 */
export function collectEntries<Entry>(
    map: ModuleMap<object>,
    rules: EntryRules,
): CollectedEntry<Entry>[] {
    const seen = new Map<string, string>();
    const collected: CollectedEntry<Entry>[] = [];
    for (const [path, module] of orderedModules(map)) {
        for (const entry of exportedEntries(module, path, rules)) {
            const key = validEntryKey(entry, path, rules);
            const first = seen.get(key);
            if (first !== undefined) {
                throw new RegistrationError(
                    `${rules.noun} ${rules.key} "${key}" is used by ${first} and ${path}.`,
                    path,
                );
            }
            seen.set(key, path);
            collected.push({ entry: entry as Entry, path });
        }
    }
    return collected;
}

/** The entries `module` exports under `rules.exportName`; throws when it has no such export. */
function exportedEntries(module: object, path: string, rules: EntryRules): readonly unknown[] {
    const exported: unknown = (module as Record<string, unknown>)[rules.exportName];
    if (rules.list && Array.isArray(exported)) return exported;
    if (!rules.list && typeof exported === "object" && exported !== null) return [exported];
    throw new RegistrationError(`${path} does not export "${rules.exportName}".`, path);
}

/** The key of `entry`; throws when it has no key or, for ordered entries, no finite order. */
function validEntryKey(entry: unknown, path: string, rules: EntryRules): string {
    const fields = (entry ?? {}) as Record<string, unknown>;
    const key = fields[rules.key];
    if (typeof key !== "string" || key.trim() === "") {
        throw new RegistrationError(`A ${rules.item} of ${path} has no ${rules.key}.`, path);
    }
    if (rules.ordered && !Number.isFinite(fields.order)) {
        throw new RegistrationError(`${rules.noun} "${key}" (${path}) has no order.`, path);
    }
    return key;
}

/** Orders entries by `order`, then by id in code-unit order, so modules' order does not matter. */
export function byOrderThenId(
    a: { readonly order: number; readonly id: string },
    b: { readonly order: number; readonly id: string },
): number {
    return a.order - b.order || compareCodeUnits(a.id, b.id);
}
