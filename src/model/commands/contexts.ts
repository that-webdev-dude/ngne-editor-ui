import type { KeyContext } from "./types.js";

/**
 * Every key context in priority order (SPEC §7.2): `text`, then the editor's own contexts in
 * the order it gives, then `canvas` and `global`. Throws when an editor context is empty,
 * repeated or one of the package's.
 */
export function keyContextOrder<Context extends string>(
    contexts: readonly Context[],
): readonly KeyContext<Context>[] {
    const seen = new Set<string>();
    for (const context of contexts) {
        if (context.trim() === "") throw new Error("A key context has an empty name.");
        if (context === "text" || context === "canvas" || context === "global") {
            throw new Error(`The key context "${context}" is the package's; list only the app's.`);
        }
        if (seen.has(context)) throw new Error(`The key context "${context}" is listed twice.`);
        seen.add(context);
    }
    return ["text", ...contexts, "canvas", "global"];
}
