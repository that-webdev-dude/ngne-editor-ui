import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { audit, THEMES, uncaughtErrors } from "./gallery-support.ts";

// The keymap `UiRoot` installs (SPEC §7.2), on the demo editor's keys section: J is bound in
// the `gesture` state context, the `panel` focus context and `canvas`; Alt+J in `text` and
// `global`; Ctrl+F only in `panel`. Each command records the context it is bound in, so the key
// log shows which context took a key: the first applicable one that binds it. Nothing runs
// while a dialog or a menu is open; a select keeps its typeahead characters; a browser shortcut
// bound in a context that does not apply is suppressed.

async function openDemo(page: Page) {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./demo/");
    await expect(page.getByRole("heading", { name: "NGNE Demo Editor", level: 1 })).toBeVisible();
    // Every keydown that reaches the window after the keymap, with whether it was prevented.
    await page.evaluate(() => {
        const seen: { key: string; prevented: boolean }[] = [];
        Object.assign(window, { keysSeen: seen });
        window.addEventListener("keydown", (event) =>
            seen.push({ key: event.key, prevented: event.defaultPrevented }),
        );
    });
}

const log = (page: Page) => page.getByRole("list", { name: "Commands run" });
const viewport = (page: Page) => page.getByRole("application", { name: "Canvas" });
const panel = (page: Page) => page.getByRole("region", { name: "Panel" });
const layer = (page: Page, name: string) =>
    panel(page).getByRole("listitem").getByText(name, { exact: true });
const nameField = (page: Page) => page.getByRole("textbox", { name: "Name" });
const brush = (page: Page) => page.getByRole("combobox", { name: "Brush" });
const gestureToggle = (page: Page) => page.getByRole("button", { name: "Gesture" });

/** Waits for React to commit and for Radix's deferred focus moves: frames, then a timer. */
const settle = (page: Page) =>
    page.evaluate(
        () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => setTimeout(() => resolve(), 0)),
                ),
            ),
    );

/** The commands `keys` ran, in order, by the context and chord each recorded. */
async function ranAfter(page: Page, keys: readonly string[]): Promise<string[]> {
    await settle(page);
    const before = await log(page).getByRole("listitem").count();
    for (const key of keys) await page.keyboard.press(key);
    await settle(page);
    const entries = await log(page).getByRole("listitem").allTextContents();
    return entries.slice(before);
}

/** Whether the default of the last keydown of `key` was prevented once the keymap saw it. */
const lastPrevented = (page: Page, key: string) =>
    page.evaluate(
        (name) =>
            (window as unknown as { keysSeen: { key: string; prevented: boolean }[] }).keysSeen
                .filter((event) => event.key === name)
                .at(-1)?.prevented ?? null,
        key,
    );

async function focus(target: Locator) {
    await target.focus();
    await expect(target).toBeFocused();
}

test.describe("keys on the demo editor", () => {
    test.beforeEach(async ({ page }) => {
        await openDemo(page);
    });

    test("a key runs the command of the first applicable context that binds it", async ({
        page,
    }) => {
        const errors = uncaughtErrors(page);
        // The viewport: canvas before global.
        await focus(viewport(page));
        expect(await ranAfter(page, ["KeyJ", "Alt+KeyJ"])).toEqual(["canvas J", "global Alt+J"]);

        // The panel: its focus context before canvas.
        await focus(layer(page, "Ground"));
        expect(await ranAfter(page, ["KeyJ", "Alt+KeyJ"])).toEqual(["panel J", "global Alt+J"]);

        // A text field: only `text` applies, and the field keeps its typing.
        await focus(nameField(page));
        expect(await ranAfter(page, ["KeyJ", "Alt+KeyJ"])).toEqual(["text Alt+J"]);
        await expect(nameField(page)).toHaveValue("j");

        // Nothing focused: letters still act in canvas.
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        expect(await ranAfter(page, ["KeyJ"])).toEqual(["canvas J"]);
        expect(errors).toEqual([]);
    });

    test("a state context, switched on, takes the key before the focus contexts", async ({
        page,
    }) => {
        await gestureToggle(page).click();
        await expect(gestureToggle(page)).toHaveAttribute("aria-pressed", "true");
        await focus(viewport(page));
        expect(await ranAfter(page, ["KeyJ"])).toEqual(["gesture J"]);
        await focus(layer(page, "Props"));
        expect(await ranAfter(page, ["KeyJ"])).toEqual(["gesture J"]);

        await gestureToggle(page).click();
        await expect(gestureToggle(page)).toHaveAttribute("aria-pressed", "false");
        await focus(layer(page, "Props"));
        expect(await ranAfter(page, ["KeyJ"])).toEqual(["panel J"]);
    });

    test("no command runs while a dialog is open", async ({ page }) => {
        await page.getByRole("button", { name: "Open dialog" }).click();
        const dialog = page.getByRole("dialog", { name: "Demo dialog" });
        await expect(dialog).toBeVisible();
        expect(await ranAfter(page, ["KeyJ", "Alt+KeyJ", "Control+KeyF"])).toEqual([]);
        // Ctrl+F is bound: no find bar, even though it did not act.
        expect(await lastPrevented(page, "f")).toBe(true);

        await dialog.getByRole("button", { name: "Close" }).click();
        await expect(dialog).toBeHidden();
        await focus(viewport(page));
        expect(await ranAfter(page, ["KeyJ"])).toEqual(["canvas J"]);
    });

    test("no command runs while a menu is open", async ({ page }) => {
        await page.locator('[data-row="Ground"]').click({ button: "right" });
        const menu = page.getByRole("menu");
        await expect(menu).toBeVisible();
        expect(await ranAfter(page, ["KeyJ", "Alt+KeyJ", "Control+KeyF"])).toEqual([]);
        expect(await lastPrevented(page, "f")).toBe(true);

        await page.keyboard.press("Escape");
        await expect(menu).toHaveCount(0);
        await focus(viewport(page));
        expect(await ranAfter(page, ["KeyJ"])).toEqual(["canvas J"]);
    });

    test("typeahead in a select keeps its characters", async ({ page }) => {
        await expect(brush(page)).toHaveText("Pencil");
        await focus(brush(page));
        expect(await ranAfter(page, ["KeyJ"])).toEqual([]);
        await expect(brush(page)).toHaveText("Jitter");
        await expect(brush(page)).toBeFocused();
        // A chord that is not a typed character still acts.
        expect(await ranAfter(page, ["Alt+KeyJ"])).toEqual(["global Alt+J"]);
    });

    test("a focused button keeps the keys it handles natively", async ({ page }) => {
        const tool = page.getByRole("button", { name: "Tool", exact: true });
        await focus(tool);
        expect(await ranAfter(page, ["Enter", "Space"])).toEqual([]);
        expect(await lastPrevented(page, "Enter")).toBe(false);
        expect(await ranAfter(page, ["KeyJ"])).toEqual(["canvas J"]);
    });

    test("a browser shortcut bound in another context is suppressed", async ({ page }) => {
        await focus(viewport(page));
        expect(await ranAfter(page, ["Control+KeyF"])).toEqual([]);
        expect(await lastPrevented(page, "f")).toBe(true);

        // Where its context applies, it runs.
        await focus(layer(page, "Background"));
        expect(await ranAfter(page, ["Control+KeyF"])).toEqual(["panel Ctrl+F"]);

        // A browser shortcut bound nowhere is left to the browser.
        await focus(viewport(page));
        expect(await ranAfter(page, ["Control+KeyM"])).toEqual([]);
        expect(await lastPrevented(page, "m")).toBe(false);
    });
});

for (const theme of THEMES) {
    test(`the keys section in the ${theme} theme passes axe`, async ({ page }) => {
        await openDemo(page);
        if (theme === "light") {
            await page
                .getByRole("radiogroup", { name: "Theme" })
                .getByRole("radio", { name: "Light" })
                .click();
            await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
        }
        await focus(viewport(page));
        await ranAfter(page, ["KeyJ"]);
        const result = await audit(page, 'section[aria-label="Keys"]');
        expect(result.violations).toEqual([]);
        expect(result.contrastUndecided).toEqual([]);
        expect(result.contrastChecked).toBeGreaterThan(0);
    });
}
