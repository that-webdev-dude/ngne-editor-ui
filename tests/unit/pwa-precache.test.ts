import { describe, expect, it } from "vitest";
import {
    cacheName,
    cacheable,
    isOwnCache,
    mayDeleteStale,
    olderFile,
    precacheUrls,
    pwaNames,
    route,
    searchOrder,
    staleCaches,
    uniqueEntries,
} from "../../src/ui/pwa/index.ts";
import type { PrecacheEntry } from "../../src/ui/pwa/index.ts";

// What the service worker keeps and how it answers (SPEC §10), apart from the worker's events:
// the cache of one deployment, named from the editor's id and a hash of its files, the older
// caches it searches and deletes, and the requests it answers from them. Run for both editors'
// ids: each keeps to its own caches on an origin they share.

const IDS = ["ngne-sprite-editor", "ngne-tilemap-editor"] as const;
const SCOPE = "https://example.test/sub/path/";
const ENTRIES: PrecacheEntry[] = [
    { url: "index.html", revision: "a1" },
    { url: "assets/index-abc.js", revision: null },
    { url: "manifest.webmanifest", revision: "m1" },
    { url: "assets/index-abc.js", revision: null },
];

describe.each(IDS)("precache of %s", (id) => {
    const other = IDS.find((name) => name !== id)!;
    const prefix = `${id}-`;

    it("prefixes its caches and messages with the editor's id", () => {
        expect(pwaNames(id).cachePrefix).toBe(prefix);
        expect(pwaNames(id).skipWaiting).toBe(`${id}:skip-waiting`);
        expect(cacheName(id, ENTRIES)).toMatch(new RegExp(`^${prefix}[0-9a-f]{8}$`));
    });

    it("names one cache per build, the same name for the same build", () => {
        const name = cacheName(id, ENTRIES);
        expect(name.startsWith(prefix)).toBe(true);
        expect(cacheName(id, [...ENTRIES])).toBe(name);
        const changed = [{ url: "index.html", revision: "a2" }, ...ENTRIES.slice(1)];
        expect(cacheName(id, changed)).not.toBe(name);
        // The same build of another editor: its own cache, with the same hash.
        expect(cacheName(other, ENTRIES)).toBe(`${other}-${name.slice(prefix.length)}`);
    });

    it("deletes only its own older caches", () => {
        const current = cacheName(id, ENTRIES);
        expect(
            staleCaches(
                id,
                [current, `${prefix}00000000`, "other-app", `${other}-00000000`],
                current,
            ),
        ).toEqual([`${prefix}00000000`]);
    });

    it("keeps the caches of an editor whose id starts with its own", () => {
        const current = cacheName(id, ENTRIES);
        const longer = `${id}-beta-00000000`;
        expect(isOwnCache(id, `${prefix}0000abcd`)).toBe(true);
        expect(isOwnCache(id, longer)).toBe(false);
        expect(isOwnCache(id, `${prefix}0000ABCD`)).toBe(false);
        expect(isOwnCache(id, prefix)).toBe(false);
        expect(staleCaches(id, [longer, current], current)).toEqual([]);
        expect(searchOrder(id, [longer, current], current)).toEqual([current]);
    });

    it("looks for a file in its own cache, then the older ones, newest first", () => {
        const current = `${prefix}cccccccc`;
        const names = [`${prefix}aaaaaaaa`, `${other}-dddddddd`, current, `${prefix}bbbbbbbb`];
        expect(searchOrder(id, names, current)).toEqual([
            current,
            `${prefix}bbbbbbbb`,
            `${prefix}aaaaaaaa`,
        ]);
        expect(searchOrder(id, [current], current)).toEqual([current]);
    });
});

describe("precache logic", () => {
    it("keeps each URL once, the first entry", () => {
        expect(uniqueEntries(ENTRIES)).toEqual(ENTRIES.slice(0, 3));
    });

    it("resolves the entries in the worker's scope, the app's base", () => {
        expect(precacheUrls(ENTRIES.slice(0, 2), SCOPE)).toEqual([
            "https://example.test/sub/path/index.html",
            "https://example.test/sub/path/assets/index-abc.js",
        ]);
    });

    it("answers navigations to the app with the cached shell and build files from the cache", () => {
        const precached = new Set(precacheUrls(uniqueEntries(ENTRIES), SCOPE));
        const shell = { cached: `${SCOPE}index.html` };
        const get = (url: string, mode = "cors") =>
            route({ url, method: "GET", mode }, SCOPE, precached);
        expect(get(SCOPE, "navigate")).toEqual(shell);
        expect(get(`${SCOPE}?from=launch#x`, "navigate")).toEqual(shell);
        expect(get(`${SCOPE}index.html`, "navigate")).toEqual(shell);
        expect(get(`${SCOPE}assets/index-abc.js`)).toEqual({
            cached: `${SCOPE}assets/index-abc.js`,
        });
        // Not the app's: the network, as without a worker.
        expect(get(`${SCOPE}other.html`, "navigate")).toBeNull();
        expect(get("https://example.test/", "navigate")).toBeNull();
        expect(get(`${SCOPE}assets/missing.js`)).toBeNull();
        expect(
            route({ url: `${SCOPE}index.html`, method: "POST", mode: "cors" }, SCOPE, precached),
        ).toBeNull();
    });

    it("looks for a file of the scope that is not this build's in the older caches (a window of an older deployment)", () => {
        const precached = new Set(precacheUrls(uniqueEntries(ENTRIES), SCOPE));
        const older = (url: string, mode = "cors", method = "GET") =>
            olderFile({ url, method, mode }, SCOPE, precached);
        // An older deployment's chunk or web worker script: not in this build.
        expect(older(`${SCOPE}assets/importWorker-old.js`)).toBe(
            `${SCOPE}assets/importWorker-old.js`,
        );
        expect(older(`${SCOPE}assets/old.js#x`)).toBe(`${SCOPE}assets/old.js`);
        // This build's files are `route`'s; navigations, other methods and other places are
        // the network's.
        expect(older(`${SCOPE}assets/index-abc.js`)).toBeNull();
        expect(older(`${SCOPE}assets/old.js`, "navigate")).toBeNull();
        expect(older(`${SCOPE}assets/old.js`, "cors", "POST")).toBeNull();
        expect(older("https://example.test/elsewhere/old.js")).toBeNull();
        expect(older("https://other.test/sub/path/old.js")).toBeNull();
    });

    it("keeps the older caches while a window open when it took over is still there", () => {
        // The single window reloaded: its new page is no older window.
        expect(mayDeleteStale(["new-page"], ["old-page"])).toBe(true);
        expect(mayDeleteStale([], ["old-page"])).toBe(true);
        expect(mayDeleteStale([], [])).toBe(true);
        // A second window still runs the older deployment.
        expect(mayDeleteStale(["new-page", "second-window"], ["old-page", "second-window"])).toBe(
            false,
        );
    });

    it("rebuilds a redirected response before it is cached and keeps any other", async () => {
        const plain = new Response("x", { status: 200 });
        expect(await cacheable(plain)).toBe(plain);
        const redirected = {
            redirected: true,
            status: 200,
            statusText: "OK",
            headers: new Headers({ "content-type": "text/html" }),
            blob: async () => new Blob(["<!doctype html>"]),
        };
        const rebuilt = await cacheable(redirected);
        expect(rebuilt).toBeInstanceOf(Response);
        expect(rebuilt.redirected).toBe(false);
        expect(rebuilt.status).toBe(200);
        expect(rebuilt.statusText).toBe("OK");
        expect(rebuilt.headers.get("content-type")).toBe("text/html");
        expect(await (rebuilt as Response).text()).toBe("<!doctype html>");
    });
});
