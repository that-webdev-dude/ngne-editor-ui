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
import type { ToolBase } from "../../model/tools/types.js";
import { useEditorUi } from "../editorUi/context.js";
import { RegionBoundary } from "../messages/RegionBoundary.js";
import { WindowTooSmall } from "../messages/WindowTooSmall.js";
import { useWindowHeight, useWindowWidth } from "../platform/useWindowSize.js";
import { Splitter } from "../primitives/Splitter.js";
import { ContextBar } from "./ContextBar.js";
import { Dock } from "./Dock.js";
import { MenuBar } from "./MenuBar.js";
import { StatusBar } from "./StatusBar.js";
import type { StatusBarSource } from "./StatusBar.js";
import { ToolRail } from "./ToolRail.js";
import type { RailFilter } from "./ToolRail.js";
import type { ToolStateSource } from "./useToolState.js";

export interface AppShellProps<StatusInput = unknown, Tool extends ToolBase = ToolBase> {
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
    /**
     * What the status bar's fields read and its hint (SPEC §8): the same object across renders.
     * Without it the fields read `undefined` and there is no hint.
     */
    status?: StatusBarSource<StatusInput>;
    /**
     * The editor's active-tool store (SPEC §8): the tool the rail marks and the context bar
     * shows, the variant each rail slot shows, the option values, and what selects a tool or
     * sets an option. Without it the rail shows no tools and the context bar stays empty.
     */
    tools?: ToolStateSource<Tool>;
    /**
     * Which rail slots show (SPEC §8); without it every slot of the registry. Pass a new
     * function when what it reads changes (the active layer's kind): the rail and its columns
     * follow.
     */
    railFilter?: RailFilter<Tool>;
    /**
     * Where the focus goes after a tool is chosen in the rail with the pointer; the default is
     * the viewport target (`data-viewport-focus`, SPEC §6).
     */
    toolFocus?: () => HTMLElement | null;
    /** The context bar's readouts, after the active tool's options; never in its overflow menu. */
    contextReadouts?: ReactNode;
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
 * The menu bar, the tool rail, the context bar, the dock and the status bar draw what the
 * instance's registries hold: the menus from the command registry with the palette trigger,
 * the `*.tools.ts(x)` rail slots and the active tool's options (or the `*.contextbar.tsx`
 * content), the `*.dock.tsx` sections, the `*.status.ts` fields and the hint; the rail and the
 * context bar read the editor's active-tool store (`tools`). The editor fills the slots; region
 * contents, the viewport's included, stay the editor's. Rendered under `UiRoot`, whose instance
 * it reads.
 */
export function AppShell<StatusInput = unknown, Tool extends ToolBase = ToolBase>({
    menuCentre,
    railFooter,
    viewport,
    bottom,
    noDocument,
    status,
    tools,
    railFilter,
    toolFocus,
    contextReadouts,
}: Readonly<AppShellProps<StatusInput, Tool>>) {
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
                        <MenuBar centre={menuCentre} />
                    </RegionBoundary>
                </header>
                <ToolRail
                    tools={tools}
                    filter={railFilter}
                    focusTarget={toolFocus}
                    footer={railFooter}
                />
                <section
                    className="shell-context"
                    data-region="context-bar"
                    aria-label="Tool options"
                >
                    <RegionBoundary name="Context bar">
                        <ContextBar tools={tools} readouts={contextReadouts} />
                    </RegionBoundary>
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
                            <RegionBoundary name="Panels">
                                <Dock />
                            </RegionBoundary>
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
                    <RegionBoundary name="Status bar">
                        <StatusBar source={status as StatusBarSource | undefined} />
                    </RegionBoundary>
                </footer>
            </div>
            {tooSmall ? <WindowTooSmall width={windowWidth} height={windowHeight} /> : null}
        </>
    );
}
