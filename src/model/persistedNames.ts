import { pwaNames } from "./pwa/precache.js";
import type { PwaNames } from "./pwa/precache.js";

// Every name an editor persists under (SPEC §5), from its id alone, so an editor's storage-key
// and PWA tests name them without building an instance. The instance's stores are kept under
// these names, and the service worker and its pages use the `PwaNames` part.

/** The persisted names of the editor `id` (SPEC §5). */
export interface PersistedNames extends PwaNames {
    /** The theme's key: `<id>.theme`. */
    readonly theme: string;
    /** The shell layout's key: `<id>.layout`. */
    readonly layout: string;
    /** The recent commands' key: `<id>.recent-commands`. */
    readonly recentCommands: string;
}

/** The persisted names of the editor `id`: its storage keys and its worker's names (SPEC §5). */
export function persistedNames(id: string): PersistedNames {
    return {
        theme: `${id}.theme`,
        layout: `${id}.layout`,
        recentCommands: `${id}.recent-commands`,
        ...pwaNames(id),
    };
}
