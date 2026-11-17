import { ChevronDown, ChevronRight } from "lucide-react";
import type { ComponentType } from "react";
import { useId } from "react";
import type { DockPanel } from "../../model/registries/dock.js";
import { RegionBoundary } from "../messages/RegionBoundary.js";
import { Icon } from "../primitives/Icon.js";

export interface DockSectionProps {
    panel: DockPanel<ComponentType>;
    collapsed: boolean;
    onCollapsedChange(collapsed: boolean): void;
}

/**
 * One collapsible section of the right dock (DESIGN §2): a header that stays clickable and the
 * panel body, which is mounted only while expanded and has its own error boundary (DESIGN §5).
 */
export function DockSection({ panel, collapsed, onCollapsedChange }: Readonly<DockSectionProps>) {
    const bodyId = useId();
    const { Body, HeaderExtra } = panel;
    return (
        <section className="dock-section" data-dock-panel={panel.id}>
            <h2 className="dock-section__header">
                <button
                    type="button"
                    className="dock-section__toggle"
                    aria-expanded={!collapsed}
                    aria-controls={bodyId}
                    onClick={() => onCollapsedChange(!collapsed)}
                >
                    <Icon icon={collapsed ? ChevronRight : ChevronDown} />
                    {panel.title}
                </button>
                {HeaderExtra ? (
                    <span className="dock-section__extra">
                        <HeaderExtra />
                    </span>
                ) : null}
            </h2>
            <div id={bodyId} className="dock-section__body" hidden={collapsed}>
                {collapsed ? null : (
                    <RegionBoundary name={panel.title}>
                        <Body />
                    </RegionBoundary>
                )}
            </div>
        </section>
    );
}
