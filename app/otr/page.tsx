"use client";

import { ArrowRight, Check, Clock, Copy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";

import { Button, ButtonLink, Icon, PublicFooter, PublicPage } from "@/components/r1";
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
 * THE LOOK IS THE ROUND 1 REDESIGN, and this was the first public page to wear
 * it: white ground, Instrument Serif for the headline and the price, Onest for
 * everything else. Its colours and buttons now come from the shared Round 1
 * tokens and components (app/round1.css, components/r1). The lockup in the
 * header is the one this page already had, unchanged, because it is what tells
 * a viewer the offer comes from the show.
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

    return (
        <PublicPage
            header={
                <header className="t-pub-head">
                    <Link href="/" className="flex items-center gap-3" aria-label="Tendso x Off The Record. Tendso home">
                        {/* The file is white lettering with alpha, drawn for the dark
                            footer. .t-logo inverts it to ink, keeping the lettering's
                            shape, the same treatment every Round 1 header uses. */}
                        <Image
                            src="/tendso-logo.png"
                            alt="Tendso"
                            width={104}
                            height={28}
                            priority
                            className="t-logo h-7 w-auto translate-y-[1px] lg:h-8"
                        />
                        {/* A collaboration lockup, not two logos sharing a line.
                            The x is what tells a viewer this offer comes from the
                            show they were just watching, which is the only reason
                            they trust the discount at all. */}
                        <span
                            aria-hidden
                            className="-translate-y-[0.09em] px-0.5 text-lg font-semibold leading-none text-r1-ink-2 lg:text-xl"
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
                            <span className="whitespace-nowrap font-r1-mono text-[11px] font-semibold uppercase leading-none tracking-[0.18em] text-r1-ink-2">
                                Off The Record
                            </span>
                        </span>
                    </Link>
                    {/* Hidden on a phone: the lockup needs the whole width there,
                        and the same button is the first thing under the price. */}
                    <ButtonLink href={buyHref} className="max-sm:hidden">
                        Get a website
                    </ButtonLink>
                </header>
            }
            footer={
                <PublicFooter
                    links={[
                        { href: "/privacy-policy", label: "Privacy policy" },
                        { href: "/terms-of-service", label: "Terms of service" },
                        { href: "/knowledge", label: "Help" },
                    ]}
                />
            }
        >
            {/* One column on a phone, two on a desk. The offer keeps the left
                where reading starts; the money detail sits beside it rather
                than a scroll below. */}
            <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-12 px-5 pb-16 pt-10 lg:max-w-none lg:flex-row lg:items-start lg:justify-center lg:gap-16 lg:px-12 lg:pt-14">
                <div className="flex min-w-0 flex-col gap-12 lg:w-[560px] lg:flex-none">
                    <section className="flex flex-col gap-7">
                        <div className="flex flex-col gap-2">
                            <h1 className="font-r1-serif text-[2.25rem] leading-[1.1] tracking-[-0.01em] text-balance lg:text-[2.5rem] lg:leading-[2.75rem]">
                                Your business gets a real website for 30% off.
                            </h1>
                            <p className="t-sub">For Off The Record viewers.</p>
                        </div>

                        {/* The number they came for, and the number it used to
                            be. Said once, where the eye lands. */}
                        <div className="flex flex-col gap-2">
                            <p className="flex items-baseline gap-4">
                                <span className="font-r1-serif text-[3.5rem] leading-none tracking-[-0.01em] tabular-nums lg:text-[4rem]">
                                    {formatPHP(websitePrice)}
                                </span>
                                <span className="text-xl leading-6 text-r1-ink-3 line-through tabular-nums">{formatPHP(listPrice)}</span>
                            </p>
                            <p className="t-body">
                                Paid once, after your website is live. No monthly fees. Your discount is
                                already applied — nothing to type.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <ButtonLink variant="primary" size="lg" href={buyHref}>
                                Get my website — {formatPHP(websitePrice)}
                                <Icon icon={ArrowRight} />
                            </ButtonLink>
                            {/* An external store link is a plain anchor (ButtonLink
                                only routes in-app paths through next/link): prefetching
                                a URL that leaves the app does nothing but noise. */}
                            <ButtonLink size="lg" href={earnHref} rel={earnIsStore ? "noopener" : undefined}>
                                Earn with Tendso
                            </ButtonLink>
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="t-card flex items-center justify-between gap-4 py-3 pl-4 pr-3">
                                <div className="flex min-w-0 flex-col gap-1">
                                    <span className="t-label">Discount code, if you ever need to enter it by hand</span>
                                    <span className="font-r1-mono text-base font-medium leading-5 tracking-[0.04em] text-r1-ink">
                                        {FALLBACK_CODE}
                                    </span>
                                </div>
                                <Button className="flex-none px-3 text-[13px]" onClick={copyCode}>
                                    <Icon icon={Copy} />
                                    Copy code
                                </Button>
                            </div>
                            <p className="t-meta">
                                The code applies to the website. Earning is free to join and happens in
                                the Tendso app.
                            </p>
                            {offerEnds && (
                                <p className="t-meta flex items-center gap-2">
                                    <Icon icon={Clock} className="flex-none" />
                                    <span>Offer ends {offerEnds}</span>
                                </p>
                            )}
                            {chatUrl && (
                                <ButtonLink href={chatUrl} target="_blank" rel="noopener noreferrer" className="h-11 self-start px-4">
                                    Message us — we answer in Tagalog
                                </ButtonLink>
                            )}
                        </div>
                    </section>

                    <section className="flex flex-col gap-4" aria-labelledby="otr-get">
                        <h2 id="otr-get" className="t-h2">
                            What you get
                        </h2>
                        <ul className="flex flex-col gap-2.5">
                            {WHAT_YOU_GET.map((item) => (
                                <li key={item} className="t-body flex items-start gap-2.5">
                                    <Icon icon={Check} className="mt-0.5 flex-none text-r1-ink" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="flex flex-col gap-4" aria-labelledby="otr-how">
                        <h2 id="otr-how" className="t-h2">
                            How it works
                        </h2>
                        <ol className="flex flex-col gap-4">
                            {STEPS.map((step, index) => (
                                <li key={step} className="flex items-start gap-3.5">
                                    <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full border border-r1-line-2 text-[13px] font-semibold tabular-nums text-r1-ink">
                                        {index + 1}
                                    </span>
                                    <span className="t-body pt-1">{step}</span>
                                </li>
                            ))}
                        </ol>
                    </section>
                </div>

                <aside className="flex flex-col gap-3 lg:sticky lg:top-24 lg:w-[360px] lg:flex-none" aria-label="What you pay">
                    <section className="t-hl flex flex-col gap-4 p-6">
                        <h2 className="t-h2">What you pay</h2>
                        <dl className="flex flex-col gap-3 text-sm leading-5 text-r1-ink">
                            <div className="flex items-baseline justify-between gap-4">
                                <dt className="font-medium">Your website</dt>
                                <dd className="whitespace-nowrap tabular-nums">
                                    <span className="font-semibold">{formatPHP(websitePrice)}</span>{" "}
                                    <span className="text-r1-ink-3 line-through">{formatPHP(listPrice)}</span>
                                </dd>
                            </div>
                            <div className="h-px bg-r1-gold-line" aria-hidden />
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
                        <p className="text-[13px] leading-[18px] text-r1-ink-2">
                            Paid once, after your website is live. Nothing to pay today, and no monthly
                            fees ever.
                        </p>
                    </section>
                    <p className="t-meta px-1">Price for OTR viewers: 30% off the {formatPHP(listPrice)} website.</p>
                </aside>
            </div>
        </PublicPage>
    );
}
