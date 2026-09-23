"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { campaignFromLocation, rememberCampaign } from "@/lib/campaign";
import {
    BASE_PRICE,
    CUSTOM_DOMAIN_ADDON,
    campaignSellPrice,
    formatPHP,
} from "@/lib/pricing";

/**
 * Where an Off The Record viewer lands after scanning the QR code.
 *
 * BUILT FOR ONE MOMENT: a phone, on mobile data, held up to a television, by
 * someone who has just heard about Tendso for the first time and will give it
 * about five seconds. So the offer and the two buttons are above everything
 * else, there is no hero image to wait for, and nothing here blocks the first
 * paint on a network round-trip.
 *
 * THE DISCOUNT IS NEVER TYPED. Landing here stores the campaign for thirty days
 * and the buttons carry it in their links, so the form quotes the lower price on
 * its own. The code is printed small for the one case that breaks: a different
 * phone, or site data cleared between watching and deciding.
 *
 * THE PRICE HERE IS A PROMISE, NOT A CALCULATION. Everything shown comes from
 * lib/pricing, and the server re-derives the real amount at submit from the
 * campaign name alone — see convex/ownerIntake.ts. Nothing a visitor can edit
 * reaches the bill.
 *
 * THE QR CODE IS ALREADY PRINTED. It points at this path with no query, so a
 * scan arrives with no source at all; that is recorded as `qr` rather than lost.
 * The tagged links (?src=description, comment, shorts) are the ones we can still
 * change, and they keep working.
 */

const CAMPAIGN = "otr";
const FALLBACK_CODE = "OTR30";
/** A scan carries no query of its own, so this is what an untagged visit is. */
const DEFAULT_SOURCE = "qr";

const websitePrice = campaignSellPrice(CAMPAIGN);
const domainPrice = websitePrice + CUSTOM_DOMAIN_ADDON;

/**
 * Photos from the shoot, added after Thursday.
 *
 * Empty hides the whole section rather than showing an empty frame: a proof
 * section with nothing in it is worse than no proof section.
 */
const PROOF: Array<{ src: string; alt: string; caption: string }> = [];

export default function OtrPage() {
    // Stamped on mount rather than during render: it touches storage and the
    // URL, and it must happen even for someone who never taps a button.
    const [source, setSource] = useState<string>(DEFAULT_SOURCE);
    useEffect(() => {
        const found = campaignFromLocation();
        const tag = found.source ?? DEFAULT_SOURCE;
        // The URL and localStorage do not exist while rendering, and the tag has
        // to reach the links below, so this is a state write from an effect on
        // purpose. It runs once and settles before anyone can tap anything.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSource(tag);
        rememberCampaign(CAMPAIGN, tag);
    }, []);

    // Both optional and both hidden when unset, so neither blocks the page going
    // live. Set them in the admin settings once the accounts exist.
    const chatUrl = useQuery(api.settings.get, { key: "otr_chat_url" }) as string | null | undefined;
    const logoUrl = useQuery(api.settings.get, { key: "otr_logo_url" }) as string | null | undefined;

    const withSource = (path: string) => `${path}?campaign=${CAMPAIGN}&src=${encodeURIComponent(source)}`;

    return (
        <main className="min-h-dvh bg-khaki text-ink">
            <div className="mx-auto w-full max-w-lg px-5 pb-16 pt-8">
                <header className="flex items-center gap-3">
                    <Image src="/tendso-logo.png" alt="Tendso" width={104} height={28} priority className="h-7 w-auto" />
                    <span aria-hidden className="h-5 w-px bg-ink/15" />
                    {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoUrl} alt="Off The Record" className="h-7 w-auto" />
                    ) : (
                        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
                            Off The Record
                        </span>
                    )}
                </header>

                <section className="pt-9">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">
                        For OTR viewers
                    </p>
                    <h1 className="mt-3 text-[2rem] font-extrabold leading-[1.1] tracking-tight text-balance">
                        Your business gets a real website for{" "}
                        <span className="text-rust-soft">30% off</span>.
                    </h1>

                    {/* The number they came for, and the number it used to be.
                        Said once, where the eye lands, not repeated below. */}
                    <p className="mt-5 flex items-baseline gap-3">
                        <span className="text-4xl font-extrabold tabular-nums">{formatPHP(websitePrice)}</span>
                        <span className="text-lg text-ink-soft line-through tabular-nums">{formatPHP(BASE_PRICE)}</span>
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                        Paid once, after your website is live. No monthly fees. Your discount is already
                        applied — nothing to type.
                    </p>

                    <div className="mt-7 flex flex-col gap-3">
                        <Link
                            href={withSource("/start")}
                            className="rounded-xl bg-ink px-5 py-4 text-center text-base font-bold text-khaki transition-colors hover:bg-ink-soft"
                        >
                            Get my website — {formatPHP(websitePrice)}
                        </Link>
                        <Link
                            href={withSource("/for-field-agents")}
                            className="rounded-xl border border-ink/15 bg-white px-5 py-4 text-center text-base font-bold text-ink transition-colors hover:border-ink/40"
                        >
                            Earn with my smartphone
                        </Link>
                    </div>

                    <p className="mt-3 text-xs text-ink-soft">
                        Discount code {FALLBACK_CODE}, if you ever need to enter it by hand.
                    </p>
                </section>

                <section className="mt-10 rounded-2xl border border-ink/10 bg-white p-5">
                    <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                        What you pay
                    </h2>
                    <dl className="mt-4 space-y-3 text-sm">
                        <div className="flex items-baseline justify-between gap-4">
                            <dt className="font-semibold">Your website</dt>
                            <dd className="tabular-nums">
                                <span className="font-bold">{formatPHP(websitePrice)}</span>{" "}
                                <span className="text-ink-soft line-through">{formatPHP(BASE_PRICE)}</span>
                            </dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-4">
                            <dt className="text-ink-soft">
                                With your own .com
                                <span className="block text-xs">The domain is bought at cost, so the discount does not apply to it.</span>
                            </dt>
                            <dd className="whitespace-nowrap font-semibold tabular-nums">{formatPHP(domainPrice)}</dd>
                        </div>
                    </dl>
                    <p className="mt-4 text-xs leading-relaxed text-ink-soft">
                        A domain is from {formatPHP(CUSTOM_DOMAIN_ADDON)} and we pay the first year. After
                        that it renews at around ₱1,120 a year and stays yours to renew or drop. The website
                        itself never renews.
                    </p>
                </section>

                {PROOF.length > 0 && (
                    <section className="mt-10">
                        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                            Shops already on Tendso
                        </h2>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            {PROOF.map((photo) => (
                                <figure key={photo.src} className="overflow-hidden rounded-xl border border-ink/10 bg-white">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={photo.src} alt={photo.alt} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                                    <figcaption className="px-3 py-2 text-xs text-ink-soft">{photo.caption}</figcaption>
                                </figure>
                            ))}
                        </div>
                    </section>
                )}

                <section className="mt-10 space-y-3">
                    <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                        How it works
                    </h2>
                    <ol className="space-y-2 text-sm leading-relaxed text-ink-soft">
                        <li>1. Tell us about your shop and send a few photos. About ten minutes, on your phone.</li>
                        <li>2. We build your website and email it to you within 48 to 72 hours.</li>
                        <li>3. You pay {formatPHP(websitePrice)} only after you have seen it live.</li>
                    </ol>
                </section>

                {chatUrl && (
                    <a
                        href={chatUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-10 flex items-center justify-center rounded-xl border border-ink/15 bg-white px-5 py-4 text-center text-sm font-semibold text-ink"
                    >
                        Message us — we answer in Tagalog
                    </a>
                )}

                <p className="mt-10 text-xs text-ink-soft">
                    Tendso builds websites for Philippine small businesses.{" "}
                    <Link href="/" className="underline">
                        See more
                    </Link>
                </p>
            </div>
        </main>
    );
}
