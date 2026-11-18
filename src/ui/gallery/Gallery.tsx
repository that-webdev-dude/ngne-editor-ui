import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { EditorUiContext } from "../editorUi/context.js";
import { inertOutsideModalLayers } from "../focus/inertOutside.js";
import { trackFocusModality } from "../focus/modality.js";
import { DialogHost } from "../messages/DialogHost.js";
import { ToastViewport } from "../messages/ToastViewport.js";
import { TooltipProvider } from "../primitives/Tooltip.js";
import { GALLERY_DIALOGS, GALLERY_GROUPS } from "./entries.js";
import { fixtureInstance } from "./entries/fixtureEditor.js";
import { GalleryThemeContext } from "./entry.js";
import type { GalleryEntry, GalleryGroup, GalleryTheme } from "./entry.js";

// The gallery frame (SPEC §12): a header with the theme switch and the link to the licences
// file, the navigation to every entry by its id, then one section per entry, the package's
// groups first and the app's entries after them; after them the dialog host and the toasts.
// The host is under an instance of the fixture editor (entries/fixtureEditor.ts), as `UiRoot`
// puts an app's under its instance: the dialogs that name the editor read it.
// The switch sets the theme of the whole document, so surfaces that render outside the frame
// follow it; it is the gallery's own and stores nothing.

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

/** The title of the group of the entries an app passes. */
const APP_GROUP = "App";

/** The package's groups, then the app's entries in a group of their own. */
function groupsWith(entries: readonly GalleryEntry[]): readonly GalleryGroup[] {
    return entries.length === 0
        ? GALLERY_GROUPS
        : [...GALLERY_GROUPS, { title: APP_GROUP, entries }];
}

/** Throws when two entries share an id: the id is the section's anchor. */
function checkIds(groups: readonly GalleryGroup[]): void {
    const seen = new Set<string>();
    for (const { entries } of groups) {
        for (const { id } of entries) {
            if (seen.has(id)) throw new Error(`Gallery: two entries have the id "${id}".`);
            seen.add(id);
        }
    }
}

/** The section of the entry the address names (`#id`), or null. */
function sectionOfHash(): HTMLElement | null {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id === "") return null;
    const section = document.getElementById(id);
    return section?.matches("section[data-entry]") ? section : null;
}

/**
 * Shows the entry the address names: when the gallery opens, after its entries have rendered,
 * and whenever the address's fragment changes.
 */
function useEntryNavigation(): void {
    useEffect(() => {
        const show = () => sectionOfHash()?.scrollIntoView({ block: "start" });
        show();
        window.addEventListener("hashchange", show);
        return () => window.removeEventListener("hashchange", show);
    }, []);
}

function Navigation({ groups }: Readonly<{ groups: readonly GalleryGroup[] }>) {
    return (
        <nav className="gallery__nav" aria-label="Entries">
            {groups.map(({ title, entries }) => (
                <div key={title} className="gallery__group" data-group={title}>
                    <span className="gallery__group-title" id={groupId(title)}>
                        {title}
                    </span>
                    <ul className="gallery__links" aria-labelledby={groupId(title)}>
                        {entries.map(({ id, title: entryTitle }) => (
                            <li key={id}>
                                <a className="gallery__nav-link" href={`#${id}`}>
                                    {entryTitle}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </nav>
    );
}

const groupId = (title: string) => `gallery-group-${title.toLowerCase().replaceAll(" ", "-")}`;

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

export interface GalleryProps {
    /**
     * The app's own entries (SPEC §12), shown after the package's in a group of their own, in
     * this order. Each id must differ from every other entry's, the package's included.
     */
    entries?: readonly GalleryEntry[];
}

const NO_ENTRIES: readonly GalleryEntry[] = [];

/**
 * The gallery of the suite's interface (SPEC §12): the package's entries, then the app's, in
 * the theme chosen in its header; the address's fragment (`#id`) shows an entry.
 */
export function Gallery({ entries = NO_ENTRIES }: Readonly<GalleryProps>) {
    const [theme, setTheme] = useState<GalleryTheme>("dark");
    const groups = useMemo(() => groupsWith(entries), [entries]);
    const [editorUi] = useState(() => fixtureInstance("ngne-gallery-frame"));
    checkIds(groups);
    useFocusServices();
    useLayoutEffect(() => applyTheme(theme), [theme]);
    useEntryNavigation();

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
                <Navigation groups={groups} />
                <main className="gallery__entries">
                    {groups.map(({ entries: groupEntries }) =>
                        groupEntries.map((entry) => <Section key={entry.id} entry={entry} />),
                    )}
                </main>
            </div>
            {/* The message surfaces of the entries, mounted once. The toasts are a live
                region: Radix leaves live regions and their ancestors out when it hides the
                page behind a modal layer, so they sit beside the page, not inside it. */}
            <EditorUiContext.Provider value={editorUi}>
                <TooltipProvider>
                    <DialogHost dialogs={GALLERY_DIALOGS} />
                    {createPortal(<ToastViewport />, document.body)}
                </TooltipProvider>
            </EditorUiContext.Provider>
        </GalleryThemeContext.Provider>
    );
}
