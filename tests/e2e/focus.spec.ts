import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import {
    ACCENT,
    button,
    chooseTheme,
    entry,
    openGallery,
    readout,
    tabTo,
    THEMES,
} from "./gallery-support.ts";

// The focus subpath on the gallery (SPEC §4, §6; DESIGN §3.3, §9): the focus ring shows under
// keyboard modality only; content outside an open dialog is inert; a dialog opened from a menu
// returns the focus to the control the menu was opened from when it closes.

const modality = (page: Page) => page.locator("html");
const canvasDialog = (page: Page) => page.getByRole("dialog", { name: "Canvas size" });

/** The outline of the element that carries the ring for `target`. */
function ringOf(target: Locator) {
    return target.evaluate((element) => {
        const owner = element.closest(".ui-number") ?? element;
        const style = getComputedStyle(owner);
        return style.outlineStyle === "none"
            ? "none"
            : `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}, offset ${style.outlineOffset}`;
    });
}

for (const theme of THEMES) {
    test(`the focus ring shows under keyboard modality only (${theme} theme)`, async ({ page }) => {
        await openGallery(page);
        await chooseTheme(page, theme);
        const ring = `2px solid ${ACCENT[theme]}, offset 1px`;
        // After a pointer press nothing has a ring, but the Tokens entry's sample of it.
        await page.getByRole("heading", { name: "Interface gallery", level: 1 }).click();
        await expect(modality(page)).toHaveAttribute("data-modality", "pointer");
        expect(
            await page.evaluate(() =>
                [...document.querySelectorAll("*")]
                    .filter((element) => getComputedStyle(element).outlineStyle !== "none")
                    .map((element) => element.className),
            ),
        ).toEqual(["gallery-tokens__box gallery-tokens__box--focus"]);

        const targets: [string, Locator][] = [
            ["button", button(page, "Default")],
            ["danger button", button(page, "Discard")],
            ["number field", page.getByRole("spinbutton", { name: "Size" })],
            ["toast button", button(entry(page, "toast"), "Show toast")],
            ["context menu target", page.getByRole("group", { name: "Canvas" })],
            ["segmented control", page.getByRole("radio", { name: "No adapter" })],
            ["boundary control", button(entry(page, "region-boundary"), "Break regions")],
        ];
        for (const [name, target] of targets) {
            await target.click();
            await expect(target, name).toBeFocused();
            await expect(modality(page), name).toHaveAttribute("data-modality", "pointer");
            expect(await ringOf(target), `${name} after a pointer click`).toBe("none");

            // A modifier alone is not keyboard navigation (Shift-click, Ctrl-drag).
            await page.keyboard.press("Shift");
            await page.keyboard.press("Control");
            await expect(modality(page), name).toHaveAttribute("data-modality", "pointer");
            expect(await ringOf(target), `${name} after a modifier`).toBe("none");

            await page.keyboard.press("Shift+Tab");
            await page.keyboard.press("Tab");
            await expect(target, name).toBeFocused();
            await expect(modality(page), name).toHaveAttribute("data-modality", "keyboard");
            expect(await ringOf(target), `${name} after Tab`).toBe(ring);
        }

        // A dialog moves the focus by itself: a ring only when it was opened from the keyboard.
        const opener = button(entry(page, "dialog-host"), "Canvas size…");
        const width = canvasDialog(page).getByRole("spinbutton", { name: "Width" });
        await opener.click();
        await expect(width).toBeFocused();
        expect(await ringOf(width), "dialog opened with the pointer").toBe("none");
        await button(canvasDialog(page), "Cancel").click();
        await expect(opener).toBeFocused();
        expect(await ringOf(opener), "opener after a pointer close").toBe("none");

        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        await page.keyboard.press("Enter");
        await expect(width).toBeFocused();
        expect(await ringOf(width), "dialog opened with the keyboard").toBe(ring);
        await page.keyboard.press("Escape");
        await expect(opener).toBeFocused();
        expect(await ringOf(opener), "opener after Escape").toBe(ring);

        // Typing in a field focused with the pointer is not keyboard navigation; Tab is.
        const size = page.getByRole("spinbutton", { name: "Size" });
        await size.click();
        await page.keyboard.press("ArrowUp");
        await page.keyboard.type("4");
        await expect(modality(page)).toHaveAttribute("data-modality", "pointer");
        expect(await ringOf(size), "number field while typing after a click").toBe("none");
        await page.keyboard.press("Tab");
        await expect(modality(page)).toHaveAttribute("data-modality", "keyboard");
    });
}

test("content outside an open dialog is inert, and usable again once it closes", async ({
    page,
}) => {
    await openGallery(page);
    const host = entry(page, "dialog-host");
    const opener = button(host, "Canvas size…");
    const root = page.locator("#root");
    await expect(root).not.toHaveAttribute("inert");

    // Where a click behind the dialog will land.
    const toastButton = button(entry(page, "toast"), "Show toast");
    const box = await toastButton.boundingBox();
    if (!box) throw new Error("The toast button has no box.");

    await tabTo(page, opener);
    await page.keyboard.press("Enter");
    const dialog = canvasDialog(page);
    await expect(dialog).toBeVisible();
    await expect(root).toHaveAttribute("aria-hidden", "true");
    await expect(root).toHaveAttribute("inert", "");

    // Nothing behind the dialog takes the focus, from a script or from Tab.
    const blocked = await page.evaluate(() => {
        const target = [...document.querySelectorAll<HTMLButtonElement>("#root button")].find(
            (element) => element.textContent === "Show toast",
        );
        target?.focus();
        return document.activeElement === target;
    });
    expect(blocked).toBe(false);
    const inside = () => dialog.evaluate((element) => element.contains(document.activeElement));
    for (let presses = 0; presses < 6; presses++) {
        await page.keyboard.press("Tab");
        expect(await inside()).toBe(true);
    }
    // A click behind the dialog closes it and runs nothing there.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".ui-toast")).toHaveCount(0);

    await expect(root).not.toHaveAttribute("inert");
    await expect(root).not.toHaveAttribute("aria-hidden");
    await toastButton.click();
    await expect(page.locator(".ui-toast")).toHaveCount(1);
});

test.describe("menu opener", () => {
    test.beforeEach(async ({ page }) => {
        await openGallery(page);
    });

    test("a dialog opened from a menu returns the focus to the menu's trigger, from the keyboard", async ({
        page,
    }) => {
        const trigger = button(entry(page, "dialog-host"), "Image");
        await tabTo(page, trigger);
        await page.keyboard.press("Enter");
        const menu = page.getByRole("menu", { name: "Image" });
        const item = menu.getByRole("menuitem", { name: "Canvas size…" });
        // Radix moves the focus into the menu one timer after the key.
        await expect(item).toBeFocused();
        await page.keyboard.press("Enter");
        const dialog = canvasDialog(page);
        await expect(dialog).toBeVisible();
        await expect(menu).toHaveCount(0);
        await expect(dialog.getByRole("spinbutton", { name: "Width" })).toBeFocused();

        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await expect(readout(page, "dialog-answer")).toHaveText("Answer: cancelled");
    });

    test("a dialog opened from a menu returns the focus to the menu's trigger, with the pointer", async ({
        page,
    }) => {
        const trigger = button(entry(page, "dialog-host"), "Image");
        await trigger.click();
        const menu = page.getByRole("menu", { name: "Image" });
        await menu.getByRole("menuitem", { name: "Canvas size…" }).click();
        const dialog = canvasDialog(page);
        await expect(dialog).toBeVisible();
        await button(dialog, "Apply").click();
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await expect(readout(page, "dialog-answer")).toHaveText("Answer: 64");
    });

    test("a dialog opened from a context menu returns the focus to the element it was opened on", async ({
        page,
    }) => {
        const target = page.getByRole("group", { name: "Canvas" });
        await tabTo(page, target);
        await page.keyboard.press("Shift+F10");
        const item = page.getByRole("menuitem", { name: "Canvas size…" });
        await expect(item).toBeFocused();
        await page.keyboard.press("Enter");
        const dialog = canvasDialog(page);
        await expect(dialog).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(target).toBeFocused();

        // From a right-click as well.
        await target.click({ button: "right" });
        await page.getByRole("menuitem", { name: "Canvas size…" }).click();
        await expect(dialog).toBeVisible();
        await button(dialog, "Cancel").click();
        await expect(dialog).toHaveCount(0);
        await expect(target).toBeFocused();
    });
});
