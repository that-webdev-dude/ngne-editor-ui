import type { CommandRegistry } from "../../model/commands/registry.js";
import type { Command } from "../../model/commands/types.js";

// The store `useCommands` reads for one component (SPEC §2 Command refresh, §7.1): what the
// component read of the registry's commands, so that a refresh that changes none of it does
// not render the component again.

/** What a component last read of one command. */
interface Seen<Menu extends string, Context extends string> {
    command: Command<Menu, Context>;
    enabled?: boolean;
    title?: string;
}

export interface CommandTracker<Menu extends string = string, Context extends string = string> {
    /**
     * A number that changes when a command is added or removed, or when a command whose
     * `enabled` or `title` was called through `commands()` now gives another value.
     */
    snapshot(): number;
    /** The registry's commands, whose `enabled` and `title` calls are recorded. */
    commands(): readonly Command<Menu, Context>[];
}

/** The ids of a command list, as one string; one per list. */
const idsOfList = new WeakMap<readonly Command[], string>();
function idsOf(list: readonly Command[]): string {
    let ids = idsOfList.get(list);
    if (ids === undefined) {
        ids = list.map((command) => command.id).join("\n");
        idsOfList.set(list, ids);
    }
    return ids;
}

/** The commands of a list by id; one map per list. */
const byIdOfList = new WeakMap<readonly Command[], ReadonlyMap<string, Command>>();
function byIdOf<Menu extends string, Context extends string>(
    list: readonly Command<Menu, Context>[],
): ReadonlyMap<string, Command<Menu, Context>> {
    let byId = byIdOfList.get(list);
    if (byId === undefined) {
        byId = new Map(list.map((command) => [command.id, command]));
        byIdOfList.set(list, byId);
    }
    return byId as ReadonlyMap<string, Command<Menu, Context>>;
}

/** The store `useCommands` reads for one component: what it read of `registry`'s commands. */
export function createCommandTracker<Menu extends string, Context extends string>(
    registry: CommandRegistry<Menu, Context>,
): CommandTracker<Menu, Context> {
    type Cmd = Command<Menu, Context>;
    const seen = new Map<string, Seen<Menu, Context>>();
    let ids: string | null = null;
    let stamp = 0;
    let tracked: { list: readonly Cmd[]; commands: readonly Cmd[] } | null = null;

    const entry = (command: Cmd): Seen<Menu, Context> => {
        let read = seen.get(command.id);
        if (read?.command !== command) {
            read = { command };
            seen.set(command.id, read);
        }
        return read;
    };
    /**
     * One recording copy per command, so a command keeps its identity across renders. It runs
     * through the registry's command at each call: what that command's `run` is then is what
     * the palette or a menu runs, as a key does.
     */
    const copies = new WeakMap<Cmd, Cmd>();
    const track = (command: Cmd): Cmd => {
        let copy = copies.get(command);
        if (!copy) {
            copy = {
                ...command,
                enabled: () => (entry(command).enabled = command.enabled()),
                title: () => (entry(command).title = command.title()),
                run: () => command.run(),
            };
            copies.set(command, copy);
        }
        return copy;
    };

    return {
        snapshot() {
            const list = registry.list();
            const listIds = idsOf(list);
            if (listIds !== ids) {
                ids = listIds;
                seen.clear();
                stamp += 1;
                return stamp;
            }
            const byId = byIdOf(list);
            let changed = false;
            for (const [id, read] of seen) {
                const command = byId.get(id);
                if (command !== read.command) {
                    // Replaced under its id (a planned command registered): read afresh.
                    seen.delete(id);
                    changed = true;
                    continue;
                }
                if (read.enabled !== undefined) {
                    const enabled = command.enabled();
                    if (enabled !== read.enabled) {
                        read.enabled = enabled;
                        changed = true;
                    }
                }
                if (read.title !== undefined) {
                    const title = command.title();
                    if (title !== read.title) {
                        read.title = title;
                        changed = true;
                    }
                }
            }
            if (changed) stamp += 1;
            return stamp;
        },
        commands() {
            const list = registry.list();
            if (tracked?.list !== list) tracked = { list, commands: list.map(track) };
            return tracked.commands;
        },
    };
}
