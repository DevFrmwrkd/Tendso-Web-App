"use client";

import { useT } from "./i18n";
import { Eyebrow, SectionHeading, Lead } from "./ui";
import { BASE_PRICE, PRICE_CEILING, formatPHP } from "@/lib/pricing";

/* Plain, literal marks: a camera means photos, a speech bubble means questions.
   They sit small beside the step number to support it, not take over the card. */
const ICONS: Record<string, React.ReactElement> = {
    camera: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="2" y="6" width="20" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 6 L9.5 3 L14.5 3 L16 6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.5" />
        </svg>
    ),
    chat: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 5.5 A2 2 0 0 1 5 3.5 H19 A2 2 0 0 1 21 5.5 V15 A2 2 0 0 1 19 17 H9 L4 21 V17 A2 2 0 0 1 3 15 Z"
                  stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M9.6 8.4 A2.4 2.4 0 1 1 12 11.4 V12.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="12" cy="14.8" r="1" fill="currentColor" />
        </svg>
    ),
    layout: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 8 H21" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6.5 12 H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M6.5 16 H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    ),
    globe: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3.2 9.5 H20.8 M3.2 14.5 H20.8" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 3 C9 6.5 9 17.5 12 21 M12 3 C15 6.5 15 17.5 12 21" stroke="currentColor" strokeWidth="1.5" />
        </svg>
    ),
    /* Creator-side marks: a pin is the shop they picked, a wallet is the payout. */
    pin: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 21 C12 21 19 15 19 10 A7 7 0 1 0 5 10 C5 15 12 21 12 21 Z"
                  stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
    ),
    wallet: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 8 V6.5 A2 2 0 0 1 5 4.5 H16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="3" y="7.5" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M21 12 H17.5 A1.9 1.9 0 0 0 17.5 15.8 H21" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
    ),
};

/**
 * Who this section is talking to.
 *
 *   "business" → `process.*`         — the shop owner.   Rendered on `/`.
 *   "creator"  → `process.creator.*` — the creator.      Rendered on `/for-creators`.
 *
 * Both audiences get the same shell (four steps, a chip row, one stat) because
 * the shape of the story is the same — but every "you" flips. The owner keeps
 * working while we build; the creator IS the one who shows up with the camera.
 * The two key blocks are deliberately separate in i18n.tsx: rewording one page's
 * copy must never silently reword the other's.
 */
type ProcessVariant = "business" | "creator";

const ICON_ORDER: Record<ProcessVariant, string[]> = {
    business: ["camera", "chat", "layout", "globe"],
    creator: ["pin", "camera", "layout", "wallet"],
};

/** How many `kit*` chips each variant defines. Keep in sync with i18n.tsx. */
const KIT_COUNT: Record<ProcessVariant, number> = { business: 7, creator: 6 };

export default function ProcessSection({ variant = "business" }: { variant?: ProcessVariant } = {}) {
    const { t } = useT();

    const prefix = variant === "creator" ? "process.creator." : "process.";

    /* Money in the copy is a placeholder, never a literal — same rule as
       CreatorTeaserSection. Change lib/pricing.ts and this follows. */
    const money = (s: string) =>
        s.replace("{b}", formatPHP(BASE_PRICE)).replace("{c}", formatPHP(PRICE_CEILING));

    const icons = ICON_ORDER[variant];
    const steps = [1, 2, 3, 4].map((n, i) => ({
        k: `0${n}`,
        icon: icons[i],
        h: t(`${prefix}s${n}h`),
        cost: t(`${prefix}s${n}cost`),
        sub: money(t(`${prefix}s${n}sub`)),
    }));

    const kit = Array.from({ length: KIT_COUNT[variant] }, (_, i) =>
        money(t(`${prefix}kit${i + 1}`)),
    );

    /* The owner's headline number is turnaround; the creator's is their share.
       A share, not a peso amount: what a creator earns depends on the price
       they sell at, and quoting one figure reads as a promise of it. */
    const stat =
        variant === "creator"
            ? { big: "50%", label: t("process.creator.statLabel") }
            : { big: "48–72h", label: t("process.turnaroundLabel") };

    return (
        <section id="how-it-works" className="bg-khaki-deep">
            <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
                <div className="mx-auto max-w-2xl text-center">
                    <Eyebrow>{t(`${prefix}eyebrow`)}</Eyebrow>
                    <SectionHeading className="mt-4">
                        {t(`${prefix}titleA`)}{" "}
                        <span className="italic" style={{ color: "var(--rust)", fontWeight: 560 }}>
                            {t(`${prefix}titleB`)}
                        </span>
                    </SectionHeading>
                    <Lead className="mx-auto mt-5 max-w-xl">{t(`${prefix}lede`)}</Lead>
                </div>

                <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" role="list">
                    {steps.map((s) => (
                        <li key={s.k} className="rounded-2xl border border-ink/10 bg-khaki p-6">
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <span className="inline-flex text-ink-soft [&_svg]:h-5 [&_svg]:w-5">{ICONS[s.icon]}</span>
                                    <span className="font-mono text-xs text-rust">{s.k}</span>
                                </span>
                                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                                    {s.cost}
                                </span>
                            </div>
                            <h3 className="mt-4 font-sans text-[17px] font-semibold leading-snug text-ink">{s.h}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.sub}</p>
                        </li>
                    ))}
                </ol>

                {/* What you get / what you keep + the headline number */}
                <div className="mt-8 flex flex-col gap-6 rounded-2xl border border-ink/10 bg-khaki p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                    <div>
                        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                            {t(`${prefix}kitLabel`)}
                        </span>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {kit.map((tag) => (
                                <span
                                    key={tag}
                                    className="rounded-full border border-ink/10 bg-khaki-deep px-3 py-1 text-sm text-ink"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="flex-shrink-0 border-t border-ink/10 pt-4 text-center sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0 sm:text-right">
                        <div className="font-fraunces text-3xl text-ink" style={{ fontWeight: 560, fontOpticalSizing: "auto" }}>
                            {stat.big}
                        </div>
                        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                            {stat.label}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
