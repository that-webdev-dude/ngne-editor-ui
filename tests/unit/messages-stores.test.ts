import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    commandDialogs,
    createDialogRequests,
    createNotices,
    createToastService,
    dialogView,
    INFO_TOAST_MS,
    notices,
    toast,
} from "../../src/ui/messages/index.ts";
import type { DialogRequestBase } from "../../src/ui/messages/index.ts";

// The message stores (SPEC §1.2, §6; DESIGN §4, §5): toasts (4 s; errors and toasts with an
// action stay until dismissed), notices from work the editor does on its own time, and the
// requests commands make for their dialogs. One copy of each per app.

describe("toast service", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    const messages = (service: ReturnType<typeof createToastService>) =>
        service.store.getState().toasts.map((item) => `${item.kind}: ${item.message}`);

    it("removes an information toast after 4 s", () => {
        const service = createToastService();
        service.info("Saved");
        expect(messages(service)).toEqual(["info: Saved"]);
        vi.advanceTimersByTime(INFO_TOAST_MS - 1);
        expect(messages(service)).toEqual(["info: Saved"]);
        vi.advanceTimersByTime(1);
        expect(messages(service)).toEqual([]);
        expect(INFO_TOAST_MS).toBe(4000);
    });

    it("keeps an error toast until it is dismissed", () => {
        const service = createToastService();
        const id = service.error("Import failed");
        vi.advanceTimersByTime(60_000);
        expect(messages(service)).toEqual(["error: Import failed"]);
        service.dismiss(id);
        expect(messages(service)).toEqual([]);
    });

    it("keeps an information toast with an action until it is dismissed", () => {
        const service = createToastService();
        const run = vi.fn();
        const id = service.info("A new version of the editor is ready.", {
            action: { label: "Reload", run },
        });
        vi.advanceTimersByTime(INFO_TOAST_MS * 3);
        const [item] = service.store.getState().toasts;
        expect(item).toMatchObject({ id, kind: "info", action: { label: "Reload" } });
        item!.action!.run();
        expect(run).toHaveBeenCalledTimes(1);
        service.dismiss(id);
        expect(service.store.getState().toasts).toEqual([]);
        // Without an action it still goes after 4 s.
        service.info("Saved");
        vi.advanceTimersByTime(INFO_TOAST_MS);
        expect(service.store.getState().toasts).toEqual([]);
    });

    it("keeps a shown toast with an action when the same message comes without one", () => {
        const service = createToastService();
        const id = service.info("Ready.", { action: { label: "Reload", run: () => {} } });
        expect(service.info("Ready.")).toBe(id);
        vi.advanceTimersByTime(INFO_TOAST_MS * 2);
        expect(messages(service)).toEqual(["info: Ready."]);
    });

    it("queues toasts in order and expires each on its own clock", () => {
        const service = createToastService();
        service.info("Saved");
        vi.advanceTimersByTime(1000);
        service.error("Export failed");
        service.info("Exported 3 files");
        expect(messages(service)).toEqual([
            "info: Saved",
            "error: Export failed",
            "info: Exported 3 files",
        ]);
        vi.advanceTimersByTime(3000);
        expect(messages(service)).toEqual(["error: Export failed", "info: Exported 3 files"]);
        vi.advanceTimersByTime(1000);
        expect(messages(service)).toEqual(["error: Export failed"]);
    });

    it("does not stack a message that is already shown, and restarts its clock", () => {
        const service = createToastService();
        const first = service.info("Saved");
        vi.advanceTimersByTime(3000);
        expect(service.info("Saved")).toBe(first);
        expect(messages(service)).toEqual(["info: Saved"]);
        vi.advanceTimersByTime(3000);
        expect(messages(service)).toEqual(["info: Saved"]);
        vi.advanceTimersByTime(1000);
        expect(messages(service)).toEqual([]);
        expect(service.error("Failed")).toBe(service.error("Failed"));
    });

    it("notifies subscribers of every change", () => {
        const service = createToastService();
        const counts: number[] = [];
        service.store.subscribe((state) => counts.push(state.toasts.length));
        const id = service.error("Failed");
        service.dismiss(id);
        expect(counts).toEqual([1, 0]);
    });

    it("has one service for the app", () => {
        expect(toast.store.getState().toasts).toEqual([]);
        const id = toast.error("Failed");
        expect(toast.store.getState().toasts.map((item) => item.id)).toEqual([id]);
        toast.dismiss(id);
        expect(toast.store.getState().toasts).toEqual([]);
    });
});

describe("notices", () => {
    it("go to every attached sink, by kind, until the sink is removed", () => {
        const service = createNotices();
        const first: [string, string][] = [];
        const second: [string, string][] = [];
        const detachFirst = service.attachSink((kind, message) => first.push([kind, message]));
        service.attachSink((kind, message) => second.push([kind, message]));
        service.info("Saved “hero.ngsprite”.");
        service.error("Could not open “hero.ngsprite”.");
        detachFirst();
        service.info("Exported 3 files.");
        expect(first).toEqual([
            ["info", "Saved “hero.ngsprite”."],
            ["error", "Could not open “hero.ngsprite”."],
        ]);
        expect(second).toEqual([...first, ["info", "Exported 3 files."]]);
    });

    it("keeps an ordinary notice from before the toasts on the console only", () => {
        const service = createNotices();
        const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const informed = vi.spyOn(console, "info").mockImplementation(() => undefined);
        try {
            service.error("Could not open “hero.ngsprite”.");
            service.info("Saved.");
            expect(logged).toHaveBeenCalledTimes(1);
            expect(informed).toHaveBeenCalledTimes(1);
            const sent: [string, string][] = [];
            service.attachSink((kind, message) => sent.push([kind, message]));
            expect(sent).toEqual([]);
        } finally {
            logged.mockRestore();
            informed.mockRestore();
        }
    });

    it("gives a notice sent until shown to the first sink attached, once", () => {
        const service = createNotices();
        const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
        try {
            service.error("Settings could not be saved.", { untilShown: true });
            expect(logged).toHaveBeenCalledWith("Settings could not be saved.");
            const first: [string, string][] = [];
            const second: [string, string][] = [];
            service.attachSink((kind, message) => first.push([kind, message]));
            service.attachSink((kind, message) => second.push([kind, message]));
            expect(first).toEqual([["error", "Settings could not be saved."]]);
            expect(second).toEqual([]);
        } finally {
            logged.mockRestore();
        }
    });

    it("has one notices channel for the app", () => {
        const sent: string[] = [];
        const detach = notices.attachSink((_kind, message) => sent.push(message));
        notices.info("Saved.");
        detach();
        expect(sent).toEqual(["Saved."]);
    });
});

type NumberRequest = DialogRequestBase & { answer(values: number | null): void };

describe("dialog requests", () => {
    it("a request made while no host is attached is answered with null at once", async () => {
        const requests = createDialogRequests<NumberRequest>();
        const seen: unknown[] = [];
        requests.store.subscribe((state) => seen.push(state.request));
        expect(requests.hosted).toBe(false);
        await expect(
            requests.open<number>((answer) => ({ kind: "any", answer })),
        ).resolves.toBeNull();
        expect(seen).toEqual([]);
    });

    it("opens a request while a host is attached and settles it with the answer", async () => {
        const requests = createDialogRequests<NumberRequest>();
        requests.attachHost();
        expect(requests.hosted).toBe(true);
        const pending = requests.open<number>((answer) => ({ kind: "size", answer }));
        const request = requests.store.getState().request;
        expect(request?.kind).toBe("size");
        request!.answer(32);
        await expect(pending).resolves.toBe(32);
        expect(requests.store.getState().request).toBeNull();
        // Answered already: a second answer changes nothing.
        request!.answer(64);
        expect(requests.store.getState().request).toBeNull();
    });

    it("answers a request made while another is open with null, and keeps the open one", async () => {
        const requests = createDialogRequests<NumberRequest>();
        requests.attachHost();
        const first = requests.open<number>((answer) => ({ kind: "first", answer }));
        const open = requests.store.getState().request;
        await expect(
            requests.open<number>((answer) => ({ kind: "second", answer })),
        ).resolves.toBeNull();
        expect(requests.store.getState().request).toBe(open);
        open!.answer(null);
        await expect(first).resolves.toBeNull();
        // Once it closes, the next request opens.
        const next = requests.open<number>((answer) => ({ kind: "second", answer }));
        expect(requests.store.getState().request?.kind).toBe("second");
        requests.store.getState().request!.answer(1);
        await expect(next).resolves.toBe(1);
    });

    it("stays open while a host is attached; the last host to detach answers it with null", async () => {
        const requests = createDialogRequests<NumberRequest>();
        const first = requests.attachHost();
        const second = requests.attachHost();
        const pending = requests.open<number>((answer) => ({ kind: "any", answer }));
        expect(requests.store.getState().request?.kind).toBe("any");
        first();
        // Detaching twice counts once.
        first();
        expect(requests.store.getState().request).not.toBeNull();
        second();
        await expect(pending).resolves.toBeNull();
        expect(requests.store.getState().request).toBeNull();
        expect(requests.hosted).toBe(false);
    });

    it("a feature's view of the app's one store sees only its own kinds", async () => {
        type SizeRequest = DialogRequestBase & {
            kind: "canvas-size";
            answer(values: { width: number } | null): void;
        };
        const isSize = (request: DialogRequestBase): request is SizeRequest =>
            request.kind === "canvas-size";
        const view = dialogView(commandDialogs.store, isSize);
        const detach = commandDialogs.attachHost();
        try {
            const seen: (string | null)[] = [];
            const unsubscribe = view.subscribe((state) => seen.push(state.request?.kind ?? null));

            const size = commandDialogs.open<{ width: number }>((answer) => ({
                kind: "canvas-size",
                answer,
            }));
            const shared = commandDialogs.store.getState().request;
            expect(shared?.kind).toBe("canvas-size");
            expect(view.getState().request).toBe(shared);
            view.getState().request!.answer({ width: 8 });
            await expect(size).resolves.toEqual({ width: 8 });

            // A request of another feature's kind is in the shared store, not in the view.
            const other = commandDialogs.open<number>((answer) => ({ kind: "other", answer }));
            expect(commandDialogs.store.getState().request?.kind).toBe("other");
            expect(view.getState().request).toBeNull();
            (commandDialogs.store.getState().request?.answer as (values: null) => void)(null);
            await expect(other).resolves.toBeNull();

            unsubscribe();
            expect(seen).toEqual(["canvas-size", null, null, null]);
        } finally {
            detach();
        }
    });
});
