import { describe, expect, it } from "vitest";
import { RegistrationError } from "../../src/model/modules.ts";
import {
    collectContextBarContent,
    shownContextBarContent,
    subscribeContextBarContent,
} from "../../src/model/registries/contextBar.ts";
import type { ContextBarContent } from "../../src/model/registries/contextBar.ts";

// The context-bar content registry (SPEC §1.3, `*.contextbar.tsx`): entries by `order`, the
// first shown one, subscriptions to all of them, and the errors it throws at startup.

type Component = () => null;
const Body: Component = () => null;

/** An entry whose `shown` result the test sets, counting its subscribers. */
function entry(id: string, order: number, shown = true) {
    const listeners = new Set<() => void>();
    const content: ContextBarContent<Component> & {
        set(value: boolean): void;
        listeners: Set<() => void>;
    } = {
        id,
        order,
        shown: () => shown,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        Body,
        set(value) {
            shown = value;
            for (const listener of listeners) listener();
        },
        listeners,
    };
    return content;
}

describe("context bar content registry", () => {
    it("is discovered by id and ordered by `order`, whatever the module order", () => {
        const listed = collectContextBarContent({
            "a.contextbar.tsx": { contextBarContent: entry("b", 20) },
            "b.contextbar.tsx": { contextBarContent: entry("a", 10) },
            "c.contextbar.tsx": { contextBarContent: entry("c", 15) },
        });
        expect(listed.map((item) => item.id)).toEqual(["a", "c", "b"]);
        expect(listed[0]?.Body).toBe(Body);
    });

    it("refuses a duplicate id naming both modules, a missing export and an invalid entry", () => {
        expect(() =>
            collectContextBarContent({
                "a.contextbar.tsx": { contextBarContent: entry("a", 1) },
                "b.contextbar.tsx": { contextBarContent: entry("a", 2) },
            }),
        ).toThrow('Context bar content id "a" is used by a.contextbar.tsx and b.contextbar.tsx.');
        expect(() => collectContextBarContent({ "c.contextbar.tsx": {} })).toThrow(
            new RegistrationError(
                'c.contextbar.tsx does not export "contextBarContent".',
                "c.contextbar.tsx",
            ),
        );
        expect(() =>
            collectContextBarContent({ "d.contextbar.tsx": { contextBarContent: entry(" ", 1) } }),
        ).toThrow("A context bar entry of d.contextbar.tsx has no id.");
        expect(() =>
            collectContextBarContent({
                "e.contextbar.tsx": { contextBarContent: entry("e", Number.NaN) },
            }),
        ).toThrow('Context bar content "e" (e.contextbar.tsx) has no order.');
    });

    it("shows the first shown entry by order, or none", () => {
        const transform = entry("transform", 10, false);
        const crop = entry("crop", 20, true);
        const listed = collectContextBarContent({
            "crop.contextbar.tsx": { contextBarContent: crop },
            "transform.contextbar.tsx": { contextBarContent: transform },
        });
        expect(shownContextBarContent(listed)).toBe(crop);
        transform.set(true);
        expect(shownContextBarContent(listed)).toBe(transform);
        transform.set(false);
        crop.set(false);
        expect(shownContextBarContent(listed)).toBeNull();
        expect(shownContextBarContent([])).toBeNull();
    });

    it("subscribes to every entry and stops them all", () => {
        const one = entry("one", 1);
        const two = entry("two", 2);
        let told = 0;
        const stop = subscribeContextBarContent(() => void told++, [one, two]);
        one.set(false);
        two.set(false);
        expect(told).toBe(2);
        stop();
        expect(one.listeners.size + two.listeners.size).toBe(0);
        one.set(true);
        expect(told).toBe(2);
    });
});
