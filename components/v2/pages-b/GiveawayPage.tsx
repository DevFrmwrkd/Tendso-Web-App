"use client";

/**
 * /v2/giveaway: Off the Record gives 100 walk-in shops a free Tendso website (pages/giveaway.html).
 *
 * Wired to what /100-pages-giveaway uses: the live count from `giveaway.giveawayStatus`, the
 * remembered giveaway intent (`rememberGiveaway` / `clearCampaign`), the tagged source, the poster
 * PDF, and the closed copy from lib/giveaway. The claim button goes to /v2/start in giveaway mode,
 * which submits through the existing owner intake.
 */

import { useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import Image from "next/image";

import { Button, Container } from "@/components/v2";
import { api } from "@/convex/_generated/api";
import { campaignFromLocation, clearCampaign, rememberGiveaway, requestFullPriceIntake } from "@/lib/campaign";
import { GIVEAWAY_POSTER_PATH, giveawayClosedCopy } from "@/lib/giveaway";
import { formatPHP, WEBSITE_PRICE } from "@/lib/pricing";

import { Reveal } from "./Reveal";
import { PbPage, SitePhone } from "./shared";

const CAP = 100;

export function GiveawayPage() {
    const status = useQuery(api.giveaway.giveawayStatus, {});
    const [source, setSource] = useState("direct");

    useEffect(() => {
        // Source cleaning is shared with campaign attribution, so video and poster tags keep the
        // same spelling on the eventual submission.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSource(campaignFromLocation().source ?? "direct");
    }, []);

    useEffect(() => {
        if (status?.open === true) rememberGiveaway(source);
        if (status?.open === false) clearCampaign();
    }, [status?.open, source]);

    const closed = status?.open === false;
    const left = closed ? 0 : (status?.slotsLeft ?? null);
    const claimHref = `/v2/start?campaign=giveaway&src=${encodeURIComponent(source)}`;
    const copy = giveawayClosedCopy(status);

    return (
        <PbPage
            nav={{
                primary: closed ? (
                    <Button href="/v2/start" size="sm" onClick={requestFullPriceIntake}>
                        Get a website
                    </Button>
                ) : (
                    <Button href={claimHref} size="sm" onClick={() => rememberGiveaway(source)}>
                        Claim your website
                    </Button>
                ),
            }}
        >
            {/* 1. The offer, and how many are left */}
            <Container className="pb-gw-hero" aria-labelledby="gw-h" role="region">
                <div className="pb-gw-offer">
                    <p className="pb-gw-lock">
                        <span>Off the Record</span>
                        <i aria-hidden="true">×</i>
                        <span>Tendso</span>
                    </p>
                    <h1 className="pb-gw-h" id="gw-h">
                        {closed ? (status && status.given >= CAP ? "All 100 given." : "The giveaway is closed.") : "100 free websites."}
                    </h1>
                    <p className="pb-gw-sub">{closed ? `${copy.thanks} ${copy.applied}` : "For walk-in shops. A gift from Off the Record, built by Tendso."}</p>
                    <div className="pb-gw-cta">
                        {closed ? (
                            <Button href="/v2/start" variant="dark" className="pb-gw-btn" onClick={requestFullPriceIntake}>
                                Get your website for {formatPHP(WEBSITE_PRICE)}
                            </Button>
                        ) : status?.open ? (
                            <>
                                <Button href={claimHref} className="pb-gw-btn" onClick={() => rememberGiveaway(source)}>
                                    Claim your free website
                                </Button>
                                <a className="pb-link-arr" href={GIVEAWAY_POSTER_PATH} download>
                                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M12 4v11m-5-5 5 5 5-5M5 20h14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    Download the poster (A4 PDF)
                                </a>
                            </>
                        ) : (
                            <Button variant="primary" className="pb-gw-btn" disabled>
                                Checking availability…
                            </Button>
                        )}
                    </div>
                </div>

                <aside className="v2-tile v2-tile--quiet pb-gw-count" aria-label="Free websites left">
                    <div className="pb-gw-count-top">
                        <div role="status" aria-live="polite" aria-atomic="true" className="pb-gw-n">
                            <b>{left === null ? "…" : left}</b>
                            <span>of {CAP} left</span>
                        </div>
                        <span className={`pb-gw-stamp ${closed ? "is-closed" : ""}`}>
                            <i />
                            {status === undefined ? "Checking" : closed ? "Closed" : "Open"}
                        </span>
                    </div>
                    <Slots left={left} />
                    <div className="pb-gw-worth">
                        <p>
                            <b>{formatPHP(WEBSITE_PRICE)}</b> each
                        </p>
                        <p>
                            <b>₱300K+</b> in websites
                        </p>
                    </div>
                </aside>
            </Container>

            {/* 2. Three steps */}
            {!closed && (
                <Container className="pb-sec" aria-labelledby="steps-h" role="region">
                    <Reveal>
                        <div className="pb-sec-head">
                            <div>
                                <span className="pb-label">How to claim</span>
                                <h2 className="pb-sec-h" id="steps-h">
                                    Three steps.
                                </h2>
                            </div>
                        </div>
                    </Reveal>
                    <ol className="pb-gw-steps">
                        <li className="v2-tile v2-tile--quiet pb-gw-step">
                            <div className="pb-gw-step-obj pb-gw-obj-poster">
                                <div className="pb-poster" role="img" aria-label="The giveaway poster">
                                    <div className="pb-poster-top">
                                        <span>Off the Record × Tendso</span>
                                    </div>
                                    <p className="pb-poster-big">Giveaway</p>
                                    <p className="pb-poster-band">100 free websites</p>
                                    <p className="pb-poster-steps">Hang · Snap · Claim</p>
                                    <div className="pb-poster-qr">
                                        <span className="pb-poster-url">tendso.com/libre</span>
                                    </div>
                                </div>
                            </div>
                            <span className="pb-gw-step-n">01</span>
                            <h3 className="pb-gw-step-h">Hang the poster.</h3>
                            <p className="pb-gw-step-p">Print it at any print shop. Put it where customers see it.</p>
                        </li>
                        <li className="v2-tile v2-tile--quiet pb-gw-step">
                            <div className="pb-gw-step-obj pb-gw-obj-photo">
                                <Image src="/v2/pages-b/phone-outside.jpg" alt="A phone photo of a barbershop front with its sign" fill sizes="(max-width: 1100px) 50vw, 30vw" />
                                <span className="pb-gw-snap" aria-hidden="true">
                                    <i />
                                </span>
                            </div>
                            <span className="pb-gw-step-n">02</span>
                            <h3 className="pb-gw-step-h">Snap it.</h3>
                            <p className="pb-gw-step-p">One photo. The poster and your sign in the same shot.</p>
                        </li>
                        <li className="v2-tile v2-tile--quiet pb-gw-step">
                            <div className="pb-gw-step-obj pb-gw-obj-phone">
                                <SitePhone src="/v2/pages-b/forge-m-long.jpg" url="forge.sites.tendso.com" alt="Forge Barbers' website on a phone" />
                            </div>
                            <span className="pb-gw-step-n">03</span>
                            <h3 className="pb-gw-step-h">Get your website.</h3>
                            <p className="pb-gw-step-p">Off the Record checks it. Tendso builds your site.</p>
                        </li>
                    </ol>
                </Container>
            )}

            {/* 3. Last word + fine print */}
            <Container className="pb-band pb-gw-band" aria-labelledby="band-h" role="region">
                <div className="v2-tile pb-gw-band-in">
                    <div>
                        <p className="pb-label">{closed ? "Still want a website?" : "No payment. No account."}</p>
                        <h2 className="pb-band-h" id="band-h">
                            {closed ? "See it first. Pay once to publish." : "Your shop, online. Free."}
                        </h2>
                    </div>
                    <div className="pb-band-cta">
                        {closed ? (
                            <Button href="/v2/start" variant="dark" className="pb-gw-btn" onClick={requestFullPriceIntake}>
                                Get it for {formatPHP(WEBSITE_PRICE)}
                            </Button>
                        ) : (
                            <Button href={claimHref} className="pb-gw-btn" onClick={() => rememberGiveaway(source)} aria-disabled={!status?.open}>
                                Claim your free website
                            </Button>
                        )}
                    </div>
                </div>
                <p className="pb-gw-fine">
                    For walk-in businesses · One entry per business · Custom domain not included · <Link href="/privacy-policy">Privacy</Link> · <Link href="/terms-of-service">Terms</Link>
                </p>
            </Container>
        </PbPage>
    );
}

/** 100 cells: the ones given or held are ink, the ones still free are accent. They fill in once, when first seen. */
function Slots({ left }: { left: number | null }) {
    const [run, setRun] = useState(false);
    const [el, setEl] = useState<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!el) return;
        const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setRun(true), { threshold: 0.4 });
        io.observe(el);
        return () => io.disconnect();
    }, [el]);

    const taken = left === null ? 0 : CAP - Math.max(0, Math.min(CAP, left));
    return (
        <div ref={setEl} className={`pb-gw-slots ${run ? "is-run" : ""}`} aria-hidden="true">
            {Array.from({ length: CAP }, (_, i) => (
                <i key={i} className={left === null ? "" : i < taken ? "is-given" : "is-open"} style={{ "--d": `${i * 9}ms` } as CSSProperties} />
            ))}
        </div>
    );
}

