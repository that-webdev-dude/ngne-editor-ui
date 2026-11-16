import { chordKey } from "./chord.js";
import {
    isBrowserChord,
    isCharacterChord,
    isNativeKeyChord,
    isTextEditingChord,
} from "./keyClasses.js";
import type { CommandRegistry } from "./registry.js";
import type { Command, KeyContext } from "./types.js";

// Key resolution (SPEC §7.2). It takes plain values: the editor's contexts that are active
// (state contexts switched on, focus contexts whose region has focus) and the key environment
// of the moment, both read from the page by the editor UI; tests build them by hand.

/** What resolution needs to know about the moment a key is pressed, beside the contexts. */
export interface KeyEnvironment {
    /** A menu, dialog or popover is open; those handle their own keys. */
    overlayOpen: boolean;
    /**
     * What has keyboard focus: a text or number field, the viewport element itself, another
     * control, or nothing (the page body).
     */
    focus: "text" | "viewport" | "control" | "none";
    /** Native keys (keyClasses.ts) the focused control consumes itself. */
    nativeKeys: ReadonlySet<string>;
    /** The focused control uses typed characters for typeahead (a select). */
    typeahead: boolean;
}

/**
 * The contexts that apply, highest priority first (SPEC §7.2): none while an overlay is open;
 * only `text` while a text field has focus; otherwise the active editor contexts in the order
 * of `contexts`, then `canvas`, then `global`.
 */
export function applicableContexts<Context extends string>(
    contexts: readonly KeyContext<Context>[],
    active: readonly Context[],
    environment: KeyEnvironment,
): KeyContext<Context>[] {
    if (environment.overlayOpen) return [];
    // A text field is exclusive: of all bindings only those made in `text` still act.
    if (environment.focus === "text") return ["text"];
    const own = contexts.filter(
        (context) =>
            context !== "text" &&
            context !== "canvas" &&
            context !== "global" &&
            active.includes(context as Context),
    );
    return [...own, "canvas", "global"];
}

export type KeyResolution<Menu extends string = string, Context extends string = string> =
    /** The key belongs to `command`, bound in `context`. `command` may be disabled. */
    | { action: "run"; command: Command<Menu, Context>; context: KeyContext<Context> }
    /** A bound chord that does not act here; its browser default is suppressed. */
    | { action: "suppress" }
    /** Not the keymap's key: the focused control or the browser handles it. */
    | { action: "pass" };

const PASS = { action: "pass" } as const;

/**
 * Resolves a canonical chord (SPEC §7.2): the first applicable context that binds the chord
 * gets it. Before that, the focused control gets the keys it consumes natively, and the
 * `canvas` bindings of native keys act only while the viewport itself has focus.
 *
 * Among several commands that bind the chord in the winning context the first enabled one is
 * returned; when none is enabled the first is, so the caller suppresses the key without
 * running anything. A lower context is not tried in that case.
 */
export function resolveKey<Menu extends string, Context extends string>(
    registry: Pick<CommandRegistry<Menu, Context>, "contexts" | "bindings" | "isBound">,
    chord: string,
    environment: KeyEnvironment,
    active: readonly Context[],
): KeyResolution<Menu, Context> {
    const native = isNativeKeyChord(chord);
    const takenByControl =
        environment.focus !== "text" &&
        ((native && environment.nativeKeys.has(chordKey(chord))) ||
            (environment.typeahead && isCharacterChord(chord)));

    if (!takenByControl) {
        for (const context of applicableContexts(registry.contexts, active, environment)) {
            if (context === "canvas" && native && environment.focus !== "viewport") continue;
            const bound = registry.bindings(context, chord);
            const command = bound.find((candidate) => candidate.enabled()) ?? bound[0];
            if (command) return { action: "run", command, context };
        }
    }

    // Bound somewhere, not acting here: no bookmark dialog for Ctrl+D, no find bar for F3.
    // Keys the control or the text field handles are never touched.
    const handledNatively =
        takenByControl || (environment.focus === "text" && isTextEditingChord(chord));
    if (!handledNatively && isBrowserChord(chord) && registry.isBound(chord)) {
        return { action: "suppress" };
    }
    return PASS;
}
