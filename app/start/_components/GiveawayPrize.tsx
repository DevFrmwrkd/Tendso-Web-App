"use client";

import { useQuery } from "convex/react";

import { GiftArt, SlotBar } from "@/app/100-pages-giveaway/_components/Art";
import { cx } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import { WEBSITE_PRICE, formatPHP } from "@/lib/pricing";

/**
 * What a giveaway applicant is applying for, in the campaign's gold: one free
 * website, its worth, and how many are left. Takes the place of the price note
 * (StepRail's PriceNote) for giveaway applications.
 *
 * `compact` is the one-row phone version above step 1's title (hidden from
 * `lg` up, in app/giveaway.css); the desk rail shows the full card with the
 * slot bar and the review note.
 */
export function GiveawayPrize({ compact = false, className }: { compact?: boolean; className?: string }) {
    const status = useQuery(api.giveaway.giveawayStatus, {});
    const left = status?.slotsLeft;
    return (
        <section className={cx("gw-prize", compact && "is-compact", className)} aria-label="Your free website">
            <div className="gw-prize-top">
                <GiftArt className="gw-prize-gift" />
                <div className="gw-prize-copy">
                    <p className="gw-prize-label">A gift from Off the Record</p>
                    <p className="gw-prize-title">1 free website</p>
                    <p className="gw-prize-worth">
                        Worth <s>{formatPHP(WEBSITE_PRICE)}</s> · you pay ₱0
                    </p>
                </div>
                {compact && left !== undefined ? <p className="gw-prize-left m-0">{left} of 100<br />left</p> : null}
            </div>
            {compact ? null : (
                <>
                    <div className="gw-prize-slots">
                        {left !== undefined
                            ? <span><strong>{left}</strong> of 100 still up for grabs</span>
                            : <span>Checking available slots…</span>}
                        <SlotBar open={left} />
                    </div>
                    <p className="gw-prize-note">
                        Off the Record reviews your poster photo and eligibility. If approved, Tendso builds your free website with a Tendso web address.
                    </p>
                </>
            )}
        </section>
    );
}
