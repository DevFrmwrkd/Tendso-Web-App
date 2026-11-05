import { COMMISSION_RATE, CREATOR_CODE_DISCOUNT, CREATOR_CODE_PRICE, WEBSITE_PRICE, commissionFor, formatPHP } from "@/lib/pricing";

/** Creator-code pricing is fixed; this panel never mounts a form or a mutation. */
export function PriceSettings({ referralCode }: { referralCode?: string }) {
    const percentOff = Math.round(CREATOR_CODE_DISCOUNT * 100);
    return (
        <section id="price-settings" className="ap-price-settings t-card t-card-pad flex min-w-0 flex-col gap-5" aria-labelledby="price-settings-title">
            <div className="flex flex-col gap-1">
                <h2 id="price-settings-title" className="t-h2">Your offer</h2>
                <p className="t-meta">Every creator code gives shop owners the same {percentOff}% off the website price.</p>
            </div>
            <div className="ap-price-summary flex flex-col gap-2 rounded-r1 bg-r1-fill-2 p-4">
                <p className="t-label">Shop owners pay</p>
                <p className="flex flex-wrap items-baseline gap-2">
                    <del className="t-meta">{formatPHP(WEBSITE_PRICE)}</del>
                    <strong className="text-xl text-r1-ink t-num">{formatPHP(CREATOR_CODE_PRICE)}</strong>
                    <span className="t-meta">{percentOff}% off</span>
                </p>
                <p className="t-body">Shop owners save <strong>{formatPHP(WEBSITE_PRICE - CREATOR_CODE_PRICE)}</strong>.</p>
                <p className="t-body">Your commission: <strong>{formatPHP(commissionFor(CREATOR_CODE_PRICE))}</strong> ({Math.round(COMMISSION_RATE * 100)}% of the website price).</p>
            </div>
            {referralCode?.trim() && <div className="flex min-w-0 flex-col gap-1">
                <p className="t-label">Your creator code</p>
                <p className="t-body select-all break-all font-semibold">{referralCode.trim()}</p>
            </div>}
            <p className="t-meta">Share your creator code to apply this fixed offer at checkout. Your photo, name, message and social links can be updated in Page details.</p>
        </section>
    );
}
