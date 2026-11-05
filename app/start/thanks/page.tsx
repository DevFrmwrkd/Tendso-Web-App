"use client";

/** A separate receipt URL makes refresh safe: it never repeats the intake mutation. */
import { useMemo, useSyncExternalStore } from "react";
import { Button } from "@/components/v2";
import { CheckIcon, PbBrand } from "@/components/v2/pages-b/shared";
import { formatPHP } from "@/lib/pricing";
import { readSubmitted } from "../draft";
import { quoteForReceipt } from "../quote";

const noSubscription = () => () => {};
const noServerValue = () => null;
// useSyncExternalStore needs a stable snapshot. readSubmitted parses storage
// into a new object, so expose its validated value as a primitive instead.
const receiptSnapshot = () => JSON.stringify(readSubmitted());

export default function StartThanksPage() {
    // Receipt details stay in this tab's storage, never in a URL or referrer.
    const snapshot = useSyncExternalStore(noSubscription, receiptSnapshot, noServerValue);
    const receipt = useMemo(() => snapshot === null ? null : JSON.parse(snapshot) as ReturnType<typeof readSubmitted>, [snapshot]);
    const giveaway = receipt?.giveawayApplication === true;
    const quote = receipt ? quoteForReceipt(receipt) : null;
    const amount = receipt?.amount ?? null;
    const forLine = [receipt?.businessName, receipt?.city].filter(Boolean).join(" · ");
    const next = giveaway ? [
        "Off the Record checks that its poster is up in your shop.",
        "If your application qualifies, Tendso builds your free website.",
        "We email your link when it is ready. If the application cannot be accepted, we email you why.",
    ] : [
        "Our team uses your answers and photos to build your website.",
        "We check it and email a private preview to the address you gave us.",
        "Review your preview and ask for changes. When it looks right, pay once to publish it.",
    ];
    return <div className="pb-st" data-scr="done">
        <header className="pb-st-bar"><div className="v2-wrap pb-st-bar-in"><PbBrand /><Button href={giveaway ? "/100-pages-giveaway" : "/"} variant="ghost" size="sm">Back to {giveaway ? "giveaway" : "Tendso"}</Button></div></header>
        <main className="pb-st-main"><div className="v2-wrap"><div className="pb-st-form pb-st-receipt">
            <div className="pb-st-done-mark"><CheckIcon size={34} /></div>
            <h1 className="pb-st-q pb-st-q--done">{giveaway ? "Application received." : "Got it. We’ll take it from here."}</h1>
            <p className="pb-st-done-p">{giveaway ? "Off the Record checks your poster photo. If you qualify, we build your free site and email your link to " : "We’ll build your site and email a private preview to "}<b>{receipt?.email ?? "the address you gave us"}</b>.</p>
            <div className="pb-st-cards">
                <section className="pb-st-card" aria-label="What you sent"><h2>Your website request</h2><dl>
                    {forLine && <div><dt>For</dt><dd>{forLine}</dd></div>}
                    {receipt?.email && <div><dt>We’ll email</dt><dd>{receipt.email}</dd></div>}
                    {amount !== null && <div><dt>{giveaway ? "Price" : "Your price"}</dt><dd>{giveaway ? "Free, if your application qualifies" : <>{quote?.struckTotal !== null && quote?.struckTotal !== undefined && <><s>{formatPHP(quote.struckTotal)}</s>{" "}</>}{formatPHP(amount)} once</>}</dd></div>}
                    {!giveaway && quote?.tier === "with_custom_domain" && <><div><dt>Website</dt><dd>{formatPHP(quote.sellPrice)}</dd></div><div><dt>Domain</dt><dd>{formatPHP(quote.addOn)}</dd></div></>}
                    <div><dt>Next step</dt><dd>{giveaway ? "Check your inbox for the application update" : "See your private preview before you pay"}</dd></div>
                </dl></section>
                <section className="pb-st-card" aria-labelledby="thanks-next"><h2 id="thanks-next">What happens next</h2><ol className="pb-st-receipt-next">{next.map(line => <li key={line}>{line}</li>)}</ol></section>
            </div>
            <p className="pb-st-help">You can close this page. Check your inbox and spam folder for our email.</p>
            <div className="pb-st-done-cta"><Button href={giveaway ? "/100-pages-giveaway" : "/"} variant="dark">Back to {giveaway ? "giveaway" : "Tendso"}</Button><Button href="/help#contact" variant="ghost">Need to correct something?</Button></div>
        </div></div></main>
    </div>;
}
