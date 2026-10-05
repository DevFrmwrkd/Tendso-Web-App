import Link from "next/link";
import type { ComponentPropsWithRef } from "react";

import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type Look = {
    /** One primary (black) button per view. Destructive actions live in a More menu or a drawer footer. */
    variant?: ButtonVariant;
    /** sm (32) inside rows and drawer heads, md (40) everywhere, lg (48) for the main action on public pages. */
    size?: ButtonSize;
    /** Icon-only: square, and it MUST carry an aria-label. */
    icon?: boolean;
    block?: boolean;
};

/** The class string for a button look, for the rare element that is neither <Button> nor <ButtonLink>. */
export function buttonClass({ variant = "secondary", size = "md", icon = false, block = false }: Look = {}): string {
    return cx(
        "t-btn",
        variant === "primary" && "t-btn-primary",
        variant === "ghost" && "t-btn-ghost",
        variant === "danger" && "t-btn-danger",
        size === "sm" && "t-btn-sm",
        size === "lg" && "t-btn-lg",
        icon && "t-btn-icon",
        block && "t-btn-block",
    );
}

export function Button({ variant, size, icon, block, className, type = "button", ...rest }: ComponentPropsWithRef<"button"> & Look) {
    return <button type={type} className={cx(buttonClass({ variant, size, icon, block }), className)} {...rest} />;
}

/**
 * A link that looks like a button. Routes inside the app go through next/link;
 * anything else (a store, a mailto:, a customer site) is a plain anchor.
 */
export function ButtonLink({
    variant,
    size,
    icon,
    block,
    className,
    href,
    ...rest
}: Omit<ComponentPropsWithRef<"a">, "href"> & Look & { href: string }) {
    const cls = cx(buttonClass({ variant, size, icon, block }), className);
    if (href.startsWith("/") && !href.startsWith("//")) {
        return <Link href={href} className={cls} {...rest} />;
    }
    return <a href={href} className={cls} {...rest} />;
}
