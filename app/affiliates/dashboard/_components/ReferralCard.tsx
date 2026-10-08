"use client";

import { REFERRAL_BONUS, formatPHP } from "@/lib/pricing";
import { CopyButton } from "./CopyButton";

export function ReferralCard({ code, disabled = false }: { code: string; disabled?: boolean }) {
    return (
        <section className="t-card t-card-pad flex flex-col gap-4" aria-labelledby="affiliate-referral-heading">
            <div className="flex flex-col gap-1">
                <h2 id="affiliate-referral-heading" className="t-h2">Refer a creator</h2>
                <p className="t-meta">Earn {formatPHP(REFERRAL_BONUS)} when a creator using your code makes their first paid sale.</p>
            </div>
            {code ? <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="t-num select-all break-all text-2xl font-semibold tracking-wider text-r1-ink">{code}</span>
                <CopyButton value={code} label="Copy your creator referral code" disabled={disabled} />
            </div> : <p className="t-meta">Your referral code is not available. Contact support for help.</p>}
            {disabled && <p className="t-meta">Creator referrals are paused while your account is suspended.</p>}
        </section>
    );
}
