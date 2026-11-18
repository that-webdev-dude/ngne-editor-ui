import { readFileSync } from "node:fs";
import { basename } from "node:path";

// `checkStylesheets(paths)` (SPEC §9.2): the canon's rule that only `tokens.css` holds raw
// colours (DESIGN §3), as a check an app runs over its own stylesheets in a unit test. Every
// other stylesheet takes its colours from the tokens, through `var(--…)`.

/** The one stylesheet that may hold raw colours: the suite's tokens. */
const TOKENS_FILE_NAME = "tokens.css";

const NAMED_COLOURS =
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen";
const SYSTEM_COLOURS =
    "accentcolor accentcolortext activetext buttonborder buttonface buttontext canvas canvastext field fieldtext graytext highlight highlighttext linktext mark marktext selecteditem selecteditemtext visitedtext";

/** The named and system colours as one alternation: `aliceblue|antiquewhite|…`. */
const COLOUR_NAMES = `${NAMED_COLOURS} ${SYSTEM_COLOURS}`.replaceAll(" ", "|");

/** Hex colours, colour functions, and named and system colours. */
const RAW_COLOUR_PATTERNS: readonly RegExp[] = [
    /#[0-9a-f]{3,8}(?![\w-])/i,
    /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\s*\(/i,
    new RegExp(String.raw`(?<![\w-])(?:${COLOUR_NAMES})(?![\w-])`, "i"),
];

/** A comment, or a quoted string with its escapes. */
const COMMENT_OR_STRING = /\/\*[\s\S]*?(?:\*\/|$)|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g;

/**
 * A `property: value` declaration, ended by `;` or by the end of its block. Linear: a property
 * starts only at the start of a word, and the value takes the whole run up to `;`, `{` or `}`
 * without giving any back (the lookahead and `\2` stand for an atomic group), since a shorter
 * value never ends at `;` or `}` either. The value keeps the spaces after the colon.
 */
const DECLARATION = /(?<![\w-])([\w-]+)\s*:(?=([^;{}]+))\2(?=[;}])/g;

/**
 * The stylesheet with every comment and the inside of every string blanked: the same length
 * and lines, so offsets and line numbers still point into the original text, with no text that
 * could read as a declaration or a colour.
 */
function blankCommentsAndStrings(css: string): string {
    return css.replace(COMMENT_OR_STRING, (match) => {
        const blank = match.replace(/[^\n]/g, " ");
        return match.startsWith("/*") ? blank : `${match[0]}${blank.slice(2)}${match[0]}`;
    });
}

/** The raw colour inside a blanked declaration value, or null. Tokens and keywords are not raw. */
function rawColour(value: string): string | null {
    const scanned = value
        .replace(/var\(\s*--[\w-]+\s*\)/g, "")
        .replace(/(?<![\w-])url\([^)]*\)/gi, "");
    for (const pattern of RAW_COLOUR_PATTERNS) {
        const match = pattern.exec(scanned);
        if (match) return match[0];
    }
    return null;
}

/** Every declaration of `css` that holds a raw colour, as `line property: value (colour)`. */
function rawColourDeclarations(css: string): string[] {
    const original = css.replaceAll("\r", "");
    const text = blankCommentsAndStrings(original);
    const offences = [];
    let line = 1;
    let counted = 0;
    for (const match of text.matchAll(DECLARATION)) {
        const raw = rawColour(match[2] ?? "");
        if (!raw) continue;
        for (; counted < match.index; counted += 1) if (text[counted] === "\n") line += 1;
        const property = match[1] ?? "";
        const start = match.index + match[0].length - (match[2] ?? "").length;
        const value = original.slice(start, match.index + match[0].length).trim();
        offences.push(`${line} ${property}: ${value} (${raw})`);
    }
    return offences;
}

/**
 * Reads each stylesheet at `paths` and throws when one other than `tokens.css` holds a raw
 * colour: a hex colour, a colour function (`rgb()`, `hsl()`, `oklch()`, `color-mix()`, …), or
 * a named or system colour. The error lists every offence as `file:line property: value
 * (colour)`. Comments, strings and `url()` are not read; `transparent`, `currentColor` and
 * `var(--…)` are not raw colours. Paths are files, read relative to the working directory; an
 * empty list or an unreadable file throws too.
 */
export function checkStylesheets(paths: readonly string[]): void {
    if (paths.length === 0) throw new Error("checkStylesheets: no stylesheet given.");
    const offences = [];
    for (const path of paths) {
        let css: string;
        try {
            css = readFileSync(path, "utf8");
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            throw new Error(`checkStylesheets: ${path} cannot be read: ${reason}`, {
                cause: error,
            });
        }
        if (basename(path) === TOKENS_FILE_NAME) continue;
        for (const offence of rawColourDeclarations(css)) offences.push(`${path}:${offence}`);
    }
    if (offences.length > 0) {
        throw new Error(
            `checkStylesheets: raw colours outside ${TOKENS_FILE_NAME} (DESIGN §3):\n${offences.join("\n")}`,
        );
    }
}
