import { useContext, useMemo, useSyncExternalStore } from "react";
import type { CommandRegistry } from "../../model/commands/registry.js";
import type { Command } from "../../model/commands/types.js";
import { EditorUiContext } from "../editorUi/context.js";
import { createCommandTracker } from "./commandTracker.js";

// The two ways a component reads commands (SPEC §2 Command refresh, §7.1, BRIEF D14), each
// rendering the component again only when what it read changed: every refresh of the registry
// (a stroke, a file operation starting or ending) would otherwise render every component that
// shows a command. The registry is the one of the editor UI instance `UiRoot` provides, or the
// one passed in (SPEC §1.2).

/** `registry`, or the commands of the nearest `UiRoot`'s instance; throws with neither. */
function useRegistry<Menu extends string, Context extends string>(
    registry: CommandRegistry<Menu, Context> | undefined,
    hook: string,
): CommandRegistry<Menu, Context> {
    const editorUi = useContext(EditorUiContext);
    const resolved = registry ?? (editorUi?.commands as CommandRegistry<Menu, Context> | undefined);
    if (!resolved) {
        throw new Error(
            `${hook}: no command registry here; render the component under UiRoot or pass one.`,
        );
    }
    return resolved;
}

/**
 * The source `useCommandValue` hands to `useSyncExternalStore`: the registry's notifications,
 * and `read` over the registry as the snapshot, which React compares with `Object.is`.
 */
export function commandValueSource<Menu extends string, Context extends string, Value>(
    registry: CommandRegistry<Menu, Context>,
    read: (registry: CommandRegistry<Menu, Context>) => Value,
): { subscribe: (listener: () => void) => () => void; snapshot: () => Value } {
    return { subscribe: registry.subscribe, snapshot: () => read(registry) };
}

/**
 * The commands of a registry. The component renders again when a command is added or removed
 * and when a command whose `enabled` or `title` it called gives another value, so it calls
 * those functions while rendering. A refresh that changes nothing it read does not render it.
 */
export function useCommands<Menu extends string = string, Context extends string = string>(
    registry?: CommandRegistry<Menu, Context>,
): readonly Command<Menu, Context>[] {
    const commands = useRegistry(registry, "useCommands");
    const tracker = useMemo(() => createCommandTracker(commands), [commands]);
    // The same snapshot on the server: the first render reads the commands as they are.
    useSyncExternalStore(commands.subscribe, tracker.snapshot, tracker.snapshot);
    return tracker.commands();
}

/**
 * A value read from the commands of a registry, such as whether one command is enabled. It is
 * read again at each refresh of the registry, but the component renders again only when the
 * value changes (`Object.is`). `read` must be cheap and return a primitive, or the same object
 * for the same state.
 */
export function useCommandValue<
    Value,
    Menu extends string = string,
    Context extends string = string,
>(
    read: (registry: CommandRegistry<Menu, Context>) => Value,
    registry?: CommandRegistry<Menu, Context>,
): Value {
    const commands = useRegistry(registry, "useCommandValue");
    const source = commandValueSource(commands, read);
    return useSyncExternalStore(source.subscribe, source.snapshot, source.snapshot);
}
