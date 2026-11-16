import { invokeCommand } from "../../model/commands/invoke.js";
import type { CommandRegistry } from "../../model/commands/registry.js";
import type { Command } from "../../model/commands/types.js";
import { toast } from "../messages/toast.js";

// Running a command from the interface (SPEC §7.1): how a button or a panel performs an
// action. The interface dispatches registered commands; it never changes a document itself.

/** A command that fails is reported by an error toast (DESIGN §4) and in the console. */
export function reportCommandError(error: unknown, command: Command): void {
    console.error(`Command ${command.id} failed:`, error);
    const reason = error instanceof Error ? error.message : String(error);
    toast.error(`${command.title()} failed: ${reason}`);
}

/**
 * Runs the command `id` of a registry, normally the editor UI instance's
 * (`runCommand(editorUi.commands, "file.save")`). Returns false when the command does not
 * exist or is disabled; a failure is reported by `reportCommandError`.
 */
export function runCommand(registry: CommandRegistry, id: string): boolean {
    const command = registry.get(id);
    return command ? invokeCommand(command, reportCommandError) : false;
}
