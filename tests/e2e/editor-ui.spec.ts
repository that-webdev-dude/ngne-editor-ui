import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { audit, THEMES, uncaughtErrors } from "./gallery-support.ts";
import type { Theme } from "./gallery-support.ts";

// The gallery's demo editor (SPEC §5, §8): its editor UI instance mounted through `UiRoot`,
// which provides the instance, mirrors the instance's theme to the document and keeps it under
// `<id>.theme` across a reload, and mounts the toasts beside the page. Both themes pass axe.

const ID = "ngne-demo-editor";
const THEME_KEY = `${ID}.theme`;

async function openDemo(page: Page) {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./demo/");
    await expect(page.getByRole("heading", { name: "NGNE Demo Editor", level: 1 })).toBeVisible();
}

const themeRadio = (page: Page, theme: Theme) =>
    page
        .getByRole("radiogroup", { name: "Theme" })
        .getByRole("radio", { name: theme === "dark" ? "Dark" : "Light" });

async function chooseTheme(page: Page, theme: Theme) {
    await themeRadio(page, theme).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

const storedTheme = (page: Page) => page.evaluate((key) => localStorage.getItem(key), THEME_KEY);

const accent = (page: Page) =>
    page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
    );

test.describe("demo editor through UiRoot", () => {
    test("mounts the instance: its content reads it, the toasts sit beside the page", async ({
        page,
    }) => {
        const errors = uncaughtErrors(page);
        await openDemo(page);
        await expect(page.locator(`[data-editor-ui="${ID}"]`)).toBeVisible();
        await expect(page).toHaveTitle("NGNE Demo Editor");
        const toasts = page.getByRole("region", { name: "Notifications" });
        await expect(toasts).toHaveCount(1);
        expect(await toasts.evaluate((element) => element.parentElement === document.body)).toBe(
            true,
        );
        expect(errors).toEqual([]);
    });

    test("starts dark with nothing stored", async ({ page }) => {
        await openDemo(page);
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
        await expect(themeRadio(page, "dark")).toBeChecked();
        expect(await storedTheme(page)).toBeNull();
    });

    test("switches dark ↔ light, and the theme persists across a reload", async ({ page }) => {
        await openDemo(page);

        await chooseTheme(page, "light");
        expect(await storedTheme(page)).toBe("light");
        await page.reload();
        await expect(page.getByRole("heading", { name: "NGNE Demo Editor" })).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
        await expect(themeRadio(page, "light")).toBeChecked();

        await chooseTheme(page, "dark");
        expect(await storedTheme(page)).toBe("dark");
        await page.reload();
        await expect(page.getByRole("heading", { name: "NGNE Demo Editor" })).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
        await expect(themeRadio(page, "dark")).toBeChecked();
    });

    test("the gallery's own theme switch stores nothing the demo reads", async ({ page }) => {
        await page.goto("./");
        await page.getByRole("radio", { name: "Light" }).check();
        await openDemo(page);
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    });

    for (const theme of THEMES) {
        test(`${theme}: the token set is applied and axe finds no violation`, async ({ page }) => {
            await openDemo(page);
            if (theme === "light") await chooseTheme(page, "light");
            // DESIGN §3.1: the accent of each token set.
            expect(await accent(page)).toBe(theme === "dark" ? "#83e8e1" : "#087f78");
            await expect(page.locator(`[data-editor-ui="${ID}"]`)).toBeVisible();
            const result = await audit(page);
            expect(result.violations).toEqual([]);
            expect(result.contrastUndecided).toEqual([]);
            expect(result.contrastChecked).toBeGreaterThan(0);
        });
    }
});
