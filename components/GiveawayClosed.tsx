"use client";

import { ArrowRight } from "lucide-react";

import { ButtonLink, Icon } from "@/components/r1";
import { requestFullPriceIntake } from "@/lib/campaign";
import { GIVEAWAY_CLOSED } from "@/lib/giveaway";

/** Only the promised closed message and the full-price way to get a website. */
export function GiveawayClosed() {
    return (
        <section className="mx-auto flex w-full max-w-lg flex-col gap-7 px-5 py-14 lg:max-w-2xl lg:py-24" aria-labelledby="giveaway-closed-heading">
            <div className="flex flex-col gap-4">
                <h1 id="giveaway-closed-heading" className="font-r1-serif text-[2.25rem] leading-[1.1] tracking-[-0.01em] text-balance lg:text-[2.75rem]">
                    {GIVEAWAY_CLOSED.heading}
                </h1>
                <p className="t-body">{GIVEAWAY_CLOSED.thanks}</p>
            </div>
            <p className="t-body">{GIVEAWAY_CLOSED.applied}</p>
            <div className="flex flex-col gap-4">
                <p className="t-body">{GIVEAWAY_CLOSED.paid}</p>
                <ButtonLink variant="primary" size="lg" href="/start" onClick={requestFullPriceIntake} className="sm:self-start">
                    Get my website
                    <Icon icon={ArrowRight} />
                </ButtonLink>
            </div>
        </section>
    );
}
