import { expect, test } from "@playwright/test";
import { uncaughtErrors } from "./gallery-support.ts";
import {
    activeOption,
    expectEditorUsable,
    focus,
    nameField,
    openDemo,
    openPalette,
    openSurface,
    palette,
    paletteInput,
    paletteTrigger,
    preferencesButton,
    preferencesDialog,
    settle,
    shortcutSheet,
    toolButton,
    viewport,
} from "./surfaces-support.ts";

// Open-surface tracking (SPEC §7.1) on the demo editor: the instance holds the package's
// surfaces (command palette, shortcut sheet) and the editor's own (`surfaces`, SPEC §5: a
// fixture Preferences dialog), one open at a time, shown by the surface host; opening one
// closes another, and closing one returns the focus to the element it was opened from.

test.beforeEach(async ({ page }) => {
    await openDemo(page);
});

test("opening one surface closes another", async ({ page }) => {
    const errors = uncaughtErrors(page);
    expect(await openSurface(page)).toBeNull();

    // Preferences, then the shortcut sheet from inside it: the sheet takes its place.
    await preferencesButton(page).click();
    await expect(preferencesDialog(page)).toBeVisible();
    expect(await openSurface(page)).toBe("preferences");
    await preferencesDialog(page).getByRole("button", { name: "Keyboard Shortcuts…" }).click();
    await expect(shortcutSheet(page)).toBeVisible();
    await expect(preferencesDialog(page)).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(1);
    expect(await openSurface(page)).toBe("shortcut-sheet");
    await page.keyboard.press("Escape");
    await expect(shortcutSheet(page)).toBeHidden();
    expect(await openSurface(page)).toBeNull();
    await expectEditorUsable(page);

    // The palette, then Preferences from it: the palette closes, Preferences opens.
    await focus(viewport(page));
    await openPalette(page);
    expect(await openSurface(page)).toBe("command-palette");
    await page.keyboard.type("preferences");
    await expect(activeOption(page)).toHaveAttribute("data-command", "edit.preferences");
    await page.keyboard.press("Enter");
    await expect(preferencesDialog(page)).toBeVisible();
    await expect(palette(page)).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(1);
    expect(await openSurface(page)).toBe("preferences");
    await page.keyboard.press("Escape");
    await expect(preferencesDialog(page)).toBeHidden();
    await expectEditorUsable(page);
    expect(errors).toEqual([]);
});

test("the editor's surface is tracked: shown by the host, closed through the instance", async ({
    page,
}) => {
    await preferencesButton(page).click();
    const dialog = preferencesDialog(page);
    await expect(dialog).toBeVisible();
    expect(await openSurface(page)).toBe("preferences");
    // A change applies at once (DESIGN §7).
    await dialog.getByRole("radio", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    // While it is open, the keys of the editor do not act: no palette over it.
    await page.keyboard.press("Control+KeyK");
    await settle(page);
    await expect(palette(page)).toHaveCount(0);
    expect(await openSurface(page)).toBe("preferences");

    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
    expect(await openSurface(page)).toBeNull();
    await expectEditorUsable(page);
});

test("closing a surface returns the focus to the element it was opened from", async ({ page }) => {
    // Preferences from its button, with the pointer.
    await preferencesButton(page).click();
    await expect(preferencesDialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(preferencesDialog(page)).toBeHidden();
    await expect(preferencesButton(page)).toBeFocused();

    // The palette from its trigger.
    await paletteTrigger(page).click();
    await expect(paletteInput(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    await expect(paletteTrigger(page)).toBeFocused();

    // The sheet from its key, on a focused control.
    await focus(toolButton(page));
    await page.keyboard.press("Shift+Slash");
    await expect(shortcutSheet(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(shortcutSheet(page)).toBeHidden();
    await expect(toolButton(page)).toBeFocused();

    // A surface a palette command opens returns the focus where the palette was opened.
    await focus(nameField(page));
    await openPalette(page);
    await page.keyboard.type("preferences");
    await page.keyboard.press("Enter");
    await expect(preferencesDialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(preferencesDialog(page)).toBeHidden();
    await expect(nameField(page)).toBeFocused();
    await expectEditorUsable(page);
});
