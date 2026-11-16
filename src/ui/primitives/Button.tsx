import type { ComponentProps } from "react";
import { cx } from "./cx.js";

export interface ButtonProps extends ComponentProps<"button"> {
    /** `primary` is the accent-filled action of a dialog; `danger` a destructive confirm. */
    variant?: "default" | "primary" | "danger";
}

/** Text button, 24 px high (DESIGN §3.3). */
export function Button({
    variant = "default",
    className,
    type = "button",
    ...rest
}: Readonly<ButtonProps>) {
    return (
        <button
            type={type}
            className={cx("ui-button", variant !== "default" && `ui-button--${variant}`, className)}
            {...rest}
        />
    );
}
