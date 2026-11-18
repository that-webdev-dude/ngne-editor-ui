import {
    cacheName,
    cacheable,
    mayDeleteStale,
    olderFile,
    precacheUrls,
    pwaNames,
    route,
    searchOrder,
    staleCaches,
    uniqueEntries,
} from "../model/pwa/precache.js";
import type { PrecacheEntry } from "../model/pwa/precache.js";

// The editor's service worker (SPEC §10). The editor's worker entry calls
// `installServiceWorker` with its id and the list of the build's files, which its build puts
// where `self.__WB_MANIFEST` stands (vite-plugin-pwa, `injectManifest`); the dev server has no
// worker. Every name comes from the id (SPEC §5).
//
// - Install: every file of the build goes into this deployment's cache. A worker that installs
//   while an older one controls pages waits: the pages show the update toast, and the worker
//   takes over only when the user chooses Reload there (the page posts the skip-waiting
//   message).
// - Activate: the worker takes control of the open pages (on the first visit too, so the app
//   works offline from its first load on). The windows open then may run an older deployment:
//   their ids are kept (in this deployment's cache, as the worker may be stopped and started
//   again), and the caches of older deployments stay while one of them is open. With no
//   window open, they go at once; otherwise when a page this worker served starts (the started
//   message) and none of those windows is left. Other editors' caches on the origin stay.
// - Fetch: cache first for the shell and every file of the build (`route`), from this
//   deployment's cache, then the older ones; a file of the scope that is not this build's may
//   be an older deployment's (`olderFile`): the older caches, then the network. Anything else
//   is left to the network.
//
// The worker layer is compiled with the WebWorker library and imports only the model (SPEC
// §1.1, §4). The parts of the service worker scope it uses are declared here, so the unit
// tests, compiled with the DOM library, load it in a simulated scope.

interface WorkerEvent {
    waitUntil(promise: Promise<unknown>): void;
}

interface WorkerFetchEvent extends WorkerEvent {
    readonly request: Request;
    respondWith(response: Promise<Response>): void;
}

interface WorkerMessageEvent extends WorkerEvent {
    readonly data: unknown;
}

interface ServiceWorkerScope {
    readonly registration: { readonly scope: string };
    readonly clients: {
        claim(): Promise<void>;
        matchAll(options: {
            type: "window";
            includeUncontrolled: boolean;
        }): Promise<readonly { readonly id: string }[]>;
    };
    skipWaiting(): Promise<void>;
    addEventListener(type: "install" | "activate", listener: (event: WorkerEvent) => void): void;
    addEventListener(type: "fetch", listener: (event: WorkerFetchEvent) => void): void;
    addEventListener(type: "message", listener: (event: WorkerMessageEvent) => void): void;
}

/** What `installServiceWorker` takes. */
export interface ServiceWorkerOptions {
    /** The editor's id (SPEC §5), as `createEditorUi` and `registerAppUpdates` take it. */
    readonly id: string;
    /** The build's files: `self.__WB_MANIFEST`, written exactly so, which the build replaces. */
    readonly manifest: readonly PrecacheEntry[];
}

/**
 * Runs the editor's service worker in the worker's global scope: precaches the build at
 * install, removes the editor's older caches once no window runs them, and answers the app's
 * requests from the caches.
 */
export function installServiceWorker(options: ServiceWorkerOptions): void {
    const { id } = options;
    const names = pwaNames(id);
    const worker = self as unknown as ServiceWorkerScope;
    const entries = uniqueEntries(options.manifest);
    const scope = worker.registration.scope;
    const cache = cacheName(id, entries);
    const urls = precacheUrls(entries, scope);
    const precached = new Set(urls);
    /** Where the ids of the windows open when this worker took over are kept. */
    const olderWindowsUrl = new URL(names.olderWindows, scope).href;

    /** The ids of every window of the scope, whichever worker controls it. */
    const windowIds = async (): Promise<string[]> => {
        const windows = await worker.clients.matchAll({
            type: "window",
            includeUncontrolled: true,
        });
        return windows.map((client) => client.id);
    };

    const olderWindows = async (): Promise<string[]> => {
        const kept = await (await caches.open(cache)).match(olderWindowsUrl);
        return kept ? ((await kept.json()) as string[]) : [];
    };

    /** Deletes the older deployments' caches unless a window may still run one of them. */
    const deleteStaleUnlessUsed = async (): Promise<void> => {
        if (!mayDeleteStale(await windowIds(), await olderWindows())) return;
        const stale = staleCaches(id, await caches.keys(), cache);
        await Promise.all(stale.map((name) => caches.delete(name)));
        await (await caches.open(cache)).delete(olderWindowsUrl);
    };

    /** The cached copy of `url`: this deployment's cache first, then the older ones. */
    const cached = async (url: string, order: readonly string[]) => {
        for (const name of order) {
            const hit = await caches.match(url, { cacheName: name });
            if (hit) return hit;
        }
        return undefined;
    };

    worker.addEventListener("install", (event) => {
        event.waitUntil(
            (async () => {
                const open = await caches.open(cache);
                // A file without a hash in its name (index.html, the manifest, the icons) comes
                // from the server, not from the HTTP cache, which may hold an older
                // deployment's. A redirected response is rebuilt before it is kept
                // (`cacheable`).
                await Promise.all(
                    entries.map(async (entry, index) => {
                        const request = new Request(
                            urls[index]!,
                            entry.revision ? { cache: "reload" } : {},
                        );
                        const response = await fetch(request);
                        if (!response.ok) {
                            throw new Error(`sw: ${request.url} answered ${response.status}`);
                        }
                        await open.put(request, await cacheable(response));
                    }),
                );
            })(),
        );
    });

    worker.addEventListener("activate", (event) => {
        event.waitUntil(
            (async () => {
                const open = await windowIds();
                if (open.length > 0) {
                    await (await caches.open(cache)).put(olderWindowsUrl, Response.json(open));
                }
                await deleteStaleUnlessUsed();
                await worker.clients.claim();
            })(),
        );
    });

    worker.addEventListener("message", (event) => {
        const type = (event.data as { type?: unknown } | null)?.type;
        if (type === names.skipWaiting) void worker.skipWaiting();
        if (type === names.started) event.waitUntil(deleteStaleUnlessUsed());
    });

    worker.addEventListener("fetch", (event) => {
        const { request } = event;
        const url =
            route(request, scope, precached)?.cached ?? olderFile(request, scope, precached);
        if (!url) return;
        event.respondWith(
            (async () => {
                const hit = await cached(url, searchOrder(id, await caches.keys(), cache));
                return hit ?? fetch(request);
            })(),
        );
    });
}
