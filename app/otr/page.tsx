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
 * BUILT FOR ONE MOMENT FIRST: a phone, on mobile data, held up to a television,
 * by someone who has just heard about Tendso and will give it about five
 * seconds. So the offer and the two buttons come before everything else, there
 * is no hero image to wait for, and nothing blocks the first paint on a network
 * round-trip. The desk layout is the same page in two columns, not a different
 * one — the offer stays on the left where reading starts, and what you pay moves
 * up beside it instead of below the fold.
 *
 * THE DISCOUNT IS NEVER TYPED. Landing here stores the campaign for thirty days
 * and the Get-my-website link carries it, so the form quotes the lower price on
 * its own. The code is printed small for the one case that breaks: a different
 * phone, or site data cleared between watching and deciding.
 *
 * THE EARN BUTTON GOES TO THE APP, not to a web signup. Earning happens in the
 * Tendso app and the web signup is being retired, so sending a viewer to a form
 * they should not be filling in is a dead end dressed as a next step. On a phone
 * it opens that phone's store directly; on a desktop, where neither store can be
 * installed from, it opens the explainer page instead.
 *
 * IT CARRIES NO CAMPAIGN EITHER, only its source. A field agent buys nothing, so
 * a discount cannot apply to them and a link implying one would be a promise
 * with nothing behind it. Anyone who came for the offer and then decides they
 * want a website too still gets the thirty percent: the campaign was remembered
 * when they landed, not when they clicked.
 *
 * ATTRIBUTION STOPS AT THE STORE on iOS. Android carries the source into the
 * install through Play's referrer, but an App Store link cannot without a
 * configured campaign, so an iPhone signup arrives untagged unless the app reads
 * it some other way.
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

type Platform = "android" | "ios" | "other";

/** Which store this phone can actually install from. */
function detectPlatform(): Platform {
    if (typeof navigator === "undefined") return "other";
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return "android";
    // iPadOS reports as a Mac, which is why the touch check is here as well.
    if (/iphone|ipad|ipod/i.test(ua)) return "ios";
    if (/macintosh/i.test(ua) && typeof document !== "undefined" && "ontouchend" in document) return "ios";
    return "other";
}

/**
 * Play carries a referrer through the install, so an Android signup can be
 * traced back to the placement that produced it. Left alone for anything else:
 * an App Store link cannot take one without a configured campaign, and adding a
 * parameter a store ignores only makes the link look untrustworthy.
 */
function withPlayReferrer(url: string, source: string): string {
    try {
        const parsed = new URL(url);
        if (!parsed.hostname.endsWith("play.google.com")) return url;
        parsed.searchParams.set("referrer", `utm_source=otr&utm_medium=${source}`);
        return parsed.toString();
    } catch {
        return url;
    }
}

const STEPS = [
    "Tell us about your shop and send a few photos. About ten minutes, on your phone.",
    "We build your website and email it to you within 48 to 72 hours.",
    `You pay ${formatPHP(websitePrice)} only after you have seen it live.`,
];

export default function OtrPage() {
    const [source, setSource] = useState<string>(DEFAULT_SOURCE);
    const [platform, setPlatform] = useState<Platform>("other");
    useEffect(() => {
        const found = campaignFromLocation();
        const tag = found.source ?? DEFAULT_SOURCE;
        // The URL, the user agent and localStorage do not exist while rendering,
        // and all three have to reach the links below, so these are state writes
        // from an effect on purpose. They run once, before anyone can tap.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSource(tag);
        setPlatform(detectPlatform());
        rememberCampaign(CAMPAIGN, tag);
    }, []);

    // Both optional and both hidden when unset, so neither blocks the page going
    // live. Set them in the admin settings once the accounts exist.
    const chatUrl = useQuery(api.settings.get, { key: "otr_chat_url" }) as string | null | undefined;
    const logoUrl = useQuery(api.settings.get, { key: "otr_logo_url" }) as string | null | undefined;
    const playUrl = useQuery(api.settings.get, { key: "play_store_url" }) as string | null | undefined;
    const iosUrl = useQuery(api.settings.get, { key: "app_store_url" }) as string | null | undefined;

    const tag = `src=${encodeURIComponent(source)}`;
    const buyHref = `/start?campaign=${CAMPAIGN}&${tag}`;
    // The store this phone can install from, or the explainer page when we are
    // on a desktop or the link for this platform has not been set.
    const storeUrl =
        platform === "android"
            ? playUrl
                ? withPlayReferrer(playUrl, source)
                : null
            : platform === "ios"
              ? iosUrl ?? null
              : null;
    const earnHref = storeUrl ?? `/for-field-agents?${tag}`;
    const earnIsStore = storeUrl !== null;

    return (
        <main className="min-h-dvh bg-khaki text-ink">
            <div className="mx-auto w-full max-w-lg px-5 pb-16 pt-8 lg:max-w-6xl lg:px-10 lg:pb-24 lg:pt-14">
                <header className="flex items-center gap-3">
                    <Image
                        src="/tendso-logo.png"
                        alt="Tendso"
                        width={104}
                        height={28}
                        priority
                        className="h-7 w-auto lg:h-8"
                    />
                    <span aria-hidden className="h-5 w-px bg-ink/15" />
                    {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoUrl} alt="Off The Record" className="h-7 w-auto lg:h-8" />
                    ) : (
                        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
                            Off The Record
                        </span>
                    )}
                </header>

                {/* One column on a phone, two on a desk. The offer keeps the left
                    where reading starts; the money detail moves up beside it
                    rather than sitting a scroll below. */}
                <div className="lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start lg:gap-16 lg:pt-6">
                    <section className="pt-9 lg:pt-0">
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">
                            For OTR viewers
                        </p>
                        <h1 className="mt-3 text-[2rem] font-extrabold leading-[1.1] tracking-tight text-balance lg:mt-4 lg:text-[3.25rem]">
                            Your business gets a real website for{" "}
                            <span className="text-rust-soft">30% off</span>.
                        </h1>

                        {/* The number they came for, and the number it used to
                            be. Said once, where the eye lands. */}
                        <p className="mt-5 flex items-baseline gap-3 lg:mt-7">
                            <span className="text-4xl font-extrabold tabular-nums lg:text-6xl">
                                {formatPHP(websitePrice)}
                            </span>
                            <span className="text-lg text-ink-soft line-through tabular-nums lg:text-2xl">
                                {formatPHP(BASE_PRICE)}
                            </span>
                        </p>
                        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft lg:mt-3 lg:text-base">
                            Paid once, after your website is live. No monthly fees. Your discount is
                            already applied — nothing to type.
                        </p>

                        <div className="mt-7 flex flex-col gap-3 lg:mt-9 lg:flex-row lg:gap-4">
                            <Link
                                href={buyHref}
                                className="rounded-xl bg-ink px-5 py-4 text-center text-base font-bold text-khaki transition-colors hover:bg-ink-soft lg:px-7 lg:py-5 lg:text-lg"
                            >
                                Get my website — {formatPHP(websitePrice)}
                            </Link>
                            {/* An external store link is a plain anchor: Link is
                                for routes inside the app, and prefetching a URL
                                that leaves it does nothing but noise. */}
                            {earnIsStore ? (
                                <a
                                    href={earnHref}
                                    rel="noopener"
                                    className="rounded-xl border border-ink/15 bg-white px-5 py-4 text-center text-base font-bold text-ink transition-colors hover:border-ink/40 lg:px-7 lg:py-5 lg:text-lg"
                                >
                                    Earn with my smartphone
                                </a>
                            ) : (
                                <Link
                                    href={earnHref}
                                    className="rounded-xl border border-ink/15 bg-white px-5 py-4 text-center text-base font-bold text-ink transition-colors hover:border-ink/40 lg:px-7 lg:py-5 lg:text-lg"
                                >
                                    Earn with my smartphone
                                </Link>
                            )}
                        </div>

                        <p className="mt-3 text-xs text-ink-soft lg:mt-4 lg:text-sm">
                            Discount code {FALLBACK_CODE}, if you ever need to enter it by hand. It
                            applies to the website. Earning is free to join and happens in the
                            Tendso app.
                        </p>

                        {chatUrl && (
                            <a
                                href={chatUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-6 inline-flex rounded-xl border border-ink/15 bg-white px-5 py-3 text-sm font-semibold text-ink hover:border-ink/40"
                            >
                                Message us — we answer in Tagalog
                            </a>
                        )}

                        <section className="mt-10 space-y-3 lg:mt-12">
                            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                                How it works
                            </h2>
                            <ol className="max-w-prose space-y-2 text-sm leading-relaxed text-ink-soft lg:text-base">
                                {STEPS.map((step, index) => (
                                    <li key={step}>
                                        {index + 1}. {step}
                                    </li>
                                ))}
                            </ol>
                        </section>
                    </section>

                    <div className="lg:sticky lg:top-10">
                        <section className="mt-10 rounded-2xl border border-ink/10 bg-white p-5 lg:mt-0 lg:p-7">
                            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                                What you pay
                            </h2>
                            <dl className="mt-4 space-y-3 text-sm lg:mt-5 lg:space-y-4 lg:text-base">
                                <div className="flex items-baseline justify-between gap-4">
                                    <dt className="font-semibold">Your website</dt>
                                    <dd className="whitespace-nowrap tabular-nums">
                                        <span className="font-bold">{formatPHP(websitePrice)}</span>{" "}
                                        <span className="text-ink-soft line-through">
                                            {formatPHP(BASE_PRICE)}
                                        </span>
                                    </dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-4">
                                    <dt className="text-ink-soft">
                                        With your own .com
                                        <span className="block text-xs lg:text-sm">
                                            The domain is bought at cost, so the discount does not
                                            apply to it.
                                        </span>
                                    </dt>
                                    <dd className="whitespace-nowrap font-semibold tabular-nums">
                                        {formatPHP(domainPrice)}
                                    </dd>
                                </div>
                            </dl>
                            <p className="mt-4 text-xs leading-relaxed text-ink-soft lg:mt-5 lg:text-sm">
                                A domain is from {formatPHP(CUSTOM_DOMAIN_ADDON)} and we pay the
                                first year. After that it renews at around ₱1,120 a year and stays
                                yours to renew or drop. The website itself never renews.
                            </p>
                        </section>

                        {PROOF.length > 0 && (
                            <section className="mt-10 lg:mt-8">
                                <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                                    Shops already on Tendso
                                </h2>
                                <div className="mt-4 grid grid-cols-2 gap-3">
                                    {PROOF.map((photo) => (
                                        <figure
                                            key={photo.src}
                                            className="overflow-hidden rounded-xl border border-ink/10 bg-white"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={photo.src}
                                                alt={photo.alt}
                                                loading="lazy"
                                                className="aspect-[4/3] w-full object-cover"
                                            />
                                            <figcaption className="px-3 py-2 text-xs text-ink-soft">
                                                {photo.caption}
                                            </figcaption>
                                        </figure>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                </div>

                <p className="mt-10 text-xs text-ink-soft lg:mt-16 lg:text-sm">
                    Tendso builds websites for Philippine small businesses.{" "}
                    <Link href="/" className="underline">
                        See more
                    </Link>
                </p>
            </div>
        </main>
    );
}
