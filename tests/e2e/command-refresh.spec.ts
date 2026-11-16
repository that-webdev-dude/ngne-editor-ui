import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
    audit,
    button,
    chooseTheme,
    entry,
    horizontalOverflow,
    openGallery,
    THEMES,
    uncaughtErrors,
    WINDOWS,
} from "./gallery-support.ts";

// Command refresh (SPEC §2, §7.1) on the gallery's Command refresh entry: readers of different
// commands of one registry, each with a visible render counter. One store change renders again
// exactly the readers whose command's `enabled()` or `title()` result changed (`useCommands`),
// or whose read value changed (`useCommandValue`); a change no command reads renders none. The
// entry in both themes, at 1280×720 and at 125% browser zoom, with no WCAG 2.1 AA violation.

const READERS = ["save", "undo", "save-and-undo", "zoom-value"] as const;
type Reader = (typeof READERS)[number];
type Counts = Record<Reader, number>;

const refreshEntry = (page: Page) => entry(page, "command-refresh");
const reader = (page: Page, name: Reader) => refreshEntry(page).locator(`[data-reader="${name}"]`);

/** Waits for React to commit and run its effects: two animation frames. */
const settle = (page: Page) =>
    page.evaluate(
        () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
    );

async function renderCounts(page: Page): Promise<Counts> {
    await settle(page);
    const counts = {} as Counts;
    for (const name of READERS) {
        const text = await refreshEntry(page).locator(`[data-renders="${name}"]`).textContent();
        counts[name] = Number(text);
    }
    return counts;
}

/** Clicks `label` and returns how many times each reader rendered because of it. */
async function rendersAfter(page: Page, label: string): Promise<Counts> {
    const before = await renderCounts(page);
    await button(refreshEntry(page), label).click();
    const after = await renderCounts(page);
    const delta = {} as Counts;
    for (const name of READERS) delta[name] = after[name] - before[name];
    return delta;
}

test.describe("command refresh", () => {
    test.beforeEach(async ({ page }) => {
        await openGallery(page);
        await refreshEntry(page).scrollIntoViewIfNeeded();
    });

    test("each reader has rendered once at rest, showing the commands it reads", async ({
        page,
    }) => {
        expect(await renderCounts(page)).toEqual({
            save: 1,
            undo: 1,
            "save-and-undo": 1,
            "zoom-value": 1,
        });
        await expect(reader(page, "save")).toContainText("Save");
        await expect(reader(page, "save").locator('kbd[data-chord="Ctrl+S"]')).toHaveText("Ctrl+S");
        await expect(reader(page, "undo")).toContainText("Undo Pencil");
        await expect(reader(page, "zoom-value")).toContainText("Zoom In enabled");
    });

    test("a change of one command's enabled() renders exactly the readers of that command", async ({
        page,
    }) => {
        const errors = uncaughtErrors(page);
        expect(await rendersAfter(page, "Toggle unsaved changes")).toEqual({
            save: 1,
            undo: 0,
            "save-and-undo": 1,
            "zoom-value": 0,
        });
        await expect(reader(page, "save").locator("[data-enabled]")).toHaveText("disabled");

        expect(await rendersAfter(page, "Toggle unsaved changes")).toEqual({
            save: 1,
            undo: 0,
            "save-and-undo": 1,
            "zoom-value": 0,
        });
        await expect(reader(page, "save").locator("[data-enabled]")).toHaveText("enabled");
        expect(errors).toEqual([]);
    });

    test("a change of one command's title() renders exactly the readers of that command", async ({
        page,
    }) => {
        expect(await rendersAfter(page, "Next edit")).toEqual({
            save: 0,
            undo: 1,
            "save-and-undo": 1,
            "zoom-value": 0,
        });
        await expect(reader(page, "undo")).toContainText("Undo Eraser");
        await expect(reader(page, "save-and-undo")).toContainText("Undo Eraser");
    });

    test("a change of a value read with useCommandValue renders only its reader", async ({
        page,
    }) => {
        expect(await rendersAfter(page, "Toggle zoom limit")).toEqual({
            save: 0,
            undo: 0,
            "save-and-undo": 0,
            "zoom-value": 1,
        });
        await expect(reader(page, "zoom-value")).toContainText("Zoom In disabled");
    });

    test("a store change that changes no read result renders no reader", async ({ page }) => {
        for (let move = 0; move < 3; move++) {
            expect(await rendersAfter(page, "Move pointer")).toEqual({
                save: 0,
                undo: 0,
                "save-and-undo": 0,
                "zoom-value": 0,
            });
        }
    });
});

for (const theme of THEMES) {
    for (const window of WINDOWS) {
        test(`the Command refresh entry in the ${theme} theme at ${window.name} passes axe`, async ({
            page,
        }) => {
            await page.setViewportSize({ width: window.width, height: window.height });
            await openGallery(page);
            await chooseTheme(page, theme);
            const section = refreshEntry(page);
            await section.scrollIntoViewIfNeeded();
            await expect(
                section.getByRole("heading", { name: "Command refresh", level: 2 }),
            ).toBeVisible();
            expect(await horizontalOverflow(page)).toEqual({ page: 0, gallery: 0, outside: 0 });
            const result = await audit(page, 'section[data-entry="command-refresh"]');
            expect(result.violations).toEqual([]);
            expect(result.contrastUndecided).toEqual([]);
            expect(result.contrastChecked).toBeGreaterThan(0);
        });
    }
}
