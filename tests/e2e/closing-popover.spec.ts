import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

// A popover that applies on close (DESIGN §4, Popover; SPEC §9.1, the closing-popover hook),
// in the gallery's "Popover that applies on close" entry: on Escape and on an outside click,
// its field lets go of the focus while the page is still modal (Radix's `aria-hidden` marks
// and the body's pointer lock still on), the page is handed back before the closing task
// ends, and the value applies once.

const entry = (page: Page) => page.locator('section[data-entry="closing-popover"]');
const readout = (page: Page, name: string) => entry(page).locator(`[data-readout="${name}"]`);

interface PageState {
    pointerEvents: string;
    marks: number;
    focusInPopover: boolean;
}

/**
 * Records the page at the popover field's `focusout`, and once more in the next task, which
 * starts after the closing task and its microtasks and before the popover's content goes.
 */
async function recordClose(popover: Locator): Promise<void> {
    await popover.evaluate((content) => {
        const state = (): PageState => ({
            pointerEvents: document.body.style.pointerEvents,
            marks: document.querySelectorAll("[data-aria-hidden]").length,
            focusInPopover: content.contains(document.activeElement),
        });
        const record = { atBlur: null as PageState | null, afterTask: null as PageState | null };
        (window as unknown as { closeRecord: typeof record }).closeRecord = record;
        content.addEventListener(
            "focusout",
            () => {
                record.atBlur = state();
                setTimeout(() => (record.afterTask = state()), 0);
            },
            { once: true },
        );
    });
}

async function closeRecord(page: Page) {
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    (window as unknown as { closeRecord: { afterTask: unknown } }).closeRecord
                        .afterTask,
            ),
        )
        .not.toBeNull();
    return page.evaluate(
        () =>
            (window as unknown as { closeRecord: { atBlur: PageState; afterTask: PageState } })
                .closeRecord,
    );
}

/** Opens the popover from its button and steps the field up three times from the keyboard. */
async function openAndEdit(page: Page): Promise<Locator> {
    const opener = entry(page).getByRole("button", { name: "Edit opacity" });
    await opener.click();
    const popover = page.getByRole("dialog", { name: "Opacity" });
    await expect(popover).toBeVisible();
    const field = popover.getByRole("spinbutton", { name: "Opacity" });
    // Radix moves the focus in one timer after the popover opens.
    await expect(field).toBeFocused();
    for (let press = 0; press < 3; press++) await page.keyboard.press("ArrowUp");
    await expect(field).toHaveValue("131");
    // Nothing applies while the popover is open.
    await expect(readout(page, "applies")).toHaveText("Applies: 0");
    await expect(readout(page, "applied")).toHaveText("Applied: 128");
    await recordClose(popover);
    return popover;
}

async function expectBlurBeforeLift(page: Page, popover: Locator) {
    const record = await closeRecord(page);
    // The page was still modal when the field let go of the focus.
    expect(record.atBlur.pointerEvents).toBe("none");
    expect(record.atBlur.marks).toBeGreaterThan(0);
    expect(record.atBlur.focusInPopover).toBe(false);
    // And it was handed back within the closing task.
    expect(record.afterTask).toEqual({ pointerEvents: "", marks: 0, focusInPopover: false });
    await expect(popover).toBeHidden();
}

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await expect(entry(page)).toBeVisible();
});

test("Escape: the field blurs before the page is handed back, the value applies once and the focus returns", async ({
    page,
}) => {
    const popover = await openAndEdit(page);
    await page.keyboard.press("Escape");
    await expectBlurBeforeLift(page, popover);

    await expect(readout(page, "applied")).toHaveText("Applied: 131");
    await expect(readout(page, "applies")).toHaveText("Applies: 1");
    // The opener has the focus again once the content is gone.
    await expect(entry(page).getByRole("button", { name: "Edit opacity" })).toBeFocused();
    // Nothing applies a second time later (the unmount, a later task).
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 200)));
    await expect(readout(page, "applies")).toHaveText("Applies: 1");
});

test("outside click: the field blurs before the page is handed back and the value applies once", async ({
    page,
}) => {
    const popover = await openAndEdit(page);
    // Radix listens for presses outside one timer after the popover opens.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
    const viewport = page.viewportSize()!;
    await page.mouse.click(viewport.width - 8, viewport.height - 8);
    await expectBlurBeforeLift(page, popover);

    await expect(readout(page, "applied")).toHaveText("Applied: 131");
    await expect(readout(page, "applies")).toHaveText("Applies: 1");
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 200)));
    await expect(readout(page, "applies")).toHaveText("Applies: 1");
});

test("opened again, the popover starts from the applied value and applies once more", async ({
    page,
}) => {
    const popover = await openAndEdit(page);
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await expect(readout(page, "applies")).toHaveText("Applies: 1");

    await entry(page).getByRole("button", { name: "Edit opacity" }).click();
    const again = page.getByRole("dialog", { name: "Opacity" });
    const field = again.getByRole("spinbutton", { name: "Opacity" });
    await expect(field).toBeFocused();
    await expect(field).toHaveValue("131");
    await page.keyboard.press("Shift+ArrowDown");
    await expect(field).toHaveValue("121");
    await page.keyboard.press("Escape");
    await expect(again).toBeHidden();
    await expect(readout(page, "applied")).toHaveText("Applied: 121");
    await expect(readout(page, "applies")).toHaveText("Applies: 2");
});
