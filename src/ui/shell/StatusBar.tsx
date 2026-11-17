import { useMemo, useSyncExternalStore } from "react";
import type { StatusField } from "../../model/registries/statusFields.js";
import { runCommand } from "../commands/runCommand.js";
import { useCommandValue } from "../commands/useCommands.js";
import { useEditorUi } from "../editorUi/context.js";

// The status bar frame (SPEC §8, DESIGN §2, §5): the `*.status.ts` fields of the instance in
// registry order, left to right, then the hint at the right end. What the fields read and the
// hint come from the editor's `StatusBarSource`; the bar renders again only when a text it
// shows changes, not at every change of the stores behind them.

/** The contextual hint at the right end of the status bar. */
export interface StatusHint {
    readonly text: string;
    /** `feedback` (transient tool feedback) is shown in the warning colour; the default is `hint`. */
    readonly kind?: "hint" | "feedback";
}

/** What the status bar shows besides its fields' own stores (SPEC §8 `status`). */
export interface StatusBarSource<Input = unknown> {
    /** What the fields read now; passed to each field's `text`. */
    read(): Input;
    /** The hint at the right end now, or null for none. */
    hint(): StatusHint | null;
    /**
     * Calls `listener` whenever what `read` or `hint` return may have changed; returns the
     * function that stops it.
     */
    subscribe(listener: () => void): () => void;
}

interface StatusSnapshot {
    /** Each field's text, in the order of the fields. */
    readonly texts: readonly string[];
    readonly hint: string;
    readonly kind: "hint" | "feedback";
}

const sameTexts = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((text, index) => text === b[index]);

const sameSnapshot = (a: StatusSnapshot, b: StatusSnapshot) =>
    a.hint === b.hint && a.kind === b.kind && sameTexts(a.texts, b.texts);

const noUpdates = () => () => undefined;

/**
 * The bar's texts as an external store: notified by the source and by every field's own store;
 * the snapshot is the same object while no text changed, so React renders only on a change.
 */
function statusStore(
    source: StatusBarSource | undefined,
    fields: readonly StatusField[],
): { subscribe: (listener: () => void) => () => void; snapshot: () => StatusSnapshot } {
    let last: StatusSnapshot | null = null;
    return {
        subscribe(listener) {
            const stops = [
                (source?.subscribe ?? noUpdates)(listener),
                ...fields.flatMap((field) => (field.subscribe ? [field.subscribe(listener)] : [])),
            ];
            return () => {
                for (const stop of stops) stop();
            };
        },
        snapshot() {
            const input = source?.read();
            const hint = source?.hint() ?? null;
            const next: StatusSnapshot = {
                texts: fields.map((field) => field.text(input)),
                hint: hint?.text ?? "",
                kind: hint?.kind ?? "hint",
            };
            if (last && sameSnapshot(last, next)) return last;
            last = next;
            return next;
        },
    };
}

/** A field's command as a quiet button right after its text ("Fit" after the zoom). */
function StatusAction({ fieldId, commandId }: Readonly<{ fieldId: string; commandId: string }>) {
    const { commands } = useEditorUi();
    const title = useCommandValue((registry) => registry.get(commandId)?.title() ?? null);
    const enabled = useCommandValue((registry) => registry.get(commandId)?.enabled() ?? false);
    if (title === null) return null;
    return (
        <button
            type="button"
            className="status-action"
            data-status-action={fieldId}
            disabled={!enabled}
            onClick={() => runCommand(commands, commandId)}
        >
            {title}
        </button>
    );
}

export interface StatusBarProps {
    /**
     * What the fields read and the hint; without it the fields read `undefined`. Keep it the
     * same object across renders (a module-level object), or the bar subscribes again each time.
     */
    source?: StatusBarSource;
}

/**
 * The status bar's content: each field at its reserved width, then the hint. A field without
 * text is not rendered unless it reserves its width, so the fields after it keep their place.
 * A field's action is a control, not a field, so it carries no `data-status`. A field with a
 * store of its own (`subscribe`) renders the bar again when that store changes.
 */
export function StatusBar({ source }: Readonly<StatusBarProps>) {
    const fields: readonly StatusField[] = useEditorUi().statusFields;
    const store = useMemo(() => statusStore(source, fields), [source, fields]);
    const { texts, hint, kind } = useSyncExternalStore(
        store.subscribe,
        store.snapshot,
        store.snapshot,
    );

    return (
        <>
            {fields.flatMap((field, index) => {
                const text = texts[index] ?? "";
                if (!text && field.reserve === undefined) return [];
                const shown = [
                    <span
                        key={field.id}
                        className="status-field"
                        data-status={field.id}
                        style={field.reserve ? { minWidth: `${field.reserve}ch` } : undefined}
                    >
                        {text}
                    </span>,
                ];
                if (text && field.action) {
                    shown.push(
                        <StatusAction
                            key={`${field.id}:action`}
                            fieldId={field.id}
                            commandId={field.action.commandId}
                        />,
                    );
                }
                return shown;
            })}
            {hint ? (
                <span className="status-message" data-status="message" data-kind={kind}>
                    {hint}
                </span>
            ) : null}
        </>
    );
}
