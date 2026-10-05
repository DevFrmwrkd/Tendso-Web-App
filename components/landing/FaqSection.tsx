"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Fold, Folds, cx } from "@/components/r1";
import { SUPPORT_EMAIL } from "@/lib/contact";

import { fill } from "./copy";
import { useT } from "./i18n";
import { LANDING_BAND, LANDING_WRAP, SectionHead } from "./layout";

export type FaqItem = { q: string; a: ReactNode };

/**
 * Questions as the kit's folds, all closed until opened. The answers are in
 * the page (hidden, not missing), so they are there for search and for
 * find-in-page. A question that wraps to two lines on a phone grows its row
 * instead of overflowing the kit's 52px.
 */
export function FaqList({ items, className }: { items: FaqItem[]; className?: string }) {
    return (
        <Folds className={className}>
            {items.map((item) => (
                <Fold
                    key={item.q}
                    title={<span className="text-[15px] leading-5">{item.q}</span>}
                    className="[&_.t-fold-btn]:h-auto [&_.t-fold-btn]:min-h-[52px] [&_.t-fold-btn]:py-3.5"
                >
                    <p className="t-body pb-1 leading-[22px] sm:pr-12">{item.a}</p>
                </Fold>
            ))}
        </Folds>
    );
}

/**
 * The owner's questions (board: Landing, #faq). Five, from the owner FAQ that
 * was here before; the price question went, because the price card answers it
 * a scroll above, and "update it later" now points at the Help Center, where
 * the contact card lives.
 */
export default function FaqSection() {
    const { t } = useT();
    const items: FaqItem[] = [1, 2, 3, 4, 5].map((n) => ({
        q: t(`r1.landing.faq.q${n}`),
        a: fill(t(`r1.landing.faq.a${n}`), {
            help: (
                <Link href="/knowledge" className="t-link">
                    {t("r1.landing.faq.helpCenter")}
                </Link>
            ),
        }),
    }));

    return (
        <section id="faq" aria-labelledby="faq-title" className={LANDING_BAND}>
            <div
                className={cx(
                    LANDING_WRAP,
                    "grid gap-8 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,720px)] lg:items-start lg:gap-16 lg:py-20 xl:gap-24",
                )}
            >
                <SectionHead
                    id="faq-title"
                    title={t("r1.landing.faq.title")}
                    sub={fill(t("r1.landing.faq.sub"), {
                        email: (
                            <a href={`mailto:${SUPPORT_EMAIL}`} className="t-link [overflow-wrap:anywhere]">
                                {SUPPORT_EMAIL}
                            </a>
                        ),
                    })}
                />
                {/* The board reserves the list's height on a desk, so opening an
                    answer does not shove the closing band down the page. */}
                <div className="lg:min-h-[350px]">
                    <FaqList items={items} />
                </div>
            </div>
        </section>
    );
}
