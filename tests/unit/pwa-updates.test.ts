import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { createToastService } from "../../src/ui/messages/index.ts";
import {
    RELOAD_KEPT_MS,
    registerAppUpdates,
    showUpdateToast,
    UPDATE_MESSAGE,
} from "../../src/ui/pwa/index.ts";
import type { ContainerLike } from "../../src/ui/pwa/index.ts";
import { FakeContainer, FakeWorker } from "./support/pwa.ts";

// The page's side of the service worker (SPEC §10), over a simulated worker registration: the
// started message to the worker that serves the page, update detection (a worker waiting
// behind the one in control), the update toast and its Reload, the skip-waiting message to the
// waiting worker and the reload once it controls the page. Messages are named from the
// editor's id.

const ID = "ngne-sprite-editor";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function start(controller: FakeWorker | null, id: string = ID) {
    const container = new FakeContainer(controller);
    const reload = vi.fn();
    const updates = registerAppUpdates({
        id,
        container,
        url: "/sub/path/sw.js",
        scope: "/sub/path/",
        reload,
    });
    return { container, registration: container.registration, reload, updates };
}

describe("started message", () => {
    it("tells the worker that serves the page that the page has started, once", async () => {
        const served = new FakeWorker();
        served.state = "activated";
        const { updates } = start(served);
        await flush();
        expect(served.messages).toEqual([{ type: `${ID}:started` }]);
        await updates.check();
        expect(served.messages).toHaveLength(1);
    });

    it("names the message from the editor's id", () => {
        const served = new FakeWorker();
        start(served, "ngne-tilemap-editor");
        expect(served.messages).toEqual([{ type: "ngne-tilemap-editor:started" }]);
    });
});

describe("update flow", () => {
    it("takes the browser's navigator.serviceWorker as its container", () => {
        expectTypeOf<ServiceWorkerContainer>().toExtend<ContainerLike>();
    });

    it("registers the worker at the base, and the first visit is no update", async () => {
        const { container, registration, reload, updates } = start(null);
        await flush();
        expect(container.registered).toEqual([{ url: "/sub/path/sw.js", scope: "/sub/path/" }]);
        const worker = new FakeWorker();
        registration.install(worker);
        worker.become("installed");
        worker.become("activated");
        container.change(worker);
        expect(updates.store.getState().ready).toBe(false);
        expect(reload).not.toHaveBeenCalled();
        expect(worker.messages).toEqual([]);
    });

    it("offers a new deployment once its worker waits, and activates it only on apply", async () => {
        const { container, registration, reload, updates } = start(new FakeWorker());
        await flush();
        await updates.check();
        expect(registration.updates).toBe(1);
        const worker = new FakeWorker();
        registration.install(worker);
        expect(updates.store.getState().ready).toBe(false);
        worker.become("installed");
        expect(updates.store.getState().ready).toBe(true);
        expect(worker.messages).toEqual([]);

        updates.apply();
        expect(worker.messages).toEqual([{ type: `${ID}:skip-waiting` }]);
        expect(reload).not.toHaveBeenCalled();
        container.change(worker);
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("names the skip-waiting message from the editor's id", async () => {
        const { registration, updates } = start(new FakeWorker(), "ngne-tilemap-editor");
        await flush();
        const worker = new FakeWorker();
        registration.install(worker);
        worker.become("installed");
        updates.apply();
        expect(worker.messages).toEqual([{ type: "ngne-tilemap-editor:skip-waiting" }]);
    });

    it("offers a worker already waiting when the page starts", async () => {
        const container = new FakeContainer(new FakeWorker());
        const waiting = new FakeWorker();
        waiting.state = "installed";
        container.registration.waiting = waiting;
        const updates = registerAppUpdates({
            id: ID,
            container,
            url: "sw.js",
            scope: "/",
            reload: vi.fn(),
        });
        await flush();
        expect(updates.store.getState().ready).toBe(true);
        updates.apply();
        expect(waiting.messages).toEqual([{ type: `${ID}:skip-waiting` }]);
    });

    it("offers a reload when another window applied the update", async () => {
        const { container, reload, updates } = start(new FakeWorker());
        await flush();
        container.change(new FakeWorker());
        expect(updates.store.getState().ready).toBe(true);
        expect(reload).not.toHaveBeenCalled();
        updates.apply();
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("offers Reload again when the reload was cancelled (Stay), and reloads nothing without it", async () => {
        vi.useFakeTimers();
        try {
            const { container, registration, reload, updates } = start(new FakeWorker());
            const service = createToastService();
            showUpdateToast(updates, service);
            await vi.advanceTimersByTimeAsync(0);
            const worker = new FakeWorker();
            registration.install(worker);
            worker.become("installed");
            const offered = () =>
                service.store.getState().toasts.filter((item) => item.message === UPDATE_MESSAGE);
            expect(offered()).toHaveLength(1);

            // Reload (the toast's action dismisses the toast); the new worker takes over and
            // the page reloads, but the browser's question is answered Stay.
            const [toast] = offered();
            service.dismiss(toast!.id);
            toast!.action!.run();
            expect(worker.messages).toEqual([{ type: `${ID}:skip-waiting` }]);
            container.change(worker);
            expect(reload).toHaveBeenCalledTimes(1);
            expect(offered()).toHaveLength(0);

            // The page still runs: Reload is offered again.
            vi.advanceTimersByTime(RELOAD_KEPT_MS);
            expect(updates.store.getState().ready).toBe(true);
            expect(offered()).toHaveLength(1);
            // A later change of worker reloads nothing without the user's choice.
            container.change(new FakeWorker());
            expect(reload).toHaveBeenCalledTimes(1);
            // Reload again reloads (the new worker controls the page already).
            offered()[0]!.action!.run();
            expect(reload).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it("waits once more when the page was held by the browser's question, and offers nothing once the page has gone", async () => {
        vi.useFakeTimers();
        try {
            const { reload, updates } = start(new FakeWorker());
            await vi.advanceTimersByTimeAsync(0);
            // Another window applied the update: Reload just reloads.
            updates.store.setState({ ready: true });
            updates.apply();
            expect(reload).toHaveBeenCalledTimes(1);
            // The question held the page's timers for a while: the check comes late and waits
            // once more, for the page to leave (Leave) or stay.
            vi.setSystemTime(Date.now() + RELOAD_KEPT_MS * 10);
            vi.advanceTimersByTime(RELOAD_KEPT_MS);
            const states: boolean[] = [];
            updates.store.subscribe((state) => states.push(state.ready));
            expect(states).toEqual([]);
            vi.advanceTimersByTime(RELOAD_KEPT_MS);
            expect(states).toEqual([false, true]);
        } finally {
            vi.useRealTimers();
        }
    });

    it("reports a registration that fails and keeps the page as it is", async () => {
        const container = new FakeContainer(null);
        container.register = () => Promise.reject(new Error("no worker"));
        const report = vi.fn();
        const updates = registerAppUpdates({
            id: ID,
            container,
            url: "sw.js",
            scope: "/",
            reload: vi.fn(),
            report,
        });
        await updates.check();
        expect(report).toHaveBeenCalledWith(new Error("no worker"));
        expect(updates.store.getState().ready).toBe(false);
    });
});

describe("update toast", () => {
    it("shows the update message with Reload while a new version is ready, and stops on request", async () => {
        const { registration, updates } = start(new FakeWorker());
        await flush();
        const service = createToastService();
        const stop = showUpdateToast(updates, service);
        expect(service.store.getState().toasts).toEqual([]);

        const worker = new FakeWorker();
        registration.install(worker);
        worker.become("installed");
        const [toast] = service.store.getState().toasts;
        expect(toast).toMatchObject({
            kind: "info",
            message: "A new version of the editor is ready.",
            action: { label: "Reload" },
        });
        expect(UPDATE_MESSAGE).toBe("A new version of the editor is ready.");
        toast!.action!.run();
        expect(worker.messages).toEqual([{ type: `${ID}:skip-waiting` }]);

        // Stopped, it offers nothing more.
        service.dismiss(toast!.id);
        stop();
        updates.store.setState({ ready: false });
        updates.store.setState({ ready: true });
        expect(service.store.getState().toasts).toEqual([]);
    });

    it("shows the toast at once for a version that was ready before it started", async () => {
        const container = new FakeContainer(new FakeWorker());
        const waiting = new FakeWorker();
        waiting.state = "installed";
        container.registration.waiting = waiting;
        const updates = registerAppUpdates({
            id: ID,
            container,
            url: "sw.js",
            scope: "/",
            reload: vi.fn(),
        });
        await flush();
        const service = createToastService();
        showUpdateToast(updates, service);
        expect(service.store.getState().toasts.map((item) => item.message)).toEqual([
            UPDATE_MESSAGE,
        ]);
    });
});
