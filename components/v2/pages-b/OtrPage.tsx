"use client";

/**
 * /v2/otr: where the Off the Record QR code lands (pages/otr.html).
 *
 * Same wiring as /otr: landing here remembers the "otr" campaign for 30 days (so the form quotes
 * the lower price by itself), the source is read from the link (a scan carries none, which is
 * recorded as "qr"), and the price comes from lib/pricing, never typed. The optional settings
 * (otr_chat_url, otr_offer_ends) show only when set. The buy button goes to /v2/start, which
 * submits through the existing owner intake.
 */

import { useQuery } from "convex/react";
import { useEffect, useState } from "react";

import { Button, Container } from "@/components/v2";
import { api } from "@/convex/_generated/api";
import { campaignFromLocation, rememberCampaign } from "@/lib/campaign";
import { campaignListPrice, campaignSellPrice, formatPHP } from "@/lib/pricing";

import { CheckIcon, PbPage, SitePhone, copyWithToast, usePbToast } from "./shared";

const CAMPAIGN = "otr";
const FALLBACK_CODE = "OTR30";
/** A scan carries no query of its own, so this is what an untagged visit is. */
const DEFAULT_SOURCE = "qr";

const listPrice = campaignListPrice(CAMPAIGN);
const websitePrice = campaignSellPrice(CAMPAIGN);

const WHAT_YOU_GET = [
    "Your own live web address",
    "Built from your photos and your words",
    "Made for phones. Customers find you there.",
    "Hosted with SSL, kept online",
    "Free edits for the first year",
];

export function OtrPage() {
    const [source, setSource] = useState<string>(DEFAULT_SOURCE);
    const { node: toast, show } = usePbToast();

    useEffect(() => {
        const tag = campaignFromLocation().source ?? DEFAULT_SOURCE;
        // The URL and localStorage do not exist while rendering, and both have to reach the links
        // below, so these are writes from an effect on purpose. They run once, before anyone can tap.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSource(tag);
        rememberCampaign(CAMPAIGN, tag);
    }, []);

    // Optional and hidden when unset, so none of them blocks the page going live.
    const chatUrl = useQuery(api.settings.get, { key: "otr_chat_url" }) as string | null | undefined;
    const offerEnds = useQuery(api.settings.get, { key: "otr_offer_ends" }) as string | null | undefined;

    const buyHref = `/v2/start?campaign=${CAMPAIGN}&src=${encodeURIComponent(source)}`;

    return (
        <PbPage nav={{ primary: <Button href={buyHref} size="sm">Get my website</Button> }}>
            {/* 1. The offer first: a viewer gives it about five seconds */}
            <Container className="pb-ot-hero" aria-labelledby="ot-h" role="region">
                <div className="pb-ot-offer">
                    <p className="pb-ot-lock">
                        <span>Off the Record</span>
                        <i aria-hidden="true">×</i>
                        <span>Tendso</span>
                    </p>
                    <p className="pb-label pb-ot-for">For Off the Record viewers</p>
                    <h1 className="pb-ot-h" id="ot-h">
                        Your website. 30% off.
                    </h1>
                    <div className="pb-ot-price">
                        <p className="pb-ot-now">{formatPHP(websitePrice)}</p>
                        <p className="pb-ot-was">
                            <s>
                                <span className="sr-only">Was </span>
                                {formatPHP(listPrice)}
                            </s>
                            <span>Once. See it first, then pay once to publish.</span>
                        </p>
                    </div>
                    <div className="pb-ot-cta">
                        <Button href={buyHref} className="pb-ot-btn">
                            Get my website
                        </Button>
                        <p className="pb-ot-code">
                            Code, if you ever need it <b>{FALLBACK_CODE}</b>
                            <Button variant="ghost" size="sm" onClick={() => void copyWithToast(FALLBACK_CODE, `Code ${FALLBACK_CODE} copied`, show)}>
                                Copy
                            </Button>
                        </p>
                        {offerEnds && <p className="pb-ot-code">Offer ends {offerEnds}</p>}
                        {chatUrl && (
                            <Button href={chatUrl} variant="ghost" size="sm" target="_blank" rel="noopener noreferrer">
                                Message us. We answer in Tagalog
                            </Button>
                        )}
                    </div>
                </div>
                <div className="pb-ot-stage">
                    <span className="pb-sample-tag pb-ot-tag">Sample site · Héla, Makati</span>
                    <div className="pb-ot-phone">
                        <SitePhone src="/v2/pages-b/hela-m-long.jpg" url="hela.sites.tendso.com" alt="Héla Hair Studio's website on a phone" />
                    </div>
                </div>
            </Container>

            {/* 2. How it works + what you get */}
            <Container className="pb-sec pb-ot-more" aria-label="How it works" role="region">
                <div>
                    <span className="pb-label">How it works</span>
                    <ol className="pb-ot-steps">
                        <li>
                            <span>1</span>
                            <div>
                                <b>Tell us about your shop.</b>
                                <p>A few questions and photos. About ten minutes, on your phone.</p>
                            </div>
                        </li>
                        <li>
                            <span>2</span>
                            <div>
                                <b>Your site is ready the same day.</b>
                                <p>We build it in about 20 minutes. Ask for changes, or say it looks good.</p>
                            </div>
                        </li>
                        <li>
                            <span>3</span>
                            <div>
                                <b>See it. Pay once to publish.</b>
                                <p>{formatPHP(websitePrice)}. Nothing to pay before you see it.</p>
                            </div>
                        </li>
                    </ol>
                </div>
                <div>
                    <span className="pb-label">What you get</span>
                    <ul className="pb-incl pb-ot-incl">
                        {WHAT_YOU_GET.map((item) => (
                            <li key={item}>
                                <CheckIcon />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </Container>

            <Container className="pb-band" aria-labelledby="band-h" role="region">
                <div className="v2-tile v2-tile--quiet pb-band-in">
                    <h2 className="pb-band-h" id="band-h">
                        {formatPHP(websitePrice)}. See it first.
                    </h2>
                    <div className="pb-band-cta">
                        <Button href={buyHref} className="pb-ot-btn">
                            Get my website
                        </Button>
                    </div>
                </div>
            </Container>
            {toast}
        </PbPage>
    );
}
