import { describe, expect, it } from "vitest";
import {
    createWheelPan,
    createWheelZoom,
    WHEEL_ZOOM_TRAVEL,
    wheelPixels,
} from "../../src/model/overlay/index.ts";

// Wheel travel → zoom steps and pan distance (`@ngne/editor-ui/overlay`, SPEC §4).

describe("wheel travel", () => {
    it("one notch of a mouse wheel is one zoom step: up in, down out", () => {
        const zoom = createWheelZoom();
        expect(zoom(-100)).toBe(1);
        expect(zoom(-100)).toBe(1);
        expect(zoom(100)).toBe(-1);
        expect(zoom(120)).toBe(-1);
        expect(zoom(-WHEEL_ZOOM_TRAVEL)).toBe(1);
        expect(zoom(0)).toBe(0);
        expect(zoom(Number.NaN)).toBe(0);
    });

    it("adds the small deltas of a touchpad up to one step, and never gives two", () => {
        const zoom = createWheelZoom();
        const steps = [];
        for (let event = 0; event < 10; event++) steps.push(zoom(-12));
        // 5 × 12 = 60 reaches the travel of one step; the count starts again from there.
        expect(steps).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        expect(zoom(-5000)).toBe(1);
    });

    it("notches of less than a step's travel zoom every second notch: 33 px and 40 px", () => {
        // A wheel at a page zoom of 300% or 250%. The travel takes no time into account, so
        // notches half a second apart count like notches in one burst.
        expect(createWheelZoom()).toHaveLength(1);
        for (const notch of [33.3, 40]) {
            for (const direction of [1, -1] as const) {
                const zoom = createWheelZoom();
                const steps = Array.from({ length: 20 }, () => zoom(-direction * notch));
                expect(steps, `${notch} px`).toEqual(
                    Array.from({ length: 20 }, (_, event) => (event % 2 === 1 ? direction : 0)),
                );
            }
        }
        // 25 px: every second notch as well, exactly at the travel of a step.
        const quarter = createWheelZoom();
        expect([quarter(-25), quarter(-25), quarter(-25), quarter(-25)]).toEqual([0, 1, 0, 1]);
    });

    it("forgets travel short of a step when the wheel turns the other way", () => {
        const zoom = createWheelZoom();
        expect(zoom(-40)).toBe(0);
        // Turned back: the 40 are gone, 40 the other way is not a step either.
        expect(zoom(40)).toBe(0);
        expect(zoom(40)).toBe(-1);
        // After a step the count starts from zero in both directions.
        expect(zoom(-40)).toBe(0);
        expect(zoom(-40)).toBe(1);
        expect(zoom(40)).toBe(0);
        expect(zoom(-40)).toBe(0);
        expect(zoom(40)).toBe(0);
        expect(zoom(40)).toBe(-1);
    });

    it("pans by whole device pixels and carries the fraction over", () => {
        const pan = createWheelPan();
        expect(pan(100, 1)).toBe(100);
        expect(pan(100, 1.5)).toBe(150);
        expect(pan(-33, 2)).toBe(-66);
        // 0.4, then 0.8 (one pixel, 0.2 too many), then 0.2.
        expect([pan(0.4, 1), pan(0.4, 1), pan(0.4, 1)]).toEqual([0, 1, 0]);
        // Ten events of 0.4 are four pixels, none of them lost.
        const slow = createWheelPan();
        const moved = Array.from({ length: 10 }, () => slow(0.4, 1));
        expect(moved.reduce((sum, distance) => sum + distance, 0)).toBe(4);
        expect(moved.every((distance) => distance === 0 || distance === 1)).toBe(true);
        const back = createWheelPan();
        expect([back(-0.4, 1), back(-0.4, 1), back(-0.4, 1)]).toEqual([0, -1, 0]);
        expect(pan(Number.NaN, 1)).toBe(0);
    });

    it("reads lines and pages as pixels", () => {
        expect(wheelPixels(3, 0)).toBe(3);
        expect(wheelPixels(3, 1)).toBe(48);
        expect(wheelPixels(1, 2)).toBe(800);
    });
});
