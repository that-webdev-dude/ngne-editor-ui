import { contextMenuEntries, useCommands } from "@ngne/editor-ui/commands";
import { ContextMenu } from "@ngne/editor-ui/primitives";
import { useStore } from "zustand";
import { rowsStore } from "./rows.ts";

// The demo editor's rows panel (DESIGN §4 Context menu): each row opens the "demo-row" context
// menu, built from the commands of the instance `UiRoot` provides. Right-clicking a row makes
// it the row the commands act on.

export function DemoRows() {
    const rows = useStore(rowsStore, (state) => state.rows);
    const items = contextMenuEntries("demo-row", useCommands());
    return (
        <ul className="demo__rows" aria-label="Rows">
            {rows.map((row) => (
                <ContextMenu key={row.id} items={items}>
                    <li
                        className="demo__row"
                        tabIndex={0}
                        data-row={row.name}
                        onContextMenu={() => rowsStore.setState({ target: row.id })}
                    >
                        {row.name}
                    </li>
                </ContextMenu>
            ))}
        </ul>
    );
}
