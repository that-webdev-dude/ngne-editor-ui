import type { ReactNode } from "react";
import { useGalleryTheme } from "../entry.js";
import type { GalleryEntry } from "../entry.js";

// The Tokens entry of the gallery (SPEC §12): every token of DESIGN §3 the canon shows, with
// its name and the value tokens.css gives it in the theme the frame shows.

/** DESIGN §3.1: the colour table, then the transparency checkerboard. */
const COLOURS = [
    "--bg-workspace",
    "--bg-panel",
    "--bg-raised",
    "--bg-active",
    "--border",
    "--border-strong",
    "--border-input",
    "--text",
    "--text-muted",
    "--text-faint",
    "--accent",
    "--accent-contrast",
    "--danger",
    "--warn",
    "--check-a",
    "--check-b",
] as const;

/** DESIGN §3.2: each size with the sample it sets, then the family and the weights. */
const TYPE = [
    { token: "--font-size", sample: "Body and controls" },
    { token: "--font-size-label", sample: "Labels and status bar" },
    { token: "--font-size-title", sample: "Dialog titles" },
] as const;
const TYPE_FACTS = ["--font-ui", "--line-height", "--font-weight", "--font-weight-strong"] as const;

/** DESIGN §3.3. */
const SPACING = [
    "--space-2",
    "--space-4",
    "--space-8",
    "--space-12",
    "--space-16",
    "--space-24",
] as const;
const RADII = ["--radius-control", "--radius-surface", "--radius-region"] as const;
const FOCUS_RING = ["--focus-ring-width", "--focus-ring-offset"] as const;

const ALL = [
    ...COLOURS,
    ...TYPE.map(({ token }) => token),
    ...TYPE_FACTS,
    ...SPACING,
    ...RADII,
    "--elevation",
    ...FOCUS_RING,
];

/**
 * The value of each token on the document element, as tokens.css declares it. The frame sets
 * the theme on that element before it renders in the theme, and the entry renders again when
 * the theme changes (`useGalleryTheme`).
 */
function tokenValues(): ReadonlyMap<string, string> {
    const style = getComputedStyle(document.documentElement);
    return new Map(ALL.map((name) => [name, style.getPropertyValue(name).trim()]));
}

function Name({ children }: Readonly<{ children: string }>) {
    return <code className="gallery-tokens__name">{children}</code>;
}

function Value({ name, values }: Readonly<{ name: string; values: ReadonlyMap<string, string> }>) {
    return (
        <span className="gallery-tokens__value" data-token-value={name}>
            {values.get(name)}
        </span>
    );
}

function Group({
    id,
    title,
    children,
}: Readonly<{ id: string; title: string; children: ReactNode }>) {
    return (
        <section className="gallery-tokens__group" aria-labelledby={`gallery-tokens-${id}`}>
            <h3 className="gallery-tokens__heading" id={`gallery-tokens-${id}`}>
                {title}
            </h3>
            {children}
        </section>
    );
}

function TokensEntry() {
    useGalleryTheme();
    const values = tokenValues();
    return (
        <div className="gallery-tokens">
            <Group id="colour" title="Colour">
                <ul className="gallery-tokens__colours">
                    {COLOURS.map((name) => (
                        <li key={name} className="gallery-tokens__colour" data-token={name}>
                            <span
                                className="gallery-tokens__swatch"
                                style={{ background: `var(${name})` }}
                                aria-hidden="true"
                            />
                            <Name>{name}</Name>
                            <Value name={name} values={values} />
                        </li>
                    ))}
                </ul>
            </Group>

            <Group id="type" title="Type">
                <ul className="gallery-tokens__list">
                    {TYPE.map(({ token: name, sample }) => (
                        <li key={name} className="gallery-tokens__fact" data-token={name}>
                            <span
                                className="gallery-tokens__sample"
                                style={{ fontSize: `var(${name})` }}
                            >
                                {sample}
                            </span>
                            <Name>{name}</Name>
                            <Value name={name} values={values} />
                        </li>
                    ))}
                    {TYPE_FACTS.map((name) => (
                        <li key={name} className="gallery-tokens__fact" data-token={name}>
                            <Name>{name}</Name>
                            <Value name={name} values={values} />
                        </li>
                    ))}
                </ul>
            </Group>

            <Group id="spacing" title="Spacing">
                <ul className="gallery-tokens__list">
                    {SPACING.map((name) => (
                        <li key={name} className="gallery-tokens__fact" data-token={name}>
                            <span className="gallery-tokens__slot" aria-hidden="true">
                                <span
                                    className="gallery-tokens__space"
                                    style={{ width: `var(${name})` }}
                                />
                            </span>
                            <Name>{name}</Name>
                            <Value name={name} values={values} />
                        </li>
                    ))}
                </ul>
            </Group>

            <Group id="radius" title="Radius">
                <ul className="gallery-tokens__shapes">
                    {RADII.map((name) => (
                        <li key={name} className="gallery-tokens__shape" data-token={name}>
                            <span
                                className="gallery-tokens__box gallery-tokens__box--radius"
                                style={{ borderRadius: `var(${name})` }}
                                aria-hidden="true"
                            />
                            <Name>{name}</Name>
                            <Value name={name} values={values} />
                        </li>
                    ))}
                </ul>
            </Group>

            <Group id="elevation" title="Elevation">
                <ul className="gallery-tokens__shapes">
                    <li className="gallery-tokens__shape" data-token="--elevation">
                        <span
                            className="gallery-tokens__box gallery-tokens__box--elevation"
                            aria-hidden="true"
                        />
                        <Name>--elevation</Name>
                        <Value name="--elevation" values={values} />
                    </li>
                </ul>
            </Group>

            <Group id="focus" title="Focus ring">
                <ul className="gallery-tokens__shapes">
                    <li className="gallery-tokens__shape" data-token="--focus-ring-width">
                        <span
                            className="gallery-tokens__box gallery-tokens__box--focus"
                            aria-hidden="true"
                        />
                        {FOCUS_RING.map((name) => (
                            <span key={name} className="gallery-tokens__pair">
                                <Name>{name}</Name>
                                <Value name={name} values={values} />
                            </span>
                        ))}
                    </li>
                </ul>
            </Group>
        </div>
    );
}

export const tokensEntry: GalleryEntry = { id: "tokens", title: "Tokens", Component: TokensEntry };
