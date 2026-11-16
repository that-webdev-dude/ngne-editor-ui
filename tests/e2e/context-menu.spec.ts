import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { audit, THEMES, uncaughtErrors } from "./gallery-support.ts";

// The context menu built from the command registry (SPEC §7.1; DESIGN §4 Context menu, Toast)
// on the demo editor's rows: a row's menu lists the commands that name it, in order, with
// their chords; disabled commands stay visible and inert; choosing a command runs it on the
// row; a failing command shows an error toast. The commands come from the instance `UiRoot`
// provides, refreshed by the rows store.

async function openDemo(page: Page) {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./demo/");
    await expect(page.getByRole("heading", { name: "NGNE Demo Editor", level: 1 })).toBeVisible();
}

const rows = (page: Page) => page.getByRole("list", { name: "Rows" }).getByRole("listitem");
const row = (page: Page, name: string) => page.locator(`[data-row="${name}"]`);
const menu = (page: Page) => page.getByRole("menu");
const item = (page: Page, name: string) => menu(page).getByRole("menuitem", { name });

async function openMenu(page: Page, target: Locator) {
    await target.click({ button: "right" });
    await expect(menu(page)).toBeVisible();
}

async function closeMenu(page: Page) {
    await page.keyboard.press("Escape");
    await expect(menu(page)).toHaveCount(0);
}

test.describe("command context menu", () => {
    test.beforeEach(async ({ page }) => {
        await openDemo(page);
    });

    test("lists a row's commands in order with their chords", async ({ page }) => {
        await openMenu(page, row(page, "Ground"));
        const items = menu(page).getByRole("menuitem");
        await expect(items).toHaveText([
            "Duplicate RowCtrl+D",
            "Move Row UpAlt+↑",
            "Move Row DownAlt+↓",
            "Export Row",
        ]);
        await expect(item(page, "Duplicate Row").locator(".ui-menu__shortcut")).toHaveText(
            "Ctrl+D",
        );
        // Orders in different hundreds are separated by a line.
        await expect(menu(page).getByRole("separator")).toHaveCount(2);
        await closeMenu(page);
    });

    test("shows disabled commands, and choosing one does nothing", async ({ page }) => {
        await openMenu(page, row(page, "Background"));
        const moveUp = item(page, "Move Row Up");
        await expect(moveUp).toBeVisible();
        await expect(moveUp).toHaveAttribute("aria-disabled", "true");
        await expect(item(page, "Move Row Down")).not.toHaveAttribute("aria-disabled", "true");
        await moveUp.click({ force: true });
        // The menu stays open and the rows keep their order.
        await expect(menu(page)).toBeVisible();
        await closeMenu(page);
        await expect(rows(page)).toHaveText(["Background", "Ground", "Props"]);

        // The last row cannot move down.
        await openMenu(page, row(page, "Props"));
        await expect(item(page, "Move Row Down")).toHaveAttribute("aria-disabled", "true");
        await expect(item(page, "Move Row Up")).not.toHaveAttribute("aria-disabled", "true");
        await closeMenu(page);
    });

    test("runs the chosen command on the row it was opened on", async ({ page }) => {
        const errors = uncaughtErrors(page);
        await openMenu(page, row(page, "Background"));
        await item(page, "Move Row Down").click();
        await expect(menu(page)).toHaveCount(0);
        await expect(rows(page)).toHaveText(["Ground", "Background", "Props"]);

        await openMenu(page, row(page, "Props"));
        await item(page, "Duplicate Row").click();
        await expect(rows(page)).toHaveText(["Ground", "Background", "Props", "Props copy"]);

        // The new last row: Props can move down now, Props copy cannot.
        await openMenu(page, row(page, "Props"));
        await expect(item(page, "Move Row Down")).not.toHaveAttribute("aria-disabled", "true");
        await closeMenu(page);
        expect(errors).toEqual([]);
    });

    test("opens from the keyboard and runs with Enter", async ({ page }) => {
        const target = row(page, "Ground");
        await target.focus();
        await page.keyboard.press("Shift+F10");
        // Radix moves the focus into the menu after it opens.
        await expect(item(page, "Duplicate Row")).toBeFocused();
        await page.keyboard.press("ArrowDown");
        await expect(item(page, "Move Row Up")).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(menu(page)).toHaveCount(0);
        await expect(rows(page)).toHaveText(["Ground", "Background", "Props"]);
        await expect(target).toBeFocused();
    });

    test("a failing command shows an error toast", async ({ page }) => {
        const errors = uncaughtErrors(page);
        await openMenu(page, row(page, "Ground"));
        await item(page, "Export Row").click();
        const toast = page
            .getByRole("region", { name: "Notifications" })
            .locator(".ui-toast")
            .filter({ hasText: "Export Row failed: the demo editor cannot export." });
        await expect(toast).toHaveCount(1);
        expect(errors).toEqual([]);
    });

    for (const theme of THEMES) {
        test(`${theme}: the open menu passes axe`, async ({ page }) => {
            if (theme === "light") {
                await page
                    .getByRole("radiogroup", { name: "Theme" })
                    .getByRole("radio", { name: "Light" })
                    .click();
                await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
            }
            await openMenu(page, row(page, "Ground"));
            const result = await audit(page);
            expect(result.violations).toEqual([]);
            expect(result.contrastUndecided).toEqual([]);
            expect(result.contrastChecked).toBeGreaterThan(0);
        });
    }
});
