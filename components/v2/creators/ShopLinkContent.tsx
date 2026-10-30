"use client";
import { AFFILIATE_SOCIAL_LABELS, AFFILIATE_SOCIAL_PLATFORMS, getAffiliateSocialLinks } from "@/lib/affiliates";
import type { CreatorCard } from "@/lib/v2/creatorTypes";
import { firstName, peso } from "@/lib/v2/creatorProgram";
import { MiniFoot, SoloBar } from "./Chrome";
import { CreatorPhoto, GetTheApp } from "./LinkPageParts";
import { Photo } from "./Photo";
import { PhoneFrame } from "../PhoneFrame";

const SITES = [
    { id: "forge", name: "Forge Barbers", kind: "Barber · Marikina", src: "/v2/sites/forge-m.jpg", alt: "Forge Barbers website" },
    { id: "hela", name: "Héla Hair Studio", kind: "Salon · Makati", src: "/v2/sites/hela-m.jpg", alt: "Héla Hair Studio website" },
    { id: "vulca", name: "Vulca Garage", kind: "Mechanic · Cebu City", src: "/v2/sites/vulca-m.jpg", alt: "Vulca Garage website" },
] as const;

/** Shared by the live public page and editor preview. No attribution effects or account reads. */
export function ShopLinkView({ card }: { card: CreatorCard }) {
    return <>
        <SoloBar brandHref="/v2" right={<a className="btn btn--accent btn--sm" href="#get">Get the app</a>} />
        <main className="wrap">
            <ShopLinkContent card={card} />
            <ShopLinkFooter />
        </main>
    </>;
}

export function ShopLinkFooter() {
    return <MiniFoot links={[
        { label: "Help", href: "/v2/help" },
        { label: "Privacy", href: "/v2/privacy" },
        { label: "Share Tendso and earn", href: "/v2/creators" },
    ]} />;
}

export function ShopLinkContent({ card }: { card: CreatorCard }) {
    const name = firstName(card.name);
    const saves = card.saving > 0;
    const message = card.message?.trim();
    const socialLinks = getAffiliateSocialLinks(card.socialLinks);
    const platforms = AFFILIATE_SOCIAL_PLATFORMS.filter((platform) => socialLinks[platform]);
    return (
        <>
            <section className="as-hero" aria-labelledby="as-h">
                <div className="as-copy">
                    <p className="ag-eyebrow">Shared by {card.name}</p>
                    <h1 className="as-h as-h--shop" id="as-h">
                        Your shop online.<br />Pay once, own it.
                    </h1>
                    {message ? <div className="as-note">
                        <p className="as-note-label">A note from {name}</p>
                        <p className="as-note-message">{message}</p>
                    </div> : null}
                    <div className="as-price">
                        {saves ? <s>{peso(card.listPrice)}</s> : null}
                        <b>{peso(card.price)}</b>
                        <span>{saves ? `Save ${peso(card.saving)} with ${name}'s code.` : "One-time website price."} See it first. Pay to publish.</span>
                    </div>
                    <GetTheApp card={card} />
                    {platforms.length ? <nav className="as-socials" aria-label={`${card.name}'s social links`}>
                        <p>Find {name} online</p>
                        <div>{platforms.map((platform) => <a key={platform} href={socialLinks[platform]} target="_blank" rel="noopener noreferrer">
                            {platform === "messenger" ? "Message on Messenger" : AFFILIATE_SOCIAL_LABELS[platform]}
                            <span aria-hidden="true">↗</span>
                        </a>)}</div>
                    </nav> : null}
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
                            <img src="/v2/sites/forge-m.jpg" alt="" />
                            <img src="/v2/sites/domingo-m.jpg" alt="" />
                            <img src="/v2/sites/hela-m.jpg" alt="" />
                            <img src="/v2/sites/vulca-m.jpg" alt="" />
                            {/* eslint-enable @next/next/no-img-element */}
                        </figure>
                        <div className="as-step-t">
                            <span>2</span>
                            <b>Choose your website design.</b>
                        </div>
                    </li>
                    <li className="as-step">
                        <figure>
                            <Photo name="barber.jpg" alt="A friend films a barber talking about his shop" sizes="(max-width: 760px) 90vw, 30vw" position="40% 40%" />
                        </figure>
                        <div className="as-step-t">
                            <span>3</span>
                            <b>Record your story and take 10 shop photos.</b>
                        </div>
                    </li>
                    <li className="as-step">
                        <figure className="as-fig-ink">
                            <p className="as-big">
                                Your<small>shop. Your story.</small>
                            </p>
                        </figure>
                        <div className="as-step-t">
                            <span>4</span>
                            <b>We turn your story into a website.</b>
                        </div>
                    </li>
                    <li className="as-step">
                        <figure>
                            <Photo src="/v2/sites/forge-m.jpg" alt="A finished barber website" sizes="(max-width: 760px) 90vw, 30vw" position="top" />
                        </figure>
                        <div className="as-step-t">
                            <span>5</span>
                            <b>Preview it and request changes.</b>
                        </div>
                    </li>
                    <li className="as-step as-step--accent">
                        <figure className="as-fig-wash">
                            <div className="as-pay">
                                <span className="p">
                                    {saves ? <s>{peso(card.listPrice)}</s> : null}
                                    <b>{peso(card.price)}</b>
                                </span>
                                {card.code ? <span className="k">Use {name}&apos;s code before you pay</span> : null}
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
                    <h2 id="as-end-h">Your shop. Your website.</h2>
                    <div className="as-end-r">
                        <GetTheApp card={card} />
                    </div>
                </div>
            </section>
        </>
    );
}
