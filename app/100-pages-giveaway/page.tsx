"use client";

import { useQuery } from "convex/react";
import { ArrowRight, Download } from "lucide-react";
import { useEffect, useState } from "react";

import { GiveawayClosed } from "@/components/GiveawayClosed";
import { Button, ButtonLink, Icon, PublicFooter, PublicPage, buttonClass } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import { campaignFromLocation, clearCampaign, rememberGiveaway } from "@/lib/campaign";
import { GIVEAWAY_POSTER_PATH } from "@/lib/giveaway";
import { CampaignHeader } from "./_components/CampaignHeader";

const STEPS = [
    {
        title: "Print the Off the Record poster.",
        detail: "Download the PDF and take it to any print shop. This poster is for Off the Record’s community.",
    },
    {
        title: "Hang it and take a photo.",
        detail: "Hang the Off the Record poster where your customers will see it. Photograph it on your wall, with your storefront or sign in the shot.",
    },
    {
        title: "Apply for your free website.",
        detail: "Tell us about your business and send the poster photo. Off the Record checks eligibility; Tendso builds and delivers your free website.",
    },
] as const;

/** A light, phone-first page for video links and the poster's QR code. */
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

    if (status?.open === false) {
        return (
            <PublicPage header={<CampaignHeader />} footer={<PublicFooter />}>
                <GiveawayClosed status={status} />
            </PublicPage>
        );
    }

    const applyHref = `/start?campaign=giveaway&src=${encodeURIComponent(source)}`;

    return (
        <PublicPage
            header={<CampaignHeader />}
            footer={<PublicFooter />}
        >
            <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-12 px-5 pb-16 pt-10 lg:max-w-none lg:flex-row lg:items-start lg:justify-center lg:gap-16 lg:px-12 lg:pt-14">
                <section className="flex min-w-0 flex-col gap-7 lg:w-[560px] lg:flex-none" aria-labelledby="giveaway-heading">
                    <h1 id="giveaway-heading" className="font-r1-serif text-[2.25rem] leading-[1.1] tracking-[-0.01em] text-balance lg:text-[2.75rem]">
                        Off the Record is giving 100 local businesses a free Tendso website.
                    </h1>
                    <p className="t-body">
                        Hang an Off the Record poster in your business, send a photo as proof, and apply for your free website. A one-time gift from Off the Record to its community, built by Tendso from your photos and your story.
                    </p>
                    <div className="t-hl flex flex-col gap-2 p-5" role="status" aria-live="polite" aria-atomic="true">
                        {status ? (
                            <>
                                <p className="font-r1-serif text-[2rem] leading-[1.15] tracking-[-0.01em] tabular-nums">
                                    {status.slotsLeft} of 100 slots left
                                </p>
                                <p className="t-body">The first 100 eligible businesses. An application reserves a slot while Off the Record reviews it.</p>
                            </>
                        ) : (
                            <p className="t-body">Checking available slots…</p>
                        )}
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        {status?.open ? (
                            <ButtonLink variant="primary" size="lg" href={applyHref} onClick={() => rememberGiveaway(source)}>
                                Apply for a free website
                                <Icon icon={ArrowRight} />
                            </ButtonLink>
                        ) : (
                            <Button variant="primary" size="lg" disabled>Checking availability…</Button>
                        )}
                        <a href={GIVEAWAY_POSTER_PATH} download className={buttonClass({ size: "lg" })}>
                            <Icon icon={Download} />
                            Download OTR poster
                        </a>
                    </div>
                    <section className="flex flex-col gap-3" aria-labelledby="giveaway-qualifies">
                        <h2 id="giveaway-qualifies" className="t-h2">Who qualifies?</h2>
                        <p className="t-body">
                            Any walk-in business where customers will see the Off the Record poster. A solo owner, studio, or team — if people visit your shop, you can apply. Hang the poster and include a clear photo showing it in your business.
                        </p>
                    </section>
                </section>

                <section className="flex min-w-0 flex-col gap-5 lg:w-[360px] lg:flex-none lg:pt-1" aria-labelledby="giveaway-how">
                    <h2 id="giveaway-how" className="t-h2">Three steps to your free website</h2>
                    <ol className="flex flex-col gap-7">
                        {STEPS.map((step, index) => (
                            <li key={step.title} className="flex items-start gap-3.5">
                                <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full border border-r1-line-2 text-sm font-semibold tabular-nums text-r1-ink">
                                    {index + 1}
                                </span>
                                <div className="flex min-w-0 flex-col gap-2 pt-1">
                                    <h3 className="text-base font-semibold leading-6 text-r1-ink">{step.title}</h3>
                                    <p className="t-body">{step.detail}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                    <div className="flex flex-col gap-2 border-t border-r1-line pt-5">
                        <h3 className="text-base font-semibold leading-6">What’s included?</h3>
                        <p className="t-body">A free business website with a Tendso web address. No account to make, nothing to pay. A custom domain is not included.</p>
                    </div>
                </section>
            </div>
        </PublicPage>
    );
}
