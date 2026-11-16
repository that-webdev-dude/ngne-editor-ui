import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
    audit,
    boxOf,
    button,
    chooseTheme,
    entry,
    horizontalOverflow,
    openGallery,
    readout,
    tabTo,
    THEMES,
    uncaughtErrors,
    WINDOWS,
} from "./gallery-support.ts";
import { settle } from "./surfaces-support.ts";

// The message entries of the gallery (SPEC §6, §12; DESIGN §4, §5, §7): toasts bottom-centre
// with their lifetimes; a dialog asked for through the app's dialog requests, shown by the
// dialog host and settled by its actions, Escape and an outside click; the discard question;
// a crashed region's one line and Reload while the page stays usable; the WebGPU-required
// notice with the product name it is given. Every entry in both themes, at 1280×720 and at
// 125% browser zoom, with no WCAG 2.1 AA violation at rest or with a surface open.

const ENTRIES = [
    "toast",
    "dialog-host",
    "discard-changes",
    "webgpu-required",
    "region-boundary",
] as const;

/** The space a toast keeps above the bottom: the 24 px status bar and a 12 px gap. */
const TOAST_BOTTOM_GAP = 36;

const toasts = (page: Page) => page.getByRole("region", { name: "Notifications" });
const canvasDialog = (page: Page) => page.getByRole("dialog", { name: "Canvas size" });
const discardDialog = (page: Page) =>
    page.getByRole("dialog", { name: "Discard unsaved changes?" });
const notice = (page: Page) => entry(page, "webgpu-required").locator("[data-notice]");

/** Shows the three kinds of toast: information, error, and information with an action. */
async function showToasts(page: Page) {
    const toastEntry = entry(page, "toast");
    await button(toastEntry, "Show toast").click();
    await button(toastEntry, "Show error toast").click();
    await button(toastEntry, "Show toast with action").click();
    await expect(toasts(page).locator(".ui-toast")).toHaveCount(3);
}

/** Every toast is one line, centred, stacked above the status bar's place. */
async function expectToastPlacement(page: Page, width: number, height: number) {
    const items = toasts(page).locator(".ui-toast");
    const boxes = [];
    for (const item of await items.all()) {
        const box = await boxOf(item);
        expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThanOrEqual(1);
        // One line: the control height and its padding, the message never wrapping.
        expect(box.height).toBeLessThanOrEqual(34);
        expect(
            await item
                .locator(".ui-toast__message")
                .evaluate((element) => getComputedStyle(element).whiteSpace),
        ).toBe("nowrap");
        boxes.push(box);
    }
    const last = boxes.at(-1)!;
    expect(last.y + last.height).toBe(height - TOAST_BOTTOM_GAP);
    // Oldest on top, each above the next.
    for (let index = 1; index < boxes.length; index++) {
        expect(boxes[index - 1]!.y + boxes[index - 1]!.height).toBeLessThan(boxes[index]!.y);
    }
}

interface Surface {
    name: string;
    /** Selector of the surface while it is open. */
    selector: string;
    open(page: Page): Promise<unknown>;
    close(page: Page): Promise<unknown>;
}

const SURFACES: readonly Surface[] = [
    {
        name: "toasts",
        selector: ".ui-toast",
        open: showToasts,
        close: async (page) => {
            const region = toasts(page);
            await button(region.getByRole("alert"), "Dismiss").click();
            await button(region.locator(".ui-toast--action"), "Dismiss").click();
            await expect(region.locator(".ui-toast")).toHaveCount(0, { timeout: 8000 });
        },
    },
    {
        name: "dialog asked through a request",
        selector: ".ui-dialog",
        open: (page) => button(entry(page, "dialog-host"), "Canvas size…").click(),
        close: (page) => page.keyboard.press("Escape"),
    },
    {
        name: "discard question",
        selector: ".ui-dialog",
        open: (page) => button(entry(page, "discard-changes"), "Close").click(),
        close: (page) => page.keyboard.press("Escape"),
    },
    {
        name: "crashed regions",
        selector: '[data-entry="region-boundary"] .region-error',
        open: (page) => button(entry(page, "region-boundary"), "Break regions").click(),
        close: async (page) => {
            const boundary = entry(page, "region-boundary");
            await button(boundary, "Repair regions").click();
            await button(boundary, "Reload").click();
            await boundary
                .getByRole("button", { name: "Demo rail failed to render. Reload" })
                .click();
        },
    },
];

for (const theme of THEMES) {
    for (const window of WINDOWS) {
        test(`every message entry renders in the ${theme} theme at ${window.name} with no AA violation`, async ({
            page,
        }) => {
            // Many audits in one test, and an information toast's 4 s.
            test.setTimeout(180_000);
            const errors = uncaughtErrors(page);
            await page.setViewportSize({ width: window.width, height: window.height });
            await openGallery(page);
            await chooseTheme(page, theme);

            for (const id of ENTRIES) await expect(entry(page, id), id).toHaveCount(1);
            expect(await horizontalOverflow(page)).toEqual({ page: 0, gallery: 0, outside: 0 });

            const rest = await audit(page);
            expect(rest.violations).toEqual([]);
            expect(rest.contrastUndecided).toEqual([]);

            for (const { name, selector, open, close } of SURFACES) {
                await open(page);
                const surface = page.locator(selector);
                await expect(surface.first(), name).toBeVisible();
                if (name === "toasts")
                    await expectToastPlacement(page, window.width, window.height);

                const whole = await audit(page);
                expect(whole.violations, name).toEqual([]);
                const own = await audit(page, selector);
                expect(own.violations, name).toEqual([]);
                expect(own.contrastUndecided, name).toEqual([]);
                expect(own.contrastChecked, name).toBeGreaterThan(0);

                await close(page);
                await expect(surface, name).toHaveCount(0);
            }
            expect(errors).toEqual([]);
        });
    }
}

test.describe("messages", () => {
    test.beforeEach(async ({ page }) => {
        await openGallery(page);
    });

    test("toasts: 4 s for information; errors and toasts with an action stay until dismissed", async ({
        page,
    }) => {
        await page.clock.install();
        await openGallery(page);
        // From here the time moves only when the test moves it.
        await page.clock.pauseAt(Date.now() + 1000);
        const region = toasts(page);
        await showToasts(page);
        const info = region.getByRole("status").filter({ hasText: "Document saved." });
        const error = region.getByRole("alert");
        const withAction = region.getByRole("status").filter({ hasText: "A new version" });
        await expect(error).toHaveText("Import failed: not a PNG file.");
        await expect(withAction).toContainText("A new version of the editor is ready.");

        await page.clock.runFor(3999);
        await expect(info).toBeVisible();
        await page.clock.runFor(1);
        await expect(info).toHaveCount(0);

        // A minute later the other two are still there.
        await page.clock.runFor(60_000);
        await expect(error).toBeVisible();
        await expect(withAction).toBeVisible();

        // The same message is not stacked a second time.
        await button(entry(page, "toast"), "Show error toast").click();
        await expect(region.getByRole("alert")).toHaveCount(1);

        // Running the action dismisses its toast; Dismiss removes the error.
        await button(withAction, "Reload").click();
        await expect(withAction).toHaveCount(0);
        await expect(readout(page, "toast-action")).toHaveText("Action runs: 1");
        await button(error, "Dismiss").click();
        await expect(region.locator(".ui-toast")).toHaveCount(0);
    });

    test("toasts sit bottom-centre, one line each, and are operable from the keyboard", async ({
        page,
    }) => {
        const toastEntry = entry(page, "toast");
        await tabTo(page, button(toastEntry, "Show error toast"));
        await page.keyboard.press("Enter");
        await tabTo(page, button(toastEntry, "Show toast with action"));
        await page.keyboard.press("Enter");
        await expect(toasts(page).locator(".ui-toast")).toHaveCount(2);
        await expectToastPlacement(page, 1280, 720);

        const region = toasts(page);
        await tabTo(page, button(region.getByRole("alert"), "Dismiss"));
        await page.keyboard.press("Enter");
        await expect(region.getByRole("alert")).toHaveCount(0);
        await tabTo(page, button(region, "Reload"));
        await page.keyboard.press("Enter");
        await expect(region.locator(".ui-toast")).toHaveCount(0);
        await expect(readout(page, "toast-action")).toHaveText("Action runs: 1");
    });

    test("a dialog asked through a dialog request settles on its actions, Escape and an outside click", async ({
        page,
    }) => {
        const host = entry(page, "dialog-host");
        const opener = button(host, "Canvas size…");
        const answer = readout(page, "dialog-answer");
        await expect(answer).toHaveText("Answer: none");

        // Apply answers with the dialog's values.
        await opener.click();
        const dialog = canvasDialog(page);
        await expect(dialog).toBeVisible();
        const width = dialog.getByRole("spinbutton", { name: "Width" });
        await expect(width).toHaveValue("64");
        await expect(width).toBeFocused();
        await page.keyboard.press("ArrowUp");
        await button(dialog, "Apply").click();
        await expect(dialog).toHaveCount(0);
        await expect(answer).toHaveText("Answer: 65");
        await expect(readout(page, "canvas-width")).toHaveText("Width: 65");
        await expect(opener).toBeFocused();

        // Cancel, Escape and a press outside answer null; each request is a dialog of its own.
        const cancels: [string, () => Promise<unknown>][] = [
            ["Cancel", () => button(dialog, "Cancel").click()],
            ["Escape", () => page.keyboard.press("Escape")],
            ["outside click", () => page.mouse.click(8, 700)],
        ];
        for (const [name, cancel] of cancels) {
            await opener.click();
            await expect(width, name).toHaveValue("65");
            await page.keyboard.press("ArrowUp");
            await expect(width, name).toHaveValue("66");
            // Radix listens for a press outside only from a timer after the dialog opens, and
            // input queued before that timer runs first: wait for it.
            await settle(page);
            await cancel();
            await expect(dialog, name).toHaveCount(0);
            await expect(answer, name).toHaveText("Answer: cancelled");
            await expect(readout(page, "canvas-width"), name).toHaveText("Width: 65");

            // Applied unchanged, so the next cancel is a new answer.
            await opener.click();
            await expect(width, name).toHaveValue("65");
            await button(dialog, "Apply").click();
            await expect(answer, name).toHaveText("Answer: 65");
        }
    });

    test("a dialog that fails to open is answered, reported by an error toast, and the page stays usable", async ({
        page,
    }) => {
        const errors = uncaughtErrors(page);
        const host = entry(page, "dialog-host");
        await button(host, "Open failing dialog").click();
        await expect(toasts(page).getByRole("alert")).toHaveText("Failing dialog failed to open.");
        await expect(readout(page, "dialog-answer")).toHaveText("Answer: failed");
        await expect(page.getByRole("dialog")).toHaveCount(0);

        // The host shows the next request.
        await button(host, "Canvas size…").click();
        await expect(canvasDialog(page)).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(canvasDialog(page)).toHaveCount(0);
        expect(errors).toEqual([]);
    });

    test("the discard question names the document; Discard is the danger action", async ({
        page,
    }) => {
        const discardEntry = entry(page, "discard-changes");
        const answer = readout(page, "discard-answer");
        const cases = [
            { label: "Close", text: "“level-1” has unsaved changes. Closing it loses them." },
            {
                label: "Open level-2",
                text: "“level-1” has unsaved changes. “level-2” takes its place, and the changes are lost.",
            },
            {
                label: "Revert",
                text: "“level-1” has unsaved changes. Revert reads “level-1” again, and the changes are lost.",
            },
        ];
        for (const { label, text } of cases) {
            const opener = button(discardEntry, label);
            await opener.click();
            const dialog = discardDialog(page);
            await expect(dialog, label).toBeVisible();
            await expect(dialog.locator(".ui-dialog__body"), label).toHaveText(text);

            // Cancel, then Discard: the danger button, right of Cancel.
            const cancel = button(dialog, "Cancel");
            const discard = button(dialog, "Discard");
            await expect(discard).toHaveClass(/ui-button--danger/);
            const colours = await discard.evaluate((element) => {
                const style = getComputedStyle(element);
                const danger = getComputedStyle(document.documentElement)
                    .getPropertyValue("--danger")
                    .trim();
                return { color: style.color, border: style.borderColor, danger };
            });
            expect(colours.color).toBe(colours.border);
            expect(colours.danger).toBe("#ff6b6b");
            expect(colours.color).toBe("rgb(255, 107, 107)");
            expect((await boxOf(cancel)).x).toBeLessThan((await boxOf(discard)).x);

            await cancel.click();
            await expect(dialog).toHaveCount(0);
            await expect(answer).toHaveText("Answer: keep");
            await expect(opener).toBeFocused();

            await page.keyboard.press("Enter");
            await expect(dialog).toBeVisible();
            await page.keyboard.press("Escape");
            await expect(dialog).toHaveCount(0);
            await expect(answer).toHaveText("Answer: keep");

            await opener.click();
            await button(dialog, "Discard").click();
            await expect(dialog).toHaveCount(0);
            await expect(answer).toHaveText("Answer: discard");
        }
    });

    test("a crashed region shows one line and Reload while the page stays usable", async ({
        page,
    }) => {
        const errors = uncaughtErrors(page);
        const boundary = entry(page, "region-boundary");
        const panel = boundary.locator('[data-demo-region="panel"]');
        const rail = boundary.locator('[data-demo-region="rail"]');
        await expect(panel).toHaveText("Panel content");
        await expect(rail).toHaveText("Rail");
        const { width: panelWidth, height: panelHeight } = await boxOf(panel);

        await tabTo(page, button(boundary, "Break regions"));
        await page.keyboard.press("Enter");
        const panelAlert = panel.getByRole("alert");
        await expect(panelAlert).toHaveText("Demo panel failed to render.Reload");
        await expect(page.getByRole("alert")).toHaveCount(2);
        // One line: the message does not wrap, and the region keeps its size.
        expect(
            await panelAlert
                .locator(".region-error__message")
                .evaluate((element) => getComputedStyle(element).whiteSpace),
        ).toBe("nowrap");
        expect((await boxOf(panelAlert)).height).toBeLessThanOrEqual(34);
        expect(await boxOf(panel)).toMatchObject({ width: panelWidth, height: panelHeight });
        // A region too narrow for the line: its Reload carries the message.
        const railReload = rail.getByRole("button", { name: "Demo rail failed to render. Reload" });
        await expect(railReload).toBeVisible();

        // The rest of the page keeps working.
        await button(entry(page, "toast"), "Show error toast").click();
        await expect(toasts(page).getByRole("alert")).toBeVisible();
        await button(toasts(page), "Dismiss").click();
        await button(entry(page, "dialog-host"), "Canvas size…").click();
        await expect(canvasDialog(page)).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(canvasDialog(page)).toHaveCount(0);

        // Reload with the cause still there fails again; after the repair it recovers.
        await tabTo(page, button(panel, "Reload"));
        await page.keyboard.press("Enter");
        await expect(panelAlert).toBeVisible();
        await button(boundary, "Repair regions").click();
        await button(panel, "Reload").click();
        await expect(panel).toHaveText("Panel content");
        await expect(railReload).toBeVisible();
        await railReload.click();
        await expect(rail).toHaveText("Rail");
        await expect(page.getByRole("alert")).toHaveCount(0);
        expect(errors).toEqual([]);
    });

    test("the WebGPU-required notice shows the product name it is given", async ({ page }) => {
        const box = notice(page);
        await expect(box).toHaveAttribute("data-notice", "webgpu-required");
        await expect(box.getByRole("heading", { name: "WebGPU required" })).toBeVisible();
        await expect(box).toContainText(
            "NGNE Gallery Editor draws with the NGNE engine, which runs on WebGPU only",
        );
        // DESIGN §7: what is missing, supported browsers, how to enable acceleration.
        await expect(box.getByRole("heading", { name: "What is missing" })).toBeVisible();
        await expect(box.getByRole("heading", { name: "Supported browsers" })).toBeVisible();
        await expect(box).toContainText("Desktop Chrome or Edge");
        await expect(
            box.getByRole("heading", { name: "How to enable acceleration" }),
        ).toBeVisible();
        await expect(box.getByRole("listitem")).toHaveCount(3);

        const reason = box.locator("[data-notice-reason]");
        await expect(reason).toHaveAttribute("data-notice-reason", "no-adapter");
        await expect(reason).toContainText("no graphics adapter is available");
        await expect(box).toContainText("Adapter request blocked.");

        await entry(page, "webgpu-required").getByRole("radio", { name: "No WebGPU" }).click();
        await expect(reason).toHaveAttribute("data-notice-reason", "no-api");
        await expect(reason).toContainText("navigator.gpu is missing");
        await expect(box).not.toContainText("Adapter request blocked.");

        // It fills the window of an app; here, the frame that stands for it.
        const frame = await boxOf(entry(page, "webgpu-required").locator(".gallery__notice"));
        const own = await boxOf(box);
        expect(own.width).toBe(frame.width - 2);
        expect(own.height).toBe(frame.height - 2);
    });
});
