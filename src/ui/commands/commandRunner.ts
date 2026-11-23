import type { CommandRegistry } from "../../model/commands/registry.js";
import { runCommand } from "./runCommand.js";

// Running the editor's commands from the modules its instance loads (SPEC §5 `sources`, §7.1).
// The instance's module maps load the editor's command, dialog, dock, tool and overlay modules
// while `createEditorUi` runs, so those modules cannot import the module that holds the
// instance. The editor creates a runner in a module of its own, which imports no instance, and
// passes it in `config.sources.commandRunner`; the instance connects it to its command
// registry, and the editor's modules run commands through it at call time.

/** Runs the commands of the editor UI instance it was passed to (`config.sources`). */
export interface CommandRunner {
    /**
     * Runs the command `id` as `runCommand` does: returns false when the command does not exist
     * or is disabled, and reports a failure by an error toast. Throws while no instance holds
     * the runner.
     */
    run(id: string): boolean;
}

/** The registry each runner `createCommandRunner` made runs, once an instance connects it. */
const connections = new WeakMap<object, { registry: CommandRegistry | null }>();

/** A runner no instance holds yet; pass it to `createEditorUi` in `sources.commandRunner`. */
export function createCommandRunner(): CommandRunner {
    const connection: { registry: CommandRegistry | null } = { registry: null };
    const runner: CommandRunner = {
        run(id) {
            if (connection.registry === null) {
                throw new Error(
                    "CommandRunner: no editor UI holds this runner; pass it to createEditorUi " +
                        "in config.sources.commandRunner.",
                );
            }
            return runCommand(connection.registry, id);
        },
    };
    connections.set(runner, connection);
    return runner;
}

/** Whether `value` is a runner of `createCommandRunner`, and whether an instance holds it. */
export function commandRunnerState(value: unknown): "unknown" | "free" | "connected" {
    if (typeof value !== "object" || value === null) return "unknown";
    const connection = connections.get(value);
    if (connection === undefined) return "unknown";
    return connection.registry === null ? "free" : "connected";
}

/** Connects a free runner to the registry of the instance that holds it. */
export function connectCommandRunner(runner: CommandRunner, registry: CommandRegistry): void {
    const connection = connections.get(runner);
    // No connection (not a runner of createCommandRunner) or one already made.
    if (connection?.registry !== null) {
        throw new Error("CommandRunner: the runner is not a free one of createCommandRunner.");
    }
    connection.registry = registry;
}
