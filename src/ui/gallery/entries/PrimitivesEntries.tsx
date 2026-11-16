import { Eraser, Grid2x2, Hand, Layers, Pencil, Plus } from "lucide-react";
import { Popover as RadixPopover } from "radix-ui";
import { useCallback, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
    Button,
    ContextMenu,
    Dialog,
    Icon,
    IconButton,
    NumberField,
    Popover,
    SegmentedControl,
    Select,
    Slider,
    Splitter,
    Toggle,
    ToolButton,
    Tooltip,
    TooltipProvider,
    useClosingPopover,
} from "../../primitives/index.js";
import type { ContextMenuEntry } from "../../primitives/index.js";
import type { GalleryEntry } from "../entry.js";

// The primitive entries of the gallery (SPEC §9.1, §12): one entry per primitive of DESIGN §4,
// each with the states the canon names, and a popover that applies on close. Each entry has its
// own tooltip provider, as `UiRoot` gives an app one.

const TOOLS = [
    { id: "pencil", label: "Pencil", shortcut: "B", icon: Pencil },
    { id: "eraser", label: "Eraser", shortcut: "E", icon: Eraser },
    { id: "hand", label: "Hand", shortcut: "H", icon: Hand },
] as const;

const INKS = [
    { value: "simple", label: "Simple" },
    { value: "alpha", label: "Alpha compositing" },
    { value: "lock", label: "Lock alpha" },
] as const;

const SHAPES = [
    { value: "square", label: "Square" },
    { value: "circle", label: "Circle" },
] as const;

const SPLIT = { default: 160, min: 80, max: 320 } as const;

function Row({ children }: Readonly<{ children: ReactNode }>) {
    return <div className="gallery__row">{children}</div>;
}

function Readout({ name, children }: Readonly<{ name: string; children: ReactNode }>) {
    return (
        <output className="gallery__readout" data-readout={name}>
            {children}
        </output>
    );
}

function ButtonEntry() {
    const [clicks, setClicks] = useState(0);
    return (
        <Row>
            <Button onClick={() => setClicks(clicks + 1)}>Default</Button>
            <Button variant="primary" onClick={() => setClicks(clicks + 1)}>
                Primary
            </Button>
            <Button variant="danger" onClick={() => setClicks(clicks + 1)}>
                Discard
            </Button>
            <Button disabled>Disabled</Button>
            <Readout name="clicks">Clicks: {clicks}</Readout>
        </Row>
    );
}

function IconButtonEntry() {
    const [added, setAdded] = useState(0);
    return (
        <Row>
            <IconButton label="Add frame" shortcut="Alt+N" onClick={() => setAdded(added + 1)}>
                <Icon icon={Plus} />
            </IconButton>
            <IconButton label="New layer" disabled>
                <Icon icon={Layers} />
            </IconButton>
            <Readout name="added">Added: {added}</Readout>
        </Row>
    );
}

function ToolButtonEntry() {
    const [tool, setTool] = useState<(typeof TOOLS)[number]["id"]>("pencil");
    return (
        <Row>
            {TOOLS.map((entry) => (
                <ToolButton
                    key={entry.id}
                    label={entry.label}
                    shortcut={entry.shortcut}
                    active={tool === entry.id}
                    onClick={() => setTool(entry.id)}
                >
                    <Icon icon={entry.icon} />
                </ToolButton>
            ))}
            <Readout name="tool">Active: {tool}</Readout>
        </Row>
    );
}

function NumberFieldEntry() {
    const [size, setSize] = useState(1);
    const [opacity, setOpacity] = useState(100);
    return (
        <Row>
            <NumberField label="Size" value={size} onChange={setSize} min={1} max={64} unit="px" />
            <NumberField
                label="Opacity"
                value={opacity}
                onChange={setOpacity}
                min={0}
                max={100}
                unit="%"
            />
            <NumberField label="Locked" value={8} onChange={() => {}} unit="px" disabled />
        </Row>
    );
}

function SliderEntry() {
    const [tolerance, setTolerance] = useState(32);
    return (
        <Row>
            <Slider label="Tolerance" value={tolerance} onChange={setTolerance} min={0} max={255} />
            <Slider label="Locked" value={40} onChange={() => {}} disabled />
        </Row>
    );
}

function ToggleEntry() {
    const [grid, setGrid] = useState(false);
    const [pixelPerfect, setPixelPerfect] = useState(true);
    return (
        <Row>
            <Toggle label="Pixel grid" pressed={grid} onPressedChange={setGrid}>
                <Icon icon={Grid2x2} />
            </Toggle>
            <Toggle
                label="Pixel-perfect"
                showLabel
                pressed={pixelPerfect}
                onPressedChange={setPixelPerfect}
            />
            <Toggle
                label="Symmetry"
                showLabel
                pressed={false}
                onPressedChange={() => {}}
                disabled
            />
        </Row>
    );
}

function SelectEntry() {
    const [ink, setInk] = useState<(typeof INKS)[number]["value"]>("simple");
    return (
        <Row>
            <Select label="Ink" value={ink} onChange={setInk} options={INKS} />
            <Select label="Locked" value="simple" onChange={() => {}} options={INKS} disabled />
            <Readout name="ink">Ink: {ink}</Readout>
        </Row>
    );
}

function SegmentedEntry() {
    const [shape, setShape] = useState<(typeof SHAPES)[number]["value"]>("square");
    return (
        <Row>
            <SegmentedControl
                label="Brush shape"
                value={shape}
                onChange={setShape}
                options={SHAPES}
            />
            <Readout name="shape">Shape: {shape}</Readout>
        </Row>
    );
}

function DialogEntry() {
    const [dialog, setDialog] = useState<"standard" | "large" | null>(null);
    const [width, setWidth] = useState(32);
    const [height, setHeight] = useState(32);
    const [ink, setInk] = useState<(typeof INKS)[number]["value"]>("simple");
    const close = () => setDialog(null);
    return (
        <Row>
            <Button onClick={() => setDialog("standard")}>Open dialog</Button>
            <Button onClick={() => setDialog("large")}>Open large dialog</Button>
            <Dialog
                open={dialog === "standard"}
                onOpenChange={(open) => setDialog(open ? "standard" : null)}
                title="New document"
                actions={
                    <>
                        <Button onClick={close}>Cancel</Button>
                        <Button variant="primary" onClick={close}>
                            Create
                        </Button>
                    </>
                }
            >
                <Row>
                    <NumberField
                        label="Width"
                        value={width}
                        onChange={setWidth}
                        min={1}
                        max={1024}
                        unit="px"
                    />
                    <NumberField
                        label="Height"
                        value={height}
                        onChange={setHeight}
                        min={1}
                        max={1024}
                        unit="px"
                    />
                </Row>
            </Dialog>
            <Dialog
                open={dialog === "large"}
                onOpenChange={(open) => setDialog(open ? "large" : null)}
                title="Export"
                size="large"
                actions={
                    <>
                        <Button onClick={close}>Cancel</Button>
                        <Button variant="primary" onClick={close}>
                            Export
                        </Button>
                    </>
                }
            >
                <div className="gallery__column">
                    <Select label="Ink" value={ink} onChange={setInk} options={INKS} />
                    {Array.from({ length: 48 }, (_, index) => (
                        <p key={index}>hero_walk_{String(index).padStart(2, "0")}.png</p>
                    ))}
                </div>
            </Dialog>
        </Row>
    );
}

function PopoverEntry() {
    const [frames, setFrames] = useState(2);
    const [withinTag, setWithinTag] = useState(false);
    return (
        <Row>
            <Popover label="Onion skin" trigger={<Button>Open popover</Button>}>
                <NumberField
                    label="Frames before"
                    value={frames}
                    onChange={setFrames}
                    min={0}
                    max={8}
                />
                <Toggle
                    label="Within tag"
                    showLabel
                    pressed={withinTag}
                    onPressedChange={setWithinTag}
                />
            </Popover>
        </Row>
    );
}

interface OpacityDraft {
    opacity: number;
}

/**
 * A modal popover whose value applies when it closes (DESIGN §4, Popover), as a properties
 * popover of an editor's panel does: Escape, an outside click or Enter in its field closes it,
 * and the value applies once, then. Its life around the close is `useClosingPopover`'s.
 */
function ClosingPopoverEntry() {
    const [applied, setApplied] = useState(128);
    const [applies, setApplies] = useState(0);
    const [draft, setDraft] = useState<OpacityDraft | null>(null);
    // The open draft for the handlers: a close and the field's commit on blur may come in one
    // task, and the second must find the popover closed.
    const open = useRef<OpacityDraft | null>(null);
    const opener = useRef<HTMLButtonElement | null>(null);
    const fallback = useCallback(() => opener.current?.focus({ preventScroll: true }), []);
    const { shown, opening, contentRef, returnToRef } = useClosingPopover(draft, fallback);

    const start = () => {
        open.current = { opacity: applied };
        setDraft(open.current);
    };
    const edit = (opacity: number) => {
        if (!open.current) return;
        open.current = { opacity };
        setDraft(open.current);
    };
    const finish = () => {
        const last = open.current;
        if (!last) return;
        open.current = null;
        setApplied(last.opacity);
        setApplies((count) => count + 1);
        setDraft(null);
    };

    return (
        <Row>
            <RadixPopover.Root
                modal
                open={shown !== null}
                onOpenChange={(next) => {
                    if (!next) finish();
                }}
            >
                <RadixPopover.Anchor asChild>
                    <Button ref={opener} onClick={start}>
                        Edit opacity
                    </Button>
                </RadixPopover.Anchor>
                {shown ? (
                    <RadixPopover.Portal key={opening}>
                        <RadixPopover.Content
                            ref={contentRef}
                            className="ui-popover"
                            aria-label="Opacity"
                            side="bottom"
                            align="start"
                            sideOffset={6}
                            collisionPadding={8}
                            onOpenAutoFocus={() => {
                                returnToRef.current = document.activeElement;
                            }}
                            onCloseAutoFocus={(event) => {
                                // The hook moved the focus already, in the closing commit.
                                event.preventDefault();
                            }}
                            onKeyDown={(event) => {
                                // Enter in the field applies, after the field took its value.
                                if (event.key === "Enter" && !event.defaultPrevented) finish();
                            }}
                        >
                            <NumberField
                                label="Opacity"
                                value={shown.opacity}
                                onChange={edit}
                                min={0}
                                max={255}
                            />
                        </RadixPopover.Content>
                    </RadixPopover.Portal>
                ) : null}
            </RadixPopover.Root>
            <Readout name="applied">Applied: {applied}</Readout>
            <Readout name="applies">Applies: {applies}</Readout>
        </Row>
    );
}

function ContextMenuEntryView() {
    const [action, setAction] = useState("none");
    const menu: ContextMenuEntry[] = [
        { id: "duplicate", label: "Duplicate", onSelect: () => setAction("Duplicate") },
        { id: "rename", label: "Rename", shortcut: "F2", onSelect: () => setAction("Rename") },
        { type: "separator", id: "separator" },
        { id: "merge", label: "Merge down", disabled: true, onSelect: () => setAction("Merge") },
        { id: "delete", label: "Delete", onSelect: () => setAction("Delete") },
    ];
    return (
        <Row>
            <ContextMenu items={menu}>
                <div className="gallery__target" tabIndex={0} role="group" aria-label="Layer">
                    Right-click, or focus and press the Menu key
                </div>
            </ContextMenu>
            <Readout name="action">Last action: {action}</Readout>
        </Row>
    );
}

function TooltipEntry() {
    return (
        <Row>
            <Tooltip label="Shown after 400 ms" shortcut="Ctrl+K">
                <Button>Hover or focus</Button>
            </Tooltip>
        </Row>
    );
}

function SplitterEntry() {
    const [split, setSplit] = useState<number>(SPLIT.default);
    return (
        <Row>
            <div className="gallery__split">
                <div className="gallery__pane" style={{ width: split }}>
                    Pane
                </div>
                <Splitter
                    orientation="vertical"
                    label="Resize pane"
                    value={split}
                    min={SPLIT.min}
                    max={SPLIT.max}
                    onChange={setSplit}
                    onReset={() => setSplit(SPLIT.default)}
                />
                <div className="gallery__pane gallery__pane--rest">Rest</div>
            </div>
            <Readout name="split">Width: {split}</Readout>
        </Row>
    );
}

function IconEntry() {
    return (
        <ul className="gallery__icons">
            {TOOLS.map((entry) => (
                <li key={entry.id} className="gallery__icon">
                    <Icon icon={entry.icon} />
                    {entry.label}
                </li>
            ))}
        </ul>
    );
}

/** An entry of `Component`, under a tooltip provider of its own. */
function entry(id: string, title: string, Component: ComponentType): GalleryEntry {
    function WithTooltips() {
        return (
            <TooltipProvider>
                <Component />
            </TooltipProvider>
        );
    }
    return { id, title, Component: WithTooltips };
}

/** The primitive entries, in the order of DESIGN §4 and SPEC §9.1. */
export const primitiveEntries: readonly GalleryEntry[] = [
    entry("button", "Button", ButtonEntry),
    entry("icon-button", "Icon button", IconButtonEntry),
    entry("tool-button", "Tool button", ToolButtonEntry),
    entry("toggle", "Toggle", ToggleEntry),
    entry("segmented", "Segmented control", SegmentedEntry),
    entry("number-field", "Number field", NumberFieldEntry),
    entry("slider", "Slider", SliderEntry),
    entry("select", "Select", SelectEntry),
    entry("popover", "Popover", PopoverEntry),
    entry("closing-popover", "Popover that applies on close", ClosingPopoverEntry),
    entry("dialog", "Dialog", DialogEntry),
    entry("context-menu", "Context menu", ContextMenuEntryView),
    entry("tooltip", "Tooltip", TooltipEntry),
    entry("splitter", "Splitter", SplitterEntry),
    entry("icon", "Icon", IconEntry),
];
