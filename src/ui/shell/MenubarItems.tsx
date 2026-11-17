import { ChevronRight } from "lucide-react";
import { Menubar } from "radix-ui";
import { formatChord } from "../../model/commands/chord.js";
import { invokeCommand } from "../../model/commands/invoke.js";
import { buildMenu } from "../../model/commands/menuModel.js";
import type { MenuNode } from "../../model/commands/menuModel.js";
import { reportCommandError } from "../commands/runCommand.js";
import { useCommands } from "../commands/useCommands.js";
import { Icon } from "../primitives/Icon.js";

interface NodesProps {
    nodes: readonly MenuNode[];
}

/** A node's React key, stable while the menu changes: a separator is named by what follows it. */
function nodeKey(nodes: readonly MenuNode[], index: number): string {
    const node = nodes[index];
    if (node === undefined) return "end";
    if (node.kind === "command") return node.command.id;
    if (node.kind === "submenu") return `submenu-${node.title}`;
    return `separator-before-${nodeKey(nodes, index + 1)}`;
}

function Nodes({ nodes }: Readonly<NodesProps>) {
    return nodes.map((node, index) => {
        if (node.kind === "separator") {
            return <Menubar.Separator key={nodeKey(nodes, index)} className="ui-menu__separator" />;
        }
        if (node.kind === "submenu") {
            return (
                <Menubar.Sub key={nodeKey(nodes, index)}>
                    <Menubar.SubTrigger className="ui-menu__item" data-submenu={node.title}>
                        {node.title}
                        <span className="ui-menu__indicator">
                            <Icon icon={ChevronRight} />
                        </span>
                    </Menubar.SubTrigger>
                    <Menubar.Portal>
                        <Menubar.SubContent className="ui-menu" collisionPadding={8}>
                            <Nodes nodes={node.children} />
                        </Menubar.SubContent>
                    </Menubar.Portal>
                </Menubar.Sub>
            );
        }
        const { command } = node;
        const shortcut = command.shortcuts[0];
        return (
            <Menubar.Item
                key={command.id}
                className="ui-menu__item"
                data-command={command.id}
                disabled={!command.enabled()}
                onSelect={() => {
                    invokeCommand(command, reportCommandError);
                }}
            >
                {command.title()}
                {shortcut ? (
                    <span className="ui-menu__shortcut" data-chord={shortcut}>
                        {formatChord(shortcut)}
                    </span>
                ) : null}
            </Menubar.Item>
        );
    });
}

export interface MenubarItemsProps {
    /** The menu of the menu bar whose items these are. */
    menu: string;
}

/**
 * The items of one menu of the menu bar, generated from the command registry of the instance
 * `UiRoot` provides (DESIGN §4, §8): shortcut right-aligned and muted, disabled items visible
 * and inert. Rendered inside the open menu, so titles and disabled states are read when the
 * menu opens and follow the state while it is open.
 */
export function MenubarItems({ menu }: Readonly<MenubarItemsProps>) {
    return <Nodes nodes={buildMenu(useCommands(), [menu])} />;
}
