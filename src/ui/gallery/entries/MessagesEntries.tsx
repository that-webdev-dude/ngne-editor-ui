import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { collectCommandDialogs } from "../../../model/registries/dialogs.js";
import { commandDialogs } from "../../messages/dialogRequests.js";
import type { DialogRequestBase } from "../../messages/dialogRequests.js";
import { commandDialog } from "../../messages/dialogRegistry.js";
import type { CommandDialogModule, CommandDialogs } from "../../messages/dialogRegistry.js";
import { DiscardChangesDialog } from "../../messages/DiscardChangesDialog.js";
import type { DiscardAction, DiscardChangesRequest } from "../../messages/DiscardChangesDialog.js";
import { RegionBoundary } from "../../messages/RegionBoundary.js";
import { toast } from "../../messages/toast.js";
import { WebGpuRequired } from "../../messages/WebGpuRequired.js";
import type { WebGpuRequiredProps } from "../../messages/WebGpuRequired.js";
import {
    Button,
    ContextMenu,
    Dialog,
    NumberField,
    SegmentedControl,
    TooltipProvider,
} from "../../primitives/index.js";
import type { GalleryEntry } from "../entry.js";

// The message entries of the gallery (SPEC §6, §12; DESIGN §5, §7): toasts, the dialog host
// with a fixture dialog and the discard question, both asked through the app's dialog
// requests, the WebGPU-required notice and a region boundary. The frame mounts the toast
// viewport and the dialog host over `GALLERY_DIALOGS`, as `UiRoot` does in an app.

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

// --- The fixture dialogs, registered as a `*.dialog.tsx` module of an app registers them ----

/** The fixture feature's request: a canvas width, or null to cancel. */
interface CanvasSizeRequest {
    kind: "gallery-canvas-size";
    width: number;
    answer(width: number | null): void;
}

/** A request whose dialog throws while rendering: the host answers it and reports it. */
interface FailingRequest {
    kind: "gallery-failing";
    answer(values: null): void;
}

function CanvasSizeDialog({ request }: Readonly<{ request: CanvasSizeRequest }>) {
    const [width, setWidth] = useState(request.width);
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) request.answer(null);
            }}
            title="Canvas size"
            actions={
                <>
                    <Button onClick={() => request.answer(null)}>Cancel</Button>
                    <Button variant="primary" onClick={() => request.answer(width)}>
                        Apply
                    </Button>
                </>
            }
        >
            <NumberField
                label="Width"
                value={width}
                onChange={setWidth}
                min={1}
                max={1024}
                unit="px"
            />
        </Dialog>
    );
}

function FailingDialog(): ReactNode {
    throw new Error("Gallery: the failing dialog was asked to open.");
}

/** The gallery's `*.dialog.tsx` module map, as an app's one glob line returns it. */
const DIALOG_MODULES: Readonly<Record<string, CommandDialogModule>> = {
    "./gallery/messages.dialog.tsx": {
        commandDialogs: [
            commandDialog<CanvasSizeRequest>(
                "gallery-canvas-size",
                "Canvas size",
                CanvasSizeDialog,
            ),
            commandDialog<FailingRequest>("gallery-failing", "Failing dialog", FailingDialog),
        ],
    },
    "./file/file.dialog.tsx": {
        commandDialogs: [
            commandDialog<DiscardChangesRequest>(
                "discard-changes",
                "Discard changes",
                DiscardChangesDialog,
            ),
        ],
    },
};

/** The dialogs the gallery's dialog host shows. */
export const GALLERY_DIALOGS: CommandDialogs = collectCommandDialogs(DIALOG_MODULES);

/** Asks through the app's requests, as a feature's typed function does (SPEC §6). */
function ask<Request extends DialogRequestBase, Values>(
    build: (answer: (values: Values | null) => void) => Request,
): Promise<Values | null> {
    return commandDialogs.open<Values>((answer) => build(answer) as DialogRequestBase);
}

const askCanvasSize = (width: number) =>
    ask<CanvasSizeRequest, number>((answer) => ({ kind: "gallery-canvas-size", width, answer }));

const askDiscard = (action: DiscardAction, file: string | null) =>
    ask<DiscardChangesRequest, true>((answer) => ({
        kind: "discard-changes",
        document: "level-1",
        action,
        file,
        answer,
    }));

// --- Entries --------------------------------------------------------------------------------

function ToastEntry() {
    const [runs, setRuns] = useState(0);
    return (
        <Row>
            <Button onClick={() => toast.info("Document saved.")}>Show toast</Button>
            <Button onClick={() => toast.error("Import failed: not a PNG file.")}>
                Show error toast
            </Button>
            <Button
                onClick={() =>
                    toast.info("A new version of the editor is ready.", {
                        action: { label: "Reload", run: () => setRuns((count) => count + 1) },
                    })
                }
            >
                Show toast with action
            </Button>
            <Readout name="toast-action">Action runs: {runs}</Readout>
        </Row>
    );
}

function DialogHostEntry() {
    const [width, setWidth] = useState(64);
    const [answer, setAnswer] = useState("none");
    const canvasSize = () => {
        void askCanvasSize(width).then((value) => {
            setAnswer(value === null ? "cancelled" : String(value));
            if (value !== null) setWidth(value);
        });
    };
    const failing = () => {
        void ask<FailingRequest, null>((answer) => ({ kind: "gallery-failing", answer })).then(() =>
            setAnswer("failed"),
        );
    };
    return (
        <Row>
            <Button onClick={canvasSize}>Canvas size…</Button>
            {/* Non-modal, as the menus of the menu bar: the trigger stays focusable. */}
            <DropdownMenu.Root modal={false}>
                <DropdownMenu.Trigger asChild>
                    <Button>Image</Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                    <DropdownMenu.Content className="ui-menu" align="start" sideOffset={4}>
                        <DropdownMenu.Item className="ui-menu__item" onSelect={canvasSize}>
                            Canvas size…
                        </DropdownMenu.Item>
                    </DropdownMenu.Content>
                </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <ContextMenu
                items={[{ id: "canvas-size", label: "Canvas size…", onSelect: canvasSize }]}
            >
                <div className="gallery__target" role="group" aria-label="Canvas" tabIndex={0}>
                    Right-click for the menu
                </div>
            </ContextMenu>
            <Button onClick={failing}>Open failing dialog</Button>
            <Readout name="dialog-answer">Answer: {answer}</Readout>
            <Readout name="canvas-width">Width: {width}</Readout>
        </Row>
    );
}

const DISCARDS: readonly { action: DiscardAction; label: string; file: string | null }[] = [
    { action: "close", label: "Close", file: null },
    { action: "open", label: "Open level-2", file: "level-2" },
    { action: "revert", label: "Revert", file: "level-1" },
];

function DiscardEntry() {
    const [answer, setAnswer] = useState("none");
    return (
        <Row>
            {DISCARDS.map(({ action, label, file }) => (
                <Button
                    key={action}
                    onClick={() =>
                        void askDiscard(action, file).then((value) =>
                            setAnswer(value === true ? "discard" : "keep"),
                        )
                    }
                >
                    {label}
                </Button>
            ))}
            <Readout name="discard-answer">Answer: {answer}</Readout>
        </Row>
    );
}

const REASONS: readonly { value: WebGpuRequiredProps["reason"]; label: string }[] = [
    { value: "no-adapter", label: "No adapter" },
    { value: "no-api", label: "No WebGPU" },
];

function WebGpuEntry() {
    const [reason, setReason] = useState<WebGpuRequiredProps["reason"]>("no-adapter");
    return (
        <>
            <Row>
                <SegmentedControl
                    label="What is missing"
                    value={reason}
                    onChange={setReason}
                    options={REASONS}
                />
            </Row>
            {/* The notice fills the window in an app; here it fills this frame. */}
            <div className="gallery__notice">
                <WebGpuRequired
                    productName="NGNE Gallery Editor"
                    reason={reason}
                    detail={reason === "no-adapter" ? "Adapter request blocked." : undefined}
                />
            </div>
        </>
    );
}

function Fragile({ broken, children }: Readonly<{ broken: boolean; children: ReactNode }>) {
    if (broken) throw new Error("Gallery: the demo region was asked to fail.");
    return <span className="gallery__fragile">{children}</span>;
}

function RegionBoundaryEntry() {
    const [broken, setBroken] = useState(false);
    return (
        <>
            <Row>
                <Button onClick={() => setBroken(true)}>Break regions</Button>
                <Button onClick={() => setBroken(false)}>Repair regions</Button>
            </Row>
            <div className="gallery__regions">
                <div className="gallery__region gallery__region--narrow" data-demo-region="rail">
                    <RegionBoundary name="Demo rail" compact>
                        <Fragile broken={broken}>Rail</Fragile>
                    </RegionBoundary>
                </div>
                <div className="gallery__region" data-demo-region="panel">
                    <RegionBoundary name="Demo panel">
                        <Fragile broken={broken}>Panel content</Fragile>
                    </RegionBoundary>
                </div>
            </div>
        </>
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

/** The message entries, in the order of DESIGN §5 and §7. */
export const messageEntries: readonly GalleryEntry[] = [
    entry("toast", "Toast", ToastEntry),
    entry("dialog-host", "Dialog host", DialogHostEntry),
    entry("discard-changes", "Discard changes", DiscardEntry),
    entry("webgpu-required", "WebGPU required", WebGpuEntry),
    entry("region-boundary", "Region boundary", RegionBoundaryEntry),
];
