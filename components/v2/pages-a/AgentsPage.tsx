import { ArrowDown, Lock } from "lucide-react";
import Image from "next/image";
import type { CSSProperties } from "react";

import { DISCORD_INVITE_URL } from "@/lib/contact";
import { Button, PhoneFrame } from "@/components/v2";

import { EarnCalc, PaidCard, VisitStepper } from "./agents-client";
import { APP_LINKS } from "./data";
import { FaqList, type FaqItem } from "./Faq";
import { PageShell } from "./PageShell";

const A = "/v2/pages-a";
const rev = (i: number): CSSProperties => ({ ["--i" as string]: i });

const FAQ: FaqItem[] = [
    { q: "Do I need experience?", a: "No. The training takes about 20 minutes, and the app guides you through every visit." },
    { q: "What do I need?", a: "A phone (iPhone or Android) with the Tendso app, and an email for your Wise payouts." },
    { q: "Do I collect money from the shop?", a: "No. The shop pays Tendso directly. Your half lands in your wallet when their payment is confirmed." },
    { q: "How do I get paid?", a: "To your Wise email. Cash out any amount. You don't need a Wise account first: Wise emails you a link. Use it within 7 days." },
    { q: "Can I choose the price?", a: "Yes. Any price from ₱999 to ₱4,999, for each shop, from your first site." },
    { q: "The shop has a Facebook page. Does it count?", a: "Yes. A shop with a Facebook or Instagram page can still get a website." },
];

function Eyebrow({ children, reveal = true, i }: { children: string; reveal?: boolean; i?: number }) {
    return (
        <p className="ag-eyebrow" {...(reveal ? { "data-reveal": "" } : {})} style={i ? rev(i) : undefined}>
            {children}
        </p>
    );
}

export function AgentsPage() {
    return (
        <PageShell
            page="agents"
            nav={{
                secondary: (
                    <Button variant="ghost" size="sm" href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">
                        Join the Discord
                    </Button>
                ),
                primary: (
                    <Button size="sm" href="#start">
                        Become a field agent
                    </Button>
                ),
            }}
        >
            <div className="ag">
                {/* 1. Hero: the job in one line, the app on a phone, what one visit can bring */}
                <section className="ag-hero" aria-labelledby="ag-hero-h">
                    <div className="v2-wrap ag-hero-in">
                        <div className="ag-hero-copy">
                            <p className="ag-eyebrow" data-reveal="hero">
                                For field agents
                            </p>
                            <h1 className="ag-hero-h" id="ag-hero-h" data-reveal="hero" style={rev(1)}>
                                Build websites for shops near you. Keep half.
                            </h1>
                            <p className="ag-hero-sub" data-reveal="hero" style={rev(2)}>
                                One visit with the Tendso app, about 30 minutes. Set your price, keep 50%.
                            </p>
                            <div className="ag-earn-pill" data-reveal="hero" style={rev(2)}>
                                <b>Earn ₱30,000+ a month</b>
                                <span>Example: 5 shops a week at ₱2,999, you keep ₱1,500 each</span>
                            </div>
                            <div className="ag-hero-cta" data-reveal="hero" style={rev(3)}>
                                <Button size="lg" className="ag-btn-lg" href="#start">
                                    Become a field agent
                                </Button>
                                <Button variant="ghost" size="lg" className="ag-btn-lg ag-btn-2" href="#earn">
                                    See how you earn
                                    <ArrowDown size={16} strokeWidth={1.8} aria-hidden="true" />
                                </Button>
                            </div>
                            <ul className="ag-facts" data-reveal="hero" style={rev(4)}>
                                <li>Free to join</li>
                                <li>No experience needed</li>
                                <li>No quota</li>
                            </ul>
                        </div>

                        <div className="ag-hero-stage" data-reveal="hero" style={rev(2)}>
                            <figure className="ag-hero-photo">
                                <Image src={`${A}/people/03-barber.jpg`} alt="A field agent films a barber talking about his shop" fill sizes="(max-width: 1080px) 90vw, 50vw" priority />
                            </figure>
                            <div className="ag-hero-phone">
                                <PhoneFrame size="md" theme="dark">
                                    <Image src={`${A}/screens/agent-interview-cam.jpg`} alt="The Tendso app recording an owner's interview" width={390} height={844} sizes="262px" priority style={{ width: 390, height: 844 }} />
                                </PhoneFrame>
                            </div>
                            <PaidCard />
                        </div>
                    </div>
                </section>

                {/* 2. How a visit works: one phone, four steps */}
                <section className="ag-sec" id="how" aria-labelledby="how-h">
                    <div className="v2-wrap">
                        <div className="ag-head">
                            <Eyebrow>How a visit works</Eyebrow>
                            <h2 className="ag-h2" id="how-h" data-reveal="" style={rev(1)}>
                                One visit.
                                <br />
                                About 30 minutes.
                            </h2>
                            <p className="ag-head-sub" data-reveal="" style={rev(2)}>
                                The app tells you what to do, one step at a time.
                            </p>
                        </div>
                        <VisitStepper />
                    </div>
                </section>

                {/* 3. How you earn */}
                <section className="ag-sec" id="earn" aria-labelledby="earn-h">
                    <div className="v2-wrap">
                        <div className="ag-head">
                            <Eyebrow>How you earn</Eyebrow>
                            <h2 className="ag-h2" id="earn-h" data-reveal="" style={rev(1)}>
                                You set the price. You keep half.
                            </h2>
                        </div>
                        <EarnCalc />
                        <p className="ag-payline" data-reveal="">
                            <span>The shop pays Tendso</span>
                            <i aria-hidden="true">→</i>
                            <span>Your half lands in your wallet</span>
                            <i aria-hidden="true">→</i>
                            <span>Cash out to your Wise email</span>
                        </p>
                        <p className="ag-note" data-reveal="">
                            Examples, not a promise. What you earn depends on the shops you sign up.
                        </p>
                    </div>
                </section>

                {/* 4. What you get */}
                <section className="ag-sec" id="get" aria-labelledby="get-h">
                    <div className="v2-wrap">
                        <div className="ag-head">
                            <Eyebrow>What you get</Eyebrow>
                            <h2 className="ag-h2" id="get-h" data-reveal="" style={rev(1)}>
                                You are never on your own.
                            </h2>
                        </div>
                        <div className="ag-get">
                            <article className="ag-g ag-g--train" data-reveal="">
                                <figure className="ag-g-photo">
                                    <Image src={`${A}/people/11-workshop.jpg`} alt="New field agents in a training session" width={1024} height={688} sizes="(max-width: 760px) 90vw, 50vw" />
                                </figure>
                                <div className="ag-g-copy">
                                    <h3 className="ag-h3">Short training first.</h3>
                                    <p>5 short lessons, about 20 minutes. Then a quiz: get 4 of 5 right. Retake it any time.</p>
                                </div>
                                <div className="ag-lesson" aria-hidden="true">
                                    <span className="ag-lesson-t">Lesson 3 of 5</span>
                                    <span className="ag-lesson-bar">
                                        <i />
                                    </span>
                                </div>
                            </article>

                            <article className="ag-g ag-g--coach" data-reveal="" style={rev(1)}>
                                <div className="ag-g-copy">
                                    <h3 className="ag-h3">A team, and a coach.</h3>
                                    <p>Ask real people on Discord. Or ask Kuya Tendo, our AI coach, any time of day.</p>
                                </div>
                                <div className="ag-chat" aria-hidden="true">
                                    <div className="ag-chat-me">How do I get the owner talking?</div>
                                    <div className="ag-chat-bot">
                                        <span className="ag-chat-av">
                                            <Image src="/v2/brand/mark-ink-256.png" alt="" width={28} height={28} />
                                        </span>
                                        <div>
                                            <b>Kuya Tendo</b>
                                            <p>Start easy: “How did you start the shop?” Then let them talk.</p>
                                        </div>
                                    </div>
                                </div>
                            </article>

                            <article className="ag-g ag-g--link" data-reveal="">
                                <div className="ag-g-copy">
                                    <h3 className="ag-h3">Your own page.</h3>
                                    <p>One link to share. Shops see the sites you built and your price.</p>
                                </div>
                                <div className="ag-link" aria-hidden="true">
                                    <span className="ag-link-url">
                                        <Lock size={14} aria-hidden="true" />
                                        tendso.com/a/mika
                                    </span>
                                    <div className="ag-link-card">
                                        <Image src={`${A}/people/17-mika.jpg`} alt="" width={56} height={56} />
                                        <div>
                                            <b>Mika Santos</b>
                                            <span>Field agent in Marikina</span>
                                        </div>
                                    </div>
                                </div>
                            </article>

                            {/* TODO(Theo): the ₱1,000 friend bonus is replaced by the creator override for new recruits (CREATOR-PROGRAM.md); no figure is shown until the field-agent referral reward is decided. */}
                            <article className="ag-g ag-g--ref" data-reveal="" style={rev(1)}>
                                <div className="ag-g-copy">
                                    <h3 className="ag-h3">Bring a friend.</h3>
                                    <p>Share your code. Your friend joins in the app, free.</p>
                                </div>
                                <div className="ag-code" aria-hidden="true">
                                    <span className="ag-code-l">Your code</span>
                                    <span className="ag-code-v">MIKA8K2Q</span>
                                    <span className="ag-code-b">Share my code</span>
                                </div>
                            </article>
                        </div>
                    </div>
                </section>

                {/* 5. Trust */}
                <section className="ag-sec" id="trust" aria-labelledby="trust-h">
                    <div className="v2-wrap">
                        <div className="ag-trust" data-reveal="">
                            <div className="ag-trust-copy">
                                <p className="ag-eyebrow">Trust</p>
                                <h2 className="ag-h2" id="trust-h">
                                    Is this a scam? No.
                                </h2>
                                <ul className="ag-checks">
                                    <li>
                                        <i aria-hidden="true" />
                                        Tendso never asks you for money. Not to join, not to send, not on Discord.
                                    </li>
                                    <li>
                                        <i aria-hidden="true" />
                                        You never hold the shop&apos;s money. The shop pays Tendso.
                                    </li>
                                    <li>
                                        <i aria-hidden="true" />
                                        The owner sees the finished site first, then pays once to publish.
                                    </li>
                                    <li>
                                        <i aria-hidden="true" />
                                        Real people answer you on Discord.
                                    </li>
                                </ul>
                            </div>
                            <figure className="ag-trust-photo">
                                <Image src={`${A}/people/12-salon.jpg`} alt="A field agent shows a salon owner her new website" width={896} height={1120} sizes="(max-width: 900px) 90vw, 40vw" />
                            </figure>
                        </div>
                    </div>
                </section>

                {/* 6. FAQ */}
                <section className="ag-sec" id="faq" aria-labelledby="faq-h">
                    <div className="v2-wrap ag-faq-in">
                        <div className="ag-head ag-head--side">
                            <Eyebrow>Questions</Eyebrow>
                            <h2 className="ag-h2" id="faq-h" data-reveal="" style={rev(1)}>
                                Short answers.
                            </h2>
                        </div>
                        <FaqList items={FAQ} base="ag-qa" className="ag-faq" data-reveal="" style={rev(2)} />
                    </div>
                </section>

                {/* 7. Start */}
                <section className="ag-sec ag-sec--end" id="start" aria-labelledby="start-h">
                    <div className="v2-wrap">
                        <div className="ag-end" data-reveal="">
                            <div className="ag-end-copy">
                                <h2 className="ag-end-h cr-end-h" id="start-h">
                                    Start with one shop near you.
                                </h2>
                                <ol className="ag-end-steps">
                                    <li>
                                        <span>1</span>Get the app
                                    </li>
                                    <li>
                                        <span>2</span>Train, about 20 minutes
                                    </li>
                                    <li>
                                        <span>3</span>Visit your first shop
                                    </li>
                                </ol>
                                <div className="ag-end-cta">
                                    <Button variant="dark" size="lg" className="ag-btn-lg" href={APP_LINKS.appStore}>
                                        Download the app
                                    </Button>
                                    <Button variant="ghost" size="lg" className="ag-btn-lg ag-btn-onaccent" href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">
                                        Join the Discord
                                    </Button>
                                </div>
                            </div>
                            <figure className="ag-end-photo">
                                <Image src={`${A}/people/10-scooter.jpg`} alt="A field agent rides his scooter to a visit" width={1024} height={688} sizes="(max-width: 900px) 90vw, 40vw" />
                            </figure>
                        </div>
                    </div>
                </section>
            </div>
        </PageShell>
    );
}
