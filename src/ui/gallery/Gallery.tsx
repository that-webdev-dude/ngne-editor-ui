import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { inertOutsideModalLayers } from "../focus/inertOutside.js";
import { trackFocusModality } from "../focus/modality.js";
import { DialogHost } from "../messages/DialogHost.js";
import { ToastViewport } from "../messages/ToastViewport.js";
import { TooltipProvider } from "../primitives/Tooltip.js";
import { GALLERY_DIALOGS, GALLERY_ENTRIES } from "./entries.js";
import { GalleryThemeContext } from "./entry.js";
import type { GalleryEntry, GalleryTheme } from "./entry.js";

// The gallery frame (SPEC §12): a header with the theme switch and the link to the licences
// file, then one section per entry; after them the dialog host and the toasts. The switch sets
// the theme of the whole document, so surfaces that render outside the frame follow it; it is
// the gallery's own and stores nothing.

const THEMES: readonly { value: GalleryTheme; label: string }[] = [
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
];

/** Puts the token set of `theme` on the document (DESIGN §3: light under `[data-theme]`). */
function applyTheme(theme: GalleryTheme): void {
    document.documentElement.dataset.theme = theme;
}

/**
 * Keeps `data-modality` on the document, which the focus ring of base.css reads, and marks the
 * page `inert` while a modal layer of the entries is open (DESIGN §3.3, §9), as `UiRoot` does
 * in an app (SPEC §8).
 */
function useFocusServices(): void {
    useEffect(() => trackFocusModality(), []);
    useEffect(() => inertOutsideModalLayers(), []);
}

function Section({ entry }: Readonly<{ entry: GalleryEntry }>) {
    const { id, title, Component } = entry;
    return (
        <section
            className="gallery__entry"
            id={id}
            data-entry={id}
            aria-labelledby={`gallery-entry-${id}`}
        >
            <h2 className="gallery__title" id={`gallery-entry-${id}`}>
                {title}
            </h2>
            <Component />
        </section>
    );
}

/** The gallery of the suite's interface (SPEC §12), in the theme chosen in its header. */
export function Gallery() {
    const [theme, setTheme] = useState<GalleryTheme>("dark");
    useFocusServices();
    useLayoutEffect(() => applyTheme(theme), [theme]);

    // The theme is on the document before the entries render in it: they read its values.
    const choose = (next: GalleryTheme) => {
        applyTheme(next);
        setTheme(next);
    };

    return (
        <GalleryThemeContext.Provider value={theme}>
            <div className="gallery">
                <header className="gallery__header">
                    <h1 className="gallery__heading">Interface gallery</h1>
                    <div className="gallery__actions">
                        <fieldset className="gallery__themes">
                            <legend className="ui-visually-hidden">Theme</legend>
                            {THEMES.map(({ value, label }) => (
                                <label key={value} className="gallery__theme">
                                    <input
                                        type="radio"
                                        name="gallery-theme"
                                        value={value}
                                        checked={theme === value}
                                        onChange={() => choose(value)}
                                    />
                                    {label}
                                </label>
                            ))}
                        </fieldset>
                        <a className="gallery__link" href="licences.txt">
                            Open source licences
                        </a>
                    </div>
                </header>
                <main className="gallery__entries">
                    {GALLERY_ENTRIES.map((entry) => (
                        <Section key={entry.id} entry={entry} />
                    ))}
                </main>
            </div>
            {/* The message surfaces of the entries, mounted once. The toasts are a live
                region: Radix leaves live regions and their ancestors out when it hides the
                page behind a modal layer, so they sit beside the page, not inside it. */}
            <TooltipProvider>
                <DialogHost dialogs={GALLERY_DIALOGS} />
                {createPortal(<ToastViewport />, document.body)}
            </TooltipProvider>
        </GalleryThemeContext.Provider>
    );
}
