"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Icon, Skeleton } from "@/components/r1";

import { CREATOR_FAQ, CREATOR_FAQ_ITEMS } from "./creatorFaq";
import { HcLink } from "./HcLink";
import { HASH_EVENT, useHash } from "./nav";

export type FaqRow = { id: string; question: string; answer: string; href: string | null };

const TARGETS = new Set(["#faq", "#creator-faq"]);

/**
 * "Frequently asked": a fold, closed by default (board). The knowledge base's
 * FAQs first, each opening its article; then the creator questions that were
 * /help-faq. /help-faq redirects to #creator-faq, so landing on either anchor
 * opens the fold and scrolls to it.
 */
export function FaqFold({ faqs }: { faqs: FaqRow[] | undefined }) {
    const panelId = useId();
    const hash = useHash();
    const targeted = TARGETS.has(hash);
    // null = follow the URL; a click on the fold takes over from there.
    const [manual, setManual] = useState<boolean | null>(null);
    const open = manual ?? targeted;

    // Scroll to the anchor once the fold has opened for it.
    useEffect(() => {
        if (open && targeted) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
    }, [open, targeted, hash]);

    // Being sent to the same anchor again (from the search palette) reopens a fold the reader closed.
    useEffect(() => {
        const reopen = () => {
            const h = window.location.hash;
            if (!TARGETS.has(h)) return;
            setManual(null);
            requestAnimationFrame(() => document.getElementById(h.slice(1))?.scrollIntoView({ block: "start" }));
        };
        window.addEventListener(HASH_EVENT, reopen);
        return () => window.removeEventListener(HASH_EVENT, reopen);
    }, []);

    const count = (faqs?.length ?? 0) + CREATOR_FAQ_ITEMS.length;

    return (
        <section id="faq" className="t-fold scroll-mt-24">
            {/* A heading around the button: the accordion pattern, so the fold shows up in a screen reader's heading list. */}
            <h2>
                <button type="button" className="t-fold-btn" aria-expanded={open} aria-controls={panelId} onClick={() => setManual(!open)}>
                    <span className="inline-flex items-center gap-2">
                        Frequently asked <span className="t-count">{count}</span>
                    </span>
                    <span className="t-fold-chev">
                        <Icon icon={ChevronDown} />
                    </span>
                </button>
            </h2>
            <div id={panelId} hidden={!open} className="pb-4">
                <div className="t-list border-t border-r1-line-3">
                    {faqs === undefined
                        ? Array.from({ length: 3 }, (_, i) => (
                              <div key={i} className="t-row px-0" aria-hidden="true">
                                  <span className="flex flex-1 flex-col gap-1.5">
                                      <Skeleton width="55%" height={12} />
                                      <Skeleton width="80%" height={10} />
                                  </span>
                              </div>
                          ))
                        : faqs.map((f) => <FaqItem key={f.id} row={f} />)}
                </div>

                <div id="creator-faq" className="flex scroll-mt-24 flex-col gap-1 pt-6">
                    <h3 className="t-h2">For creators</h3>
                    {CREATOR_FAQ.map((g) => (
                        <div key={g.id} className="flex flex-col pt-3">
                            <h4 className="t-label pb-1">{g.title}</h4>
                            <div className="t-list border-t border-r1-line-3">
                                {g.items.map((item) => (
                                    <FaqItem key={item.id} row={{ id: item.id, question: item.question, answer: item.answer, href: null }} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function FaqItem({ row }: { row: FaqRow }) {
    const text = (
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-medium leading-5 text-r1-ink">{row.question}</span>
            <span className="t-body">{row.answer}</span>
        </span>
    );
    if (!row.href) return <div className="t-row px-0">{text}</div>;
    return (
        <HcLink href={row.href} className="t-row px-0">
            {text}
            <span className="t-meta shrink-0 max-sm:hidden">Read the article</span>
            <span className="flex shrink-0 text-r1-ink-4">
                <Icon icon={ChevronRight} />
            </span>
        </HcLink>
    );
}
