import { useRef, useState } from "react";
import { useEditorUi } from "../editorUi/context.js";
import { Button } from "../primitives/Button.js";
import { cx } from "../primitives/cx.js";
import { Dialog } from "../primitives/Dialog.js";
import { copyText, versionLine } from "./versionInfo.js";

type CopyState = "idle" | "copying" | "copied" | "failed";

const COPY_MESSAGES: Record<CopyState, string> = {
    idle: "",
    copying: "",
    copied: "Version info copied.",
    failed: "Could not copy the version info: the clipboard is not available.",
};

/**
 * About <productName> (DESIGN §7, SPEC §11): the editor's name and version, the engine's
 * version and the licence as name and value, links to the repository and the changelog (each
 * in a new tab), and Copy version info, which copies the one line a bug report needs and says
 * whether that worked. The facts are the instance's `about` config, from the editor's build.
 * Shown by the surface host while the instance's `about` surface is open.
 */
export function AboutDialog() {
    const editorUi = useEditorUi();
    const { about: info, productName } = editorUi.config;
    const [copy, setCopy] = useState<CopyState>("idle");
    const copying = useRef(false);
    const close = () => editorUi.surfaces.close("about");
    const copyLine = async () => {
        // A second press while a copy is pending does nothing. The button is not `disabled`
        // meanwhile: Chrome takes the focus off a focused button that becomes disabled, and
        // with a clipboard slower than a frame it went to the page behind the modal dialog.
        if (copying.current) return;
        copying.current = true;
        setCopy("copying");
        try {
            const copied = await copyText(versionLine(info, navigator.userAgent));
            setCopy(copied ? "copied" : "failed");
        } finally {
            copying.current = false;
        }
    };
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) close();
            }}
            title={`About ${productName}`}
            actions={
                <>
                    <Button
                        aria-disabled={copy === "copying" || undefined}
                        onClick={() => void copyLine()}
                    >
                        Copy version info
                    </Button>
                    <Button variant="primary" onClick={close}>
                        Close
                    </Button>
                </>
            }
        >
            <div className="about">
                <p className="about__name">
                    {productName} {info.version}
                </p>
                <dl className="about__facts">
                    <dt>Engine</dt>
                    <dd>
                        {info.engine.packageName} {info.engine.version}
                    </dd>
                    <dt>Licence</dt>
                    <dd>{info.licence}</dd>
                </dl>
                <ul className="about__links">
                    <li>
                        <a href={info.repositoryUrl} target="_blank" rel="noopener noreferrer">
                            Source code on GitHub
                        </a>
                    </li>
                    <li>
                        <a href={info.changelogUrl} target="_blank" rel="noopener noreferrer">
                            Changelog
                        </a>
                    </li>
                </ul>
                {/* An <output> has the role status: the message is announced when it changes. */}
                <output
                    className={cx("about__status", copy === "failed" && "about__status--failed")}
                >
                    {COPY_MESSAGES[copy]}
                </output>
            </div>
        </Dialog>
    );
}
