"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import { campaignFromLocation, rememberCampaign } from "@/lib/campaign";
import { campaignListPrice, campaignSellPrice, formatPHP } from "@/lib/pricing";

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
 * installed from, it opens /for-creators at its app section — the current pitch,
 * which ends in the same download. Not /for-field-agents: that is the older
 * recruitment page, and it is behind the login wall besides.
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
 * THE LOOK IS THE ROUND 1 REDESIGN, and this is the first public page to wear
 * it: white ground, Instrument Serif for the headline and the price, Onest for
 * everything else. The colours are written out here rather than added to
 * globals.css because no other page shares them yet; when a second one does,
 * that is the moment to name them. The lockup in the header is the one this
 * page already had, unchanged, because it is what tells a viewer the offer
 * comes from the show.
 *
 * THERE IS NO "SHOPS ALREADY ON TENDSO" SECTION, on purpose. It was designed,
 * and then cut: this page has one job, and a gallery under the offer is a
 * second thing to look at before deciding.
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

const listPrice = campaignListPrice(CAMPAIGN);
const websitePrice = campaignSellPrice(CAMPAIGN);

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
    "Tell us about your shop and send a few photos. About ten minutes, on your phone or PC.",
    "We build your website and email it to you within 48 to 72 hours.",
    `You pay ${formatPHP(websitePrice)} only after you have seen it live.`,
];

/** The same six lines the price card on the homepage promises. */
const WHAT_YOU_GET = [
    "A real coded website — not a fill-in template",
    "Your own live web address",
    "Built from your photos and your words",
    "Mobile-first — customers find you on their phones",
    "Hosted with SSL, kept online",
    "Free edits for the first year — ask us, we make the change",
];

const SERIF = { fontFamily: "var(--font-instrument-serif)" } as const;
const SANS = { fontFamily: "var(--font-onest)" } as const;

const BTN =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-medium leading-none transition-colors";
const BTN_PRIMARY = `${BTN} border-[#111111] bg-[#111111] text-white hover:bg-[#2B2B2B]`;
const BTN_PLAIN = `${BTN} border-[#D4D4D0] bg-white text-[#111111] hover:bg-[#F4F4F2]`;
const H2 = "text-base font-semibold leading-6 text-[#111111]";

function Check() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="mt-0.5 flex-none text-[#111111]"
        >
            <path d="M20 6 9 17l-5-5" />
        </svg>
    );
}

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

    // All optional and all hidden when unset, so none of them blocks the page
    // going live. Set them in the admin settings once they exist.
    const chatUrl = useQuery(api.settings.get, { key: "otr_chat_url" }) as string | null | undefined;
    const logoUrl = useQuery(api.settings.get, { key: "otr_logo_url" }) as string | null | undefined;
    const playUrl = useQuery(api.settings.get, { key: "play_store_url" }) as string | null | undefined;
    const iosUrl = useQuery(api.settings.get, { key: "app_store_url" }) as string | null | undefined;
    // Free text, shown as written ("October 31"). The design has an end date on
    // it and nobody has decided one, so the line stays off the page until this
    // is set rather than shipping a date somebody made up.
    const offerEnds = useQuery(api.settings.get, { key: "otr_offer_ends" }) as string | null | undefined;

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
    const earnHref = storeUrl ?? `/for-creators?${tag}#app`;
    const earnIsStore = storeUrl !== null;

    // The code is a fallback, so copying it is a convenience and never the
    // path: when the clipboard is unavailable (an in-app browser, an insecure
    // context) say the code out loud instead of failing quietly.
    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(FALLBACK_CODE);
            toast.success(`Code ${FALLBACK_CODE} copied`);
        } catch {
            toast(`Your code is ${FALLBACK_CODE}`);
        }
    };

    const earnClass = `${BTN_PLAIN} h-12 px-5 text-[15px]`;

    return (
        <main className="flex min-h-dvh flex-col bg-white text-[#111111]" style={SANS}>
            <header className="flex h-[72px] flex-none items-center justify-between gap-4 border-b border-[#E7E7E4] px-5 lg:px-16">
                <Link href="/" className="flex items-center gap-3" aria-label="Tendso x Off The Record. Tendso home">
                    {/* The file is white lettering with alpha, drawn for the dark
                        footer. brightness(0) keeps the lettering's shape and
                        drops its colour to black, the same treatment the booking
                        page uses. */}
                    <Image
                        src="/tendso-logo.png"
                        alt="Tendso"
                        width={104}
                        height={28}
                        priority
                        className="h-7 w-auto translate-y-[1px] lg:h-8"
                        style={{ filter: "brightness(0)" }}
                    />
                    {/* A collaboration lockup, not two logos sharing a line.
                        The x is what tells a viewer this offer comes from the
                        show they were just watching, which is the only reason
                        they trust the discount at all. */}
                    <span
                        aria-hidden
                        className="-translate-y-[0.09em] px-0.5 text-lg font-semibold leading-none text-ink-soft lg:text-xl"
                    >
                        x
                    </span>
                    {/* The mark plus its name. The mark is abstract enough that
                        somebody who has not watched the show would not read it
                        as OTR on its own, and this is the one line telling them
                        they are in the right place. The settings key stays as an
                        override, so the logo can be changed without a deploy. */}
                    <span className="flex items-center gap-2">
                        {logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logoUrl} alt="" className="h-5 w-auto lg:h-6" />
                        ) : (
                            <Image
                                src="/otr-mark.png"
                                alt=""
                                width={459}
                                height={504}
                                priority
                                className="h-5 w-auto lg:h-6"
                            />
                        )}
                        <span className="whitespace-nowrap font-mono text-[11px] font-semibold uppercase leading-none tracking-[0.18em] text-ink-soft">
                            Off The Record
                        </span>
                    </span>
                </Link>
                {/* Hidden on a phone: the lockup needs the whole width there,
                    and the same button is the first thing under the price. */}
                <Link href={buyHref} className={`${BTN_PLAIN} h-10 px-4 text-sm max-sm:hidden`}>
                    Get a website
                </Link>
            </header>

            {/* One column on a phone, two on a desk. The offer keeps the left
                where reading starts; the money detail sits beside it rather
                than a scroll below. */}
            <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-12 px-5 pb-16 pt-10 lg:max-w-none lg:flex-row lg:items-start lg:justify-center lg:gap-16 lg:px-12 lg:pt-14">
                <div className="flex min-w-0 flex-col gap-12 lg:w-[560px] lg:flex-none">
                    <section className="flex flex-col gap-7">
                        <div className="flex flex-col gap-2">
                            <h1
                                className="text-[2.25rem] leading-[1.1] tracking-[-0.01em] text-balance lg:text-[2.5rem] lg:leading-[2.75rem]"
                                style={SERIF}
                            >
                                Your business gets a real website for 30% off.
                            </h1>
                            <p className="text-[15px] leading-[22px] text-[#6B6B72]">For Off The Record viewers.</p>
                        </div>

                        {/* The number they came for, and the number it used to
                            be. Said once, where the eye lands. */}
                        <div className="flex flex-col gap-2">
                            <p className="flex items-baseline gap-4">
                                <span className="text-[3.5rem] leading-none tracking-[-0.01em] tabular-nums lg:text-[4rem]" style={SERIF}>
                                    {formatPHP(websitePrice)}
                                </span>
                                <span className="text-xl leading-6 text-[#6B6B72] line-through tabular-nums">
                                    {formatPHP(listPrice)}
                                </span>
                            </p>
                            <p className="text-sm leading-5 text-[#3F3F46]">
                                Paid once, after your website is live. No monthly fees. Your discount is
                                already applied — nothing to type.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Link href={buyHref} className={`${BTN_PRIMARY} h-12 px-5 text-[15px]`}>
                                Get my website — {formatPHP(websitePrice)}
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.75"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden
                                >
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </Link>
                            {/* An external store link is a plain anchor: Link is
                                for routes inside the app, and prefetching a URL
                                that leaves it does nothing but noise. */}
                            {earnIsStore ? (
                                <a href={earnHref} rel="noopener" className={earnClass}>
                                    Earn with Tendso
                                </a>
                            ) : (
                                <Link href={earnHref} className={earnClass}>
                                    Earn with Tendso
                                </Link>
                            )}
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-4 rounded-xl border border-[#E7E7E4] bg-white py-3 pl-4 pr-3">
                                <div className="flex min-w-0 flex-col gap-1">
                                    <span className="text-xs font-medium leading-4 text-[#6B6B72]">
                                        Discount code, if you ever need to enter it by hand
                                    </span>
                                    <span className="font-mono text-base font-medium leading-5 tracking-[0.04em] text-[#111111]">
                                        {FALLBACK_CODE}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={copyCode}
                                    className={`${BTN_PLAIN} h-10 flex-none cursor-pointer px-3 text-[13px]`}
                                >
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.75"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden
                                    >
                                        <rect x="9" y="9" width="13" height="13" rx="2" />
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                    </svg>
                                    Copy code
                                </button>
                            </div>
                            <p className="text-[13px] leading-[18px] text-[#6B6B72]">
                                The code applies to the website. Earning is free to join and happens in
                                the Tendso app.
                            </p>
                            {offerEnds && (
                                <p className="flex items-center gap-2 text-[13px] leading-[18px] text-[#6B6B72]">
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.75"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden
                                        className="flex-none"
                                    >
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 6v6l4 2" />
                                    </svg>
                                    <span>Offer ends {offerEnds}</span>
                                </p>
                            )}
                            {chatUrl && (
                                <a
                                    href={chatUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`${BTN_PLAIN} h-11 self-start px-4 text-sm`}
                                >
                                    Message us — we answer in Tagalog
                                </a>
                            )}
                        </div>
                    </section>

                    <section className="flex flex-col gap-4" aria-labelledby="otr-get">
                        <h2 id="otr-get" className={H2}>
                            What you get
                        </h2>
                        <ul className="flex flex-col gap-2.5">
                            {WHAT_YOU_GET.map((item) => (
                                <li key={item} className="flex items-start gap-2.5 text-sm leading-5 text-[#3F3F46]">
                                    <Check />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="flex flex-col gap-4" aria-labelledby="otr-how">
                        <h2 id="otr-how" className={H2}>
                            How it works
                        </h2>
                        <ol className="flex flex-col gap-4">
                            {STEPS.map((step, index) => (
                                <li key={step} className="flex items-start gap-3.5">
                                    <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full border border-[#D4D4D0] text-[13px] font-semibold tabular-nums text-[#111111]">
                                        {index + 1}
                                    </span>
                                    <span className="pt-1 text-sm leading-5 text-[#3F3F46]">{step}</span>
                                </li>
                            ))}
                        </ol>
                    </section>
                </div>

                <aside className="flex flex-col gap-3 lg:sticky lg:top-6 lg:w-[360px] lg:flex-none" aria-label="What you pay">
                    <section className="flex flex-col gap-4 rounded-xl border border-[#EAD9B8] bg-[#F7EEDC] p-6">
                        <h2 className={H2}>What you pay</h2>
                        <dl className="flex flex-col gap-3 text-sm leading-5 text-[#111111]">
                            <div className="flex items-baseline justify-between gap-4">
                                <dt className="font-medium">Your website</dt>
                                <dd className="whitespace-nowrap tabular-nums">
                                    <span className="font-semibold">{formatPHP(websitePrice)}</span>{" "}
                                    <span className="text-[#6B6B72] line-through">{formatPHP(listPrice)}</span>
                                </dd>
                            </div>
                            <div className="h-px bg-[#EAD9B8]" aria-hidden />
                            <div className="flex items-baseline justify-between gap-4">
                                <dt>To pay today</dt>
                                <dd className="whitespace-nowrap font-semibold tabular-nums">{formatPHP(0)}</dd>
                            </div>
                        </dl>
                        {/* The custom domain is deliberately NOT sold here. It
                            is an option with a yearly renewal behind it, and
                            putting that on the page somebody reads five
                            seconds after scanning a code turns one clear
                            price into two prices and a caveat. The choice,
                            and the renewal it carries, are on the form where
                            it is actually made. */}
                        <p className="text-[13px] leading-[18px] text-[#3F3F46]">
                            Paid once, after your website is live. Nothing to pay today, and no monthly
                            fees ever.
                        </p>
                    </section>
                    <p className="px-1 text-[13px] leading-[18px] text-[#6B6B72]">
                        Price for OTR viewers: 30% off the {formatPHP(listPrice)} website.
                    </p>
                </aside>
            </div>

            <footer className="flex flex-none flex-col gap-4 border-t border-[#E7E7E4] px-5 py-8 text-[13px] text-[#6B6B72] sm:flex-row sm:items-center sm:justify-between lg:px-16 lg:py-10">
                <span>Tendso · operated by VONAS, OPC</span>
                <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal">
                    <Link href="/privacy-policy" className="underline underline-offset-[3px] hover:text-[#111111]">
                        Privacy policy
                    </Link>
                    <Link href="/terms-of-service" className="underline underline-offset-[3px] hover:text-[#111111]">
                        Terms of service
                    </Link>
                    <Link href="/help-faq" className="underline underline-offset-[3px] hover:text-[#111111]">
                        Help
                    </Link>
                </nav>
            </footer>
        </main>
    );
}
