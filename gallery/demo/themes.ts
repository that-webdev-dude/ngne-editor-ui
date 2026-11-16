import type { Theme } from "@ngne/editor-ui";

// The two themes the demo editor offers, in its header and in its Preferences dialog.

export const THEMES: readonly { value: Theme; label: string }[] = [
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
];
