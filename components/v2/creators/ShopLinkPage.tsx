"use client";

import { useEffect } from "react";

import { rememberAffiliate } from "@/lib/campaign";
import { useCreatorCard, useRecordClick, type CreatorCard } from "@/lib/v2/creatorData";
import { firstName, peso } from "@/lib/v2/creatorProgram";

import { MiniFoot, SoloBar } from "./Chrome";
import { CreatorsBoundary } from "./CreatorsBoundary";
import { CreatorPhoto, GetTheApp } from "./LinkPageParts";
import { Photo } from "./Photo";
import { PhoneFrame } from "../PhoneFrame";
import { StoreRow } from "./Stores";

const SITES = [
    { id: "forge", name: "Forge Barbers", kind: "Barber · Marikina", src: "/v2/sites/forge-m.jpg", alt: "Forge Barbers website" },
    { id: "hela", name: "Héla Hair Studio", kind: "Salon · Makati", src: "/v2/sites/hela-m.jpg", alt: "Héla Hair Studio website" },
    { id: "vulca", name: "Vulca Garage", kind: "Mechanic · Cebu City", src: "/v2/sites/vulca-m.jpg", alt: "Vulca Garage website" },
] as const;

/** /v2/a/<handle>: what a shop owner sees from a creator's link. Records the click when it loads. */
export function ShopLinkPage({ handle }: { handle: string }) {
    return (
        <CreatorsBoundary>
            <ShopLinkInner handle={handle} />
        </CreatorsBoundary>
    );
}

function ShopLinkInner({ handle }: { handle: string }) {
    const state = useCreatorCard(handle);
    useRecordClick(handle, "shop");
    // The owner intake (/start?affiliate=<handle>) reads this, exactly as the original /a/<handle> page does.
    useEffect(() => rememberAffiliate(handle), [handle]);

    return (
        <>
            <SoloBar brandHref="/v2" right={<a className="btn btn--accent btn--sm" href="#get">Get the app</a>} />
            <main className="wrap">
                {state.status === "loading" && <Loading />}
                {state.status === "missing" && <Missing />}
                {state.status === "found" && <Found card={state.card} />}
                <MiniFoot
                    links={[
                        { label: "Help", href: "/v2/help" },
                        { label: "Privacy", href: "/v2/privacy" },
                        { label: "Share Tendso and earn", href: "/v2/creators" },
                    ]}
                />
            </main>
        </>
    );
}

function Loading() {
    return (
        <section className="as-state" aria-busy="true" aria-label="Loading">
            <span className="as-skel" style={{ width: 220, height: 24 }} />
            <span className="as-skel" style={{ width: "min(560px, 100%)", height: 96 }} />
            <span className="as-skel" style={{ width: 320, height: 64 }} />
        </section>
    );
}

function Missing() {
    return (
        <section className="as-state">
            <h1>This link is not active.</h1>
            <p>It may be old, or the creator is not on Tendso yet. You can still get the app and build your shop&apos;s website.</p>
            <StoreRow />
        </section>
    );
}

function Found({ card }: { card: CreatorCard }) {
    const name = firstName(card.name);
    const saves = card.saving > 0;
    return (
        <>
            <section className="as-hero" aria-labelledby="as-h">
                <div className="as-copy">
                    <p className="ag-eyebrow">{name} sent you</p>
                    <h1 className="as-h" id="as-h">
                        {saves ? `With ${name}, you save ${peso(card.saving)}.` : `${name} sent you to Tendso.`}
                    </h1>
                    <div className="as-price">
                        {saves ? <s>{peso(card.listPrice)}</s> : null}
                        <b>{peso(card.price)}</b>
                        <span>Your shop&apos;s website. Pay once. No monthly fee.</span>
                    </div>
                    <GetTheApp card={card} />
                </div>
                <figure className="as-photo">
                    <CreatorPhoto card={card} />
                    <figcaption className="as-photo-tag">
                        <span>
                            <b>{card.name}</b>
                            <span>Tendso creator</span>
                        </span>
                        {card.code ? <span className="code">{card.code}</span> : null}
                    </figcaption>
                </figure>
            </section>

            <section className="as-sec" aria-labelledby="as-how">
                <h2 className="as-h2" id="as-how">
                    How it works.
                </h2>
                <ol className="as-steps">
                    <li className="as-step">
                        <figure className="as-fig-wash">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/v2/creators/app-icon-256.png" alt="" width={112} height={112} style={{ width: 112, height: 112, objectFit: "contain", borderRadius: 26, boxShadow: "var(--shadow-object)" }} />
                        </figure>
                        <div className="as-step-t">
                            <span>1</span>
                            <b>Download the app.</b>
                        </div>
                    </li>
                    <li className="as-step">
                        <figure className="as-grid4" aria-hidden="true">
                            {/* eslint-disable @next/next/no-img-element */}
                            <img src="/v2/creators/photos/forge-headshot.jpg" alt="" />
                            <img src="/v2/creators/photos/tailor-owner.jpg" alt="" />
                            <img src="/v2/creators/photos/hela-owner.jpg" alt="" />
                            <img src="/v2/creators/photos/vulca-owner.jpg" alt="" />
                            {/* eslint-enable @next/next/no-img-element */}
                        </figure>
                        <div className="as-step-t">
                            <span>2</span>
                            <b>Pick what you sell.</b>
                        </div>
                    </li>
                    <li className="as-step">
                        <figure>
                            <Photo name="barber.jpg" alt="A friend films a barber talking about his shop" sizes="(max-width: 760px) 90vw, 30vw" position="40% 40%" />
                        </figure>
                        <div className="as-step-t">
                            <span>3</span>
                            <b>A friend interviews you and takes 10 photos.</b>
                        </div>
                    </li>
                    <li className="as-step">
                        <figure className="as-fig-ink">
                            <p className="as-big">
                                20<small>minutes</small>
                            </p>
                        </figure>
                        <div className="as-step-t">
                            <span>4</span>
                            <b>We build it in about 20 minutes.</b>
                        </div>
                    </li>
                    <li className="as-step">
                        <figure>
                            <Photo src="/v2/sites/forge-m.jpg" alt="A finished barber website" sizes="(max-width: 760px) 90vw, 30vw" position="top" />
                        </figure>
                        <div className="as-step-t">
                            <span>5</span>
                            <b>See it first.</b>
                        </div>
                    </li>
                    <li className="as-step as-step--accent">
                        <figure className="as-fig-wash">
                            <div className="as-pay">
                                <span className="p">
                                    {saves ? <s>{peso(card.listPrice)}</s> : null}
                                    <b>{peso(card.price)}</b>
                                </span>
                                <span className="k">{name}&apos;s code is already in</span>
                            </div>
                        </figure>
                        <div className="as-step-t">
                            <span>6</span>
                            <b>Pay once to publish.</b>
                        </div>
                    </li>
                </ol>
            </section>

            <section className="as-sec" aria-labelledby="as-sites">
                <h2 className="as-h2" id="as-sites">
                    Shops like yours.
                </h2>
                <div className="as-sites">
                    {SITES.map((s) => (
                        <div className="as-site" key={s.id}>
                            <PhoneFrame size="md" image={{ src: s.src, alt: s.alt }} />
                            <b>{s.name}</b>
                            <span>{s.kind}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="as-sec" id="get" aria-labelledby="as-end-h">
                <div className="as-end">
                    <h2 id="as-end-h">Get the app. {name}&apos;s code is waiting.</h2>
                    <div className="as-end-r">
                        <GetTheApp card={card} />
                    </div>
                </div>
            </section>
        </>
    );
}

