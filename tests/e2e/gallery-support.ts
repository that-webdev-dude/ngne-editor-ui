import { AxeBuilder } from "@axe-core/playwright";
import { expect } from "@playwright/test";
import type { FrameLocator, Locator, Page } from "@playwright/test";

// What the message and focus specs share on the gallery (SPEC §3, §12): opening it, the
// themes and window sizes of DESIGN §9, keyboard focus, and the WCAG 2.1 AA audit.

export type Theme = "dark" | "light";
export const THEMES: readonly Theme[] = ["dark", "light"];

/** The window sizes of DESIGN §9: the minimum window, and 1920 × 1080 at 125% browser zoom. */
export const WINDOWS = [
    { name: "1280×720", width: 1280, height: 720 },
    // 125% zoom of a 1920 × 1080 window lays the page out in 1536 × 864 CSS pixels.
    { name: "1536×864 (125% of 1920×1080)", width: 1536, height: 864 },
] as const;

/** The accent of each theme (DESIGN §3.1), as computed styles give it. */
export const ACCENT: Record<Theme, string> = {
    dark: "rgb(131, 232, 225)",
    light: "rgb(8, 127, 120)",
};

export const entry = (page: Page, id: string) => page.locator(`section[data-entry="${id}"]`);
export const button = (scope: Page | Locator, name: string) =>
    scope.getByRole("button", { name, exact: true });
export const readout = (page: Page, name: string) => page.locator(`[data-readout="${name}"]`);

export async function openGallery(page: Page) {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await expect(page.getByRole("heading", { name: "Interface gallery", level: 1 })).toBeVisible();
}

export async function chooseTheme(page: Page, theme: Theme) {
    const radio = page.getByRole("radio", { name: theme === "dark" ? "Dark" : "Light" });
    await radio.check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

/** Focuses `target` from the keyboard: Tab onto it from the control before it. */
export async function tabTo(page: Page, target: Locator) {
    await target.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(target).toBeFocused();
}

export async function boxOf(locator: Locator) {
    const box = await locator.boundingBox();
    if (!box) throw new Error("The element has no box.");
    return box;
}

/** Uncaught errors of the page; a boundary's caught error is not one. */
export function uncaughtErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    return errors;
}

const AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** A node axe names: one selector per frame from the page down, the last the node's own. */
type AxeTarget = readonly (string | readonly string[])[];

/** The element an axe target names, in the frame it names. */
function located(page: Page, target: AxeTarget): Locator {
    const selectors = target.map((part) => (typeof part === "string" ? part : part.join(" ")));
    let scope: Page | FrameLocator = page;
    for (const frame of selectors.slice(0, -1)) scope = scope.frameLocator(frame);
    return scope.locator(selectors.at(-1)!);
}

/**
 * Whether any part of the element lies inside the visible box of its scrolling ancestors, in
 * its own frame's document.
 */
function isOnScreen(element: Locator): Promise<boolean> {
    return element.evaluate((element) => {
        let { left, top, right, bottom } = element.getBoundingClientRect();
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            if (style.overflowX === "visible" && style.overflowY === "visible") continue;
            const clip = parent.getBoundingClientRect();
            left = Math.max(left, clip.left);
            top = Math.max(top, clip.top);
            right = Math.min(right, clip.right);
            bottom = Math.min(bottom, clip.bottom);
        }
        return right > left && bottom > top;
    });
}

/**
 * Runs axe (WCAG 2.1 A and AA) on the page, or on the subtree under `scope`, frames included,
 * and returns the violations together with what the contrast rule covered: nodes it judged,
 * and nodes on screen it could not decide on (those would hide a failure, so the specs accept
 * none).
 */
export async function audit(page: Page, scope?: string) {
    const builder = new AxeBuilder({ page }).withTags(AA_TAGS);
    const results = await (scope ? builder.include(scope) : builder).analyze();
    const contrast = (list: typeof results.passes) =>
        list.filter((rule) => rule.id === "color-contrast").flatMap((rule) => rule.nodes);
    const undecided = contrast(results.incomplete).map((node) => node.target as AxeTarget);
    const onScreen = await Promise.all(
        undecided.map((target) => isOnScreen(located(page, target))),
    );
    const contrastUndecided = undecided
        .filter((_, index) => onScreen[index])
        .map((target) => target.join(" "));
    return {
        violations: results.violations.flatMap((rule) =>
            rule.nodes.map(
                (node) => `${rule.id}: ${node.target.join(" ")} — ${node.failureSummary}`,
            ),
        ),
        contrastChecked: contrast(results.passes).length,
        contrastUndecided,
    };
}

/** Nothing scrolls sideways or reaches past the page's right edge. */
export function horizontalOverflow(page: Page) {
    return page.evaluate(() => {
        const gallery = document.querySelector(".gallery")!;
        const width = document.documentElement.clientWidth;
        const outside = [...document.querySelectorAll("section[data-entry] *")].filter(
            (element) => element.getBoundingClientRect().right > width,
        );
        return {
            page: document.documentElement.scrollWidth - width,
            gallery: gallery.scrollWidth - gallery.clientWidth,
            outside: outside.length,
        };
    });
}
