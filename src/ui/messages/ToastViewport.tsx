import { CircleAlert, X } from "lucide-react";
import { useStore } from "zustand";
import { Button } from "../primitives/Button.js";
import { cx } from "../primitives/cx.js";
import { Icon } from "../primitives/Icon.js";
import { IconButton } from "../primitives/IconButton.js";
import { toast } from "./toast.js";

/**
 * Renders the toast queue bottom-centre (DESIGN §4); mounted once by `UiRoot` (SPEC §8),
 * inside its tooltip provider.
 */
export function ToastViewport() {
    const toasts = useStore(toast.store, (state) => state.toasts);
    return (
        <section className="ui-toasts" aria-label="Notifications" aria-live="polite">
            {toasts.map((item) =>
                item.kind === "error" ? (
                    <div key={item.id} className={cx("ui-toast", "ui-toast--error")} role="alert">
                        <span className="ui-toast__icon">
                            <Icon icon={CircleAlert} />
                        </span>
                        <span className="ui-toast__message">{item.message}</span>
                        <IconButton
                            label="Dismiss"
                            tooltipSide="top"
                            onClick={() => toast.dismiss(item.id)}
                        >
                            <Icon icon={X} />
                        </IconButton>
                    </div>
                ) : (
                    <output
                        key={item.id}
                        className={cx("ui-toast", item.action && "ui-toast--action")}
                    >
                        <span className="ui-toast__message">{item.message}</span>
                        {item.action ? (
                            <>
                                <Button
                                    onClick={() => {
                                        toast.dismiss(item.id);
                                        item.action?.run();
                                    }}
                                >
                                    {item.action.label}
                                </Button>
                                <IconButton
                                    label="Dismiss"
                                    tooltipSide="top"
                                    onClick={() => toast.dismiss(item.id)}
                                >
                                    <Icon icon={X} />
                                </IconButton>
                            </>
                        ) : null}
                    </output>
                ),
            )}
        </section>
    );
}
