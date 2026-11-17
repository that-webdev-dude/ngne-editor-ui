import { Ellipsis } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import {
    shownContextBarContent,
    subscribeContextBarContent,
} from "../../model/registries/contextBar.js";
import { fittingOptions, optionControl } from "../../model/tools/options.js";
import type {
    RegisteredTool,
    ToolBase,
    ToolOptionSpec,
    ToolOptionValue,
} from "../../model/tools/types.js";
import { useEditorUi } from "../editorUi/context.js";
import { Icon } from "../primitives/Icon.js";
import { IconButton } from "../primitives/IconButton.js";
import { NumberField } from "../primitives/NumberField.js";
import { Popover } from "../primitives/Popover.js";
import { SegmentedControl } from "../primitives/SegmentedControl.js";
import { Select } from "../primitives/Select.js";
import { Toggle } from "../primitives/Toggle.js";
import { useToolState } from "./useToolState.js";
import type { ToolStateSource } from "./useToolState.js";

// The context bar (SPEC §8, DESIGN §2, §4): the active tool's name, then its options in the
// order the tool lists them, each in the control its kind calls for, then the editor's
// readouts. Options that do not fit move, from the last one back, into a trailing overflow
// menu; the readouts never do. While `*.contextbar.tsx` content is shown, it takes the place
// of the options and the readouts. Empty while no registered tool is active.

/** The overflow menu's trigger and accessible name. */
export const CONTEXT_OVERFLOW_LABEL = "More options";

interface OptionFieldProps {
    option: ToolOptionSpec;
    value: ToolOptionValue;
    onChange(value: ToolOptionValue): void;
}

/** One option of the active tool, as the control its kind calls for (DESIGN §4). */
function OptionField({ option, value, onChange }: Readonly<OptionFieldProps>) {
    const data = { "data-tool-option": option.key };
    switch (optionControl(option)) {
        case "number": {
            const { min, max, step, unit } = option as Extract<ToolOptionSpec, { kind: "number" }>;
            return (
                <span {...data}>
                    <NumberField
                        label={option.label}
                        value={Number(value)}
                        onChange={onChange}
                        min={min}
                        max={max}
                        step={step}
                        unit={unit}
                    />
                </span>
            );
        }
        case "toggle":
            return (
                <Toggle
                    {...data}
                    label={option.label}
                    pressed={value === true}
                    onPressedChange={onChange}
                    showLabel
                />
            );
        case "select": {
            const { choices } = option as Extract<ToolOptionSpec, { kind: "choice" }>;
            return (
                <span {...data}>
                    <Select
                        label={option.label}
                        value={String(value)}
                        onChange={onChange}
                        options={choices}
                    />
                </span>
            );
        }
        case "segmented": {
            const { choices } = option as Extract<ToolOptionSpec, { kind: "choice" }>;
            return (
                <span className="ui-field" {...data}>
                    {/* The group is named by its aria-label; this is the visible label. */}
                    <span className="ui-field__label" aria-hidden="true">
                        {option.label}
                    </span>
                    <SegmentedControl
                        label={option.label}
                        value={String(value)}
                        onChange={onChange}
                        options={choices}
                    />
                </span>
            );
        }
    }
}

interface ToolOptionsProps<Tool extends ToolBase> {
    tool: RegisteredTool<Tool>;
    tools: ToolStateSource<Tool>;
    readouts: ReactNode;
}

/** The options of the active tool with the overflow menu, then the readouts. */
function ToolOptions<Tool extends ToolBase>({
    tool,
    tools,
    readouts,
}: Readonly<ToolOptionsProps<Tool>>) {
    const bar = useRef<HTMLDivElement>(null);
    const measure = useRef<HTMLDivElement>(null);
    const [fit, setFit] = useState(tool.options.length);
    // Counts the bar's resizes, so the fit below is measured again after each.
    const [resized, setResized] = useState(0);
    const values = tools.options(tool);
    const hasReadouts = readouts !== undefined && readouts !== null && readouts !== false;

    useLayoutEffect(() => {
        const element = bar.current;
        if (!element) return;
        const resize = new ResizeObserver(() => setResized((count) => count + 1));
        resize.observe(element);
        return () => resize.disconnect();
    }, []);

    // Measured before the browser paints: another tool, a value (a select's label is as wide as
    // it), other readouts and a resize each change the widths or the room.
    useLayoutEffect(() => {
        const element = bar.current;
        const layer = measure.current;
        if (!element || !layer) return;
        const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0;
        const width = (item: Element | null) => item?.getBoundingClientRect().width ?? 0;
        const widths = [...layer.querySelectorAll("[data-measure-option]")].map(width);
        // The name, with the margin after it.
        const name = element.querySelector(":scope > [data-context-tool]");
        const nameWidth = name
            ? width(name) + (Number.parseFloat(getComputedStyle(name).marginRight) || 0)
            : 0;
        const readouts = element.querySelector(":scope > [data-context-readouts]");
        const readoutsWidth = readouts ? gap + width(readouts) : 0;
        const next = fittingOptions(
            widths,
            element.clientWidth,
            nameWidth + readoutsWidth,
            gap,
            width(layer.querySelector("[data-measure-trigger]")),
        );
        setFit((current) => (current === next ? current : next));
    }, [tool, values, readouts, resized]);

    const field = (option: ToolOptionSpec) => (
        <OptionField
            key={`${tool.id}:${option.key}`}
            option={option}
            value={values[option.key] ?? option.default}
            onChange={(value) => tools.setOption(tool, option.key, value)}
        />
    );
    const shown = tool.options.slice(0, fit);
    const overflow = tool.options.slice(fit);

    return (
        <div className="context-bar" ref={bar}>
            <span className="context-tool" data-context-tool={tool.id}>
                {tool.label}
            </span>
            {shown.map(field)}
            {overflow.length === 0 ? null : (
                <Popover
                    label={CONTEXT_OVERFLOW_LABEL}
                    side="bottom"
                    align="end"
                    className="context-overflow"
                    trigger={
                        <IconButton label={CONTEXT_OVERFLOW_LABEL} data-context-overflow="">
                            <Icon icon={Ellipsis} />
                        </IconButton>
                    }
                >
                    <div className="context-overflow__options" data-context-overflow-menu="">
                        {overflow.map(field)}
                    </div>
                </Popover>
            )}
            {hasReadouts ? (
                <span className="context-readouts" data-context-readouts="">
                    {readouts}
                </span>
            ) : null}
            {/* Every option at its natural width, unseen and inert, for the fit above. */}
            <div className="context-bar__measure" ref={measure} aria-hidden="true" inert>
                <div className="context-bar__measure-row">
                    {tool.options.map((option) => (
                        <span key={option.key} data-measure-option={option.key}>
                            <OptionField
                                option={option}
                                value={values[option.key] ?? option.default}
                                onChange={() => undefined}
                            />
                        </span>
                    ))}
                    <span className="context-bar__measure-trigger" data-measure-trigger="" />
                </div>
            </div>
        </div>
    );
}

export interface ContextBarProps<Tool extends ToolBase = ToolBase> {
    /** The editor's active-tool store; without it the bar is empty. */
    tools?: ToolStateSource<Tool>;
    /** The editor's readouts after the options (SPEC §8); never in the overflow menu. */
    readouts?: ReactNode;
}

function ActiveToolBar<Tool extends ToolBase>({
    tools: source,
    readouts,
}: Readonly<{ tools: ToolStateSource<Tool>; readouts: ReactNode }>) {
    const editorUi = useEditorUi();
    const registry = editorUi.tools;
    const entries = editorUi.contextBarContent;
    const subscribe = useCallback(
        (listener: () => void) => subscribeContextBarContent(listener, entries),
        [entries],
    );
    const current = useCallback(() => shownContextBarContent(entries), [entries]);
    const content = useSyncExternalStore(subscribe, current, current);
    useSyncExternalStore(registry.subscribe, registry.version, registry.version);
    const tools = useToolState(source);
    const id = tools.activeId();
    const tool = id === null ? undefined : (registry.get(id) as RegisteredTool<Tool> | undefined);
    if (!tool) return null;
    if (content) {
        return (
            <div className="context-bar">
                <span className="context-tool" data-context-tool={tool.id}>
                    {tool.label}
                </span>
                <span className="context-content" data-context-content={content.id}>
                    <content.Body />
                </span>
            </div>
        );
    }
    // A key per tool: another tool's options start from a fresh measurement.
    return <ToolOptions key={tool.id} tool={tool} tools={tools} readouts={readouts} />;
}

/** The context bar's content, read from the instance `UiRoot` provides and the editor's store. */
export function ContextBar<Tool extends ToolBase>({
    tools,
    readouts,
}: Readonly<ContextBarProps<Tool>>) {
    return tools ? <ActiveToolBar tools={tools} readouts={readouts} /> : null;
}
