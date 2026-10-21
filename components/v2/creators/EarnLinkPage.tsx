"use client";

import { useCreatorCard, useRecordClick, type CreatorCard } from "@/lib/v2/creatorData";
import { AGENT_EXAMPLE, firstName, peso } from "@/lib/v2/creatorProgram";

import { MiniFoot, SoloBar } from "./Chrome";
import { CreatorsBoundary } from "./CreatorsBoundary";
import { Face } from "./Face";
import { ChatIcon, CoachIcon, FastIcon, KitIcon } from "./icons";
import { GetTheApp } from "./LinkPageParts";
import { Photo } from "./Photo";
import { StoreRow } from "./Stores";

/** /v2/a/<handle>/earn: "Join <name>'s team", for people looking for work. Records the click when it loads. */
export function EarnLinkPage({ handle }: { handle: string }) {
    return (
        <CreatorsBoundary>
            <EarnLinkInner handle={handle} />
        </CreatorsBoundary>
    );
}

function EarnLinkInner({ handle }: { handle: string }) {
    const state = useCreatorCard(handle);
    useRecordClick(handle, "earn");
    return (
        <>
            <SoloBar brandHref="/v2" right={<a className="btn btn--accent btn--sm" href="#get">Get the app</a>} />
            <main className="wrap">
                {state.status === "loading" && (
                    <section className="as-state" aria-busy="true" aria-label="Loading">
                        <span className="as-skel" style={{ width: 220, height: 24 }} />
                        <span className="as-skel" style={{ width: "min(560px, 100%)", height: 96 }} />
                        <span className="as-skel" style={{ width: 320, height: 64 }} />
                    </section>
                )}
                {state.status === "missing" && (
                    <section className="as-state">
                        <h1>This invite is not active.</h1>
                        <p>It may be old. You can still get the app and become a field agent.</p>
                        <StoreRow />
                    </section>
                )}
                {state.status === "found" && <Found card={state.card} />}
                <MiniFoot
                    links={[
                        { label: "About field agents", href: "/v2/field-agents" },
                        { label: "Help", href: "/v2/help" },
                        { label: "Privacy", href: "/v2/privacy" },
                    ]}
                />
            </main>
        </>
    );
}

function Found({ card }: { card: CreatorCard }) {
    const name = firstName(card.name);
    const week = AGENT_EXAMPLE.keepPerShop * AGENT_EXAMPLE.shopsPerWeek;
    return (
        <>
            <section className="as-hero" aria-labelledby="ae-h">
                <div className="as-copy">
                    <p className="as-from">
                        <Face src={card.photo} name={card.name} size={64} />
                        {name} invited you
                    </p>
                    <h1 className="as-h" id="ae-h">
                        Join {name}&apos;s team.
                    </h1>
                    <p className="ag-hero-sub">Visit shops near you with the Tendso app. Build their website. Keep half of every sale.</p>
                    <div className="ae-example" aria-label="Example earnings">
                        <div className="ae-example-top">
                            <span>
                                {AGENT_EXAMPLE.shopsPerWeek} shops a week at {peso(AGENT_EXAMPLE.price)}
                            </span>
                            <em className="ag-tag">Example</em>
                        </div>
                        <div className="ae-example-row">
                            <span>You keep per shop</span>
                            <b>{peso(AGENT_EXAMPLE.keepPerShop)}</b>
                        </div>
                        <div className="ae-example-row big">
                            <span>A week</span>
                            <b>{peso(week)}</b>
                        </div>
                    </div>
                    <GetTheApp card={card} label="Who sent you?" />
                </div>
                <figure className="as-photo">
                    <Photo name="barber.jpg" alt="A field agent films a barber talking about his shop" sizes="(max-width: 900px) 90vw, 40vw" position="62% 40%" priority />
                    <figcaption className="as-photo-tag">
                        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <Face src={card.photo} name={card.name} size={48} />
                            <span>
                                <b>{card.name}</b>
                                <span>Your coach on Tendso</span>
                            </span>
                        </span>
                    </figcaption>
                </figure>
            </section>

            <section className="as-sec" aria-labelledby="ae-do">
                <h2 className="as-h2" id="ae-do">
                    What a field agent does.
                </h2>
                <ol className="as-steps ae-steps4">
                    <li className="as-step">
                        <figure>
                            <Photo name="agent.jpg" alt="A field agent outside an auto shop" sizes="(max-width: 760px) 90vw, 24vw" position="50% 25%" />
                        </figure>
                        <div className="as-step-t">
                            <span>1</span>
                            <b>Visit a shop near you.</b>
                        </div>
                    </li>
                    <li className="as-step">
                        <figure>
                            <Photo name="garage.jpg" alt="An agent records a mechanic talking" sizes="(max-width: 760px) 90vw, 24vw" position="50% 35%" />
                        </figure>
                        <div className="as-step-t">
                            <span>2</span>
                            <b>Ask 10 questions on camera.</b>
                        </div>
                    </li>
                    <li className="as-step">
                        <figure>
                            <Photo name="sarisari.jpg" alt="An agent photographs a sari-sari store" sizes="(max-width: 760px) 90vw, 24vw" position="50% 30%" />
                        </figure>
                        <div className="as-step-t">
                            <span>3</span>
                            <b>Take 10 photos. The site is ready in about 20 minutes.</b>
                        </div>
                    </li>
                    <li className="as-step as-step--accent">
                        <figure className="as-fig-ink">
                            <p className="as-big">
                                {peso(AGENT_EXAMPLE.keepPerShop)}
                                <small>you keep, example</small>
                            </p>
                        </figure>
                        <div className="as-step-t">
                            <span>4</span>
                            <b>The owner sees it, pays once. You keep half.</b>
                        </div>
                    </li>
                </ol>
            </section>

            <section className="as-sec" aria-labelledby="ae-why">
                <h2 className="as-h2" id="ae-why">
                    Why join through {name}.
                </h2>
                <div className="ae-why">
                    <article className="ae-w">
                        <span className="ae-w-ic">
                            <CoachIcon />
                        </span>
                        <b>A coach you already follow.</b>
                        <p>{name} shares what works for her.</p>
                    </article>
                    <article className="ae-w">
                        <span className="ae-w-ic">
                            <ChatIcon />
                        </span>
                        <b>A team chat.</b>
                        <p>{name}&apos;s own channel on our Discord.</p>
                    </article>
                    <article className="ae-w">
                        <span className="ae-w-ic">
                            <FastIcon />
                        </span>
                        <b>Checked first.</b>
                        <p>Your account goes to the front of the review line.</p>
                    </article>
                    <article className="ae-w">
                        <span className="ae-w-ic">
                            <KitIcon />
                        </span>
                        <b>{name}&apos;s starter kit.</b>
                        <p>Her scripts, her best shops, her pitch.</p>
                    </article>
                </div>
                <p className="ae-honest">
                    <Face src={card.photo} name={card.name} size={40} />
                    <span>
                        <b>Fair and open:</b> Tendso thanks {name} with a small share when you sell. It never comes out of your half.
                    </span>
                </p>
            </section>

            <section className="as-sec" id="get" aria-labelledby="ae-end-h">
                <div className="ag-end ae-end">
                    <div className="ag-end-copy">
                        <h2 className="ag-end-h" id="ae-end-h">
                            Start this week.
                        </h2>
                        <ol className="ag-end-steps">
                            <li>
                                <span>1</span>Get the app
                            </li>
                            <li>
                                <span>2</span>
                                {name}&apos;s code is already in
                            </li>
                            <li>
                                <span>3</span>Train, about 20 minutes
                            </li>
                            <li>
                                <span>4</span>Visit your first shop
                            </li>
                        </ol>
                        <GetTheApp card={card} label="Who sent you?" />
                    </div>
                    <figure className="ag-end-photo">
                        <Photo name="scooter.jpg" alt="A field agent rides to a visit" sizes="(max-width: 900px) 90vw, 36vw" position="50% 50%" />
                    </figure>
                </div>
                <p className="ag-note">Free to join. Tendso never asks you for money. Example, not a promise: what you earn depends on the shops you sign up.</p>
            </section>
        </>
    );
}

