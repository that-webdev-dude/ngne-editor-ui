import { useGalleryTheme } from "@ngne/editor-ui/gallery";
import type { GalleryEntry } from "@ngne/editor-ui/gallery";
import { useLayoutEffect, useRef, useState } from "react";

// The site's own gallery entry (SPEC §12), passed to the gallery as an app passes its entries:
// the demo editor (demo/), with its menu bar, tab strip, tool rail, context bar, dock, bottom
// region and status bar. It runs in a frame of the minimum window (DESIGN §2, 1280×720),
// scaled down to the entry's width where that is narrower, so its `UiRoot` keeps the frame's
// document to itself: its theme, keymap and return focus act there, not on the gallery. The
// frame opens the demo in the gallery's theme (`?theme=`), again when the switch changes it.

/** The minimum window the demo editor lays out at (DESIGN §2). */
const FRAME = { width: 1280, height: 720 } as const;

/** The scale that fits the frame's width into `width`, never above 1. */
const fit = (width: number) => Math.min(1, width / FRAME.width);

function DemoEditorFrame() {
    const theme = useGalleryTheme();
    const box = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    useLayoutEffect(() => {
        const element = box.current;
        if (!element) return;
        const measure = () => setScale(fit(element.clientWidth));
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    return (
        <>
            <p className="site-demo__links">
                <a className="site-demo__link" href="demo/">
                    Open the demo editor in its own page
                </a>
            </p>
            <div ref={box} className="site-demo" style={{ height: FRAME.height * scale }}>
                <iframe
                    className="site-demo__frame"
                    src={`demo/?theme=${theme}`}
                    title="NGNE Demo Editor"
                    loading="lazy"
                    width={FRAME.width}
                    height={FRAME.height}
                    style={{ transform: `scale(${scale})` }}
                />
            </div>
        </>
    );
}

export const demoEditorEntry: GalleryEntry = {
    id: "demo-editor",
    title: "Demo editor",
    Component: DemoEditorFrame,
};
