import Link from "next/link";

import { GiveawayStage } from "@/app/100-pages-giveaway/_components/Stage";
import { WEBSITE_PRICE, formatPHP } from "@/lib/pricing";

import type { SubmittedReceipt } from "../draft";

const NEXT = [
    "Off the Record checks that its poster is up in your shop.",
    "When it's approved, you get an email and Tendso starts building your free website.",
    "Your link arrives by email when it's live. If it can't be accepted, we'll email you why.",
];

/**
 * The end of a giveaway application, on the campaign's poster ground: the
 * stamped "Salamat!", what was sent, and what happens next. Same receipt rules
 * as the paid thanks page: every line the receipt cannot fill is left out.
 */
export function GiveawayThanks({ receipt }: { receipt: SubmittedReceipt | null }) {
    const email = receipt?.email ?? null;
    const forLine = [receipt?.businessName, receipt?.city].filter(Boolean).join(" · ");
    return (
        <GiveawayStage short exit={{ href: "/100-pages-giveaway", label: "Back to giveaway" }}>
            <div className="gw-thanks">
                <div className="gw-stamped">
                    <p className="gw-banner" aria-hidden="true">Salamat!</p>
                    <p className="gw-stamp">Application received</p>
                </div>
            </div>

            <div className="gw-thanks">
                <div className="flex flex-col gap-2.5">
                    <h1 className="gw-thanks-h">Off the Record has your application.</h1>
                    <p className="gw-closed-text">
                        Your slot is reserved while Off the Record checks your business and poster photo. Tendso will email your free website to{" "}
                        <strong className="font-extrabold text-[var(--gw-ink)] [overflow-wrap:anywhere]">{email ?? "the address you gave us"}</strong>{" "}
                        when it&apos;s ready, if your application qualifies.
                    </p>
                </div>

                <dl className="gw-receipt" aria-label="What you sent">
                    {email ? <div><dt>We&apos;ll write to</dt><dd>{email}</dd></div> : null}
                    <div>
                        <dt>Your website</dt>
                        <dd><span className="gw-free">FREE</span><span className="gw-worth">worth {formatPHP(WEBSITE_PRICE)} · with a Tendso web address</span></dd>
                    </div>
                    {forLine ? <div><dt>For</dt><dd>{forLine}</dd></div> : null}
                </dl>

                <section className="gw-next" aria-labelledby="giveaway-next">
                    <h2 id="giveaway-next" className="gw-step-label"><span>What happens next</span></h2>
                    <ol>
                        {NEXT.map((line, index) => (
                            <li key={index}>
                                <span className="gw-badge" aria-hidden="true">{index + 1}</span>
                                <span>{line}</span>
                            </li>
                        ))}
                    </ol>
                </section>
            </div>

            <div className="gw-thanks is-tight">
                <Link href="/100-pages-giveaway" className="gw-cta">Back to the giveaway</Link>
                <p className="gw-small">Nothing to pay · No account to make · Check spam for our email</p>
                <p className="gw-small">
                    Something wrong with what you sent? <Link href="/knowledge#contact">Message us</Link> and we&apos;ll fix it before we build.
                </p>
            </div>
        </GiveawayStage>
    );
}
