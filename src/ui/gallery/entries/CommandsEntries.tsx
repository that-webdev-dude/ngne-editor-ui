import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";
import { createCommandRegistry, registerCommandModules } from "../../../model/commands/registry.js";
import type { CommandRegistry } from "../../../model/commands/registry.js";
import type { Command, CommandModule } from "../../../model/commands/types.js";
import { Chord } from "../../commands/Chord.js";
import { useCommands, useCommandValue } from "../../commands/useCommands.js";
import { Button } from "../../primitives/index.js";
import type { GalleryEntry } from "../entry.js";

// The command-refresh entry of the gallery (SPEC §2 Command refresh, §7.1): readers of
// different commands of one registry, each with a visible render counter, and buttons that
// change the store the commands read. A store change renders again exactly the readers whose
// command's `enabled()` or `title()` result changed; a change no command reads renders none.
// The registry is passed to the hooks, as code outside `UiRoot` does (SPEC §1.2).

const MENUS = ["File", "Edit", "View"] as const;
type Menu = (typeof MENUS)[number];

/** The fixture editor's state, which the commands' conditions and titles read. */
interface FixtureState {
    /** The document has unsaved changes: Save is enabled. */
    dirty: boolean;
    /** The last edit's name, in Undo's title. */
    lastEdit: string;
    /** The zoom factor: Zoom In is enabled below 8. */
    zoom: number;
    /** Changes no command reads, as a pointer position does. */
    pointer: number;
}

const EDITS: readonly string[] = ["Pencil", "Eraser", "Fill"];
const MAX_ZOOM = 8;

function fixtureModules(
    store: StoreApi<FixtureState>,
): Readonly<Record<string, CommandModule<Menu, never>>> {
    const state = () => store.getState();
    return {
        "./gallery/refresh.commands.ts": {
            commands: [
                {
                    id: "file.save",
                    title: "Save",
                    shortcut: "Ctrl+S",
                    menuPath: ["File"],
                    enabled: () => state().dirty,
                    run: () => store.setState({ dirty: false }),
                },
                {
                    id: "edit.undo",
                    title: () => `Undo ${state().lastEdit}`,
                    shortcut: "Ctrl+Z",
                    menuPath: ["Edit"],
                    run: () => {},
                },
                {
                    id: "view.zoom-in",
                    title: "Zoom In",
                    shortcut: "Ctrl+=",
                    menuPath: ["View"],
                    enabled: () => state().zoom < MAX_ZOOM,
                    run: () => store.setState({ zoom: state().zoom * 2 }),
                },
            ],
        },
    };
}

interface Fixture {
    store: StoreApi<FixtureState>;
    registry: CommandRegistry<Menu, never>;
}

function createFixture(): Fixture {
    const store = createStore<FixtureState>(() => ({
        dirty: true,
        lastEdit: "Pencil",
        zoom: 1,
        pointer: 0,
    }));
    const registry = createCommandRegistry<Menu>({ menus: MENUS });
    registerCommandModules(registry, fixtureModules(store));
    return { store, registry };
}

/**
 * Counts the commits of the calling component and writes the count into the returned
 * element: one per render that reached the page. The element has no children of React's, so
 * a render does not overwrite the count.
 */
function useRenderCounter(): RefObject<HTMLOutputElement | null> {
    const count = useRef(0);
    const output = useRef<HTMLOutputElement>(null);
    useEffect(() => {
        count.current += 1;
        if (output.current) output.current.textContent = String(count.current);
    });
    return output;
}

/** A reader's row: what it reads, what it shows, and its render count. */
function ReaderRow({
    name,
    label,
    counter,
    children,
}: Readonly<{
    name: string;
    label: string;
    counter: RefObject<HTMLOutputElement | null>;
    children: ReactNode;
}>) {
    return (
        <div className="gallery-commands__reader" data-reader={name}>
            <span className="gallery-commands__label">{label}</span>
            <span className="gallery-commands__read">{children}</span>
            <span className="gallery__readout">
                Renders: <output ref={counter} data-renders={name} />
            </span>
        </div>
    );
}

/** One command's title, chord and state. */
function CommandLine({ command }: Readonly<{ command: Command }>) {
    const chord = command.shortcuts[0];
    const enabled = command.enabled();
    return (
        <span className="gallery-commands__command" data-command={command.id}>
            <span>{command.title()}</span>
            {chord ? <Chord chord={chord} /> : null}
            <span className="gallery__readout" data-enabled={enabled}>
                {enabled ? "enabled" : "disabled"}
            </span>
        </span>
    );
}

interface ReaderProps {
    registry: CommandRegistry<Menu, never>;
}

/** Reads the commands `ids` through one `useCommands` call. */
function CommandsReader({
    name,
    ids,
    registry,
}: Readonly<ReaderProps & { name: string; ids: readonly string[] }>) {
    const counter = useRenderCounter();
    const commands = useCommands(registry).filter((command) => ids.includes(command.id));
    return (
        <ReaderRow name={name} label={`useCommands: ${ids.join(", ")}`} counter={counter}>
            {commands.map((command) => (
                <CommandLine key={command.id} command={command} />
            ))}
        </ReaderRow>
    );
}

/** Reads whether Zoom In is enabled through `useCommandValue`. */
function ValueReader({ registry }: Readonly<ReaderProps>) {
    const counter = useRenderCounter();
    const canZoom = useCommandValue(
        (commands) => commands.get("view.zoom-in")?.enabled() ?? false,
        registry,
    );
    return (
        <ReaderRow
            name="zoom-value"
            label="useCommandValue: view.zoom-in enabled"
            counter={counter}
        >
            <span data-enabled={canZoom}>{canZoom ? "Zoom In enabled" : "Zoom In disabled"}</span>
        </ReaderRow>
    );
}

function CommandRefreshEntry() {
    const [{ store, registry }] = useState(createFixture);
    // The editor's `refreshOn`: every change of the store refreshes the commands.
    useEffect(() => store.subscribe(() => registry.refresh()), [store, registry]);
    const set = (change: (state: FixtureState) => Partial<FixtureState>) =>
        store.setState(change(store.getState()));
    return (
        <div className="gallery__column">
            <div className="gallery__row">
                <Button onClick={() => set((state) => ({ dirty: !state.dirty }))}>
                    Toggle unsaved changes
                </Button>
                <Button
                    onClick={() =>
                        set((state) => ({
                            lastEdit: EDITS[(EDITS.indexOf(state.lastEdit) + 1) % EDITS.length]!,
                        }))
                    }
                >
                    Next edit
                </Button>
                <Button
                    onClick={() => set((state) => ({ zoom: state.zoom < MAX_ZOOM ? MAX_ZOOM : 1 }))}
                >
                    Toggle zoom limit
                </Button>
                <Button onClick={() => set((state) => ({ pointer: state.pointer + 1 }))}>
                    Move pointer
                </Button>
            </div>
            <div className="gallery-commands">
                <CommandsReader name="save" ids={["file.save"]} registry={registry} />
                <CommandsReader name="undo" ids={["edit.undo"]} registry={registry} />
                <CommandsReader
                    name="save-and-undo"
                    ids={["file.save", "edit.undo"]}
                    registry={registry}
                />
                <ValueReader registry={registry} />
            </div>
        </div>
    );
}

export const commandEntries: readonly GalleryEntry[] = [
    { id: "command-refresh", title: "Command refresh", Component: CommandRefreshEntry },
];
