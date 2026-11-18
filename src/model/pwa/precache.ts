// What the service worker (`installServiceWorker`, SPEC §10) keeps and how it answers, apart
// from the worker's events, so it runs in Node and in the worker alike. Every name comes from
// the editor's id (SPEC §5), so two editors on one origin keep their caches and messages apart.
//
// The editor's build puts the list of its files into the worker (`self.__WB_MANIFEST`,
// vite-plugin-pwa with `injectManifest`): each file's URL relative to the app's base, with a
// revision for a file whose name has no content hash. One deployment's files go into one cache,
// named after a hash of that list, so a new deployment fills a cache of its own while the
// running one keeps answering from the old cache. Older caches stay while a window still runs
// an older deployment (it loaded its files before the new worker took over, and still asks for
// them: its web workers' scripts, for one); they go once no such window is left.

/** One file of the build, as the plugin lists it. */
export interface PrecacheEntry {
    url: string;
    revision: string | null;
}

/** The names the worker and its pages use, each from the editor's id (SPEC §5). */
export interface PwaNames {
    /** The prefix of every cache the worker makes: `<id>-`. */
    readonly cachePrefix: string;
    /** The message a page sends a waiting worker to take over (the update toast's Reload). */
    readonly skipWaiting: string;
    /**
     * The message a page sends the worker that controls it once it has started: a page served
     * by that worker runs its deployment, so the worker checks whether older caches can go.
     */
    readonly started: string;
    /** Where, in the worker's scope, the windows open when it took over are kept. */
    readonly olderWindows: string;
}

/** The persisted names of the worker of the editor `id` (SPEC §5). */
export function pwaNames(id: string): PwaNames {
    return {
        cachePrefix: `${id}-`,
        skipWaiting: `${id}:skip-waiting`,
        started: `${id}:started`,
        olderWindows: `${id}-older-windows`,
    };
}

/** A cache name's part after the prefix: the hash of `cacheName`. */
const CACHE_HASH = /^[0-9a-f]{8}$/;

/**
 * Whether `name` is a cache of the editor `id`: its prefix and a hash. Another editor's cache
 * is not, even when that editor's id starts with this one's (`<id>-beta-…`).
 */
export function isOwnCache(id: string, name: string): boolean {
    const prefix = pwaNames(id).cachePrefix;
    return name.startsWith(prefix) && CACHE_HASH.test(name.slice(prefix.length));
}

/**
 * The entries with each URL once, the first kept: the plugin lists the manifest (and would list
 * its icons) beside the files its patterns find, and a cache refuses to add one URL twice.
 */
export function uniqueEntries(entries: readonly PrecacheEntry[]): PrecacheEntry[] {
    const seen = new Set<string>();
    return entries.filter((entry) => !seen.has(entry.url) && seen.add(entry.url));
}

/** FNV-1a over the entries in order: the same build always gives the same name. */
export function cacheName(id: string, entries: readonly PrecacheEntry[]): string {
    let hash = 0x811c9dc5;
    for (const { url, revision } of entries) {
        for (const char of `${url} ${revision ?? ""}\n`) {
            hash ^= char.codePointAt(0)!;
            hash = Math.imul(hash, 0x01000193) >>> 0;
        }
    }
    return `${pwaNames(id).cachePrefix}${hash.toString(16).padStart(8, "0")}`;
}

/** The absolute URL of each entry, in the worker's scope (the app's base). */
export function precacheUrls(entries: readonly PrecacheEntry[], scope: string): string[] {
    return entries.map((entry) => new URL(entry.url, scope).href);
}

/** The caches a worker of `current` deletes once it is active: the editor's own older ones. */
export function staleCaches(id: string, names: readonly string[], current: string): string[] {
    return names.filter((name) => isOwnCache(id, name) && name !== current);
}

/**
 * The caches the worker looks in for a file, in order: its own, then every older one of the
 * editor's (the newest first, as `caches.keys()` lists them oldest first), so a window that
 * still runs an older deployment finds its files.
 */
export function searchOrder(id: string, names: readonly string[], current: string): string[] {
    return [current, ...staleCaches(id, names, current).reverse()];
}

/**
 * Whether the older caches can go: no window of the app is one of `older`, the windows that
 * were open when the current worker took over (they run an older deployment, or may).
 */
export function mayDeleteStale(windows: readonly string[], older: readonly string[]): boolean {
    const kept = new Set(older);
    return !windows.some((id) => kept.has(id));
}

/** The parts of a `Response` that `cacheable` reads. */
export interface ResponseLike {
    readonly redirected: boolean;
    readonly status: number;
    readonly statusText: string;
    readonly headers: Headers;
    blob(): Promise<Blob>;
}

/**
 * A response as the worker caches it: a redirected one is rebuilt with the same status,
 * headers and body (as Workbox does), because Chrome refuses a redirected response for a
 * navigation, and the cached shell answers navigations. Any other is kept as it is.
 */
export async function cacheable<R extends ResponseLike>(response: R): Promise<R | Response> {
    if (!response.redirected) return response;
    return new Response(await response.blob(), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
    });
}

/** The parts of a request that `route` and `olderFile` read. */
export interface RequestLike {
    readonly url: string;
    readonly method: string;
    readonly mode: string;
}

/** What the worker answers a request with: the cached `url`, or nothing (the network). */
export type Route = { cached: string } | null;

/**
 * How the worker answers a GET request (cache first): a navigation to the app (its base, or
 * `index.html` there, whatever the query) gets the cached shell; a file of the build gets its
 * cached copy. Everything else goes to the network as if no worker were there.
 */
export function route(request: RequestLike, scope: string, precached: ReadonlySet<string>): Route {
    if (request.method !== "GET") return null;
    const url = new URL(request.url);
    url.hash = "";
    const shell = new URL("index.html", scope).href;
    if (request.mode === "navigate") {
        url.search = "";
        const isApp = url.href === scope || url.href === shell;
        return isApp && precached.has(shell) ? { cached: shell } : null;
    }
    return precached.has(url.href) ? { cached: url.href } : null;
}

/**
 * A request `route` leaves to the network that may still be a file of an older deployment: a
 * GET, not a navigation, for a URL in the worker's scope. The worker looks for it in the older
 * caches before the network (`searchOrder`); returns its URL, or null.
 */
export function olderFile(
    request: RequestLike,
    scope: string,
    precached: ReadonlySet<string>,
): string | null {
    if (request.method !== "GET" || request.mode === "navigate") return null;
    if (route(request, scope, precached)) return null;
    const url = new URL(request.url);
    url.hash = "";
    return url.href.startsWith(scope) ? url.href : null;
}
