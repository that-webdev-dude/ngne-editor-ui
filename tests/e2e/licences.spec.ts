import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { audit, boxOf, button, THEMES, uncaughtErrors, WINDOWS } from "./gallery-support.ts";
import {
    chooseDemoTheme,
    expectEditorUsable,
    focus,
    openDemo,
    runFromPalette,
    settle,
    toolButton,
    viewport,
} from "./surfaces-support.ts";

// The Open Source Licences dialog (SPEC §11, DESIGN §4, §7, §8) on the demo editor: View →
// Open Source Licences…, the last item of the View menu in a group of its own, enabled with no
// document open, shows the gallery's licences.txt (the file the build writes beside the demo's
// index.html too) in a large dialog: in a section named "Licence text", whose text keeps its
// line breaks, scrolls, and carries no role of its own (the tilemap editor's accessible-region
// fix, BRIEF D14). A file that cannot be read gives a line naming the editor with a link to the
// file. No tab is opened. Escape and Close return the focus. Both themes, at 1280×720 and 125%
// zoom, pass axe with the dialog open.

const LICENCES_COMMAND = "app.licences";
const FIRST_LINE = "NGNE Editor UI gallery: open source licences";

const licencesDialog = (page: Page) => page.getByRole("dialog", { name: "Open Source Licences" });
const licenceText = (dialog: Locator) => dialog.getByRole("region", { name: "Licence text" });
const viewTrigger = (page: Page) =>
    page
        .getByRole("menubar", { name: "Main menu" })
        .getByRole("menuitem", { name: "View", exact: true });

/** The open menu's entries: each item's command id, "---" for a separator. */
function menuOutline(page: Page): Promise<string[]> {
    return page
        .getByRole("menu")
        .evaluate((menu) =>
            Array.from(
                menu.querySelectorAll<HTMLElement>('[role="menuitem"], [role="separator"]'),
                (node) => node.dataset.command ?? "---",
            ),
        );
}

/** Opens the dialog from its item in the View menu and waits for Radix's focus move. */
async function openFromView(page: Page): Promise<Locator> {
    await viewTrigger(page).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.locator(`[role="menuitem"][data-command="${LICENCES_COMMAND}"]`).click();
    const dialog = licencesDialog(page);
    await expect(dialog).toBeVisible();
    await settle(page);
    return dialog;
}

/** The site's own licences file, at the root of the gallery, as the browser reads it. */
function siteLicences(page: Page): Promise<string> {
    return page.evaluate(async () => (await fetch("../licences.txt")).text());
}

/** Makes the licences file beside the demo's page answer 404. */
async function withoutLicences(page: Page): Promise<void> {
    await page.route("**/demo/licences.txt", (route) =>
        route.fulfill({ status: 404, contentType: "text/plain", body: "Not found" }),
    );
}

const missingAddress = (page: Page) => new URL("licences.txt", page.url()).href;

test.describe("on the demo editor", () => {
    test.beforeEach(async ({ page }) => {
        await openDemo(page);
    });

    test("View → Open Source Licences… is the last item of View, in a group of its own", async ({
        page,
    }) => {
        await viewTrigger(page).click();
        await expect(page.getByRole("menu")).toBeVisible();
        expect(await menuOutline(page)).toEqual([
            "demo.view.zoomIn",
            "demo.view.fit",
            "---",
            LICENCES_COMMAND,
        ]);
        const item = page.getByRole("menu").getByRole("menuitem").last();
        await expect(item).toHaveText("Open Source Licences…");
        await expect(item).not.toHaveAttribute("aria-disabled", "true");
    });

    test("it shows the gallery's licences.txt in a large dialog, in a labelled scrolling section, and opens no tab", async ({
        page,
        context,
    }) => {
        const errors = uncaughtErrors(page);
        const read = page.waitForResponse((answer) => answer.url().endsWith("/demo/licences.txt"));
        const dialog = await openFromView(page);
        expect((await read).status()).toBe(200);
        await expect(dialog.getByRole("heading", { name: "Open Source Licences" })).toBeVisible();
        await expect(dialog).toHaveClass(/ui-dialog--large/);

        // The section names the region; the text inside carries no role of its own.
        const section = licenceText(dialog);
        await expect(section).toBeVisible();
        expect(await section.evaluate((element) => element.tagName)).toBe("SECTION");
        const text = section.locator("pre");
        await expect(text).toHaveCount(1);
        await expect(text).not.toHaveAttribute("role");
        await expect(text).not.toHaveAttribute("aria-label");
        await expect(dialog.locator('[role="region"]')).toHaveCount(0);

        // The gallery's file, whole, with its line breaks kept.
        const file = await siteLicences(page);
        expect(file.startsWith(`${FIRST_LINE}\n`)).toBe(true);
        expect(await text.evaluate((element) => element.textContent)).toBe(file);
        expect(await text.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe(
            "pre-wrap",
        );
        const lines = await text.evaluate((element) => (element as HTMLElement).innerText);
        expect(lines.split("\n")[0]).toBe(FIRST_LINE);
        await expect(text).toContainText(/\nreact \S+ \(MIT\)\n/);
        await expect(text).toContainText("Third-party notices (THIRD_PARTY_NOTICES.md)");

        // It scrolls in its own box, from the keyboard too: it takes the focus.
        const scroll = () => text.evaluate((element) => element.scrollTop);
        expect(await text.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
            true,
        );
        await focus(text);
        await page.keyboard.press("PageDown");
        await expect.poll(scroll).toBeGreaterThan(0);

        expect(context.pages()).toEqual([page]);
        // Close is the primary action.
        await expect(button(dialog, "Close")).toHaveClass(/primary/);
        expect(errors).toEqual([]);
    });

    test("it is enabled and shows the file with no document open", async ({ page }) => {
        await page.getByRole("button", { name: "Close document" }).click();
        await expect(page.getByText("No document is open.")).toBeVisible();
        const dialog = await openFromView(page);
        await expect(licenceText(dialog)).toContainText(FIRST_LINE);
    });

    test("a file that cannot be read gives a line naming the editor with a link to it", async ({
        page,
    }) => {
        const errors = uncaughtErrors(page);
        await withoutLicences(page);
        const address = missingAddress(page);
        let dialog = await openFromView(page);
        const line = dialog.locator("p.licences__missing");
        await expect(line).toHaveText(
            `The licences file of NGNE Demo Editor could not be loaded. It is at ${address}.`,
        );
        const link = line.getByRole("link", { name: address });
        await expect(link).toHaveAttribute("href", address);
        await expect(link).toHaveAttribute("target", "_blank");
        await expect(link).toHaveAttribute("rel", "noopener noreferrer");
        expect(await link.evaluate((a) => getComputedStyle(a).textDecorationLine)).toBe(
            "underline",
        );
        await expect(licenceText(dialog)).toHaveCount(0);
        await button(dialog, "Close").click();
        await expect(dialog).toBeHidden();
        await settle(page);

        // A failed request, as offline without a cached file, gives the same line.
        await page.unroute("**/demo/licences.txt");
        await page.route("**/demo/licences.txt", (route) => route.abort("internetdisconnected"));
        dialog = await openFromView(page);
        await expect(dialog.locator("p.licences__missing")).toContainText(
            "The licences file of NGNE Demo Editor could not be loaded.",
        );
        expect(errors).toEqual([]);
    });

    test("Escape and Close close the dialog and return the focus", async ({ page }) => {
        // From the menu: back to the menu's trigger, as every surface a menu opens.
        let dialog = await openFromView(page);
        await expect(dialog.locator(":focus")).toHaveCount(1);
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await settle(page);
        await expect(viewTrigger(page)).toBeFocused();
        await expectEditorUsable(page);

        dialog = await openFromView(page);
        await button(dialog, "Close").click();
        await expect(dialog).toBeHidden();
        await settle(page);
        await expect(viewTrigger(page)).toBeFocused();
        await expectEditorUsable(page);

        // From the command palette: back to the control that had the focus before it.
        await focus(toolButton(page));
        await runFromPalette(page, LICENCES_COMMAND);
        await expect(dialog).toBeVisible();
        await settle(page);
        await button(dialog, "Close").click();
        await expect(dialog).toBeHidden();
        await expect(toolButton(page)).toBeFocused();

        // From the viewport, by the keyboard alone.
        await focus(viewport(page));
        await runFromPalette(page, LICENCES_COMMAND);
        await expect(dialog).toBeVisible();
        await settle(page);
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(viewport(page)).toBeFocused();
        await expectEditorUsable(page);
    });

    for (const theme of THEMES) {
        for (const window of WINDOWS) {
            test(`${theme}, ${window.name}: the open dialog fits and passes axe, with the file and without`, async ({
                page,
            }) => {
                await page.setViewportSize({ width: window.width, height: window.height });
                if (theme === "light") await chooseDemoTheme(page, "light");
                let dialog = await openFromView(page);
                const box = await boxOf(dialog);
                expect(box.x).toBeGreaterThanOrEqual(0);
                expect(box.y).toBeGreaterThanOrEqual(0);
                expect(box.x + box.width).toBeLessThanOrEqual(window.width);
                expect(box.y + box.height).toBeLessThanOrEqual(window.height);
                // Large: up to 960 px wide and 86% of the window's height (DESIGN §4).
                expect(box.width).toBeGreaterThan(560);
                expect(box.width).toBeLessThanOrEqual(960);
                expect(box.height).toBeLessThanOrEqual(window.height * 0.86 + 1);
                // The text box is wholly in view: only its content scrolls.
                const text = await boxOf(licenceText(dialog).locator("pre"));
                expect(text.y).toBeGreaterThanOrEqual(box.y);
                expect(text.y + text.height).toBeLessThanOrEqual(box.y + box.height);
                await expect(button(dialog, "Close")).toBeInViewport({ ratio: 1 });
                let result = await audit(page);
                expect(result.violations).toEqual([]);
                expect(result.contrastUndecided).toEqual([]);
                expect(result.contrastChecked).toBeGreaterThan(0);

                await page.keyboard.press("Escape");
                await expect(dialog).toBeHidden();
                await settle(page);
                await withoutLicences(page);
                dialog = await openFromView(page);
                await expect(dialog.locator("p.licences__missing")).toBeVisible();
                result = await audit(page);
                expect(result.violations).toEqual([]);
                expect(result.contrastUndecided).toEqual([]);
            });
        }
    }
});
