import { afterEach, describe, expect, it, vi } from "vitest";
import { cacheName, precacheUrls, uniqueEntries } from "../../src/ui/pwa/index.ts";
import type { PrecacheEntry } from "../../src/ui/pwa/index.ts";
import { installServiceWorker } from "../../src/worker/index.ts";
import { simulateWorkerScope } from "./support/pwa.ts";

// The editor's service worker (SPEC §10), `installServiceWorker({ id, manifest })` run in a
// simulated worker scope: install fills this deployment's cache from the network, activate
// takes the windows and removes the editor's older caches once no window runs them (other
// editors' caches stay), fetch answers from the caches, and the pages' messages are named from
// the editor's id.

const ID = "ngne-sprite-editor";
const OTHER = "ngne-tilemap-editor";
const SCOPE = "https://example.test/sub/path/";
const MANIFEST: PrecacheEntry[] = [
    { url: "index.html", revision: "a1" },
    { url: "assets/index-abc.js", revision: null },
    { url: "manifest.webmanifest", revision: "m1" },
    { url: "assets/index-abc.js", revision: null },
];
const NETWORK = {
    [`${SCOPE}index.html`]: "<!doctype html>new",
    [`${SCOPE}assets/index-abc.js`]: "new code",
    [`${SCOPE}manifest.webmanifest`]: "{}",
};
const CURRENT = cacheName(ID, uniqueEntries(MANIFEST));
const OLDER = `${ID}-00000000`;
const OLDER_WINDOWS = `${SCOPE}${ID}-older-windows`;

/** A worker of the build `MANIFEST`, with an older deployment's cache and another editor's. */
function startWorker(network: Record<string, string | number> = NETWORK) {
    const scope = simulateWorkerScope(SCOPE, network);
    scope.storage.fill(OLDER, {
        [`${SCOPE}index.html`]: "<!doctype html>old",
        [`${SCOPE}assets/index-old.js`]: "old code",
    });
    scope.storage.fill(`${OTHER}-11111111`, {
        "https://example.test/sub/tilemap/index.html": "tilemap",
    });
    installServiceWorker({ id: ID, manifest: MANIFEST });
    return scope;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("install", () => {
    it("adds one listener per event and does nothing before the browser asks", () => {
        const scope = startWorker();
        expect(scope.listenerCounts()).toEqual({ install: 1, activate: 1, message: 1, fetch: 1 });
        expect(scope.fetched).toEqual([]);
    });

    it("fills this deployment's cache with every file of the build once, revisioned files from the server", async () => {
        const scope = startWorker();
        await scope.install();
        expect(scope.storage.urls(CURRENT).sort()).toEqual(
            precacheUrls(uniqueEntries(MANIFEST), SCOPE).sort(),
        );
        expect(scope.fetched).toEqual([
            { url: `${SCOPE}index.html`, cache: "reload" },
            { url: `${SCOPE}assets/index-abc.js`, cache: "default" },
            { url: `${SCOPE}manifest.webmanifest`, cache: "reload" },
        ]);
        // Installing leaves the older caches and the waiting to the user's choice.
        expect(await scope.storage.keys()).toEqual([OLDER, `${OTHER}-11111111`, CURRENT]);
        expect(scope.state.skipWaiting).toBe(0);
    });

    it("fails the install when a file of the build cannot be fetched", async () => {
        const scope = startWorker({ ...NETWORK, [`${SCOPE}assets/index-abc.js`]: 404 });
        await expect(scope.install()).rejects.toThrow(
            `sw: ${SCOPE}assets/index-abc.js answered 404`,
        );
    });
});

describe("activate", () => {
    it("with no window open, removes the editor's older caches at once and keeps other editors'", async () => {
        const scope = startWorker();
        await scope.install();
        await scope.activate();
        expect(await scope.storage.keys()).toEqual([`${OTHER}-11111111`, CURRENT]);
        expect(scope.storage.urls(CURRENT)).not.toContain(OLDER_WINDOWS);
        expect(scope.state.claims).toBe(1);
    });

    it("keeps an editor's caches whose id starts with this editor's", async () => {
        const scope = startWorker();
        scope.storage.fill(`${ID}-beta-22222222`, {});
        await scope.install();
        await scope.activate();
        expect(await scope.storage.keys()).toContain(`${ID}-beta-22222222`);
    });

    it("keeps the older caches while a window open when it took over is there, then removes them", async () => {
        const scope = startWorker();
        await scope.install();
        scope.state.windows = ["old-page", "second-window"];
        await scope.activate();
        expect(scope.state.claims).toBe(1);
        expect(await scope.storage.keys()).toContain(OLDER);
        const kept = await (await scope.storage.open(CURRENT)).match(OLDER_WINDOWS);
        expect(await kept!.json()).toEqual(["old-page", "second-window"]);

        // The first window reloads into the new deployment; the second still runs the old one.
        scope.state.windows = ["new-page", "second-window"];
        await scope.message({ type: `${ID}:started` });
        expect(await scope.storage.keys()).toContain(OLDER);

        // The second window is closed: the next page that starts lets the older caches go.
        scope.state.windows = ["new-page"];
        await scope.message({ type: `${ID}:started` });
        expect(await scope.storage.keys()).toEqual([`${OTHER}-11111111`, CURRENT]);
        expect(scope.storage.urls(CURRENT)).not.toContain(OLDER_WINDOWS);
    });
});

describe("messages", () => {
    it("takes over on the editor's skip-waiting message only", async () => {
        const scope = startWorker();
        await scope.message({ type: `${OTHER}:skip-waiting` });
        await scope.message({ type: "skip-waiting" });
        await scope.message(null);
        await scope.message("text");
        expect(scope.state.skipWaiting).toBe(0);
        await scope.message({ type: `${ID}:skip-waiting` });
        expect(scope.state.skipWaiting).toBe(1);
    });

    it("ignores another editor's started message", async () => {
        const scope = startWorker();
        await scope.install();
        await scope.message({ type: `${OTHER}:started` });
        expect(await scope.storage.keys()).toContain(OLDER);
    });
});

describe("fetch", () => {
    it("answers navigations to the app with the cached shell, and the build's files from its cache", async () => {
        const scope = startWorker();
        await scope.install();
        const shell = await scope.fetch({ url: `${SCOPE}?from=launch`, mode: "navigate" });
        expect(await shell!.text()).toBe("<!doctype html>new");
        const code = await scope.fetch({ url: `${SCOPE}assets/index-abc.js` });
        expect(await code!.text()).toBe("new code");
        expect(scope.fetched).toHaveLength(3);
    });

    it("answers a file of an older deployment from the older caches, the network when none has it", async () => {
        const scope = startWorker();
        await scope.install();
        const old = await scope.fetch({ url: `${SCOPE}assets/index-old.js` });
        expect(await old!.text()).toBe("old code");
        const missing = await scope.fetch({ url: `${SCOPE}assets/missing.js` });
        expect(missing!.status).toBe(503);
        expect(scope.fetched.at(-1)).toEqual({ url: `${SCOPE}assets/missing.js`, cache: "" });
    });

    it("leaves other requests to the network", async () => {
        const scope = startWorker();
        await scope.install();
        expect(await scope.fetch({ url: `${SCOPE}other.html`, mode: "navigate" })).toBeNull();
        expect(await scope.fetch({ url: "https://example.test/elsewhere.js" })).toBeNull();
        expect(await scope.fetch({ url: `${SCOPE}index.html`, method: "POST" })).toBeNull();
    });

    it("finds the build's files in an older cache while its own is not filled", async () => {
        const scope = startWorker();
        const shell = await scope.fetch({ url: SCOPE, mode: "navigate" });
        expect(await shell!.text()).toBe("<!doctype html>old");
    });
});
