import Image from "next/image";
import type { CSSProperties } from "react";

import { DISCORD_INVITE_URL } from "@/lib/contact";
import { Button, Label } from "@/components/v2";

import { AboutPhoto } from "./AboutPhoto";
import { PageShell } from "./PageShell";
import { PaTile } from "./PaTile";

const A = "/v2/pages-a";
const rev = (i: number): CSSProperties => ({ ["--i" as string]: i });

/*
 * TODO(Theo): the team below is the mock's placeholder set. No real names or photos
 * of the team are in the repo, so every member reads "Name TBC" over a stand-in photo.
 * Replace with real people before this page replaces /about.
 */
const TEAM = [
    { img: "06-agent.jpg", pos: "55% 30%", role: "Founder" },
    { img: "04-team.jpg", pos: "50% 30%", role: "Product & build" },
    { img: "10-scooter.jpg", pos: "45% 30%", role: "Field operations" },
    { img: "09-cafe.jpg", pos: "30% 30%", role: "Creator community" },
] as const;

/* TODO(Theo): the city list is the mock's sample list; confirm before launch. */
const CITIES = ["Marikina", "Makati", "Cebu", "Davao", "Pasig", "Lipa", "Baguio"];

const LINES = [
    { n: "01", t: "A mobile app that turns a conversation into a website.", k: "The app" },
    { n: "02", t: "Real people who visit the shop when the owner is busy.", k: "Field agents" },
    { n: "03", t: "The owner sees it live before paying once.", k: "The deal" },
];

export function AboutPage() {
    return (
        <PageShell page="about" className="ab">
            <section className="ab-hero">
                <div className="v2-wrap">
                    <Label data-reveal="hero">About Tendso</Label>
                    <h1 className="ab-moment" data-reveal="hero" style={{ ...rev(1), marginTop: 18 }}>
                        The thinking ends here.
                    </h1>
                    <AboutPhoto src={`${A}/people/08-stairs.jpg`} alt="The Tendso team" width={1024} height={688} />
                </div>
            </section>

            <section className="cr-sec cr-sec--tight">
                <div className="v2-wrap">
                    <ol className="ab-lines">
                        {LINES.map((l, i) => (
                            <li className="ab-line" key={l.n} data-reveal="" style={rev(i)}>
                                <span className="ab-line-n">{l.n}</span>
                                <span className="ab-line-t">{l.t}</span>
                                <span className="ab-line-k">{l.k}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            <section className="cr-sec">
                <div className="v2-wrap">
                    <div className="cr-head cr-head--row">
                        <h2 className="cr-h2" data-reveal="">
                            The team.
                        </h2>
                        <Label data-reveal="" style={rev(1)}>
                            Placeholder photos
                        </Label>
                    </div>
                    <ul className="ab-team">
                        {TEAM.map((m, i) => (
                            <li className="ab-member" key={m.role} data-reveal="" style={rev(i)}>
                                <Image src={`${A}/people/${m.img}`} alt="" width={896} height={1120} sizes="(max-width: 760px) 45vw, 25vw" style={{ objectPosition: m.pos }} />
                                <span className="ab-member-n">Name TBC</span>
                                <span className="ab-member-r">{m.role}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <section className="cr-sec">
                <div className="v2-wrap">
                    <PaTile tone="quiet" className="ab-where" data-reveal="">
                        <div>
                            <Label>Where we work</Label>
                            <p className="ab-where-big" style={{ marginTop: 18 }}>
                                <b>{CITIES.length}</b>cities.
                                <br />
                                Philippines first.
                            </p>
                        </div>
                        <ul className="ab-tags" aria-label="Cities">
                            {CITIES.map((c, i) => (
                                <li key={c} className={i === 0 ? "is-first" : undefined}>
                                    {c}
                                </li>
                            ))}
                            <li className="is-more">and growing</li>
                        </ul>
                    </PaTile>
                </div>
            </section>

            <section className="cr-sec cr-sec--end">
                <div className="v2-wrap">
                    <div className="ab-join">
                        <PaTile tone="dark" className="ab-join-tile" data-reveal="">
                            <Label className="cr-level-label">Careers</Label>
                            <h2 className="cr-h2">Work the street with us.</h2>
                            <div className="cr-end-cta">
                                <Button href="/v2/field-agents">For field agents</Button>
                                <Button variant="ghost" className="ab-btn-dark" href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">
                                    Join the Discord
                                </Button>
                            </div>
                        </PaTile>
                        <PaTile className="ab-join-tile ab-join-photo" data-reveal="" style={rev(1)}>
                            <Image src={`${A}/people/11-workshop.jpg`} alt="Field agent training workshop" fill sizes="(max-width: 900px) 90vw, 50vw" />
                        </PaTile>
                    </div>
                </div>
            </section>
        </PageShell>
    );
}
