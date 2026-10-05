"use client";

import Link from "next/link";
import { useT } from "./i18n";
import { Eyebrow, SectionHeading, Lead } from "./ui";
import { BASE_PRICE, REFERRAL_BONUS, commissionFor, formatPHP } from "@/lib/pricing";

/**
 * Creator earnings teaser — the honest replacement for the old EarningsSection
 * (which carried fake testimonials + invented weekly/monthly income figures).
 * Every number here is model-backed and derived from lib/pricing.ts: 50%
 * commission (₱500 on a ₱999 site), a ₱1,000 referral bonus, and Wise payouts.
 * The landing advertises the ₱999 base price, so the teaser stays anchored to
 * it; the price-ceiling progression (up to ₱2,500) lives on /for-creators.
 * No projections, no testimonials.
 *
 * /for-creators passes its own `facts`: that page states the website price, the
 * lowest a creator may discount it to, and their half, and quotes no peso
 * earnings. The homepage keeps the three below.
 */
export type CreatorFact = { big: string; label: string; sub: string };

export default function CreatorTeaserSection({
    ctaHref = "/for-creators",
    note,
    facts: factsOverride,
    id,
}: {
    ctaHref?: string;
    /** A line under the cards. Omitted on the homepage. */
    note?: string;
    /** Replaces the three default cards. */
    facts?: CreatorFact[];
    id?: string;
} = {}) {
    const { t } = useT();

    // Numbers interpolated from the pricing source of truth (never hardcoded here).
    const f1sub = t("earn.f1sub")
        .replace("{a}", formatPHP(commissionFor(BASE_PRICE)))
        .replace("{b}", formatPHP(BASE_PRICE));

    const facts: CreatorFact[] = factsOverride ?? [
        { big: "50%", label: t("earn.f1label"), sub: f1sub },
        { big: formatPHP(REFERRAL_BONUS), label: t("earn.f2label"), sub: t("earn.f2sub") },
        { big: "Wise", label: t("earn.f3label"), sub: t("earn.f3sub") },
    ];

    return (
        <section id={id} className="bg-khaki">
            <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
                <div className="mx-auto max-w-2xl text-center">
                    <Eyebrow>{t("earn.eyebrow")}</Eyebrow>
                    <SectionHeading className="mt-4">
                        {t("earn.titleA")}{" "}
                        <span className="italic" style={{ color: "var(--rust)", fontWeight: 560 }}>
                            {t("earn.titleB")}
                        </span>
                    </SectionHeading>
                    <Lead className="mx-auto mt-5 max-w-xl">{t("earn.lede")}</Lead>
                </div>

                <div className="mx-auto mt-12 grid max-w-4xl gap-5 sm:grid-cols-3">
                    {facts.map((f) => (
                        <div key={f.label} className="rounded-2xl border border-ink/10 bg-khaki-deep p-6">
                            <div className="font-fraunces text-4xl text-ink" style={{ fontWeight: 560, fontOpticalSizing: "auto" }}>
                                {f.big}
                            </div>
                            <div className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                                {f.label}
                            </div>
                            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{f.sub}</p>
                        </div>
                    ))}
                </div>

                {note && (
                    <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-ink-soft">
                        {note}
                    </p>
                )}

                <div className="mt-9 text-center">
                    <Link
                        href={ctaHref}
                        className="inline-flex items-center gap-2 rounded-lg bg-ink px-6 py-3.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
                    >
                        {t("earn.cta")}
                        <span aria-hidden>→</span>
                    </Link>
                </div>
            </div>
        </section>
    );
}
