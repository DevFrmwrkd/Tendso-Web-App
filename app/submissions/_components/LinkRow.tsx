"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Copy } from "lucide-react";
import type { MouseEvent } from "react";
import { toast } from "sonner";

import { Button, Icon, cx } from "@/components/r1";

/**
 * Copy text to the clipboard. Falls back to a hidden textarea where the async
 * clipboard is missing or refused (older phone browsers, a plain-http
 * preview). The textarea goes inside the open dialog: everything outside a
 * modal dialog is inert, and an inert field cannot be selected.
 */
export async function copyText(text: string, from: HTMLElement): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // Refused (no permission, not a secure context): try the old way.
    }
    try {
        const field = document.createElement("textarea");
        field.value = text;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.top = "0";
        field.style.opacity = "0";
        (from.closest("dialog") ?? document.body).appendChild(field);
        field.select();
        const ok = document.execCommand("copy");
        field.remove();
        from.focus();
        return ok;
    } catch {
        return false;
    }
}

/**
 * A link in a box with its Copy button beside it (board: `.sb-linkrow`): the
 * owner's pay link, the live site. With `href` the box opens the link in a new
 * tab; without, it is only there to be read.
 */
export function LinkRow({
    icon,
    text,
    href,
    value,
    copyLabel,
    copiedMessage,
}: {
    icon: LucideIcon;
    /** What the box shows, usually the address without https://. */
    text: string;
    href?: string;
    /** What Copy puts on the clipboard. */
    value: string;
    copyLabel: string;
    copiedMessage: string;
}) {
    const onCopy = async (e: MouseEvent<HTMLButtonElement>) => {
        const button = e.currentTarget;
        if (await copyText(value, button)) {
            toast.success(copiedMessage, { action: { label: "Dismiss", onClick: () => {} } });
        } else {
            toast.error("Couldn't copy the link. Select it and copy it yourself.");
        }
    };

    const box =
        "flex h-10 min-w-0 flex-1 items-center gap-2 rounded-r1 border border-r1-line-2 bg-r1-paper px-3 text-[13px] leading-[18px] text-r1-ink-2";
    const inner = (
        <>
            <Icon icon={icon} className="flex-none text-r1-ink-3" />
            <span className="min-w-0 truncate">{text}</span>
        </>
    );

    return (
        <div className="flex items-center gap-2">
            {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className={cx(box, "no-underline hover:bg-r1-fill-row")}>
                    {inner}
                    <Icon icon={ArrowUpRight} className="ml-auto flex-none text-r1-ink-3" />
                    <span className="sr-only">(opens in a new tab)</span>
                </a>
            ) : (
                <span className={box}>{inner}</span>
            )}
            <Button onClick={onCopy}>
                <Icon icon={Copy} />
                {copyLabel}
            </Button>
        </div>
    );
}
