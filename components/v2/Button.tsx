import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "./cx";

export type ButtonVariant = "primary" | "dark" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

interface Shared {
    /** primary = accent fill with ink text (the one action), dark = ink fill, ghost = hairline outline. */
    variant?: ButtonVariant;
    /** sm 38px, md 46px, lg 52px (hero CTAs). */
    size?: ButtonSize;
    block?: boolean;
    className?: string;
    children: ReactNode;
}

type LinkProps = Shared & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children">;
type NativeProps = Shared & { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export type ButtonProps = LinkProps | NativeProps;

function classes({ variant = "primary", size = "md", block, className }: Shared) {
    return cx("v2-btn", `v2-btn--${variant}`, size !== "md" && `v2-btn--${size}`, block && "v2-btn--block", className);
}

/** Pill button. Renders a link when `href` is given, a <button> otherwise. */
export function Button(props: ButtonProps) {
    if (props.href !== undefined) {
        const { variant, size, block, className, children, href, ...rest } = props;
        const cls = classes({ variant, size, block, className, children });
        const external = /^(https?:)?\/\//.test(href) || href.startsWith("mailto:") || href.startsWith("tel:") || rest.target === "_blank";
        if (external || href.startsWith("#")) {
            return (
                <a href={href} className={cls} {...rest}>
                    {children}
                </a>
            );
        }
        return (
            <Link href={href} className={cls} {...rest}>
                {children}
            </Link>
        );
    }
    const { variant, size, block, className, children, type = "button", ...rest } = props;
    return (
        <button type={type} className={classes({ variant, size, block, className, children })} {...rest}>
            {children}
        </button>
    );
}
