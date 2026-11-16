import type { Command } from "./types.js";

/** Receives what a command threw, or what its promise was rejected with. */
export type CommandErrorHandler<Menu extends string = string, Context extends string = string> = (
    error: unknown,
    command: Command<Menu, Context>,
) => void;

/**
 * Runs a command the way every caller of the registry does (menu, shortcut, palette): not at
 * all while it is disabled, and with failures handed to `onError` instead of thrown. Returns
 * whether the command was run. The registry's `beforeRun` is part of the command's `run`, so
 * what it throws reaches `onError` too (SPEC §7.1).
 */
export function invokeCommand<Menu extends string, Context extends string>(
    command: Command<Menu, Context>,
    onError: CommandErrorHandler<Menu, Context>,
): boolean {
    if (!command.enabled()) return false;
    try {
        const result = command.run();
        if (result instanceof Promise) {
            result.catch((error: unknown) => onError(error, command));
        }
    } catch (error) {
        onError(error, command);
    }
    return true;
}
