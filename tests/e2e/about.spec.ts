import { expect, test } from "@playwright/test";
import type { BrowserContext, Locator, Page } from "@playwright/test";
import {
    audit,
    boxOf,
    button,
    chooseTheme,
    entry,
    openGallery,
    THEMES,
    uncaughtErrors,
    WINDOWS,
} from "./gallery-support.ts";
import {
    chooseDemoTheme,
    expectEditorUsable,
    focus,
    openDemo,
    runFromPalette,
    settle,
    SHORTCUTS_COMMAND,
    toolButton,
    viewport,
} from "./surfaces-support.ts";

// The About dialog (SPEC §11, DESIGN §7, §8) on the demo editor: Help → About NGNE Demo
// Editor…, the last item of the Help menu in a group of its own, shows the demo's fixture build
// facts (gallery/demo/appInfo.ts); its links open in new tabs; Copy version info copies the one
// line a bug report needs and says so, or says in --danger that the clipboard is not
// available; Escape and Close return the focus. Both themes, at 1280×720 and 125% zoom, pass
// axe with the dialog open, on the demo and in the gallery's About entry.

const ABOUT_COMMAND = "help.about";

/** The demo's fixture facts, as gallery/demo/appInfo.ts gives them. */
const DEMO = {
    name: "NGNE Demo Editor 1.4.2",
    engine: "@ngne/core 0.9.3",
    licence: "MIT",
    repository: "https://github.com/that-webdev-dude/ngne-editor-ui",
    changelog: "https://github.com/that-webdev-dude/ngne-editor-ui/blob/main/CHANGELOG.md",
    line: (userAgent: string) => `ngne-demo-editor 1.4.2 · @ngne/core 0.9.3 · ${userAgent}`,
};

const COPIED = "Version info copied.";
const NOT_COPIED = "Could not copy the version info: the clipboard is not available.";

const aboutDialog = (page: Page) => page.getByRole("dialog", { name: "About NGNE Demo Editor" });
const helpTrigger = (page: Page) =>
    page
        .getByRole("menubar", { name: "Main menu" })
        .getByRole("menuitem", { name: "Help", exact: true });
const copyButton = (dialog: Locator) => button(dialog, "Copy version info");

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

/** Opens the dialog from its item in the Help menu and waits for Radix's focus move. */
async function openFromHelp(page: Page): Promise<Locator> {
    await helpTrigger(page).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.locator(`[role="menuitem"][data-command="${ABOUT_COMMAND}"]`).click();
    const dialog = aboutDialog(page);
    await expect(dialog).toBeVisible();
    await settle(page);
    return dialog;
}

/** Makes the page's clipboard refuse every write, as a browser that denies the permission. */
function refuseClipboard(page: Page): Promise<void> {
    return page.evaluate(() => {
        Object.defineProperty(navigator.clipboard, "writeText", {
            configurable: true,
            value: () => Promise.reject(new DOMException("Write denied", "NotAllowedError")),
        });
    });
}

/** The computed colour of `token` (`--danger`, `--text-muted`) inside the dialog. */
function tokenColour(dialog: Locator, token: string): Promise<string> {
    return dialog.evaluate((element, name) => {
        const probe = document.createElement("span");
        probe.style.color = `var(${name})`;
        element.append(probe);
        const colour = getComputedStyle(probe).color;
        probe.remove();
        return colour;
    }, token);
}

/** Serves the repository's pages locally, so a link opened in a new tab stays offline. */
async function stubRepository(context: BrowserContext): Promise<void> {
    await context.route(`${DEMO.repository}**`, (route) =>
        route.fulfill({ contentType: "text/html", body: "<title>Repository</title>" }),
    );
}

test.describe("on the demo editor", () => {
    test.beforeEach(async ({ page }) => {
        await openDemo(page);
    });

    test("Help → About is the last item of Help and shows the fixture facts", async ({ page }) => {
        const errors = uncaughtErrors(page);
        await helpTrigger(page).click();
        await expect(page.getByRole("menu")).toBeVisible();
        expect(await menuOutline(page)).toEqual([
            SHORTCUTS_COMMAND,
            "---",
            "demo.help.releaseNotes",
            "---",
            ABOUT_COMMAND,
        ]);
        await expect(page.getByRole("menu").getByRole("menuitem").last()).toHaveText(
            "About NGNE Demo Editor…",
        );
        await page.keyboard.press("Escape");
        await expect(page.getByRole("menu")).toHaveCount(0);
        await settle(page);

        const dialog = await openFromHelp(page);
        await expect(dialog.getByRole("heading", { name: "About NGNE Demo Editor" })).toBeVisible();
        await expect(dialog.getByText(DEMO.name, { exact: true })).toBeVisible();
        await expect(dialog.getByRole("term")).toHaveText(["Engine", "Licence"]);
        await expect(dialog.getByRole("definition")).toHaveText([DEMO.engine, DEMO.licence]);
        const links = dialog.getByRole("link");
        await expect(links).toHaveText(["Source code on GitHub", "Changelog"]);
        await expect(links.nth(0)).toHaveAttribute("href", DEMO.repository);
        await expect(links.nth(1)).toHaveAttribute("href", DEMO.changelog);
        // The status line is there and empty until a copy answers.
        await expect(dialog.getByRole("status")).toHaveText("");
        // Close is the primary action.
        await expect(button(dialog, "Close")).toHaveClass(/primary/);
        expect(errors).toEqual([]);
    });

    test("the links open in new tabs, underlined, and leave the dialog open", async ({
        page,
        context,
    }) => {
        await stubRepository(context);
        const dialog = await openFromHelp(page);
        for (const [name, href] of [
            ["Source code on GitHub", DEMO.repository],
            ["Changelog", DEMO.changelog],
        ] as const) {
            const link = dialog.getByRole("link", { name });
            await expect(link).toHaveAttribute("target", "_blank");
            await expect(link).toHaveAttribute("rel", "noopener noreferrer");
            expect(await link.evaluate((a) => getComputedStyle(a).textDecorationLine)).toBe(
                "underline",
            );
            const opened = context.waitForEvent("page");
            await link.click();
            const tab = await opened;
            await tab.waitForLoadState();
            expect(tab.url()).toBe(href);
            // No opener: the new tab cannot reach the editor's window.
            expect(await tab.evaluate(() => window.opener)).toBeNull();
            await tab.close();
            await expect(dialog).toBeVisible();
            expect(page.url()).toContain("/demo/");
        }
    });

    test("Copy version info copies the one-line summary and says so", async ({ page, context }) => {
        const errors = uncaughtErrors(page);
        await context.grantPermissions(["clipboard-read", "clipboard-write"]);
        const dialog = await openFromHelp(page);
        const status = dialog.getByRole("status");

        await copyButton(dialog).click();
        await expect(status).toHaveText(COPIED);
        const userAgent = await page.evaluate(() => navigator.userAgent);
        const copied = await page.evaluate(() => navigator.clipboard.readText());
        expect(copied).toBe(DEMO.line(userAgent));
        expect(copied).not.toContain("\n");
        expect(await status.evaluate((line) => getComputedStyle(line).color)).toBe(
            await tokenColour(dialog, "--text-muted"),
        );
        // The dialog stays open with the focus where it was.
        await expect(dialog).toBeVisible();
        await expect(copyButton(dialog)).toBeFocused();
        expect(errors).toEqual([]);
    });

    test("Copy version info keeps the focus while a slow copy is pending, and copies once", async ({
        page,
        context,
    }) => {
        await context.grantPermissions(["clipboard-read", "clipboard-write"]);
        // A clipboard that answers several frames later, as on a slow machine.
        await page.evaluate(() => {
            const write = navigator.clipboard.writeText.bind(navigator.clipboard);
            const calls: string[] = [];
            (window as unknown as { copyCalls: string[] }).copyCalls = calls;
            Object.defineProperty(navigator.clipboard, "writeText", {
                configurable: true,
                value: async (text: string) => {
                    calls.push(text);
                    await new Promise((resolve) => setTimeout(resolve, 500));
                    return write(text);
                },
            });
        });
        const dialog = await openFromHelp(page);
        const copy = copyButton(dialog);
        await copy.click();
        await expect(copy).toHaveAttribute("aria-disabled", "true");
        await expect(copy).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(dialog.getByRole("status")).toHaveText(COPIED);
        await expect(copy).not.toHaveAttribute("aria-disabled");
        await expect(copy).toBeFocused();
        expect(
            await page.evaluate(() => (window as unknown as { copyCalls: string[] }).copyCalls),
        ).toHaveLength(1);
    });

    test("with the clipboard denied or missing, it says so in --danger and throws nothing", async ({
        page,
    }) => {
        const errors = uncaughtErrors(page);
        await refuseClipboard(page);
        const dialog = await openFromHelp(page);
        const status = dialog.getByRole("status");

        await copyButton(dialog).click();
        await expect(status).toHaveText(NOT_COPIED);
        expect(await status.evaluate((line) => getComputedStyle(line).color)).toBe(
            await tokenColour(dialog, "--danger"),
        );
        await expect(dialog).toBeVisible();

        // A page without the API (not a secure context) gets the same answer.
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await settle(page);
        await page.evaluate(() => {
            Object.defineProperty(Navigator.prototype, "clipboard", {
                configurable: true,
                get: () => undefined,
            });
        });
        await openFromHelp(page);
        // The dialog opens anew: the last answer is gone.
        await expect(status).toHaveText("");
        await copyButton(dialog).click();
        await expect(status).toHaveText(NOT_COPIED);
        expect(errors).toEqual([]);
    });

    test("Escape and Close close the dialog and return the focus", async ({ page }) => {
        // From the menu: back to the menu's trigger, as every surface a menu opens.
        let dialog = await openFromHelp(page);
        await expect(dialog.locator(":focus")).toHaveCount(1);
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await settle(page);
        await expect(helpTrigger(page)).toBeFocused();
        await expectEditorUsable(page);

        dialog = await openFromHelp(page);
        await button(dialog, "Close").click();
        await expect(dialog).toBeHidden();
        await settle(page);
        await expect(helpTrigger(page)).toBeFocused();
        await expectEditorUsable(page);

        // From the command palette: back to the control that had the focus before it.
        await focus(toolButton(page));
        await runFromPalette(page, ABOUT_COMMAND);
        await expect(dialog).toBeVisible();
        await settle(page);
        await button(dialog, "Close").click();
        await expect(dialog).toBeHidden();
        await expect(toolButton(page)).toBeFocused();

        // From the viewport, by the keyboard alone.
        await focus(viewport(page));
        await runFromPalette(page, ABOUT_COMMAND);
        await expect(dialog).toBeVisible();
        await settle(page);
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(viewport(page)).toBeFocused();
        await expectEditorUsable(page);
    });

    for (const theme of THEMES) {
        for (const window of WINDOWS) {
            test(`${theme}, ${window.name}: the open dialog fits and passes axe`, async ({
                page,
            }) => {
                await page.setViewportSize({ width: window.width, height: window.height });
                if (theme === "light") await chooseDemoTheme(page, "light");
                const dialog = await openFromHelp(page);
                const box = await boxOf(dialog);
                expect(box.x).toBeGreaterThanOrEqual(0);
                expect(box.y).toBeGreaterThanOrEqual(0);
                expect(box.x + box.width).toBeLessThanOrEqual(window.width);
                expect(box.y + box.height).toBeLessThanOrEqual(window.height);
                // Nothing inside is clipped: the facts, links and actions show whole.
                const clipped = await dialog.evaluate(
                    (element) =>
                        [element, ...element.querySelectorAll("*")].filter(
                            (node) =>
                                node.scrollWidth > node.clientWidth + 1 ||
                                node.scrollHeight > node.clientHeight + 1,
                        ).length,
                );
                expect(clipped).toBe(0);
                const result = await audit(page);
                expect(result.violations).toEqual([]);
                expect(result.contrastUndecided).toEqual([]);
                expect(result.contrastChecked).toBeGreaterThan(0);
            });
        }
    }
});

test.describe("in the gallery", () => {
    for (const theme of THEMES) {
        test(`${theme}: the About entry opens its fixture's dialog, which passes axe`, async ({
            page,
        }) => {
            const errors = uncaughtErrors(page);
            await openGallery(page);
            await chooseTheme(page, theme);
            const about = entry(page, "about");
            await button(about, "About NGNE Gallery Editor…").click();
            const dialog = page.getByRole("dialog", { name: "About NGNE Gallery Editor" });
            await expect(dialog).toBeVisible();
            await settle(page);
            await expect(
                dialog.getByText("NGNE Gallery Editor 2.7.1", { exact: true }),
            ).toBeVisible();
            await expect(dialog.getByRole("definition")).toHaveText(["@ngne/core 0.8.5", "MIT"]);
            const result = await audit(page);
            expect(result.violations).toEqual([]);
            expect(result.contrastUndecided).toEqual([]);
            await page.keyboard.press("Escape");
            await expect(dialog).toBeHidden();
            await expect(button(about, "About NGNE Gallery Editor…")).toBeFocused();
            expect(errors).toEqual([]);
        });
    }
});
