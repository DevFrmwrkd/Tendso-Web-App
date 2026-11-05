"use client";

import { ArrowDown, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Button, PhoneFrame } from "@/components/v2";

import { AGENTS, IMAGE_PAIRS, MONTHLY_RIVALS, PRICE, SHOWCASE, WORDS, exampleHref, person, photo, siteShot } from "./content";
import { onFrame, prog, useInView, useReducedMotion } from "./motion";
import { AgentsNearScreen, InterviewCamScreen, ShotGuideScreen, SiteReadyScreen } from "./screens";

/*
 * The grid: what goes into a homepage (mock js/tiles.js). One living thing per
 * tile; each plays when 25% visible and pauses when out. Hover (or keyboard
 * focus) blurs the tile behind one line; click opens the step large.
 * The first cell (#slot-stage) receives the hero stage, then shows the gallery.
 */

type TileKey = "words" | "images" | "cost" | "humans";

const HOVER: Record<TileKey, string> = {
    words: "The interview is transcribed, then written into your pages. In your words, not ours.",
    images: "Same man, same shop. Every photo shot again, properly. The app asks for each of the 10 shots, one at a time.",
    cost: "See your finished site first, then pay once to publish. Hosting included. No monthly fees.",
    humans: "A local field agent visits with the same app. About 30 minutes at your shop.",
};

// ---------------------------------------------------------------------------- tile shell
function TileShell({ k, className, label, onOpen, onVisible, children }: { k: TileKey; className: string; label: string; onOpen: (k: TileKey) => void; onVisible: (on: boolean) => void; children: ReactNode }) {
    const ref = useInView<HTMLElement>(onVisible, 0.25);
    const onKey = (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(k);
        }
    };
    return (
        <article
            ref={ref}
            className={`v2-tile v2-tile--hover tl ${className}`}
            data-reveal=""
            role="button"
            tabIndex={0}
            aria-haspopup="dialog"
            aria-label={label}
            onClick={() => onOpen(k)}
            onKeyDown={onKey}
        >
            {children}
            <span className="v2-tile-more" aria-hidden="true">
                {HOVER[k]}
            </span>
        </article>
    );
}

// ---------------------------------------------------------------------------- words
function WordsTile({ onOpen }: { onOpen: (k: TileKey) => void }) {
    const [on, setOn] = useState(false);
    const reduced = useReducedMotion();
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = root.current;
        if (!el) return;
        const bars = [...el.querySelectorAll<HTMLElement>(".wd-wave i")];
        const type = el.querySelector<HTMLElement>(".wd-type")!;
        const site = el.querySelector<HTMLElement>(".wd-site")!;
        const text = WORDS.transcript;
        if (!on || reduced) {
            type.textContent = text;
            site.classList.add("is-on");
            return;
        }
        const LOOP = 11000;
        const t0 = performance.now();
        let shown = -1;
        return onFrame((now) => {
            const t = (now - t0) % LOOP;
            const speaking = t < 5200;
            bars.forEach((b, i) => {
                const v = speaking ? 0.25 + 0.75 * Math.abs(Math.sin(now / 170 + i * 0.7) * Math.sin(now / 410 + i * 0.31)) : 0.12;
                b.style.transform = `scaleY(${v.toFixed(3)})`;
            });
            const chars = Math.floor(prog(t, 500, 5200) * text.length);
            if (chars !== shown) {
                shown = chars;
                type.textContent = text.slice(0, chars);
            }
            site.classList.toggle("is-on", t > 5800 && t < LOOP - 600);
        });
    }, [on, reduced]);
    return (
        <TileShell k="words" className="tl--words" label="10 simple questions. Your words become the site. Open details" onOpen={onOpen} onVisible={setOn}>
            <div ref={root} className="contents">
                <header className="tl-head">
                    <h3 className="tl-title">10 simple questions. Your words become the site.</h3>
                </header>
                <div className="tl-phone tl-phone--words">
                    <PhoneFrame size="sm" theme="dark">
                        <InterviewCamScreen playing={on} />
                    </PhoneFrame>
                </div>
                <div className="wd-flow" aria-hidden="true">
                    <div className="wd-wave">
                        {Array.from({ length: 28 }, (_, i) => (
                            <i key={i} />
                        ))}
                    </div>
                    <p className="wd-quote">
                        <span className="wd-type">{WORDS.transcript}</span>
                    </p>
                    <div className="wd-arrow">
                        <ArrowDown size={18} strokeWidth={1.6} />
                    </div>
                    <div className="wd-site is-on">
                        <Image src={photo("pro2-headshot")} alt="" fill sizes="300px" />
                        <div className="wd-site-copy">
                            {WORDS.copy.map((l) => (
                                <span key={l}>{l}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </TileShell>
    );
}

// ---------------------------------------------------------------------------- images
function ImagesTile({ onOpen }: { onOpen: (k: TileKey) => void }) {
    const [on, setOn] = useState(false);
    const reduced = useReducedMotion();
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const cells = [...(root.current?.querySelectorAll<HTMLElement>(".im-cell") ?? [])];
        if (!on || reduced) {
            cells.forEach((c) => c.classList.toggle("is-pro", reduced));
            return;
        }
        const STEP = 850, HOLD = 2600, LOOP = cells.length * STEP + HOLD;
        const t0 = performance.now();
        return onFrame((now) => {
            const t = (now - t0) % LOOP;
            cells.forEach((c, i) => c.classList.toggle("is-pro", t >= 400 + i * STEP && t < LOOP - 300));
        });
    }, [on, reduced]);
    return (
        <TileShell k="images" className="tl--images" label="10 guided photos, shot like a campaign. Open details" onOpen={onOpen} onVisible={setOn}>
            <div ref={root} className="contents">
                <header className="tl-head">
                    <h3 className="tl-title">10 guided photos. Shot like a campaign.</h3>
                </header>
                <div className="im-key" aria-hidden="true">
                    <span className="im-key-a">Phone</span>
                    <i />
                    <span className="im-key-b">Tendso</span>
                </div>
                <div className="im-grid">
                    {IMAGE_PAIRS.map(([a, b, t]) => (
                        <figure key={a} className="im-cell">
                            <Image className="im-a" src={photo(a)} alt={`${t}, phone photo`} fill sizes="(max-width: 760px) 30vw, 180px" />
                            <Image className="im-b" src={photo(b)} alt={`${t}, by Tendso`} fill sizes="(max-width: 760px) 30vw, 180px" />
                            <figcaption>{t}</figcaption>
                        </figure>
                    ))}
                    <div className="im-more">
                        <b>+5</b>
                        <span>more shots, one at a time in the app</span>
                    </div>
                </div>
            </div>
        </TileShell>
    );
}

// ---------------------------------------------------------------------------- cost
function CostTile({ onOpen }: { onOpen: (k: TileKey) => void }) {
    const [on, setOn] = useState(false);
    const reduced = useReducedMotion();
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const rows = [...(root.current?.querySelectorAll<HTMLElement>(".cs-row[data-row]") ?? [])].map((r) => [...r.querySelectorAll<HTMLElement>(".cs-ticks i")]);
        const show = (n: number) => rows.forEach((ticks) => ticks.forEach((t, i) => t.classList.toggle("is-on", i < n)));
        if (!on || reduced) {
            show(12);
            return;
        }
        const STEP = 160, HOLD = 4200, LOOP = 12 * STEP + HOLD;
        const t0 = performance.now();
        let last = -1;
        return onFrame((now) => {
            const n = Math.min(12, Math.floor(((now - t0) % LOOP) / STEP) + 1);
            if (n !== last) show((last = n));
        });
    }, [on, reduced]);
    return (
        <TileShell k="cost" className="tl--cost" label="Pay once, not every month. Open details" onOpen={onOpen} onVisible={setOn}>
            <div ref={root} className="contents">
                <header className="tl-head">
                    <h3 className="tl-title">Pay once. Not every month.</h3>
                </header>
                <div className="cs">
                    <span className="cs-cap">One year of having a website</span>
                    {MONTHLY_RIVALS.map((name, i) => (
                        <div key={name} className="cs-row" data-row={i}>
                            <div className="cs-k">
                                <b>{name}</b>
                                <span className="cs-v">
                                    <b>Every month</b>
                                </span>
                            </div>
                            <div className="cs-ticks" aria-hidden="true">
                                {Array.from({ length: 12 }, (_, j) => (
                                    <i key={j} className="is-on" />
                                ))}
                            </div>
                        </div>
                    ))}
                    <div className="cs-row cs-row--once">
                        <div className="cs-k">
                            <b>Tendso</b>
                            <span className="cs-v">
                                <b>{PRICE.once}</b>
                                <i>once, or start with {PRICE.downPayment} down</i>
                            </span>
                        </div>
                        <div className="cs-ticks cs-ticks--once" aria-hidden="true">
                            <i />
                            {Array.from({ length: 11 }, (_, j) => (
                                <i key={j} className="is-free" />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="tl-phone tl-phone--cost">
                    <PhoneFrame size="sm">
                        <SiteReadyScreen playing={on} />
                    </PhoneFrame>
                </div>
            </div>
        </TileShell>
    );
}

// ---------------------------------------------------------------------------- humans
function TownSvg() {
    return (
        <svg className="hm-svg" viewBox="0 0 800 460" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <rect width="800" height="460" className="m-ground" />
            <path className="m-river" d="M-20 380 C 120 330, 220 420, 360 370 S 620 300, 820 340 L 820 470 L -20 470 Z" />
            <g className="m-blocks">
                <rect x="40" y="40" width="150" height="90" rx="6" />
                <rect x="220" y="40" width="120" height="90" rx="6" />
                <rect x="370" y="40" width="180" height="90" rx="6" />
                <rect x="580" y="40" width="180" height="90" rx="6" />
                <rect x="40" y="160" width="90" height="120" rx="6" />
                <rect x="160" y="160" width="180" height="120" rx="6" />
                <rect x="370" y="160" width="100" height="120" rx="6" />
                <rect x="500" y="160" width="260" height="120" rx="6" />
                <rect x="40" y="306" width="230" height="40" rx="6" />
                <rect x="300" y="306" width="160" height="34" rx="6" />
                <rect x="490" y="296" width="140" height="30" rx="6" />
            </g>
            <g className="m-roads">
                <path d="M0 145 H800" />
                <path d="M0 293 H800" />
                <path d="M205 0 V300" />
                <path d="M355 0 V300" />
                <path d="M565 0 V290" />
                <path d="M145 150 V300" />
                <path d="M485 150 V300" />
            </g>
            <path className="m-route" d="M250 222 C 300 222, 330 150, 420 146 S 520 150, 560 110" />
        </svg>
    );
}
function HumansTile({ onOpen }: { onOpen: (k: TileKey) => void }) {
    const [on, setOn] = useState(false);
    const a = AGENTS[0];
    return (
        <TileShell k="humans" className={`tl--humans${on ? " is-live" : ""}`} label="Rather not do it yourself? A field agent comes over. Open details" onOpen={onOpen} onVisible={setOn}>
            <header className="tl-head">
                <h3 className="tl-title">Rather not do it yourself? Someone comes over.</h3>
            </header>
            <div className="hm-map" aria-hidden="true">
                <TownSvg />
                <div className="hm-shop">
                    <i />
                    <span className="label">Your shop</span>
                </div>
                {AGENTS.map((g, i) => (
                    <div key={g.name} className="hm-pin" data-i={i} style={{ "--i": i } as CSSProperties}>
                        <b>{g.initial}</b>
                    </div>
                ))}
            </div>
            <figure className="hm-agent">
                <div className="hm-agent-ph">
                    <Image src={person("17-mika")} alt={`${a.name}, a Tendso field agent (sample)`} fill sizes="210px" />
                </div>
                <figcaption>
                    <b>{a.name}</b>
                    <span>
                        {a.dist} away · {a.note}
                    </span>
                </figcaption>
            </figure>
            <div className="tl-phone tl-phone--humans">
                <PhoneFrame size="sm">
                    <AgentsNearScreen playing={on} />
                </PhoneFrame>
            </div>
        </TileShell>
    );
}

// ---------------------------------------------------------------------------- gallery (first tile)
function Gallery() {
    const cols = [0, 1, 2].map((c) => SHOWCASE.filter((_, i) => i % 3 === c));
    return (
        <div className="gal">
            {cols.map((list, k) => (
                <div key={k} className={`gal-col gal-col--${k}`}>
                    <div className="gal-track">
                        {[...list, ...list].map((s, i) => {
                            const copy = i >= list.length;
                            return (
                                <a
                                    key={`${s.id}-${i}`}
                                    className="gal-card"
                                    href={exampleHref(s.id)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={copy ? undefined : `${s.name}, an example site made with Tendso. Opens in a new tab`}
                                    aria-hidden={copy || undefined}
                                    tabIndex={copy ? -1 : undefined}
                                >
                                    <Image src={siteShot(s.id)} alt="" fill sizes="(max-width: 760px) 45vw, 260px" />
                                </a>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------- detail sheet
const DETAIL: Record<TileKey, { title: string; lines: string[] }> = {
    words: {
        title: "10 simple questions.",
        lines: [
            "One question at a time, out loud, on camera. Then anything else you want to say.",
            "The recording is transcribed and written into your pages.",
            "Your words, your city, your products. Good for Google too.",
        ],
    },
    images: {
        title: "10 guided photos.",
        lines: [
            "The app asks for each shot your kind of business needs: owner, outside, inside, equipment, best sellers.",
            "One task at a time on the camera. Add any extra photos you like.",
            "Each one comes back like a campaign shot: same subject, same place.",
        ],
    },
    cost: {
        title: "Pay once. Not every month.",
        lines: [
            "Agencies and website builders charge you every month. Tendso is one payment.",
            "You see your finished site first. Then you pay once to publish it.",
            `${PRICE.once} in the Philippines, or start with a ${PRICE.downPayment} down payment. As low as ₱999 when a field agent or creator signs you up.`,
            "Hosting and your own web address are included.",
        ],
    },
    humans: {
        title: "Someone comes over.",
        lines: [
            "A local field agent visits your shop with the same app.",
            "About 30 minutes with you. Your site is ready about 20 minutes later.",
            "Book in the app, or send a request on this page.",
        ],
    },
};

function DetailScreen({ k }: { k: TileKey }) {
    if (k === "words") return <InterviewCamScreen playing />;
    if (k === "images") return <ShotGuideScreen playing />;
    if (k === "cost") return <SiteReadyScreen playing />;
    return <AgentsNearScreen playing />;
}

function TileDetail({ k, onClose }: { k: TileKey; onClose: () => void }) {
    const [open, setOpen] = useState(false);
    const closeRef = useRef<HTMLButtonElement>(null);
    const d = DETAIL[k];
    useEffect(() => {
        const id = requestAnimationFrame(() => setOpen(true));
        closeRef.current?.focus();
        const html = document.documentElement;
        const prev = html.style.overflow;
        html.style.overflow = "hidden";
        const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onClose();
        addEventListener("keydown", onKey);
        return () => {
            cancelAnimationFrame(id);
            html.style.overflow = prev;
            removeEventListener("keydown", onKey);
        };
    }, [onClose]);
    const dark = k === "words" || k === "images";
    return (
        <div className={`td${open ? " is-open" : ""}`} role="dialog" aria-modal="true" aria-labelledby="lv2-td-title">
            <div className="td-scrim" onClick={onClose} />
            <div className="td-card">
                <button ref={closeRef} className="td-close" type="button" aria-label="Close" onClick={onClose}>
                    <X size={16} strokeWidth={1.8} aria-hidden="true" />
                </button>
                <div className="td-phone">
                    <PhoneFrame size="lg" theme={dark ? "dark" : "light"}>
                        <DetailScreen k={k} />
                    </PhoneFrame>
                </div>
                <div className="td-copy">
                    <span className="label">In the app</span>
                    <h3 className="td-title" id="lv2-td-title">
                        {d.title}
                    </h3>
                    <ul className="td-lines">
                        {d.lines.map((l) => (
                            <li key={l}>{l}</li>
                        ))}
                    </ul>
                    <div className="td-cta">
                        <Button href="#download" onClick={onClose}>
                            Download the app
                        </Button>
                        <Button href="#hire" variant="ghost" onClick={onClose}>
                            Hire an agent
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------- grid
export function Grid() {
    const [detail, setDetail] = useState<TileKey | null>(null);
    const opener = useRef<HTMLElement | null>(null);
    const open = useCallback((k: TileKey) => {
        opener.current = document.activeElement as HTMLElement | null;
        setDetail(k);
    }, []);
    const close = useCallback(() => {
        setDetail(null);
        opener.current?.focus?.();
    }, []);
    return (
        <section className="grid-sec" id="grid" aria-label="What goes into your website">
            <div className="v2-wrap grid">
                <div className="v2-tile tile--slot" id="slot-stage" role="region" aria-label="Sites made with the Tendso app">
                    <Gallery />
                </div>
                <WordsTile onOpen={open} />
                <ImagesTile onOpen={open} />
                <CostTile onOpen={open} />
                <div className="v2-tile v2-tile--quiet moment" data-reveal="">
                    <h2 className="moment-t">
                        See it first.
                        <br />
                        Pay once.
                    </h2>
                </div>
                <HumansTile onOpen={open} />
            </div>
            {detail && createPortal(<TileDetail k={detail} onClose={close} />, document.getElementById("lv2-root") ?? document.body)}
        </section>
    );
}
