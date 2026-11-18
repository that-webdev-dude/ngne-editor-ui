// Entry module of `@ngne/editor-ui/pwa/worker` (SPEC §4, §10): the editor's service worker,
// for its worker entry. Imports only the model: no React, no DOM (SPEC §1.1).

export type { PrecacheEntry } from "../model/pwa/precache.js";
export { installServiceWorker } from "./serviceWorker.js";
export type { ServiceWorkerOptions } from "./serviceWorker.js";
