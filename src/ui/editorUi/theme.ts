import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";
import { readItem, writeItem } from "../platform/storage.js";
import type { KeyValueStorage } from "../platform/storage.js";
import { useEditorUi } from "./context.js";

// The theme of an editor (DESIGN §3), one store per editor UI instance, kept under the
// instance's `<id>.theme` (SPEC §5) so an editor keeps its users' choice. There is no theme
// command (SPEC §1.3): the editor sets the theme from its Preferences. `UiRoot` mirrors it to
// `<html data-theme>`.

/** DESIGN §3: dark is the default, light is the second full token set. */
export type Theme = "dark" | "light";

export const DEFAULT_THEME: Theme = "dark";

export interface ThemeState {
    theme: Theme;
    setTheme(theme: Theme): void;
    toggleTheme(): void;
}

function parseTheme(value: string | null): Theme {
    return value === "light" || value === "dark" ? value : DEFAULT_THEME;
}

/**
 * A theme store kept in `storage` under `key`; anything but a stored "dark" or "light" is the
 * default. A failed write is reported once per page and the theme stays in effect.
 */
export function createThemeStore(
    storage: KeyValueStorage | null,
    key: string,
): StoreApi<ThemeState> {
    return createStore<ThemeState>((set, get) => ({
        theme: parseTheme(readItem(storage, key)),
        setTheme(theme) {
            writeItem(storage, key, theme);
            set({ theme });
        },
        toggleTheme() {
            get().setTheme(get().theme === "dark" ? "light" : "dark");
        },
    }));
}

/** The theme of the editor UI that `UiRoot` provides; renders again when it changes. */
export function useTheme(): Theme {
    return useStore(useEditorUi().theme, (state) => state.theme);
}

/** Sets and stores the theme of `editorUi`. */
export function setTheme(editorUi: { readonly theme: StoreApi<ThemeState> }, theme: Theme): void {
    editorUi.theme.getState().setTheme(theme);
}
