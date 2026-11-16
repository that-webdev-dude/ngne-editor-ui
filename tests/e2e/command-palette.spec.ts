import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { audit, THEMES, uncaughtErrors } from "./gallery-support.ts";
import {
    activeOption,
    chooseDemoTheme,
    expectEditorUsable,
    focus,
    nameField,
    openDemo,
    openPalette,
    palette,
    PALETTE_COMMAND,
    paletteIds,
    paletteInput,
    paletteList,
    paletteOption,
    paletteOptions,
    ran,
    recentCommands,
    runFromPalette,
    settle,
    SHORTCUTS_COMMAND,
    viewport,
} from "./surfaces-support.ts";

// The command palette (DESIGN §4, SPEC §7.1) on the demo editor: Ctrl+K opens it, also from a
// text field; fuzzy search over the instance's registry; each row shows its menu, its chord
// and its disabled state; a disabled command is listed and inert; Enter runs the active row;
// a command run from it comes first next time, and after a reload (`<id>.recent-commands`).
// Both themes pass axe with the palette open.

/** What a palette row shows, read from the page. */
function shownRow(page: Page, commandId: string) {
    return paletteOption(page, commandId).evaluate((option) => ({
        title: option.querySelector(".command-palette__title")?.textContent ?? "",
        group: option.querySelector(".command-palette__group")?.textContent ?? "",
        shortcut: option.querySelector(".command-palette__shortcut")?.textContent ?? "",
        disabled: option.getAttribute("aria-disabled") === "true",
    }));
}

test.beforeEach(async ({ page }) => {
    await openDemo(page);
});

test("Ctrl+K opens the palette, also from a text field; Escape closes it and returns the focus", async ({
    page,
}) => {
    const errors = uncaughtErrors(page);
    await focus(viewport(page));
    await openPalette(page);
    await expect(paletteInput(page)).toHaveValue("");
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    await expect(viewport(page)).toBeFocused();
    await expectEditorUsable(page);

    // The chord also acts while a text field has focus, and types nothing there.
    await focus(nameField(page));
    await page.keyboard.type("a");
    await page.keyboard.press("Control+KeyK");
    await expect(paletteInput(page)).toBeFocused();
    await expect(nameField(page)).toHaveValue("a");
    await page.keyboard.type("b");
    await expect(paletteInput(page)).toHaveValue("b");
    await expect(nameField(page)).toHaveValue("a");
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    await expect(nameField(page)).toBeFocused();
    await expectEditorUsable(page);

    // The palette is a dialog: the key does not open a second one while it is open.
    await focus(viewport(page));
    await openPalette(page);
    await page.keyboard.press("Control+KeyK");
    await expect(palette(page)).toHaveCount(1);
    expect(errors).toEqual([]);
});

test("each row shows the command's menu, chord and disabled state", async ({ page }) => {
    await openPalette(page);
    // In a menu, with a chord.
    expect(await shownRow(page, "demo.file.new")).toEqual({
        title: "New Document",
        group: "File",
        shortcut: "Ctrl+Alt+N",
        disabled: false,
    });
    // In a menu, without a chord.
    expect(await shownRow(page, "demo.view.fit")).toEqual({
        title: "Fit to Window",
        group: "View",
        shortcut: "",
        disabled: false,
    });
    // Disabled: listed, marked.
    expect(await shownRow(page, "demo.edit.undo")).toEqual({
        title: "Undo",
        group: "Edit",
        shortcut: "Ctrl+Z",
        disabled: true,
    });
    // The package's commands: the palette in the Edit item the editor planned for it, the
    // sheet first in Help.
    expect(await shownRow(page, PALETTE_COMMAND)).toEqual({
        title: "Command Palette…",
        group: "Edit",
        shortcut: "Ctrl+K",
        disabled: false,
    });
    expect(await shownRow(page, SHORTCUTS_COMMAND)).toEqual({
        title: "Keyboard Shortcuts…",
        group: "Help",
        shortcut: "?",
        disabled: false,
    });
    // Outside the menus: no group.
    expect(await shownRow(page, "demo.keys.canvas-mark")).toEqual({
        title: "Mark on Canvas",
        group: "",
        shortcut: "J",
        disabled: false,
    });
    // Each command once; with nothing recent, in menu order: File first.
    const ids = await paletteIds(page);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice(0, 2)).toEqual(["demo.file.new", "demo.file.close"]);

    // A disabled row stays visible, in the colour of disabled controls (DESIGN §3.1).
    const colours = await paletteOption(page, "demo.edit.undo").evaluate((element) => {
        const probe = document.createElement("span");
        probe.style.color = getComputedStyle(document.documentElement).getPropertyValue(
            "--text-faint",
        );
        document.body.append(probe);
        const faint = getComputedStyle(probe).color;
        probe.remove();
        return { faint, shown: getComputedStyle(element).color };
    });
    expect(colours.shown).toBe(colours.faint);
});

test("typing searches the commands fuzzily, by title and menu; no match says so", async ({
    page,
}) => {
    await openPalette(page);
    const all = await paletteOptions(page).count();
    expect(all).toBeGreaterThan(10);

    // Letters in order, any case, others left out.
    await page.keyboard.type("NWDC");
    expect((await paletteIds(page))[0]).toBe("demo.file.new");
    // Every term matches the title or the menu path, in any order.
    await paletteInput(page).fill("zoom view");
    expect(await paletteIds(page)).toEqual(["demo.view.zoomIn"]);
    await paletteInput(page).fill("file new");
    expect((await paletteIds(page))[0]).toBe("demo.file.new");
    await paletteInput(page).fill("");
    await expect(paletteOptions(page)).toHaveCount(all);

    // The active row is named for assistive technology.
    await paletteInput(page).fill("zoom");
    await expect(activeOption(page)).toHaveAttribute("data-command", "demo.view.zoomIn");
    await expect(paletteInput(page)).toHaveAttribute(
        "aria-activedescendant",
        (await activeOption(page).getAttribute("id"))!,
    );
    await expect(paletteInput(page)).toHaveAttribute(
        "aria-controls",
        (await paletteList(page).getAttribute("id"))!,
    );

    // No match: a status line, no list, and Enter does nothing.
    await expect(palette(page).getByRole("status")).toHaveText("");
    await paletteInput(page).fill("no such command anywhere");
    await expect(paletteOptions(page)).toHaveCount(0);
    await expect(palette(page).getByRole("status")).toHaveText("No matching commands");
    await expect(paletteInput(page)).toHaveAttribute("aria-expanded", "false");
    await expect(paletteInput(page)).not.toHaveAttribute("aria-activedescendant");
    await page.keyboard.press("Enter");
    await settle(page);
    await expect(palette(page)).toBeVisible();
});

test("arrow keys move the active row and wrap; Enter runs it and closes the palette", async ({
    page,
}) => {
    await focus(viewport(page));
    const before = (await ran(page)).length;
    await openPalette(page);
    await page.keyboard.type("document");
    expect(await paletteIds(page)).toEqual(["demo.file.new", "demo.file.close"]);
    await expect(activeOption(page)).toHaveAttribute("data-command", "demo.file.new");
    await page.keyboard.press("ArrowDown");
    await expect(activeOption(page)).toHaveAttribute("data-command", "demo.file.close");
    await page.keyboard.press("ArrowDown");
    await expect(activeOption(page)).toHaveAttribute("data-command", "demo.file.new");
    await page.keyboard.press("ArrowUp");
    await expect(activeOption(page)).toHaveAttribute("data-command", "demo.file.close");
    await expect(paletteInput(page)).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(palette(page)).toBeHidden();
    await expect.poll(async () => (await ran(page)).slice(before)).toEqual(["Close Document"]);
    // It ran where the palette was opened: the focus is back on the viewport.
    await expect(viewport(page)).toBeFocused();
});

test("a disabled command is listed and inert, to the pointer and to Enter", async ({ page }) => {
    const before = (await ran(page)).length;
    await openPalette(page);
    const undo = paletteOption(page, "demo.edit.undo");
    await expect(undo).toHaveAttribute("aria-disabled", "true");
    await undo.click({ force: true });
    await settle(page);
    await expect(palette(page)).toBeVisible();
    await expect(paletteInput(page)).toBeFocused();

    await page.keyboard.type("undo");
    await expect(activeOption(page)).toHaveAttribute("data-command", "demo.edit.undo");
    await page.keyboard.press("Enter");
    await settle(page);
    await expect(palette(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    await settle(page);
    expect((await ran(page)).slice(before)).toEqual([]);
    expect(await recentCommands(page)).toEqual([]);
});

test("a command run from the palette comes first next time, and after a reload", async ({
    page,
}) => {
    const errors = uncaughtErrors(page);
    expect(await recentCommands(page)).toEqual([]);
    await openPalette(page);
    const initial = await paletteIds(page);
    expect(initial[0]).toBe("demo.file.new");
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();

    await focus(viewport(page));
    await runFromPalette(page, "demo.view.zoomIn");
    await runFromPalette(page, "demo.view.fit");
    expect(await recentCommands(page)).toEqual(["demo.view.fit", "demo.view.zoomIn"]);
    expect((await ran(page)).slice(-2)).toEqual(["Zoom In", "Fit to Window"]);

    const recentFirst = [
        "demo.view.fit",
        "demo.view.zoomIn",
        ...initial.filter((id) => id !== "demo.view.fit" && id !== "demo.view.zoomIn"),
    ];
    await openPalette(page);
    expect(await paletteIds(page)).toEqual(recentFirst);
    // The newest is the active row: Enter repeats it.
    await expect(activeOption(page)).toHaveAttribute("data-command", "demo.view.fit");
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();

    // A command run by its key is not a palette choice.
    await focus(viewport(page));
    await page.keyboard.press("Control+Equal");
    await expect.poll(async () => (await ran(page)).at(-1)).toBe("Zoom In");
    expect(await recentCommands(page)).toEqual(["demo.view.fit", "demo.view.zoomIn"]);

    // Kept under the instance's persisted name: there after a reload.
    await page.reload();
    await expect(page.getByRole("heading", { name: "NGNE Demo Editor", level: 1 })).toBeVisible();
    await openPalette(page);
    expect(await paletteIds(page)).toEqual(recentFirst);
    expect(errors).toEqual([]);
});

for (const theme of THEMES) {
    test(`${theme}: the open palette passes axe`, async ({ page }) => {
        if (theme === "light") await chooseDemoTheme(page, "light");
        await focus(viewport(page));
        await openPalette(page);
        await page.keyboard.type("o");
        await expect(activeOption(page)).toHaveCount(1);
        const result = await audit(page);
        expect(result.violations).toEqual([]);
        expect(result.contrastUndecided).toEqual([]);
        expect(result.contrastChecked).toBeGreaterThan(0);
    });
}
