// sRGB8 ↔ OKLab (SPEC §4, `@ngne/editor-ui/colour`). Written from published definitions only
// (BRIEF D21, PROVENANCE §3):
//
// - OKLab: the matrices M1 (XYZ → lms) and M2 (l'm's' → Lab) and the cube root between them,
//   as published in Björn Ottosson, "A perceptual color space for image processing" (2020),
//   https://bottosson.github.io/posts/oklab/. Its input is XYZ with a D65 white and Y = 1 for
//   white.
// - sRGB (IEC 61966-2-1): the transfer function and the chromaticities of the primaries. The
//   sRGB → XYZ matrix is built from those primaries with the white M1 maps to l = m = s = 1,
//   so every grey has a = b = 0.
//
// Coordinates are [L, a, b]: L from 0 (black) to 1 (white), a and b about −0.4..0.4.

/** A colour in OKLab: lightness L, then the axes a (green–red) and b (blue–yellow). */
export type Oklab = [L: number, a: number, b: number];

type Vector = readonly [number, number, number];
type Matrix = readonly [Vector, Vector, Vector];

/** XYZ (D65, Y = 1 for white) → approximate cone responses lms; Ottosson 2020. */
const M1: Matrix = [
    [0.8189330101, 0.3618667424, -0.1288597137],
    [0.0329845436, 0.9293118715, 0.0361456387],
    [0.0482003018, 0.2643662691, 0.633851707],
];

/** Cube roots of lms → L, a, b; Ottosson 2020. */
const M2: Matrix = [
    [0.2104542553, 0.793617785, -0.0040720468],
    [1.9779984951, -2.428592205, 0.4505937099],
    [0.0259040371, 0.7827717662, -0.808675766],
];

/** Chromaticities x, y of the sRGB primaries red, green, blue (IEC 61966-2-1). */
const SRGB_PRIMARIES = [
    [0.64, 0.33],
    [0.3, 0.6],
    [0.15, 0.06],
] as const;

function times(m: Matrix, v: Vector): [number, number, number] {
    return [
        m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
        m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
        m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
    ];
}

function transpose(m: Matrix): Matrix {
    return [
        [m[0][0], m[1][0], m[2][0]],
        [m[0][1], m[1][1], m[2][1]],
        [m[0][2], m[1][2], m[2][2]],
    ];
}

function product(a: Matrix, b: Matrix): Matrix {
    const columns = transpose(b);
    return transpose([times(a, columns[0]), times(a, columns[1]), times(a, columns[2])]);
}

/** The inverse of a 3×3 matrix, by its adjugate. */
function inverse(m: Matrix): Matrix {
    const [[a, b, c], [d, e, f], [g, h, i]] = m;
    const cofactor0 = e * i - f * h;
    const cofactor1 = f * g - d * i;
    const cofactor2 = d * h - e * g;
    const det = a * cofactor0 + b * cofactor1 + c * cofactor2;
    return [
        [cofactor0 / det, (c * h - b * i) / det, (b * f - c * e) / det],
        [cofactor1 / det, (a * i - c * g) / det, (c * d - a * f) / det],
        [cofactor2 / det, (b * g - a * h) / det, (a * e - b * d) / det],
    ];
}

/** Linear sRGB → XYZ: the primaries' XYZ (Y = 1), each scaled so that they sum to `white`. */
function srgbToXyz(white: Vector): Matrix {
    const xyz = ([x, y]: readonly [number, number]): Vector => [x / y, 1, (1 - x - y) / y];
    const unscaled = transpose([
        xyz(SRGB_PRIMARIES[0]),
        xyz(SRGB_PRIMARIES[1]),
        xyz(SRGB_PRIMARIES[2]),
    ]);
    const [kr, kg, kb] = times(inverse(unscaled), white);
    const scaled = (row: Vector): Vector => [row[0] * kr, row[1] * kg, row[2] * kb];
    return [scaled(unscaled[0]), scaled(unscaled[1]), scaled(unscaled[2])];
}

/** The white of M1: the XYZ it maps to l = m = s = 1. */
const WHITE = times(inverse(M1), [1, 1, 1]);
const SRGB_TO_LMS = product(M1, srgbToXyz(WHITE));
const LMS_TO_SRGB = inverse(SRGB_TO_LMS);
const M2_INVERSE = inverse(M2);

/** sRGB transfer function (IEC 61966-2-1): encoded value 0..1 → linear light. */
function decode(value: number): number {
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Inverse of `decode`: linear light → encoded value, clipped to 0..1. */
function encode(linear: number): number {
    const value = Math.min(1, Math.max(0, linear));
    return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
}

/** Linear light of each 8-bit channel value. */
const LINEAR = Float64Array.from({ length: 256 }, (_, channel) => decode(channel / 255));

/** The OKLab of an sRGB colour; `r`, `g` and `b` are integers 0..255. */
export function srgb8ToOklab(r: number, g: number, b: number): Oklab {
    const [l, m, s] = times(SRGB_TO_LMS, [LINEAR[r]!, LINEAR[g]!, LINEAR[b]!]);
    return times(M2, [Math.cbrt(l), Math.cbrt(m), Math.cbrt(s)]);
}

/**
 * Writes the OKLab of an sRGB colour (`r`, `g`, `b` integers 0..255) to `out[offset]`,
 * `out[offset + 1]` and `out[offset + 2]`, and nothing else.
 */
export function writeOklab(
    out: { [index: number]: number },
    offset: number,
    r: number,
    g: number,
    b: number,
): void {
    const [L, a, bAxis] = srgb8ToOklab(r, g, b);
    out[offset] = L;
    out[offset + 1] = a;
    out[offset + 2] = bAxis;
}

/**
 * The sRGB colour of an OKLab colour, each channel an integer 0..255. A colour outside the
 * sRGB gamut is clipped channel by channel.
 */
export function oklabToSrgb8(L: number, a: number, b: number): [number, number, number] {
    const roots = times(M2_INVERSE, [L, a, b]);
    const linear = times(LMS_TO_SRGB, [roots[0] ** 3, roots[1] ** 3, roots[2] ** 3]);
    return [
        Math.round(encode(linear[0]) * 255),
        Math.round(encode(linear[1]) * 255),
        Math.round(encode(linear[2]) * 255),
    ];
}
