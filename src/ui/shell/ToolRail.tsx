import type { LucideIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import type { MouseEvent, ReactNode } from "react";
import { railGroups } from "../../model/tools/registry.js";
import type { RailSlot, ToolBase } from "../../model/tools/types.js";
import { VIEWPORT_FOCUS_ATTRIBUTE } from "../commands/keyEnvironment.js";
import { useEditorUi } from "../editorUi/context.js";
import { Icon } from "../primitives/Icon.js";
import { ToolButton } from "../primitives/ToolButton.js";
import { RailFrame, RailGroup } from "./RailFrame.js";
import { shownInSlot, useToolState } from "./useToolState.js";
import type { ToolStateSource } from "./useToolState.js";
import { VariantToolButton } from "./VariantToolButton.js";

/** Which rail slots show (SPEC §8): the editor's filter, true for a slot it shows. */
export type RailFilter<Tool extends ToolBase = ToolBase> = (slot: RailSlot<Tool>) => boolean;

/** The viewport target (SPEC §6): where the focus goes after a tool is chosen by default. */
export function viewportFocusTarget(): HTMLElement | null {
    return document.querySelector<HTMLElement>(`[${VIEWPORT_FOCUS_ATTRIBUTE}]`);
}

export interface ToolRailProps<Tool extends ToolBase = ToolBase> {
    /** The editor's active-tool store; without it the rail shows no tools. */
    tools?: ToolStateSource<Tool>;
    /** Which slots show; without it every slot of the registry. */
    filter?: RailFilter<Tool>;
    /** Where the focus goes after a tool is chosen with the pointer. */
    focusTarget?: () => HTMLElement | null;
    /** Content pinned to the bottom of the rail, in `railFooterHeight`. */
    footer?: ReactNode;
}

interface RailButtonsProps<Tool extends ToolBase> {
    groups: readonly (readonly RailSlot<Tool>[])[];
    tools: ToolStateSource<Tool>;
    focusTarget(): HTMLElement | null;
}

/** The buttons of the rail's groups, read from the editor's store. */
function RailButtons<Tool extends ToolBase>({
    groups,
    tools: source,
    focusTarget,
}: Readonly<RailButtonsProps<Tool>>) {
    const tools = useToolState(source);
    const active = tools.activeId();
    const select = (id: string) => tools.select(id);
    return groups.map((group) => (
        <RailGroup key={group[0]?.id}>
            {group.map((slot) => {
                const shown = shownInSlot(tools, slot);
                if (shown && slot.variants.length > 1) {
                    return (
                        <VariantToolButton
                            key={slot.id}
                            slot={slot}
                            shown={shown}
                            active={shown.id === active}
                            select={select}
                            focusTarget={focusTarget}
                        />
                    );
                }
                const icon = (shown?.icon ?? slot.icon) as LucideIcon | undefined;
                const onClick = (event: MouseEvent<HTMLButtonElement>) => {
                    if (!shown) return;
                    tools.select(shown.id);
                    // A click from the keyboard (detail 0) keeps the focus on the button.
                    if (event.detail !== 0) focusTarget()?.focus({ preventScroll: true });
                };
                return (
                    <ToolButton
                        key={slot.id}
                        label={shown?.label ?? slot.label}
                        shortcut={shown?.shortcut ?? slot.shortcut}
                        data-tool={slot.id}
                        active={shown !== null && shown.id === active}
                        disabled={shown === null}
                        onClick={onClick}
                    >
                        {icon ? <Icon icon={icon} /> : null}
                    </ToolButton>
                );
            })}
        </RailGroup>
    ));
}

/**
 * The tool rail (SPEC §8, DESIGN §2, §4): a button per slot of the instance's tool registry,
 * in the rail's groups, the slots the editor's filter keeps. A registered tool's button
 * selects it; the active tool's is pressed. A planned slot is a disabled button until its tool
 * is registered. A slot with variants shows the one the editor's store names, with a corner
 * mark, and holding it opens the menu of its variants. Chosen with the pointer, the focus goes
 * to the editor's target. The footer sits at the bottom, in the height the configuration
 * reserves.
 */
export function ToolRail<Tool extends ToolBase>({
    tools,
    filter,
    focusTarget = viewportFocusTarget,
    footer,
}: Readonly<ToolRailProps<Tool>>) {
    const editorUi = useEditorUi();
    const registry = editorUi.tools;
    // Renders again when the registry's slots change.
    useSyncExternalStore(registry.subscribe, registry.version, registry.version);
    const slots = registry.railSlots() as readonly RailSlot<Tool>[];
    // Without the editor's store the rail shows no tools.
    let shown: readonly RailSlot<Tool>[] = [];
    if (tools) shown = filter ? slots.filter(filter) : slots;
    const groups = railGroups(shown);

    return (
        <RailFrame
            groupSizes={groups.map((group) => group.length)}
            footerHeight={editorUi.config.railFooterHeight}
            footer={footer}
        >
            {tools ? <RailButtons groups={groups} tools={tools} focusTarget={focusTarget} /> : null}
        </RailFrame>
    );
}
