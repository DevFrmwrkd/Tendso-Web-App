"use client";

import { ArrowLeft, Copy } from "lucide-react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button, Icon, Status, cx } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import { PHONE_DISPLAY, SUPPORT_EMAIL } from "@/lib/contact";

import { copyEmail } from "./ContactCard";
import type { Heading } from "./model";
import { hasNavigated, useHelpNav } from "./nav";
import { pushRecent } from "./recent";

/*
 * The interactive bits of an article. The article itself (title, body,
 * related) is server-rendered by app/knowledge/[slug]/page.tsx so crawlers
 * read it; these hydrate around it.
 */

/** The breadcrumb's Back: back through what the reader opened here, or up a level when they landed on this page. */
export function BackButton({ fallbackHref }: { fallbackHref: string }) {
    const router = useRouter();
    const go = useHelpNav();
    return (
        <Button variant="ghost" className="shrink-0 px-2.5" onClick={() => (hasNavigated() ? router.back() : go(fallbackHref))}>
            <Icon icon={ArrowLeft} />
            Back
        </Button>
    );
}

/** Puts the article at the top of the palette's Recent group, however the reader got here. */
export function RecentMark({ slug }: { slug: string }) {
    useEffect(() => {
        pushRecent(slug);
    }, [slug]);
    return null;
}

// How long "Undo" stays offered after Yes. Convex has no way to take a vote
// back, so a Yes is only sent once this window passes (or the reader leaves).
const UNDO_MS = 5000;

/**
 * "Was this article helpful?" → convex knowledge.recordFeedback, the counter
 * the admin side reads. No is sent at once and points to a person; Yes waits
 * out the undo window first.
 */
export function ArticleFeedback({ slug, className }: { slug: string; className?: string }) {
    const record = useMutation(api.knowledge.recordFeedback);
    const [answer, setAnswer] = useState<"yes" | "no" | null>(null);
    const [sent, setSent] = useState(false);
    const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

    const sendPendingYes = useCallback(() => {
        if (!pending.current) return;
        clearTimeout(pending.current);
        pending.current = null;
        void record({ slug, helpful: true });
    }, [record, slug]);

    // Leaving the article, or the page, inside the undo window still counts the Yes.
    useEffect(() => {
        window.addEventListener("pagehide", sendPendingYes);
        return () => {
            window.removeEventListener("pagehide", sendPendingYes);
            sendPendingYes();
        };
    }, [sendPendingYes]);

    const yes = () => {
        setAnswer("yes");
        pending.current = setTimeout(() => {
            pending.current = null;
            setSent(true);
            void record({ slug, helpful: true });
        }, UNDO_MS);
    };
    const undo = () => {
        if (pending.current) clearTimeout(pending.current);
        pending.current = null;
        setAnswer(null);
    };
    const no = () => {
        setAnswer("no");
        void record({ slug, helpful: false });
    };

    return (
        <div
            className={cx(
                "flex max-w-[680px] flex-col items-start gap-3 rounded-r1-card border border-r1-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
                className,
            )}
            aria-live="polite"
        >
            {answer === null && (
                <>
                    <span className="text-sm font-medium text-r1-ink">Was this article helpful?</span>
                    <span className="flex gap-2">
                        <Button onClick={yes}>Yes</Button>
                        <Button onClick={no}>No</Button>
                    </span>
                </>
            )}
            {answer === "yes" && (
                <>
                    <Status tone="done" className="whitespace-normal">
                        Thanks. That helps us keep this article useful.
                    </Status>
                    {!sent && (
                        <Button variant="ghost" onClick={undo}>
                            Undo
                        </Button>
                    )}
                </>
            )}
            {answer === "no" && (
                <>
                    <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-r1-ink">Sorry it didn&apos;t help. A person will answer.</span>
                        <span className="t-meta">
                            Email {SUPPORT_EMAIL} or call <span className="t-num">{PHONE_DISPLAY}</span>.
                        </span>
                    </span>
                    <Button className="shrink-0" onClick={copyEmail}>
                        <Icon icon={Copy} />
                        Copy email
                    </Button>
                </>
            )}
        </div>
    );
}

/** "On this page": jump to a heading; the one being read is marked. */
export function ArticleToc({ headings }: { headings: Heading[] }) {
    const [active, setActive] = useState(headings[0]?.id);
    // A string key, so a parent that rebuilds the array every render does not re-observe.
    const ids = headings.map((h) => h.id).join("\n");

    useEffect(() => {
        const els = ids
            .split("\n")
            .map((id) => document.getElementById(id))
            .filter((el): el is HTMLElement => el !== null);
        if (!els.length) return;
        const obs = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActive(visible[0].target.id);
            },
            // Below the sticky header, in the top third of the screen.
            { rootMargin: "-96px 0px -66% 0px", threshold: 0 },
        );
        els.forEach((el) => obs.observe(el));
        return () => obs.disconnect();
    }, [ids]);

    const jump = (id: string) => {
        const el = document.getElementById(id);
        if (!el) return;
        const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
        setActive(id);
    };

    return (
        <nav className="flex flex-col gap-0.5" aria-label="On this page">
            {headings.map((h) => (
                <a
                    key={h.id}
                    href={`#${h.id}`}
                    aria-current={active === h.id ? "true" : undefined}
                    onClick={(e) => {
                        e.preventDefault();
                        jump(h.id);
                    }}
                    className="flex min-h-10 items-center rounded-r1 px-3 py-1 text-[13px] leading-[18px] text-r1-ink-3 hover:bg-r1-fill hover:text-r1-ink aria-[current=true]:bg-r1-fill-nav aria-[current=true]:font-medium aria-[current=true]:text-r1-ink"
                >
                    {h.text}
                </a>
            ))}
        </nav>
    );
}
