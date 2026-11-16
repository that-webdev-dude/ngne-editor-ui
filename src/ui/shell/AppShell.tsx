import type { CSSProperties, ReactNode } from "react";
import { useStore } from "zustand";
import {
    BOTTOM_HEIGHT,
    bottomMaxHeight,
    DOCK_WIDTH,
    isWindowTooSmall,
    resolveBottomHeight,
    resolveDockWidth,
} from "../../model/shell/layout.js";
import { useEditorUi } from "../editorUi/context.js";
import { RegionBoundary } from "../messages/RegionBoundary.js";
import { WindowTooSmall } from "../messages/WindowTooSmall.js";
import { useWindowHeight, useWindowWidth } from "../platform/useWindowSize.js";
import { Splitter } from "../primitives/Splitter.js";

export interface AppShellProps {
    /** The menu bar's centre: the tab strip, or nothing. */
    menuCentre?: ReactNode;
    /** Content under the tool rail's groups, in the height `railFooterHeight` reserves. */
    railFooter?: ReactNode;
    /** The viewport region's content. */
    viewport?: ReactNode;
    /** The bottom region's content; shown only when the configuration has a bottom region. */
    bottom?: ReactNode;
    /**
     * What the viewport shows while no document is open. Given (anything but `undefined`,
     * `null` or `false`), it takes the viewport content's place, and the dock and the bottom
     * region stay empty.
     */
    noDocument?: ReactNode;
}

/** Whether the window is below the minimum the layout holds at (1280×720); renders on resize. */
export function useWindowTooSmall(): boolean {
    return isWindowTooSmall(useWindowWidth(), useWindowHeight());
}

/**
 * The editor's frame (SPEC §8, DESIGN §2, BRIEF D17): the regions on one grid, each with its
 * `data-region` for the F6 cycle and an error boundary, the dock's and the bottom region's
 * splitters with the sizes kept in the instance's layout store, and the window-too-small notice
 * below 1280×720, while the frame stays mounted, so a resize loses no state. The tool rail runs
 * full height beside the bottom region, which spans the viewport and dock columns (BRIEF D22).
 * The editor fills the slots; region contents, the viewport's included, stay the editor's.
 * Rendered under `UiRoot`, whose instance it reads.
 */
export function AppShell({
    menuCentre,
    railFooter,
    viewport,
    bottom,
    noDocument,
}: Readonly<AppShellProps>) {
    const editorUi = useEditorUi();
    const { bottomRegion, railFooterHeight } = editorUi.config;
    const windowWidth = useWindowWidth();
    const windowHeight = useWindowHeight();
    const tooSmall = isWindowTooSmall(windowWidth, windowHeight);
    const dockWidth = resolveDockWidth(useStore(editorUi.layout, (state) => state.dockWidth));
    const bottomHeight = resolveBottomHeight(
        useStore(editorUi.layout, (state) => state.bottomHeight),
        windowHeight,
    );
    const bottomVisible = useStore(editorUi.bottomRegion, (state) => state.visible);
    const { setDockWidth, setBottomHeight } = editorUi.layout.getState();
    const noDocumentOpen = noDocument !== undefined && noDocument !== null && noDocument !== false;
    const bottomShown = bottomRegion !== null && bottomVisible;
    const sizes = {
        "--shell-dock-width": `${dockWidth}px`,
        "--shell-bottom-height": bottomShown ? `${bottomHeight}px` : "0px",
        "--shell-rail-footer-height": `${railFooterHeight}px`,
    } as CSSProperties;

    return (
        <>
            <div
                className="shell"
                style={sizes}
                hidden={tooSmall}
                data-document={noDocumentOpen ? "none" : undefined}
            >
                <header className="shell-menubar" data-region="menu-bar">
                    <RegionBoundary name="Menu bar">
                        <div className="shell-menubar__centre">{menuCentre}</div>
                    </RegionBoundary>
                </header>
                <nav className="shell-rail" data-region="tool-rail" aria-label="Tools">
                    <RegionBoundary name="Tool rail" compact>
                        {railFooter === undefined || railFooter === null ? null : (
                            <div className="shell-rail__footer" data-rail-footer="">
                                {railFooter}
                            </div>
                        )}
                    </RegionBoundary>
                </nav>
                <section
                    className="shell-context"
                    data-region="context-bar"
                    aria-label="Tool options"
                >
                    <RegionBoundary name="Context bar">{null}</RegionBoundary>
                </section>
                <main className="shell-viewport" data-region="viewport">
                    <RegionBoundary name="Viewport">
                        {noDocumentOpen ? noDocument : viewport}
                    </RegionBoundary>
                </main>
                <aside className="shell-dock" data-region="dock" aria-label="Panels">
                    <Splitter
                        className="shell-dock__splitter"
                        orientation="vertical"
                        label="Resize panels"
                        value={dockWidth}
                        min={DOCK_WIDTH.min}
                        max={DOCK_WIDTH.max}
                        growth={-1}
                        onChange={setDockWidth}
                        onReset={() => setDockWidth(null)}
                    />
                    <div className="shell-dock__scroll">
                        {noDocumentOpen ? null : (
                            <RegionBoundary name="Panels">{null}</RegionBoundary>
                        )}
                    </div>
                </aside>
                {bottomRegion === null ? null : (
                    <section
                        className="shell-bottom"
                        data-region={bottomRegion.id}
                        aria-label={bottomRegion.label}
                        hidden={!bottomVisible}
                    >
                        <Splitter
                            className="shell-bottom__splitter"
                            orientation="horizontal"
                            label={`Resize ${bottomRegion.label.toLowerCase()}`}
                            value={bottomHeight}
                            min={BOTTOM_HEIGHT.min}
                            max={bottomMaxHeight(windowHeight)}
                            growth={-1}
                            onChange={setBottomHeight}
                            onReset={() => setBottomHeight(null)}
                        />
                        <div className="shell-bottom__content">
                            {noDocumentOpen ? null : (
                                <RegionBoundary name={bottomRegion.label}>{bottom}</RegionBoundary>
                            )}
                        </div>
                    </section>
                )}
                <footer className="shell-status" data-region="status-bar">
                    <RegionBoundary name="Status bar">{null}</RegionBoundary>
                </footer>
            </div>
            {tooSmall ? <WindowTooSmall width={windowWidth} height={windowHeight} /> : null}
        </>
    );
}
