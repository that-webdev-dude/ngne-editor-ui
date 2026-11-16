import { chordFromEvent, chordKey, eventKey } from "../../model/commands/chord.js";
import type { KeyEventLike } from "../../model/commands/chord.js";
import { invokeCommand } from "../../model/commands/invoke.js";
import type { CommandErrorHandler } from "../../model/commands/invoke.js";
import type { CommandRegistry } from "../../model/commands/registry.js";
import { resolveKey } from "../../model/commands/resolve.js";
import type { KeyEnvironment } from "../../model/commands/resolve.js";
import type { Command } from "../../model/commands/types.js";
import { readKeyEnvironment } from "./keyEnvironment.js";

// Keymap installation (SPEC §7.2): the keyboard listener that resolves each key against the
// command registry in the key environment of the moment and runs what it resolves to. `UiRoot`
// installs it for its instance; tests pass a target and the environment by hand.

/** The keyboard event fields the keymap reads and the one call it makes. */
export interface KeymapEvent extends KeyEventLike {
    repeat: boolean;
    isComposing: boolean;
    defaultPrevented: boolean;
    preventDefault(): void;
}

/** The part of `window` the keymap listens on; tests pass an `EventTarget`. */
export interface KeymapTarget {
    addEventListener(type: string, listener: (event: Event) => void): void;
    removeEventListener(type: string, listener: (event: Event) => void): void;
}

export interface KeymapOptions<Menu extends string = string, Context extends string = string> {
    registry: CommandRegistry<Menu, Context>;
    /** Where the key events arrive; the default is `window`. */
    target?: KeymapTarget;
    /** The environment of the key being pressed; the default reads `document`. */
    environment?(): KeyEnvironment;
    /** The editor's contexts active for the key being pressed; the default is none. */
    activeContexts?(): readonly Context[];
    /** Receives what a command throws; the default logs it. */
    onError?: CommandErrorHandler<Menu, Context>;
}

/**
 * Connects the keyboard to the command registry (SPEC §7.2). One listener in the bubble phase:
 * a control that handled the key and prevented its default is left alone. Returns the function
 * that disconnects the keymap.
 *
 * A resolved chord has its browser default prevented, whether its command is enabled or not.
 * A hold binding (`release`) runs once on key down and is released on key up or when the
 * window loses focus.
 */
export function installKeymap<Menu extends string, Context extends string>(
    options: KeymapOptions<Menu, Context>,
): () => void {
    const { registry } = options;
    const target: KeymapTarget = options.target ?? window;
    const environment = options.environment ?? (() => readKeyEnvironment(document));
    const activeContexts = options.activeContexts ?? (() => []);
    const onError: CommandErrorHandler<Menu, Context> =
        options.onError ?? ((error, command) => console.error(`Command ${command.id}:`, error));
    /** Hold bindings whose key is down, by key. */
    const held = new Map<string, Command<Menu, Context>>();

    const onKeyDown = (event: Event) => {
        const key = event as Event & KeymapEvent;
        if (key.defaultPrevented || key.isComposing) return;
        const chord = chordFromEvent(key);
        if (chord === null) return;

        const resolution = resolveKey(registry, chord, environment(), activeContexts());
        if (resolution.action === "pass") return;
        key.preventDefault();
        if (resolution.action === "suppress") return;

        const { command } = resolution;
        if (!command.release) {
            invokeCommand(command, onError);
            return;
        }
        // The key repeats while it is held; the binding starts once.
        const heldKey = chordKey(chord);
        if (key.repeat || held.has(heldKey)) return;
        if (invokeCommand(command, onError)) held.set(heldKey, command);
    };

    const release = (heldKey: string) => {
        const command = held.get(heldKey);
        if (!command) return;
        held.delete(heldKey);
        try {
            command.release?.();
        } catch (error) {
            onError(error, command);
        }
    };

    const onKeyUp = (event: Event) => {
        const key = event as Event & KeymapEvent;
        const heldKey = eventKey(key);
        if (heldKey === null) return;
        const wasHeld = held.has(heldKey);
        release(heldKey);
        // Releasing Alt on its own would otherwise move focus to the browser's menu.
        if (wasHeld || (heldKey === "Alt" && registry.isBound("Alt"))) key.preventDefault();
    };

    const onBlur = () => {
        // Deleting the entry being visited is safe in a Map's iteration.
        for (const heldKey of held.keys()) release(heldKey);
    };

    target.addEventListener("keydown", onKeyDown);
    target.addEventListener("keyup", onKeyUp);
    target.addEventListener("blur", onBlur);
    return () => {
        target.removeEventListener("keydown", onKeyDown);
        target.removeEventListener("keyup", onKeyUp);
        target.removeEventListener("blur", onBlur);
        onBlur();
    };
}
