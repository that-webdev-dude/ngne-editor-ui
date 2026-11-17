import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { boxOf, uncaughtErrors } from "./gallery-support.ts";
import { openDemo, ran, viewport } from "./surfaces-support.ts";

// The status bar (SPEC §1.3, §8, DESIGN §2) on the demo editor: the `*.status.ts` fields in
// registry order, left to right (the pointer's position, then the zoom with its Fit to Window
// action), each at its reserved width, then the hint at the right end; a field whose value
// changes, or empties, moves none of the others.

const bar = (page: Page) => page.locator('[data-region="status-bar"]');
const field = (page: Page, id: string) => bar(page).locator(`[data-status="${id}"]`);
const hint = (page: Page) => field(page, "message");
const fitAction = (page: Page) => bar(page).locator('[data-status-action="zoom"]');

/** The width of `count` digits in the status bar's type: the width a field reserves. */
function digitsWidth(page: Page, count: number): Promise<number> {
    return bar(page).evaluate((element, digits) => {
        const probe = document.createElement("span");
        probe.className = "status-field";
        probe.textContent = "0".repeat(digits);
        element.append(probe);
        const width = probe.getBoundingClientRect().width;
        probe.remove();
        return width;
    }, count);
}

/** The left edges of the zoom field, its action and the hint, and the hint's right edge. */
async function positions(page: Page) {
    const zoom = await boxOf(field(page, "zoom"));
    const action = await boxOf(fitAction(page));
    const message = await boxOf(hint(page));
    return { zoom: zoom.x, action: action.x, hintRight: message.x + message.width };
}

test.beforeEach(async ({ page }) => {
    await openDemo(page);
});

test("the fields follow the registry order at their reserved widths, the hint on the right", async ({
    page,
}) => {
    const errors = uncaughtErrors(page);
    const order = await bar(page)
        .locator("[data-status], [data-status-action]")
        .evaluateAll((nodes) =>
            nodes.map((node) =>
                node.hasAttribute("data-status-action")
                    ? `action:${node.getAttribute("data-status-action")}`
                    : node.getAttribute("data-status"),
            ),
        );
    expect(order).toEqual(["pointer", "zoom", "action:zoom", "message"]);

    // The pointer is off the canvas: its field is empty and keeps its 10 characters.
    await expect(field(page, "pointer")).toHaveText("");
    expect((await boxOf(field(page, "pointer"))).width).toBeCloseTo(await digitsWidth(page, 10), 0);
    await expect(field(page, "zoom")).toHaveText("100%");
    await expect(fitAction(page)).toHaveText("Fit to Window");
    await expect(hint(page)).toHaveText("Ctrl+K opens the command palette");
    await expect(hint(page)).toHaveAttribute("data-kind", "hint");

    // Left to right, and the hint ends at the bar's right padding.
    const region = await boxOf(bar(page));
    const pointer = await boxOf(field(page, "pointer"));
    const zoom = await boxOf(field(page, "zoom"));
    const action = await boxOf(fitAction(page));
    const message = await boxOf(hint(page));
    expect(pointer.x).toBe(region.x + 12);
    expect(zoom.x).toBeGreaterThan(pointer.x + pointer.width);
    expect(action.x).toBeGreaterThanOrEqual(zoom.x + zoom.width - 0.5);
    expect(message.x).toBeGreaterThan(action.x + action.width);
    expect(Math.round(message.x + message.width)).toBe(region.x + region.width - 12);

    // A field's action runs its command.
    const before = (await ran(page)).length;
    await fitAction(page).click();
    await expect.poll(async () => (await ran(page)).slice(before)).toEqual(["Fit to Window"]);
    expect(errors).toEqual([]);
});

test("a field's value change moves none of the others", async ({ page }) => {
    const start = await positions(page);
    const canvas = viewport(page);

    await canvas.hover({ position: { x: 5, y: 7 } });
    await expect(field(page, "pointer")).toHaveText(/^\d+, \d+$/);
    await expect(hint(page)).toHaveText("J marks the canvas");
    expect(await positions(page)).toEqual(start);

    // A longer position, near the canvas's right edge, keeps within the reserved width.
    const box = await boxOf(canvas);
    expect(box.width).toBeGreaterThan(100);
    await canvas.hover({ position: { x: box.width - 3, y: 12 } });
    await expect(field(page, "pointer")).toHaveText(/^\d{3}, 1\d$/);
    expect(await positions(page)).toEqual(start);

    // The pointer leaves the canvas: the field empties and keeps its place.
    await page.mouse.move(2, 2);
    await expect(field(page, "pointer")).toHaveText("");
    await expect(hint(page)).toHaveText("Ctrl+K opens the command palette");
    expect(await positions(page)).toEqual(start);
});

test("feedback takes the hint's place in the warning colour", async ({ page }) => {
    await page.getByRole("button", { name: "Close document" }).click();
    await expect(hint(page)).toHaveText("No document is open");
    await expect(hint(page)).toHaveAttribute("data-kind", "feedback");
    const colours = await hint(page).evaluate((element) => {
        const probe = document.createElement("span");
        probe.style.color = getComputedStyle(document.documentElement).getPropertyValue("--warn");
        document.body.append(probe);
        const warn = getComputedStyle(probe).color;
        probe.remove();
        return { warn, shown: getComputedStyle(element).color };
    });
    expect(colours.shown).toBe(colours.warn);
    // The fields stay while no document is open.
    await expect(field(page, "zoom")).toHaveText("100%");

    await page.getByRole("button", { name: "New document" }).click();
    await expect(hint(page)).toHaveAttribute("data-kind", "hint");
});
