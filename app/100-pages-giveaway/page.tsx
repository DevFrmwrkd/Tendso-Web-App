"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { api } from "@/convex/_generated/api";
import { campaignFromLocation, clearCampaign, rememberGiveaway } from "@/lib/campaign";
import { GIVEAWAY_POSTER_PATH, GIVEAWAY_VALUE, GIVEAWAY_VALUE_FLOOR } from "@/lib/giveaway";
import { WEBSITE_PRICE, formatPHP } from "@/lib/pricing";
import { ArrowIcon, CameraIcon, DownloadIcon, GiftArt, PrintIcon, SendIcon, SlotBar } from "./_components/Art";
import { GiveawayClosed } from "./_components/GiveawayClosed";
import { GiveawayStage, PresentedBy } from "./_components/Stage";

const STEPS: { label: string; detail: string; icon: ReactNode }[] = [
    { label: "Print the poster", detail: "Download the OTR poster and print it at any print shop.", icon: <PrintIcon /> },
    { label: "Hang it & snap it", detail: "Put it up in your shop, with your storefront or sign in the shot.", icon: <CameraIcon /> },
    { label: "Claim your website", detail: "Apply with the photo. Off the Record checks it; Tendso builds your site.", icon: <SendIcon /> },
];

/** One screen of campaign poster, for video links and the poster's QR code. */
export default function GiveawayPage() {
    const status = useQuery(api.giveaway.giveawayStatus, {});
    const [source, setSource] = useState("direct");

    useEffect(() => {
        // Source cleaning is shared with campaign attribution, so video and
        // poster tags retain the same spelling on the eventual submission.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSource(campaignFromLocation().source ?? "direct");
    }, []);

    useEffect(() => {
        if (status?.open === true) rememberGiveaway(source);
        if (status?.open === false) clearCampaign();
    }, [status?.open, source]);

    if (status?.open === false) return <GiveawayClosed status={status} />;

    const applyHref = `/start?campaign=giveaway&src=${encodeURIComponent(source)}`;

    return (
        <GiveawayStage live>
            <div className="gw-title">
                <div className="gw-banner-wrap">
                    <GiftArt />
                    <h1 className="gw-banner">
                        Giveaway
                        <span className="sr-only">: Off the Record is giving 100 local businesses a free Tendso website.</span>
                    </h1>
                    <p className="gw-ribbon">
                        <span>100 free websites <b aria-hidden="true">✦</b> <span className="max-md:hidden">worth </span>{formatPHP(WEBSITE_PRICE)} each</span>
                    </p>
                    <p className="gw-sticker" aria-hidden="true">
                        <span>More than</span>
                        <strong>₱{GIVEAWAY_VALUE_FLOOR / 1000}K</strong>
                        <span>in websites</span>
                    </p>
                </div>
                <PresentedBy />
            </div>

            <ol className="gw-steps" aria-label="How to claim your free website">
                {STEPS.map((step, index) => (
                    <li key={step.label} className="gw-step">
                        <div className="gw-bubble">
                            {step.icon}
                            <span className="gw-badge" aria-hidden="true">{index + 1}</span>
                        </div>
                        <div className="gw-step-copy">
                            <h2 className="gw-step-label"><span>{step.label}</span></h2>
                            <p className="gw-step-text">{step.detail}</p>
                        </div>
                    </li>
                ))}
            </ol>

            <div className="gw-foot">
                <section className="gw-panel" aria-label="Free websites left">
                    <div role="status" aria-live="polite" aria-atomic="true">
                        {status ? (
                            <p className="gw-count">
                                <span className="gw-count-n">{status.slotsLeft}</span>
                                <span className="gw-count-of">of 100 websites left</span>
                            </p>
                        ) : (
                            <p className="gw-count gw-count-wait">Checking available slots…</p>
                        )}
                    </div>
                    <div className="gw-meter">
                        <SlotBar open={status?.slotsLeft} />
                        <p className="gw-note">More than {GIVEAWAY_VALUE} in websites, a one-time gift from Off the Record built by Tendso. No payment, no account.</p>
                    </div>
                    <div className="gw-actions">
                        {status?.open ? (
                            <Link href={applyHref} className="gw-cta" onClick={() => rememberGiveaway(source)}>
                                Claim your free website
                                <ArrowIcon />
                            </Link>
                        ) : (
                            <button type="button" className="gw-cta" disabled>Checking availability…</button>
                        )}
                        <a href={GIVEAWAY_POSTER_PATH} download className="gw-link">
                            <DownloadIcon />
                            Download the poster (A4 PDF)
                        </a>
                    </div>
                </section>
                <p className="gw-fine">
                    For walk-in businesses · One entry per business · Custom domain not included ·{" "}
                    <Link href="/privacy-policy">Privacy</Link> · <Link href="/terms-of-service">Terms</Link>
                </p>
            </div>
        </GiveawayStage>
    );
}
