import { vi } from "vitest";
import type { ContainerLike, RegistrationLike, WorkerLike } from "../../../src/ui/pwa/index.ts";

// Simulations of the two sides of the editor's service worker (SPEC §10), for the PWA unit
// tests: the page's `navigator.serviceWorker` with a registration whose workers the test moves
// through their states, and the worker's global scope with its caches, windows and network,
// put where the worker reads them (`self`, `caches`, `fetch`).

/** A fake `ServiceWorker` whose state the test moves on. */
export class FakeWorker implements WorkerLike {
    state = "installing";
    messages: unknown[] = [];
    private readonly listeners: (() => void)[] = [];
    postMessage(message: unknown) {
        this.messages.push(message);
    }
    addEventListener(_type: "statechange", listener: () => void) {
        this.listeners.push(listener);
    }
    become(state: string) {
        this.state = state;
        for (const listener of this.listeners) listener();
    }
}

export class FakeRegistration implements RegistrationLike {
    installing: FakeWorker | null = null;
    waiting: FakeWorker | null = null;
    updates = 0;
    private readonly found: (() => void)[] = [];
    async update() {
        this.updates++;
    }
    addEventListener(_type: "updatefound", listener: () => void) {
        this.found.push(listener);
    }
    /** A new worker starts installing. */
    install(worker: FakeWorker) {
        this.installing = worker;
        for (const listener of this.found) listener();
    }
}

export class FakeContainer implements ContainerLike {
    registered: { url: string; scope: string }[] = [];
    private readonly changes: (() => void)[] = [];
    constructor(
        public controller: FakeWorker | null,
        public registration = new FakeRegistration(),
    ) {}
    async register(url: string, options: { scope: string }) {
        this.registered.push({ url, ...options });
        return this.registration;
    }
    addEventListener(_type: "controllerchange", listener: () => void) {
        this.changes.push(listener);
    }
    /** A new worker controls the page. */
    change(controller: FakeWorker) {
        this.controller = controller;
        for (const listener of this.changes) listener();
    }
}

const keyOf = (request: Request | string) => (typeof request === "string" ? request : request.url);

/** One cache of the simulated `caches`: responses by URL, each read as a fresh copy. */
export class FakeCache {
    readonly responses = new Map<string, Response>();
    put(request: Request | string, response: Response): Promise<void> {
        this.responses.set(keyOf(request), response);
        return Promise.resolve();
    }
    match(request: Request | string): Promise<Response | undefined> {
        return Promise.resolve(this.responses.get(keyOf(request))?.clone());
    }
    delete(request: Request | string): Promise<boolean> {
        return Promise.resolve(this.responses.delete(keyOf(request)));
    }
}

/** The simulated `caches`, its names listed in the order they were made. */
export class FakeCacheStorage {
    readonly caches = new Map<string, FakeCache>();
    open(name: string): Promise<FakeCache> {
        if (!this.caches.has(name)) this.caches.set(name, new FakeCache());
        return Promise.resolve(this.caches.get(name)!);
    }
    keys(): Promise<string[]> {
        return Promise.resolve([...this.caches.keys()]);
    }
    delete(name: string): Promise<boolean> {
        return Promise.resolve(this.caches.delete(name));
    }
    async match(request: Request | string, options: { cacheName: string }) {
        return this.caches.get(options.cacheName)?.match(request);
    }
    /** Fills the cache `name` with a body per URL, as an older deployment's worker did. */
    fill(name: string, files: Record<string, string>) {
        const cache = new FakeCache();
        for (const [url, body] of Object.entries(files))
            cache.responses.set(url, new Response(body));
        this.caches.set(name, cache);
    }
    /** The URLs the cache `name` holds. */
    urls(name: string): string[] {
        return [...(this.caches.get(name)?.responses.keys() ?? [])];
    }
}

/** A request as the worker's fetch event hands it, navigations included. */
export interface SimulatedRequest {
    url: string;
    method?: string;
    mode?: string;
}

type Listener = (event: never) => void;

/**
 * Puts a simulated service worker scope at `scope` in place of the worker's globals: `self`
 * (registration, clients, skipWaiting, events), `caches`, and `fetch` answering from
 * `network` (a body per URL, or a status). Undo with `vi.unstubAllGlobals()`.
 */
export function simulateWorkerScope(scope: string, network: Record<string, string | number>) {
    const listeners = new Map<string, Listener[]>();
    const storage = new FakeCacheStorage();
    const fetched: { url: string; cache: string }[] = [];
    const state = { windows: [] as string[], claims: 0, skipWaiting: 0 };

    vi.stubGlobal("self", {
        registration: { scope },
        clients: {
            claim: () => {
                state.claims++;
                return Promise.resolve();
            },
            matchAll: () => Promise.resolve(state.windows.map((id) => ({ id }))),
        },
        skipWaiting: () => {
            state.skipWaiting++;
            return Promise.resolve();
        },
        addEventListener: (type: string, listener: Listener) =>
            listeners.set(type, [...(listeners.get(type) ?? []), listener]),
    });
    vi.stubGlobal("caches", storage);
    /** The simulated network's response to `request`. */
    const respond = (request: Request | SimulatedRequest): Response => {
        fetched.push({ url: request.url, cache: request instanceof Request ? request.cache : "" });
        const answer = network[request.url];
        if (answer === undefined) return new Response("offline", { status: 503 });
        if (typeof answer === "number") return new Response(null, { status: answer });
        return new Response(answer, { status: 200 });
    };
    vi.stubGlobal("fetch", (request: Request | SimulatedRequest) =>
        Promise.resolve(respond(request)),
    );

    /** Dispatches `event` to the worker's listeners of `type`; waits for what it extends to. */
    const dispatch = async (type: string, event: object): Promise<void> => {
        const pending: Promise<unknown>[] = [];
        const extendable = {
            ...event,
            waitUntil: (promise: Promise<unknown>) => pending.push(promise),
        };
        for (const listener of listeners.get(type) ?? [])
            (listener as (e: object) => void)(extendable);
        await Promise.all(pending);
    };

    return {
        storage,
        fetched,
        state,
        /** How many listeners of each event the worker added. */
        listenerCounts: () =>
            Object.fromEntries([...listeners].map(([type, list]) => [type, list.length])),
        install: () => dispatch("install", {}),
        activate: () => dispatch("activate", {}),
        message: (data: unknown) => dispatch("message", { data }),
        /** The worker's answer to `request`, or null when it leaves it to the network. */
        async fetch(request: SimulatedRequest): Promise<Response | null> {
            const answered: { response?: Promise<Response> } = {};
            await dispatch("fetch", {
                request: { method: "GET", mode: "cors", ...request },
                respondWith: (response: Promise<Response>) => {
                    answered.response = response;
                },
            });
            return answered.response ? await answered.response : null;
        },
    };
}
