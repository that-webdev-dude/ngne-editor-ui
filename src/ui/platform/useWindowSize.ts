import { useSyncExternalStore } from "react";

// The window size the shell lays out by (SPEC §8: minimum window 1280×720).

function subscribe(onChange: () => void): () => void {
    window.addEventListener("resize", onChange);
    return () => window.removeEventListener("resize", onChange);
}

/** Window width in CSS pixels, updated on resize. */
export function useWindowWidth(): number {
    return useSyncExternalStore(subscribe, () => window.innerWidth);
}

/** Window height in CSS pixels, updated on resize. */
export function useWindowHeight(): number {
    return useSyncExternalStore(subscribe, () => window.innerHeight);
}
