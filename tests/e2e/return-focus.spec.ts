import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { uncaughtErrors } from "./gallery-support.ts";

// Return focus (SPEC §6), which `UiRoot` applies with the demo editor's panel selector
// (`[data-demo-panel]`, its `panel` focus context): a non-text control activated with the
// pointer returns the focus to the viewport target (`data-viewport-focus`); inside the panel
// selector the focus stays; a text field keeps the focus; keyboard activation leaves it where
// it is.

async function openDemo(page: Page) {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./demo/");
    await expect(page.getByRole("heading", { name: "NGNE Demo Editor", level: 1 })).toBeVisible();
}

/**
 * Waits until the page has run its pending timers, the one return focus sets after a click
 * included, and two frames have passed: a `setTimeout` queued after them runs after them.
 */
const settle = (page: Page) =>
    page.evaluate(
        () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => setTimeout(() => resolve(), 0)),
                ),
            ),
    );

const viewport = (page: Page) => page.getByRole("application", { name: "Canvas" });
const panel = (page: Page) => page.getByRole("region", { name: "Panel" });
const tool = (page: Page) => page.getByRole("button", { name: "Tool", exact: true });

test.describe("return focus on the demo editor", () => {
    test.beforeEach(async ({ page }) => {
        await openDemo(page);
    });

    test("clicking a non-text control returns the focus to the viewport target", async ({
        page,
    }) => {
        const errors = uncaughtErrors(page);
        await expect(viewport(page)).toHaveAttribute("data-viewport-focus", "");
        await tool(page).click();
        await expect(viewport(page)).toBeFocused();

        const gesture = page.getByRole("button", { name: "Gesture" });
        await gesture.click();
        await expect(gesture).toHaveAttribute("aria-pressed", "true");
        await expect(viewport(page)).toBeFocused();
        await gesture.click();
        await expect(viewport(page)).toBeFocused();

        const light = page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", {
            name: "Light",
        });
        await light.click();
        await expect(light).toBeChecked();
        await expect(viewport(page)).toBeFocused();
        expect(errors).toEqual([]);
    });

    test("a select chosen with the pointer returns the focus once its list has gone", async ({
        page,
    }) => {
        const brush = page.getByRole("combobox", { name: "Brush" });
        await brush.click();
        await page.getByRole("option", { name: "Eraser" }).click();
        await expect(brush).toHaveText("Eraser");
        await expect(page.getByRole("listbox")).toHaveCount(0);
        await expect(viewport(page)).toBeFocused();
    });

    test("inside the panel selector the focus stays", async ({ page }) => {
        const add = panel(page).getByRole("button", { name: "Add layer" });
        await add.click();
        await expect(add).toBeFocused();
        // Still there once a later timer could have moved it.
        await settle(page);
        await expect(add).toBeFocused();

        const ground = panel(page).getByText("Ground", { exact: true });
        await ground.click();
        await expect(ground).toBeFocused();
    });

    test("text fields keep the focus", async ({ page }) => {
        const field = page.getByRole("textbox", { name: "Name" });
        await field.click();
        await expect(field).toBeFocused();
        await settle(page);
        await expect(field).toBeFocused();
        await page.keyboard.type("abc");
        await expect(field).toHaveValue("abc");
    });

    test("keyboard activation leaves the focus on the control", async ({ page }) => {
        await tool(page).focus();
        await page.keyboard.press("Enter");
        await settle(page);
        await expect(tool(page)).toBeFocused();
    });

    test("a control that opens a dialog leaves the focus to the dialog", async ({ page }) => {
        await page.getByRole("button", { name: "Open dialog" }).click();
        const dialog = page.getByRole("dialog", { name: "Demo dialog" });
        await expect(dialog).toBeVisible();
        await settle(page);
        expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
            true,
        );
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
    });
});
