import { describe, expect, it } from "vitest";
import { isKeyboardNavigation } from "../../src/ui/focus/index.ts";

// Input modality for the focus ring (DESIGN §3.3: the ring shows on keyboard focus only): the
// key presses that mean the user works from the keyboard. The tracker that writes the modality
// on the page is covered by tests/e2e/focus.spec.ts.

describe("focus modality (DESIGN §3.3)", () => {
    it("treats navigation keys as keyboard use", () => {
        for (const key of ["Tab", "ArrowRight", "ArrowUp", "Enter", "Escape", "a"]) {
            expect(isKeyboardNavigation({ key, typing: false }), key).toBe(true);
        }
    });

    it("ignores modifiers pressed for a pointer gesture", () => {
        for (const key of ["Shift", "Control", "Alt", "Meta", "AltGraph", "CapsLock"]) {
            expect(isKeyboardNavigation({ key, typing: false }), key).toBe(false);
            expect(isKeyboardNavigation({ key, typing: true }), key).toBe(false);
        }
    });

    it("ignores typing in a text field, but not Tab out of it", () => {
        expect(isKeyboardNavigation({ key: "5", typing: true })).toBe(false);
        expect(isKeyboardNavigation({ key: "ArrowUp", typing: true })).toBe(false);
        expect(isKeyboardNavigation({ key: "Enter", typing: true })).toBe(false);
        expect(isKeyboardNavigation({ key: "Tab", typing: true })).toBe(true);
    });
});
