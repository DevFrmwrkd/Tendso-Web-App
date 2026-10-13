"use client";

import Link from "next/link";

import { requestFullPriceIntake } from "@/lib/campaign";
import { giveawayClosedCopy } from "@/lib/giveaway";
import { ArrowIcon, SlotBar } from "./Art";
import { GiveawayStage } from "./Stage";

/** The poster, stamped closed: the promised message and the full-price way to get a website. */
export function GiveawayClosed({ status }: { status?: { slotsLeft: number; given: number } }) {
    const copy = giveawayClosedCopy(status);
    const full = !!status && (status.given >= 100 || status.slotsLeft <= 0);
    return (
        <GiveawayStage short>
            <div className="gw-closed">
                <div className="gw-stamped">
                    <p className="gw-banner" aria-hidden="true">Giveaway</p>
                    <p className="gw-stamp">{copy.stamp}</p>
                </div>
            </div>
            <section className="gw-closed" aria-labelledby="giveaway-closed-heading">
                <h1 id="giveaway-closed-heading" className="gw-closed-h">{copy.heading}</h1>
                <p className="gw-closed-text">{copy.thanks}</p>
                {full && <SlotBar full />}
                <p className="gw-box">{copy.applied}</p>
            </section>
            <div className="gw-closed">
                <div className="gw-panel">
                    <p className="gw-note">{copy.paid}</p>
                    <Link href="/start" className="gw-cta" onClick={requestFullPriceIntake}>
                        Get my website
                        <ArrowIcon />
                    </Link>
                </div>
            </div>
        </GiveawayStage>
    );
}
