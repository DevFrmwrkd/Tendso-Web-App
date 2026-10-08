"use client";

import { useQuery } from "convex/react";
import { ArrowRight, Download } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { GiveawayClosed } from "@/components/GiveawayClosed";
import { Button, ButtonLink, Icon, Logo, PublicFooter, PublicPage, buttonClass } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import { campaignFromLocation, clearCampaign, rememberGiveaway } from "@/lib/campaign";
import { GIVEAWAY_POSTER_PATH } from "@/lib/giveaway";

const STEPS = [
    {
        title: "Download and print the poster.",
        detail: "Take the PDF to any print shop and get a copy printed.",
    },
    {
        title: "Hang it and take a photo.",
        detail: "Put it where your customers will see it. Photograph the poster on your wall, with your storefront or sign in the shot.",
    },
    {
        title: "Apply for your free website.",
        detail: "Tell us about your business and send the poster photo. Your application holds a slot while we review it.",
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
            <PublicPage>
                <GiveawayClosed />
            </PublicPage>
        );
    }

    const applyHref = `/start?campaign=giveaway&src=${encodeURIComponent(source)}`;

    return (
        <PublicPage
            header={
                <header className="t-pub-head">
                    <Link href="/" className="flex items-center" aria-label="Tendso home">
                        <Logo height={24} priority />
                    </Link>
                    <span className="font-r1-mono text-[10px] font-medium uppercase tracking-[0.12em] text-r1-ink-2 sm:text-[11px]">
                        100 free websites
                    </span>
                </header>
            }
            footer={<PublicFooter />}
        >
            <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-12 px-5 pb-16 pt-10 lg:max-w-none lg:flex-row lg:items-start lg:justify-center lg:gap-16 lg:px-12 lg:pt-14">
                <section className="flex min-w-0 flex-col gap-7 lg:w-[560px] lg:flex-none" aria-labelledby="giveaway-heading">
                    <h1 id="giveaway-heading" className="font-r1-serif text-[2.25rem] leading-[1.1] tracking-[-0.01em] text-balance lg:text-[2.75rem]">
                        We&apos;re giving away more than ₱300,000 in websites to the first 100 business owners.
                    </h1>
                    <p className="t-body">
                        Your business, online. A free website with a Tendso web address, built from your photos and your story.
                    </p>
                    <div className="t-hl flex flex-col gap-2 p-5" role="status" aria-live="polite" aria-atomic="true">
                        {status ? (
                            <>
                                <p className="font-r1-serif text-[2rem] leading-[1.15] tracking-[-0.01em] tabular-nums">
                                    {status.slotsLeft} of 100 slots left
                                </p>
                                <p className="t-body">First come, first served. While supplies last.</p>
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
                            Download poster
                        </a>
                    </div>
                    <section className="flex flex-col gap-3" aria-labelledby="giveaway-qualifies">
                        <h2 id="giveaway-qualifies" className="t-h2">Who qualifies?</h2>
                        <p className="t-body">
                            Any walk-in business where customers will see the poster. A solo owner, studio, or team — if people visit your shop, you can apply.
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
                </section>
            </div>
        </PublicPage>
    );
}
