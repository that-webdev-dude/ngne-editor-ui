import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import type { Theme } from "./gallery-support.ts";

// What the command palette, shortcut sheet and surfaces specs share on the demo editor
// (SPEC §7.1, §12): opening it, its theme, the surfaces and their controls, and the key log
// its commands write to.

export const ID = "ngne-demo-editor";
export const RECENT_KEY = `${ID}.recent-commands`;
export const PALETTE_COMMAND = "edit.commandPalette";
export const SHORTCUTS_COMMAND = "edit.shortcuts";
export const PREFERENCES_COMMAND = "edit.preferences";

export async function openDemo(page: Page) {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./demo/");
    await expect(page.getByRole("heading", { name: "NGNE Demo Editor", level: 1 })).toBeVisible();
}

/** Switches the demo's theme from its header. */
export async function chooseDemoTheme(page: Page, theme: Theme) {
    await page
        .locator("header.demo__header")
        .getByRole("radiogroup", { name: "Theme" })
        .getByRole("radio", { name: theme === "dark" ? "Dark" : "Light" })
        .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

/** Waits for React to commit and for Radix's deferred focus moves: frames, then a timer. */
export const settle = (page: Page) =>
    page.evaluate(async () => {
        const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await frame();
        await frame();
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

export async function focus(target: Locator) {
    await target.focus();
    await expect(target).toBeFocused();
}

// --- The demo's controls -----------------------------------------------------------------

export const viewport = (page: Page) => page.getByRole("application", { name: "Canvas" });
/** The Name field; by its class, as a modal surface hides it from the accessibility tree. */
export const nameField = (page: Page) => page.locator("input.demo__text-field");
export const toolButton = (page: Page) => page.getByRole("button", { name: "Tool", exact: true });
export const preferencesButton = (page: Page) =>
    page.locator("header.demo__header").getByRole("button", { name: "Preferences…", exact: true });
export const paletteTrigger = (page: Page) =>
    page.locator("header.demo__header").getByRole("button", { name: "Commands", exact: true });
/** The instance's open surface, as the demo names it on its page. */
export const openSurface = (page: Page) =>
    page
        .locator(`main[data-editor-ui="${ID}"]`)
        .evaluate((main) => (main as HTMLElement).dataset.openSurface ?? null);
/** What the commands run so far recorded, oldest first. */
export const ran = (page: Page) =>
    page.getByRole("list", { name: "Commands run" }).getByRole("listitem").allTextContents();

// --- Command palette ----------------------------------------------------------------------

export const palette = (page: Page) => page.getByRole("dialog", { name: "Command palette" });
export const paletteInput = (page: Page) =>
    palette(page).getByRole("combobox", { name: "Search commands" });
export const paletteList = (page: Page) => palette(page).getByRole("listbox", { name: "Commands" });
export const paletteOptions = (page: Page) => paletteList(page).getByRole("option");
export const paletteOption = (page: Page, commandId: string) =>
    palette(page).locator(`[role="option"][data-command="${commandId}"]`);
/** The row the arrow keys are on; Enter runs it. */
export const activeOption = (page: Page) =>
    palette(page).locator('[role="option"][aria-selected="true"]');

/** Opens the palette with its key and waits until the search field has focus. */
export async function openPalette(page: Page): Promise<Locator> {
    await page.keyboard.press("Control+KeyK");
    await expect(paletteInput(page)).toBeFocused();
    return palette(page);
}

/** The command ids of the palette rows, in the order shown. */
export function paletteIds(page: Page): Promise<string[]> {
    return paletteOptions(page).evaluateAll((options) =>
        options.map((option) => (option as HTMLElement).dataset.command ?? ""),
    );
}

/** Opens the palette, runs a command from its row, and waits for the palette to be gone. */
export async function runFromPalette(page: Page, commandId: string): Promise<void> {
    await openPalette(page);
    await paletteOption(page, commandId).click();
    await expect(palette(page)).toBeHidden();
    await settle(page);
}

export const recentCommands = (page: Page) =>
    page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]") as string[], RECENT_KEY);

// --- Shortcut sheet and Preferences -------------------------------------------------------

export const shortcutSheet = (page: Page) =>
    page.getByRole("dialog", { name: "Keyboard shortcuts" });
export const shortcutList = (page: Page) =>
    shortcutSheet(page).getByRole("group", { name: "Shortcuts by menu" });
export const preferencesDialog = (page: Page) => page.getByRole("dialog", { name: "Preferences" });

/** Nothing of a closed modal surface is left on the page: the editor can be used again. */
export async function expectEditorUsable(page: Page): Promise<void> {
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const leftovers = await page.evaluate(() => ({
        hidden: document.querySelectorAll("[data-aria-hidden]").length,
        pointerEvents: document.body.style.pointerEvents,
    }));
    expect(leftovers).toEqual({ hidden: 0, pointerEvents: "" });
}
