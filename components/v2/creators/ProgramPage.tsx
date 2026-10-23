import Link from "next/link";
import type { CSSProperties } from "react";

import { CODE_PRICE, CODE_SAVING, KEEP_PER_SHOP, LIST_PRICE, OVERRIDE_PER_SALE, peso } from "@/lib/v2/creatorProgram";

import { Calculator } from "./Calculator";
import { ProgramNav } from "./Chrome";
import { Face } from "./Face";
import { HomeScreen } from "./HomeScreen";
import { ArrowDownIcon, ArrowRightIcon, PlusIcon } from "./icons";
import { Photo } from "./Photo";
import { SamplePortal } from "./SamplePortal";
import { CreatorsRoot } from "./CreatorsRoot";
import { PhoneFrame } from "../PhoneFrame";
import { Footer } from "../Footer";

const FAQ: [string, string][] = [
    ["Do I need to visit shops?", "No. Field agents visit shops. You share your link and code online, where people already follow you."],
    [
        "How much do I get when a shop uses my code?",
        `With the usual 30% off, the shop pays ${peso(CODE_PRICE)} and you keep ${peso(KEEP_PER_SHOP)}. You can give a bigger discount, down to ₱999. You always keep half of what the shop pays.`,
    ],
    [
        "How does the monthly money work?",
        `When someone joins as a field agent through your link, you get 5% of every sale they make for 12 months from the day they join. On a ₱2,999 sale that is ${peso(OVERRIDE_PER_SALE)}. It never comes out of the agent’s half.`,
    ],
    ["When do I get paid?", "Your shop money after the shop pays. Your 5% after the shop has paid in full. You send it to your Wise account from your portal."],
    ["Do I earn when people sign up?", "No. Only real, paid sales count. No sale, no payout."],
    ["Is this a pyramid scheme?", "No. It is free to join, nothing is paid for sign-ups, and there is one level only: you never earn on the people your agents bring in."],
    ["Can I use my code for my own shop?", "No. You never earn on your own shop."],
    ["What if someone forgets my code?", "On iPhone the app asks once: “Did Mika send you?”. There is also a “Who sent you?” box at sign-up and at checkout."],
];

const MONTH_BARS = Array.from({ length: 12 }, (_, i) => i);

/** /v2/creators: the creator program page. Ported from the mock's pages/creator-program.html. */
export function ProgramPage() {
    return (
        <CreatorsRoot>
            <ProgramNav />

            <main id="top">
                {/* 1. Hero */}
                <section className="ag-hero" aria-labelledby="cp-hero-h">
                    <div className="wrap ag-hero-in">
                        <div className="ag-hero-copy">
                            <p className="ag-eyebrow" data-reveal>
                                For creators
                            </p>
                            <h1 className="ag-hero-h cp-hero-h" id="cp-hero-h" data-reveal style={{ "--i": 1 } as CSSProperties}>
                                Share your link. Earn two ways.
                            </h1>
                            <p className="ag-hero-sub" data-reveal style={{ "--i": 2 } as CSSProperties}>
                                You post online. Shops save with your code. Field agents join your team. You never visit a shop.
                            </p>
                            <div className="ag-hero-cta" data-reveal style={{ "--i": 3 } as CSSProperties}>
                                <Link className="btn btn--accent ag-btn-lg" href="/v2/creators/signup">
                                    Apply as a creator
                                </Link>
                                <a className="btn btn--line ag-btn-lg ag-btn-2" href="#calc">
                                    See what you could earn
                                    <ArrowDownIcon />
                                </a>
                            </div>
                            <ul className="ag-facts" data-reveal style={{ "--i": 4 } as CSSProperties}>
                                <li>Free to join</li>
                                <li>Paid on real sales only</li>
                                <li>Payouts to Wise</li>
                            </ul>
                        </div>

                        <div className="ag-hero-stage cp-hero-stage" data-reveal style={{ "--i": 2 } as CSSProperties}>
                            <figure className="ag-hero-photo">
                                <Photo name="mika.jpg" alt="Mika Santos, a Tendso creator" sizes="(max-width: 1080px) 80vw, 46vw" position="50% 22%" priority />
                            </figure>
                            <div className="ag-hero-phone">
                                <PhoneFrame size="md">
                                    <HomeScreen />
                                </PhoneFrame>
                            </div>
                            <div className="ag-paid cp-code-card" aria-label={`Example: a shop uses Mika's code, pays ${peso(CODE_PRICE)}, Mika keeps ${peso(KEEP_PER_SHOP)}`}>
                                <div className="ag-paid-top">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src="/v2/creators/photos/tailor-owner.jpg" alt="" width={46} height={46} />
                                    <span>
                                        <b>Lito’s Tailoring</b>
                                        <small>Used code MIKA</small>
                                    </span>
                                    <em className="ag-tag">Example</em>
                                </div>
                                <div className="ag-paid-keep">
                                    <span>Mika keeps</span>
                                    <strong>{peso(KEEP_PER_SHOP)}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. Two ways to earn */}
                <section className="ag-sec" id="ways" aria-labelledby="ways-h">
                    <div className="wrap">
                        <div className="ag-head">
                            <p className="ag-eyebrow" data-reveal>
                                Two ways to earn
                            </p>
                            <h2 className="ag-h2" id="ways-h" data-reveal style={{ "--i": 1 } as CSSProperties}>
                                Money now. And money every month.
                            </h2>
                            <p className="ag-head-sub" data-reveal style={{ "--i": 2 } as CSSProperties}>
                                Both come from real sales. Nobody is paid for sign-ups.
                            </p>
                        </div>
                        <div className="cp-ways">
                            <article className="cp-way cp-way--now" data-reveal>
                                <div className="cp-way-top">
                                    <span className="cp-pill">Money now</span>
                                    <span className="cp-way-who">Shops use your code</span>
                                </div>
                                <p className="cp-way-big">
                                    {peso(KEEP_PER_SHOP)}
                                    <small>per shop</small>
                                </p>
                                <div className="cp-ticket" aria-hidden="true">
                                    <span className="cp-ticket-code">MIKA</span>
                                    <span className="cp-ticket-off">30% off</span>
                                    <span className="cp-ticket-price">
                                        <s>{peso(LIST_PRICE)}</s>
                                        <b>{peso(CODE_PRICE)}</b>
                                    </span>
                                </div>
                                <ul className="cp-way-list">
                                    <li>
                                        The shop pays {peso(CODE_PRICE)} instead of {peso(LIST_PRICE)}.
                                    </li>
                                    <li>You keep half: {peso(KEEP_PER_SHOP)}.</li>
                                    <li>Want a bigger discount? Go as low as ₱999. You still keep half.</li>
                                </ul>
                            </article>
                            <article className="cp-way cp-way--monthly" data-reveal style={{ "--i": 1 } as CSSProperties}>
                                <div className="cp-way-top">
                                    <span className="cp-pill cp-pill--accent">Monthly money</span>
                                    <span className="cp-way-who">Field agents join your team</span>
                                </div>
                                <p className="cp-way-big">
                                    {peso(OVERRIDE_PER_SALE)}
                                    <small>per sale they make</small>
                                </p>
                                <div className="cp-months" aria-hidden="true">
                                    <div className="cp-months-row">
                                        {MONTH_BARS.map((i) => (
                                            <i key={i} />
                                        ))}
                                    </div>
                                    <span className="cp-months-l">12 months from the day they join</span>
                                </div>
                                <ul className="cp-way-list">
                                    <li>You get 5% of each sale. On a ₱2,999 sale, that’s {peso(OVERRIDE_PER_SALE)}.</li>
                                    <li>For 12 months per agent. One level only.</li>
                                    <li>Paid when the shop has paid in full. Never from the agent’s half.</li>
                                </ul>
                            </article>
                        </div>
                    </div>
                </section>

                {/* 3. Calculator */}
                <section className="ag-sec" id="calc" aria-labelledby="calc-h">
                    <div className="wrap">
                        <div className="ag-head">
                            <p className="ag-eyebrow" data-reveal>
                                Calculator
                            </p>
                            <h2 className="ag-h2" id="calc-h" data-reveal style={{ "--i": 1 } as CSSProperties}>
                                What could one month look like?
                            </h2>
                            <p className="ag-head-sub" data-reveal style={{ "--i": 2 } as CSSProperties}>
                                Move the sliders. Every number below is an example.
                            </p>
                        </div>
                        <Calculator />
                    </div>
                </section>

                {/* 4. How it works */}
                <section className="ag-sec" id="how" aria-labelledby="how-h">
                    <div className="wrap">
                        <div className="ag-head">
                            <p className="ag-eyebrow" data-reveal>
                                How it works
                            </p>
                            <h2 className="ag-h2" id="how-h" data-reveal style={{ "--i": 1 } as CSSProperties}>
                                Three steps. No shop visits.
                            </h2>
                        </div>
                        <ol className="cp-steps">
                            <li className="cp-step" data-reveal>
                                <span className="cp-step-n">1</span>
                                <h3 className="ag-h3">Apply</h3>
                                <p>Tell us where you post. It takes two minutes.</p>
                                <div className="cp-step-vis cp-vis-apply" aria-hidden="true">
                                    <span className="cp-mini-field">
                                        <i className="cp-dot" />
                                        TikTok<b>@mikasantos.ph</b>
                                    </span>
                                    <span className="cp-mini-field">
                                        <i className="cp-dot" />
                                        Instagram<b>@mika.santos</b>
                                    </span>
                                    <span className="cp-mini-btn">Send for review</span>
                                </div>
                            </li>
                            <li className="cp-step" data-reveal style={{ "--i": 1 } as CSSProperties}>
                                <span className="cp-step-n">2</span>
                                <h3 className="ag-h3">Get your link and code</h3>
                                <p>One link for shops, one for future field agents, and your code.</p>
                                <div className="cp-step-vis cp-vis-links" aria-hidden="true">
                                    <span className="cp-chip-link">tendso.com/a/mika</span>
                                    <span className="cp-chip-link">tendso.com/a/mika/earn</span>
                                    <span className="cp-chip-code">MIKA</span>
                                </div>
                            </li>
                            <li className="cp-step" data-reveal style={{ "--i": 2 } as CSSProperties}>
                                <span className="cp-step-n">3</span>
                                <h3 className="ag-h3">Share</h3>
                                <p>Post it, pin it in your bio, send it to friends with a shop.</p>
                                <div className="cp-step-vis cp-vis-story" aria-hidden="true">
                                    <Photo name="tailor-fit.jpg" alt="" sizes="(max-width: 1080px) 90vw, 30vw" position="50% 30%" />
                                    <span className="cp-story-bar">
                                        <i />
                                        <i />
                                        <i />
                                    </span>
                                    <span className="cp-story-sticker">tendso.com/a/mika</span>
                                </div>
                            </li>
                        </ol>
                    </div>
                </section>

                {/* 5. What you get */}
                <section className="ag-sec" id="get" aria-labelledby="get-h">
                    <div className="wrap">
                        <div className="ag-head">
                            <p className="ag-eyebrow" data-reveal>
                                What you get
                            </p>
                            <h2 className="ag-h2" id="get-h" data-reveal style={{ "--i": 1 } as CSSProperties}>
                                Everything to share, and to see it work.
                            </h2>
                        </div>
                        <div className="cp-get">
                            <article className="ag-g cp-g cp-g--links" data-reveal>
                                <div className="ag-g-copy">
                                    <h3 className="ag-h3">Two links.</h3>
                                    <p>Shops see your face and their saving. Job seekers see your team.</p>
                                </div>
                                <div className="cp-g-links" aria-hidden="true">
                                    <div className="cp-g-link">
                                        <Face src="/v2/creators/faces/mika.jpg" name="Mika Santos" size={52} />
                                        <div>
                                            <b>tendso.com/a/mika</b>
                                            <span>For shops · “With Mika, you save {peso(CODE_SAVING)}”</span>
                                        </div>
                                    </div>
                                    <div className="cp-g-link">
                                        <Face src="/v2/creators/faces/mika.jpg" name="Mika Santos" size={52} />
                                        <div>
                                            <b>tendso.com/a/mika/earn</b>
                                            <span>For field agents · “Join Mika&apos;s team”</span>
                                        </div>
                                    </div>
                                </div>
                            </article>
                            <article className="ag-g cp-g cp-g--code" data-reveal style={{ "--i": 1 } as CSSProperties}>
                                <div className="ag-g-copy">
                                    <h3 className="ag-h3">Your own code.</h3>
                                    <p>Already filled in when shops come from your link.</p>
                                </div>
                                <div className="ag-code" aria-hidden="true">
                                    <span className="ag-code-l">Your code</span>
                                    <span className="ag-code-v">MIKA</span>
                                    <span className="ag-code-b">30% off · {peso(CODE_PRICE)}</span>
                                </div>
                            </article>
                            <article className="ag-g cp-g cp-g--portal" data-reveal>
                                <div className="ag-g-copy">
                                    <h3 className="ag-h3">Your portal.</h3>
                                    <p>Clicks, downloads, sales, your agents, your payouts. All in pesos.</p>
                                </div>
                                <div className="cp-funnel-mini" aria-hidden="true">
                                    {(
                                        [
                                            ["Clicks", "100%", "2,480", false],
                                            ["Downloads", "44%", "412", false],
                                            ["Sign-ups", "22%", "63", false],
                                            ["Sales", "9%", "7", true],
                                        ] as const
                                    ).map(([label, w, n, on]) => (
                                        <div key={label}>
                                            <span>{label}</span>
                                            <i className={on ? "on" : undefined} style={{ "--w": w } as CSSProperties} />
                                            <b>{n}</b>
                                        </div>
                                    ))}
                                </div>
                                <a className="cp-g-more" href="#portal">
                                    See the portal
                                    <ArrowRightIcon />
                                </a>
                            </article>
                            <article className="ag-g cp-g cp-g--chat" data-reveal style={{ "--i": 1 } as CSSProperties}>
                                <div className="ag-g-copy">
                                    <h3 className="ag-h3">A team chat.</h3>
                                    <p>Your own channel on our Discord for the agents you bring in.</p>
                                </div>
                                <div className="ag-chat" aria-hidden="true">
                                    <div className="cp-chat-ch"># mikas-team</div>
                                    <div className="ag-chat-bot">
                                        <Face className="cp-av-face" src="/v2/creators/faces/paolo.jpg" name="Paolo" size={42} />
                                        <div>
                                            <b>Paolo</b>
                                            <p>First barber done. He loved seeing it before paying.</p>
                                        </div>
                                    </div>
                                    <div className="ag-chat-me">Nice! Post the before and after.</div>
                                </div>
                            </article>
                        </div>
                    </div>
                </section>

                {/* 5b. What your portal looks like (new) */}
                <section className="ag-sec" id="portal" aria-labelledby="portal-h">
                    <div className="wrap">
                        <div className="ag-head">
                            <p className="ag-eyebrow" data-reveal>
                                Your portal
                            </p>
                            <h2 className="ag-h2" id="portal-h" data-reveal style={{ "--i": 1 } as CSSProperties}>
                                What your portal looks like.
                            </h2>
                            <p className="ag-head-sub" data-reveal style={{ "--i": 2 } as CSSProperties}>
                                The real thing, with sample data. Everything you would see when you log in.
                            </p>
                        </div>
                        <div data-reveal>
                            <SamplePortal />
                        </div>
                        <p className="ag-note" data-reveal>
                            Sample data: Mika Santos is made up, and so is every number. Your own portal fills in as shops use your code and field agents join your link.
                        </p>
                    </div>
                </section>

                {/* 6. Rules */}
                <section className="ag-sec" id="rules" aria-labelledby="rules-h">
                    <div className="wrap">
                        <div className="ag-trust cp-rules" data-reveal>
                            <div className="ag-trust-copy">
                                <p className="ag-eyebrow">The rules</p>
                                <h2 className="ag-h2" id="rules-h">
                                    Clear rules. No tricks.
                                </h2>
                                <ul className="ag-checks">
                                    {[
                                        "Paid on real sales only. Nothing for sign-ups.",
                                        "No fees to join. Tendso never asks you for money.",
                                        "12 months per field agent, from the day they join.",
                                        "One level only. You don't earn on your agents' recruits.",
                                        "You never earn on your own shop.",
                                    ].map((t) => (
                                        <li key={t}>
                                            <i aria-hidden="true" />
                                            {t}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="cp-levels" aria-label="One level: you earn on your agents' sales, not on the people they bring in">
                                <div className="cp-lv cp-lv--you">
                                    <Face src="/v2/creators/faces/mika.jpg" name="Mika Santos" />
                                    <div>
                                        <b>You</b>
                                        <span>Your code: {peso(KEEP_PER_SHOP)} per shop</span>
                                    </div>
                                </div>
                                <span className="cp-lv-arrow" aria-hidden="true" />
                                <div className="cp-lv cp-lv--team">
                                    <div className="cp-lv-faces">
                                        <Face src="/v2/creators/faces/paolo.jpg" name="Paolo" />
                                        <Face src="/v2/creators/faces/joy.jpg" name="Joy" />
                                        <Face src="/v2/creators/faces/carlo.jpg" name="Carlo" />
                                        <Face src="/v2/creators/faces/rina.jpg" name="Rina" />
                                    </div>
                                    <div>
                                        <b>Your field agents</b>
                                        <span>5% of each sale, 12 months</span>
                                    </div>
                                </div>
                                <span className="cp-lv-arrow cp-lv-arrow--off" aria-hidden="true" />
                                <div className="cp-lv cp-lv--off">
                                    <span className="cp-lv-x" aria-hidden="true" />
                                    <div>
                                        <b>People they bring in</b>
                                        <span>Not you. One level only.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 7. FAQ */}
                <section className="ag-sec" id="faq" aria-labelledby="faq-h">
                    <div className="wrap ag-faq-in">
                        <div className="ag-head ag-head--side">
                            <p className="ag-eyebrow" data-reveal>
                                Questions
                            </p>
                            <h2 className="ag-h2" id="faq-h" data-reveal style={{ "--i": 1 } as CSSProperties}>
                                Short answers.
                            </h2>
                        </div>
                        <div className="ag-faq" data-reveal style={{ "--i": 2 } as CSSProperties}>
                            {FAQ.map(([q, a]) => (
                                <details className="ag-qa" key={q}>
                                    <summary>
                                        {q}
                                        <span className="ag-qa-plus">
                                            <PlusIcon />
                                        </span>
                                    </summary>
                                    <div className="ag-qa-a">
                                        <p>{a}</p>
                                    </div>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 8. Sign up */}
                <section className="ag-sec ag-sec--end" id="start" aria-labelledby="start-h">
                    <div className="wrap">
                        <div className="ag-end" data-reveal>
                            <div className="ag-end-copy">
                                <h2 className="ag-end-h cr-end-h" id="start-h">
                                    Start sharing this week.
                                </h2>
                                <ol className="ag-end-steps">
                                    <li>
                                        <span>1</span>Apply, about 2 minutes
                                    </li>
                                    <li>
                                        <span>2</span>Get your link and code
                                    </li>
                                    <li>
                                        <span>3</span>Post it where people know you
                                    </li>
                                </ol>
                                <div className="ag-end-cta">
                                    <Link className="btn btn--ink ag-btn-lg" href="/v2/creators/signup">
                                        Apply as a creator
                                    </Link>
                                    <a className="btn ag-btn-lg ag-btn-onaccent" href="#portal">
                                        See the portal
                                    </a>
                                </div>
                            </div>
                            <figure className="ag-end-photo">
                                <Photo name="tailor-sew.jpg" alt="A tailor at work, one of the shops a creator's code helped online" sizes="(max-width: 900px) 90vw, 36vw" position="50% 50%" />
                            </figure>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </CreatorsRoot>
    );
}
