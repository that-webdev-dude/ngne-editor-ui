import type { StatusBarSource, StatusHint } from "@ngne/editor-ui/shell";
import { createStore } from "zustand/vanilla";
import { documentStore } from "./document.ts";

// What the demo editor's status bar reads (SPEC §8 `status`): the pointer's position over the
// demo's canvas, in CSS pixels from its top-left corner, null while the pointer is elsewhere;
// and the hint at the right end, which follows the pointer and the document. With no document
// open the hint is feedback, in the warning colour.

export interface DemoStatusInput {
    readonly pointer: { readonly x: number; readonly y: number } | null;
}

export const pointerStore = createStore<DemoStatusInput>(() => ({ pointer: null }));

const CANVAS_SELECTOR = "[data-viewport-focus]";

function onPointerMove(event: PointerEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const canvas = target?.closest(CANVAS_SELECTOR);
    if (!canvas) {
        if (pointerStore.getState().pointer !== null) pointerStore.setState({ pointer: null });
        return;
    }
    const box = canvas.getBoundingClientRect();
    const x = Math.floor(event.clientX - box.left);
    const y = Math.floor(event.clientY - box.top);
    const { pointer } = pointerStore.getState();
    if (pointer?.x !== x || pointer.y !== y) pointerStore.setState({ pointer: { x, y } });
}

function onPointerOut(event: PointerEvent): void {
    // The pointer left the page.
    if (event.relatedTarget === null) pointerStore.setState({ pointer: null });
}

document.addEventListener("pointermove", onPointerMove);
document.addEventListener("pointerout", onPointerOut);

function hint(): StatusHint {
    if (!documentStore.getState().open) return { text: "No document is open", kind: "feedback" };
    if (pointerStore.getState().pointer) return { text: "J marks the canvas" };
    return { text: "Ctrl+K opens the command palette" };
}

export const demoStatus: StatusBarSource<DemoStatusInput> = {
    read: () => pointerStore.getState(),
    hint,
    subscribe(listener) {
        const stops = [pointerStore.subscribe(listener), documentStore.subscribe(listener)];
        return () => {
            for (const stop of stops) stop();
        };
    },
};
