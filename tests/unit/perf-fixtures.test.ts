import { describe, expect, it } from "vitest";
import {
    COMMAND_COUNT,
    COMMAND_MODULE_COUNT,
    createEditorUiModules,
    PACKAGE_CHORDS,
    REGISTRY_MODULE_COUNT,
    SYNTHETIC_MENUS,
} from "../perf/fixtures/editorUiModules.ts";
import type { EditorUiModuleMaps } from "../perf/fixtures/editorUiModules.ts";

// The synthetic module maps of the startup budget (docs/SPEC.md §2): 300 commands in 30
// modules, 30 modules per other registry of SPEC §1.3, unique ids, no chord conflict, and
// paths in UTF-16 code-unit order as inserted.

const maps = createEditorUiModules();

/** Module suffix of each registry (SPEC §1.3). */
const SUFFIXES: Record<keyof EditorUiModuleMaps, string> = {
    commands: ".commands.ts",
    dialogs: ".dialog.tsx",
    dock: ".dock.tsx",
    contextBars: ".contextbar.tsx",
    tools: ".tools.ts",
    overlays: ".overlay.ts",
    statusFields: ".status.ts",
};

/** The ids each registry keys its entries by. */
const idsOf: { [K in keyof EditorUiModuleMaps]: (map: EditorUiModuleMaps[K]) => string[] } = {
    commands: (map) => Object.values(map).flatMap((module) => module.commands.map((c) => c.id)),
    dialogs: (map) =>
        Object.values(map).flatMap((module) => module.commandDialogs.map((d) => d.kind)),
    dock: (map) => Object.values(map).map((module) => module.dockPanel.id),
    contextBars: (map) => Object.values(map).map((module) => module.contextBarContent.id),
    tools: (map) => Object.values(map).flatMap((module) => module.tools.map((t) => t.id)),
    overlays: (map) =>
        Object.values(map).flatMap((module) => module.overlayLayers.map((l) => l.id)),
    statusFields: (map) =>
        Object.values(map).flatMap((module) => module.statusFields.map((f) => f.id)),
};

const REGISTRIES = Object.keys(SUFFIXES) as (keyof EditorUiModuleMaps)[];

/** Compares by UTF-16 code unit, as the registries order modules (SPEC §1.3). */
function byCodeUnit(a: string, b: string): number {
    if (a < b) return -1;
    return a > b ? 1 : 0;
}

/** A chord in canonical form: modifiers in the order Ctrl, Alt, Shift, Meta, then one key. */
const CANONICAL_CHORD = /^(?:Ctrl\+)?(?:Alt\+)?(?:Shift\+)?(?:Meta\+)?[A-Z0-9]$/;

/** Every binding of the maps: commands in their context, tools' keys in `canvas`. */
function bindings(): { context: string; chord: string; id: string }[] {
    const commands = Object.values(maps.commands).flatMap((module) =>
        module.commands.map((c) => ({ context: c.context, chord: c.shortcut, id: c.id })),
    );
    const tools = Object.values(maps.tools).flatMap((module) =>
        module.tools.map((t) => ({ context: "canvas", chord: t.shortcut, id: `tool ${t.id}` })),
    );
    return [...commands, ...tools];
}

describe("perf fixtures: command modules", () => {
    it("hold 300 commands in 30 modules with unique ids", () => {
        const modules = Object.values(maps.commands);
        const ids = idsOf.commands(maps.commands);
        expect(modules).toHaveLength(COMMAND_MODULE_COUNT);
        expect(COMMAND_COUNT).toBe(300);
        expect(COMMAND_MODULE_COUNT).toBe(30);
        expect(ids).toHaveLength(COMMAND_COUNT);
        expect(new Set(ids).size).toBe(COMMAND_COUNT);
        for (const module of modules) expect(module.commands).toHaveLength(10);
    });

    it("give every command its own canonical chord, none of the package's", () => {
        const chords = Object.values(maps.commands).flatMap((module) =>
            module.commands.map((c) => c.shortcut),
        );
        expect(new Set(chords).size).toBe(COMMAND_COUNT);
        expect(chords.filter((chord) => !CANONICAL_CHORD.test(chord))).toEqual([]);
        expect(chords.filter((chord) => PACKAGE_CHORDS.includes(chord))).toEqual([]);
    });

    it("bind no chord twice in one context, tool keys included", () => {
        const byBinding = new Map<string, string[]>();
        for (const { context, chord, id } of bindings()) {
            const key = `${context} ${chord}`;
            byBinding.set(key, [...(byBinding.get(key) ?? []), id]);
        }
        const conflicts = [...byBinding].filter(([, ids]) => ids.length > 1);
        expect(conflicts).toEqual([]);
    });

    it("place every command in a menu of the synthetic menu bar", () => {
        const menus: readonly string[] = SYNTHETIC_MENUS;
        expect(menus).toContain("View");
        expect(menus.at(-1)).toBe("Help");
        const commands = Object.values(maps.commands).flatMap((module) => module.commands);
        expect(commands.filter((c) => !menus.includes(c.menuPath[0] ?? ""))).toEqual([]);
    });
});

describe("perf fixtures: other registries", () => {
    it.each(REGISTRIES.filter((registry) => registry !== "commands"))(
        "%s: 30 modules with unique ids",
        (registry) => {
            const map = maps[registry];
            const ids = (idsOf[registry] as (map: unknown) => string[])(map);
            expect(Object.keys(map)).toHaveLength(REGISTRY_MODULE_COUNT);
            expect(REGISTRY_MODULE_COUNT).toBe(30);
            expect(ids.length).toBeGreaterThanOrEqual(REGISTRY_MODULE_COUNT);
            expect(new Set(ids).size).toBe(ids.length);
        },
    );
});

describe("perf fixtures: module paths", () => {
    it.each(REGISTRIES)("%s: glob keys with the registry's suffix", (registry) => {
        const paths = Object.keys(maps[registry]);
        expect(paths.filter((path) => !path.startsWith("/src/"))).toEqual([]);
        expect(paths.filter((path) => !path.endsWith(SUFFIXES[registry]))).toEqual([]);
        expect(new Set(paths).size).toBe(paths.length);
    });

    it.each(REGISTRIES)("%s: UTF-16 code-unit order is insertion order", (registry) => {
        const paths = Object.keys(maps[registry]);
        expect([...paths].sort(byCodeUnit)).toEqual(paths);
    });
});

describe("perf fixtures: builder", () => {
    it("builds new maps on every call", () => {
        const again = createEditorUiModules();
        expect(again).toEqual(maps);
        expect(again.commands).not.toBe(maps.commands);
    });
});
