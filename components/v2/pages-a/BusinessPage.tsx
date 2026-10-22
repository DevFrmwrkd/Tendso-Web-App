import { ArrowRight, Check, Lock, Plus, Search } from "lucide-react";
import Image from "next/image";
import type { CSSProperties } from "react";

import { Button, Label, PhoneFrame } from "@/components/v2";

import { BeforeAfter, LaptopView, TypedQuery } from "./business-client";
import { SHOWCASE_SITES } from "./data";
import { FaqList, type FaqItem } from "./Faq";
import { PageShell } from "./PageShell";
import { PaTile } from "./PaTile";
import { SitePhone } from "./SitePhone";
import { Stores } from "./Stores";

const A = "/v2/pages-a";
const rev = (i: number): CSSProperties => ({ ["--i" as string]: i });

/* TODO(Theo): sample owner words from the mock (Forge Barbers). */
const WORDS = {
    transcript: "Forge, on J.P. Rizal in Marikina. Clean fades, scissor cuts, a hot-towel shave. Walk in, no fuss, no waiting.",
    copy: ["Sharp cuts.", "No fuss,", "no waiting."],
};

const FAQ: FaqItem[] = [
    { q: "How long does it take?", a: "About 20 minutes in the app, or 30 with an agent at your shop. We build your site in about 20 minutes, the same day." },
    { q: "Do I need a laptop?", a: "No. Everything happens on your phone." },
    { q: "What if I don't like it?", a: "You see it live before you pay. If something is off, we change it. You only pay once you approve it." },
    { q: "Can I change it later?", a: "Yes. Edits are free for the first year. Ask us, we make the change." },
    { q: "What about my domain?", a: "You get your own address, like forge.sites.tendso.com. Prefer your own .com? We can register and set one up when your site goes live. Just ask." },
    { q: "Who are the field agents?", a: "Local people we train to interview you, take the photos and set up your site with the same app. They come to your shop." },
];

const INCLUDED = [
    "A real coded website, not a fill-in template",
    "Your own live web address",
    "Built from your photos and your words",
    "Mobile-first",
    "Hosted with SSL, kept online",
];

/** A deterministic waveform: same bars on server and client. */
const WAVE = Array.from({ length: 34 }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.43)));

const STRIP = ["forge", "vulca", "hela", "tailor", "carpenter", "florist"].map((id) => SHOWCASE_SITES.find((s) => s.id === id)!);

function SectionHead({ label, id, title, link }: { label: string; id: string; title: string; link?: { href: string; label: string } }) {
    return (
        <div className="sec-head">
            <div>
                <Label data-reveal="">{label}</Label>
                <h2 className="sec-h" id={id} data-reveal="" style={rev(1)}>
                    {title}
                </h2>
            </div>
            {link && (
                <a className="link-arr" href={link.href} data-reveal="" style={rev(2)}>
                    {link.label} <ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" />
                </a>
            )}
        </div>
    );
}

export function BusinessPage() {
    return (
        <PageShell page="business">
            <div className="pg">
                {/* 1. Hero: the finished site, on a phone and on a laptop */}
                <section className="v2-wrap bh" aria-labelledby="bh-h">
                    <div className="bh-top">
                        <div>
                            <Label data-reveal="hero">For businesses</Label>
                            <h1 className="bh-h" id="bh-h" data-reveal="hero" style={rev(1)}>
                                Your website, finished. Before you pay.
                            </h1>
                        </div>
                        <div className="bh-side" data-reveal="hero" style={rev(2)}>
                            <p>Talk about your shop, add photos, pick a design. You see it live, then you decide.</p>
                            <div className="bh-cta">
                                <Button href="#download">Download the app</Button>
                                <Button variant="ghost" href="/v2#hire">
                                    Hire an agent
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div className="bh-stage" data-reveal="hero" style={rev(3)}>
                        <div className="bh-caption">
                            <span className="sample-tag">Sample site · Forge, Marikina</span>
                        </div>
                        <div className="browser bh-browser" id="bh-browser">
                            <div className="browser-bar">
                                <div className="browser-dots">
                                    <i />
                                    <i />
                                    <i />
                                </div>
                                <div className="browser-url">
                                    <Lock size={11} className="lock" aria-hidden="true" />
                                    forge.sites.tendso.com
                                </div>
                                <div className="browser-dots" style={{ visibility: "hidden" }}>
                                    <i />
                                    <i />
                                    <i />
                                </div>
                            </div>
                            <LaptopView src={`${A}/sites/forge-d-long.jpg`} width={1440} height={3200} alt="Forge Barbers' website on a laptop" />
                        </div>
                        <div className="bh-phone">
                            <SitePhone src={`${A}/sites/forge-m-long.jpg`} width={780} height={5200} url="forge.sites.tendso.com" alt="Forge Barbers' website on a phone" priority />
                        </div>
                    </div>
                </section>

                {/* 2. Two ways in */}
                <section className="v2-wrap sec" aria-labelledby="ways-h">
                    <SectionHead label="Two ways in" id="ways-h" title="Do it yourself, or have someone come by." />
                    <div className="ways">
                        <PaTile tone="quiet" className="way" data-reveal="">
                            <div className="way-text">
                                <Label>In the app</Label>
                                <h3 className="way-h">Do it yourself on your phone.</h3>
                                <div className="way-time">
                                    <b>
                                        20<small style={{ fontSize: ".4em", letterSpacing: "-.03em" }}> min</small>
                                    </b>
                                    <span>About that, wherever you are.</span>
                                </div>
                                <ol className="steps-mini">
                                    <li>
                                        <span>01</span>Talk about your business
                                    </li>
                                    <li>
                                        <span>02</span>Add your photos
                                    </li>
                                    <li>
                                        <span>03</span>Pick a design
                                    </li>
                                </ol>
                            </div>
                            <div className="way-obj" id="way-phone">
                                <PhoneFrame size="md">
                                    <Image src={`${A}/screens/ways-interview-rec.jpg`} alt="The Tendso app recording an owner's interview" width={390} height={844} sizes="390px" style={{ width: 390, height: 844 }} />
                                </PhoneFrame>
                            </div>
                        </PaTile>
                        <PaTile tone="quiet" className="way" data-reveal="" style={rev(1)}>
                            <div className="way-text">
                                <Label>At your shop</Label>
                                <h3 className="way-h">A field agent comes to you.</h3>
                                <div className="way-time">
                                    <b>
                                        30<small style={{ fontSize: ".4em", letterSpacing: "-.03em" }}> min</small>
                                    </b>
                                    <span>One visit. You keep working.</span>
                                </div>
                                <ol className="steps-mini">
                                    <li>
                                        <span>01</span>Book a visit
                                    </li>
                                    <li>
                                        <span>02</span>The agent records and takes photos
                                    </li>
                                    <li>
                                        <span>03</span>You approve your site
                                    </li>
                                </ol>
                                <p className="low-price">
                                    <i />
                                    As low as ₱999 when a field agent signs you up
                                </p>
                            </div>
                            <div className="way-obj">
                                <figure className="way-photo" style={{ margin: 0 }}>
                                    <Image src={`${A}/people/01-sarisari.jpg`} alt="A field agent records a sari-sari store owner" fill sizes="(max-width: 760px) 90vw, 240px" />
                                </figure>
                            </div>
                        </PaTile>
                    </div>
                </section>

                {/* 3. What you get */}
                <section className="v2-wrap sec" aria-labelledby="get-h">
                    <SectionHead label="What you get" id="get-h" title="Everything a homepage needs." />
                    <div className="get">
                        <PaTile tone="quiet" className="g g--words" data-reveal="">
                            <Label>Your words</Label>
                            <h3 className="g-h">You talk. It becomes your site&apos;s copy.</h3>
                            <div className="g-obj words">
                                <div className="bubble">
                                    <div className="wave" aria-hidden="true">
                                        {WAVE.map((v, i) => (
                                            <i key={i} style={{ height: `${(v * 22).toFixed(1)}px` }} />
                                        ))}
                                    </div>
                                    <span>“{WORDS.transcript}”</span>
                                </div>
                                <div className="words-arr">
                                    <ArrowRight size={22} strokeWidth={1.6} aria-hidden="true" />
                                </div>
                                <p className="copy-out">
                                    {WORDS.copy.map((l, i) => (
                                        <span key={l} data-reveal="" style={rev(i * 2 + 2)}>
                                            {l}
                                        </span>
                                    ))}
                                </p>
                            </div>
                        </PaTile>
                        <PaTile tone="quiet" className="g g--photo" data-reveal="" style={rev(1)}>
                            <Label>Better photos</Label>
                            <h3 className="g-h">Same shop. Same barber. Shot properly.</h3>
                            <div className="g-obj">
                                <BeforeAfter
                                    before={`${A}/photos/phone-headshot.jpg`}
                                    after={`${A}/photos/pro2-headshot.jpg`}
                                    beforeAlt="Before: phone photo"
                                    afterAlt="After: re-shot by Tendso"
                                    width={880}
                                    height={1168}
                                />
                                <p className="ba-cap">Owner headshot, Forge Barbers</p>
                            </div>
                        </PaTile>
                        <PaTile tone="quiet" className="g g--design" data-reveal="">
                            <Label>A design for you</Label>
                            <h3 className="g-h">Made for your kind of business.</h3>
                            <div className="g-obj">
                                <div className="fan">
                                    <figure>
                                        <Image src={`${A}/showcase/vulca-d.jpg`} alt="Auto repair design" fill sizes="240px" />
                                    </figure>
                                    <figure>
                                        <Image src={`${A}/showcase/forge-d.jpg`} alt="Barbershop design" fill sizes="240px" />
                                    </figure>
                                    <figure>
                                        <Image src={`${A}/showcase/hela-d.jpg`} alt="Hair salon design" fill sizes="240px" />
                                    </figure>
                                </div>
                            </div>
                        </PaTile>
                        <PaTile tone="quiet" className="g g--host" data-reveal="" style={rev(1)}>
                            <Label>Your address</Label>
                            <h3 className="g-h">Hosted, secure, kept online.</h3>
                            <div className="g-obj addr">
                                <div className="addr-pill">
                                    <Lock size={14} aria-hidden="true" />
                                    <span>forge.sites.tendso.com</span>
                                    <i className="caret" />
                                </div>
                                <div className="addr-rows">
                                    <div>
                                        <span>Web address</span>
                                        <b>Included</b>
                                    </div>
                                    <div>
                                        <span>Hosting + SSL</span>
                                        <b>Included</b>
                                    </div>
                                    <div>
                                        <span>Your own .com</span>
                                        <b>Optional</b>
                                    </div>
                                </div>
                            </div>
                        </PaTile>
                        <PaTile tone="quiet" className="g g--mobile" data-reveal="" style={rev(2)}>
                            <Label>Mobile-first</Label>
                            <h3 className="g-h">Built for the phone in your customer&apos;s hand.</h3>
                            <div className="g-obj" id="mob-phone">
                                <SitePhone src={`${A}/sites/hela-m-long.jpg`} width={780} height={5200} size="sm" alt="Héla Hair Studio's website on a phone" />
                            </div>
                        </PaTile>
                        <PaTile tone="quiet" className="g g--seo" data-reveal="">
                            <Label>Found on Google</Label>
                            <h3 className="g-h">Your name, city and services, where people search.</h3>
                            <div className="g-obj">
                                <div className="serp">
                                    <div className="serp-q">
                                        <Search size={18} strokeWidth={1.8} aria-hidden="true" />
                                        <TypedQuery text="barbershop marikina" />
                                    </div>
                                    <div className="serp-r">
                                        <span className="serp-fav">F</span>
                                        <span className="serp-site">
                                            Forge Barbers<small>forge.sites.tendso.com</small>
                                        </span>
                                        <span className="serp-title">Forge Barbers — Barbershop in Marikina</span>
                                        <span className="serp-desc">
                                            Clean fades, scissor cuts and a hot-towel shave on J.P. Rizal, <mark>Marikina</mark>. Walk in, no waiting.
                                        </span>
                                    </div>
                                </div>
                                <div className="seo-from">
                                    <span>from your interview →</span>
                                    <span>
                                        name <b>Forge</b>
                                    </span>
                                    <span>
                                        city <b>Marikina</b>
                                    </span>
                                    <span>
                                        serves <b>fades, scissor cuts, shaves</b>
                                    </span>
                                </div>
                            </div>
                        </PaTile>
                    </div>
                </section>

                {/* 4. Price */}
                <section className="v2-wrap sec" id="price" aria-labelledby="price-h">
                    <Label data-reveal="">One price. See it first, pay once.</Label>
                    <div className="price" style={{ marginTop: 28 }}>
                        <div data-reveal="" style={rev(1)}>
                            <h2 className="price-big" id="price-h">
                                ₱4,999.<small>Once.</small>
                            </h2>
                            <p className="price-sub">
                                You see your finished site first, then <b>pay once to publish.</b> Short on cash? <b>Start with a down payment from ₱500</b> and pay the rest later.
                            </p>
                            <div className="price-pills">
                                <span>See it live first</span>
                                <span>No contracts</span>
                            </div>
                        </div>
                        <ul className="incl" data-reveal="" style={rev(2)}>
                            {INCLUDED.map((t) => (
                                <li key={t}>
                                    <Check size={16} strokeWidth={1.7} aria-hidden="true" />
                                    <span>{t}</span>
                                </li>
                            ))}
                            <li>
                                <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
                                <span>
                                    Optional: your own .com<small>We can register and set one up when your site goes live. Just ask.</small>
                                </span>
                            </li>
                        </ul>
                    </div>
                    <div className="price-foot" data-reveal="">
                        <Label>No fine print.</Label>
                        <Label>Philippines pricing. Local currency elsewhere.</Label>
                    </div>
                </section>

                {/* 5. Examples strip */}
                <section className="v2-wrap sec" aria-labelledby="ex-h">
                    <SectionHead label="Examples" id="ex-h" title="Finished sites, real kinds of business." link={{ href: "/v2/examples", label: "See all designs" }} />
                    <div className="strip">
                        {STRIP.map((s, i) => (
                            <a key={s.id} className="card" href={`/v2/examples/${s.id}`} target="_blank" rel="noopener noreferrer" data-reveal="" style={rev(i % 3)} aria-label={`${s.name}, ${s.kind}, ${s.city}. Opens in a new tab`}>
                                <div className="card-img card-img--d">
                                    <Image src={`${A}/showcase/${s.id}-d.jpg`} alt={`${s.name} website`} fill sizes="(max-width: 760px) 80vw, (max-width: 900px) 50vw, 33vw" />
                                    <span className="card-view">
                                        Open <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
                                    </span>
                                </div>
                                <div className="card-meta">
                                    <b>{s.name}</b>
                                    <span>
                                        {s.kind} · {s.city}
                                    </span>
                                </div>
                            </a>
                        ))}
                    </div>
                </section>

                {/* 6. FAQ */}
                <section className="v2-wrap sec" aria-labelledby="faq-h">
                    <div className="faq-wrap">
                        <div>
                            <Label data-reveal="">Questions</Label>
                            <h2 className="sec-h" id="faq-h" data-reveal="" style={{ ...rev(1), marginTop: 18 }}>
                                Short answers.
                            </h2>
                        </div>
                        <FaqList items={FAQ} className="faq" data-reveal="" style={rev(2)} />
                    </div>
                </section>

                {/* 7. Final CTA band */}
                <section className="v2-wrap band" id="download" aria-labelledby="band-h">
                    <PaTile tone="quiet" className="band-in" data-reveal="">
                        <h2 className="band-h" id="band-h">
                            See your site before you pay.
                        </h2>
                        <div className="band-cta">
                            <Stores />
                            <Button variant="ghost" href="/v2#hire">
                                Or hire an agent
                            </Button>
                        </div>
                    </PaTile>
                </section>
            </div>
        </PageShell>
    );
}
