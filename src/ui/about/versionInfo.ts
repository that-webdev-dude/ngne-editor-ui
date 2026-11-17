import type { AppInfo } from "../editorUi/config.js";

// Copy version info of the About dialog (DESIGN §7): the one line a bug report needs, and the
// copy to the system clipboard, whose refusal is an answer the dialog shows, not an error.

/**
 * The line Copy version info copies: `<package> <version> · @ngne/core <version> · <user
 * agent>`, as "ngne-sprite-editor 1.2.0 · @ngne/core 0.4.1 · Mozilla/5.0 …".
 */
export function versionLine(info: AppInfo, userAgent: string): string {
    return [
        `${info.packageName} ${info.version}`,
        `${info.engine.packageName} ${info.engine.version}`,
        userAgent,
    ].join(" · ");
}

/** What the copy needs of the clipboard: `navigator.clipboard`, or a test's own. */
export interface ClipboardLike {
    writeText(text: string): Promise<unknown>;
}

/** The page's clipboard; missing on a page that is not a secure context. */
function browserClipboard(): ClipboardLike | undefined {
    return typeof navigator === "undefined" ? undefined : navigator.clipboard;
}

/**
 * Puts `text` on the clipboard. Resolves true when it did, false when the clipboard refused
 * (no permission, the page without focus) or is missing; never rejects.
 */
export async function copyText(
    text: string,
    clipboard: ClipboardLike | undefined = browserClipboard(),
): Promise<boolean> {
    if (typeof clipboard?.writeText !== "function") return false;
    try {
        await clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}
