"use client";

import { Copy } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button, Icon, cx } from "@/components/r1";
import { DISCORD_INVITE_URL, SUPPORT_EMAIL } from "@/lib/contact";

import { HASH_EVENT } from "./nav";

/*
 * "Ask a person": how to reach a human. This card is what /contact became
 * (that route now redirects to /knowledge#contact), so it keeps what the old
 * page offered: the support inbox as a mailto link, answered within a day,
 * and the note that press and partnerships use the same inbox.
 */

const DISCORD_DISPLAY = DISCORD_INVITE_URL.replace(/^https?:\/\//, "");

export async function copyText(text: string, done: string): Promise<void> {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(done);
    } catch {
        // Clipboard blocked (an insecure context, a denied permission): say it instead.
        toast(text);
    }
}

export function copyEmail(): void {
    void copyText(SUPPORT_EMAIL, "Email address copied");
}

const CHANNELS = [
    { key: "email", label: "Email", value: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}`, copy: SUPPORT_EMAIL, copied: "Email address copied", copyLabel: "Copy email address" },
    { key: "discord", label: "Discord", value: DISCORD_DISPLAY, href: DISCORD_INVITE_URL, copy: DISCORD_INVITE_URL, copied: "Discord invite copied", copyLabel: "Copy Discord invite" },
] as const;

/** Email and Discord, each with Copy. Also the AI answer's way out when it cannot answer. */
export function ContactRows({ className }: { className?: string }) {
    return (
        <div className={cx("flex flex-col", className)}>
            {CHANNELS.map((c) => (
                <div key={c.key} className="flex min-h-14 items-center gap-3 border-t border-r1-line-3 first:border-t-0">
                    <span className="t-label w-16 shrink-0">{c.label}</span>
                    <a
                        href={c.href}
                        className="min-w-0 flex-1 truncate text-sm leading-5 text-r1-ink hover:underline"
                        {...(c.key === "discord" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    >
                        {c.value}
                    </a>
                    <Button variant="ghost" className="shrink-0 px-2.5 text-[13px]" aria-label={c.copyLabel} onClick={() => void copyText(c.copy, c.copied)}>
                        <Icon icon={Copy} />
                        <span className="max-sm:sr-only">Copy</span>
                    </Button>
                </div>
            ))}
        </div>
    );
}

/** The "Ask a person" card on the Help Center home. Anchor: #contact. */
export function ContactCard({ className }: { className?: string }) {
    const ref = useRef<HTMLElement>(null);

    // /contact lands here as /knowledge#contact. A full page load scrolls on
    // its own; a jump from inside the Help Center (pushState) does not.
    useEffect(() => {
        const reveal = () => {
            if (window.location.hash === "#contact") ref.current?.scrollIntoView({ block: "start" });
        };
        reveal();
        window.addEventListener(HASH_EVENT, reveal);
        window.addEventListener("hashchange", reveal);
        return () => {
            window.removeEventListener(HASH_EVENT, reveal);
            window.removeEventListener("hashchange", reveal);
        };
    }, []);

    return (
        <aside
            ref={ref}
            id="contact"
            aria-labelledby="hc-contact-h"
            className={cx("t-card t-card-pad flex scroll-mt-24 flex-col gap-1", className)}
        >
            <h2 id="hc-contact-h" className="t-h2">
                Ask a person
            </h2>
            <p className="t-meta pb-3">We answer every email, usually within 24 hours. Press and partnerships use the same inbox.</p>
            <ContactRows className="border-t border-r1-line-3" />
            <p className="t-meta border-t border-r1-line-3 pt-3">
                Need a change to your live site? Edits are free for the first year. Email us what to change and we make it.
            </p>
        </aside>
    );
}
