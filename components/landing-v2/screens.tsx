"use client";

import {
    ArrowRight,
    Check,
    ChevronLeft,
    Image as ImageIcon,
    Languages,
    LayoutTemplate,
    Mic,
    Pause,
    PenLine,
    Smartphone,
    Star,
    X,
    ZapOff,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, type CSSProperties, type ReactNode, type Ref } from "react";

import { PhoneStatusBar } from "@/components/v2";

import { A, EXTRA_QUESTION, INTERVIEW_VIDEO, PRICE, QUESTIONS, SHOTS, person, photo } from "./content";
import { EASE, EASE_INOUT, makeRunner, reflow, useReducedMotion, type Runner } from "./motion";

/*
 * The Tendso app screens shown in the landing's phones, ported from the mock's
 * js/screens.js + css/screens.css (scoped under .lv2 in landing.css). Each is
 * authored at 390 x 844 and goes inside a PhoneFrame.
 *
 * Every screen takes `playing` (run its demo loop) and `epoch` (bump to restart
 * it). Not playing = the idle frame; reduced motion = the end frame, no loop.
 * Markup is React; the demo timeline toggles classes on refs exactly as the
 * mock did, so the CSS transitions carry the motion.
 */

export interface ScreenProps {
    playing: boolean;
    epoch?: number;
}

interface Ctl {
    reset(): void;
    end(): void;
    play(): void;
    pause?(): void;
}

function useScreen(playing: boolean, epoch: number, setup: (el: HTMLDivElement, run: Runner) => Ctl) {
    const ref = useRef<HTMLDivElement>(null);
    const setupRef = useRef(setup);
    useEffect(() => {
        setupRef.current = setup;
    });
    const reduced = useReducedMotion();
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const run = makeRunner();
        const s = setupRef.current(el, run);
        if (!playing) {
            s.reset();
            return () => run.clear();
        }
        el.classList.add("is-playing");
        if (reduced) {
            s.end();
            return () => el.classList.remove("is-playing");
        }
        s.play();
        return () => {
            run.clear();
            s.pause?.();
            el.classList.remove("is-playing");
        };
    }, [playing, epoch, reduced]);
    return ref;
}

const q = <T extends Element = HTMLElement>(el: Element, sel: string) => el.querySelector(sel) as T;
const qa = <T extends Element = HTMLElement>(el: Element, sel: string) => [...el.querySelectorAll(sel)] as T[];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function Shell({ name, dark, rootRef, children, style }: { name: string; dark?: boolean; rootRef: Ref<HTMLDivElement>; children: ReactNode; style?: CSSProperties }) {
    return (
        <div ref={rootRef} className={`app scr scr-${name}${dark ? " app--dark" : ""}`} style={style} aria-hidden="true">
            {children}
            <div className="a-home" />
        </div>
    );
}

function StepHead({ n, total }: { n: number; total: number }) {
    return (
        <header className="s-head">
            <div className="a-step">
                <span className="a-back">
                    <ChevronLeft size={20} strokeWidth={2.4} />
                </span>
                <div className="a-progress">
                    <i style={{ "--p": `${Math.round((n / total) * 100)}%` } as CSSProperties} />
                </div>
                <b className="s-step-n">
                    {n} / {total}
                </b>
            </div>
        </header>
    );
}

// =====================================================================================
// welcome: living walls of real shops, the buddy, one line, one button
// =====================================================================================
const WELCOME_COLS = [
    [photo("kalan-hero"), person("03-barber"), photo("hela-hero"), person("16-baguio")],
    [person("01-sarisari"), photo("after-kalan"), person("12-salon"), photo("kalan-pandesal")],
    [photo("after-mechanic"), person("15-carinderia"), photo("labana-stacks"), person("02-panaderya")],
];
export function WelcomeScreen({ playing, epoch = 0 }: ScreenProps) {
    const ref = useScreen(playing, epoch, (el) => ({
        reset: () => el.classList.remove("is-run"),
        end: () => el.classList.remove("is-run"),
        play: () => el.classList.add("is-run"),
        pause: () => el.classList.remove("is-run"),
    }));
    return (
        <Shell name="welcome" rootRef={ref}>
            <PhoneStatusBar />
            <div className="w2-wall">
                {WELCOME_COLS.map((col, k) => (
                    <div key={k} className={`w2-col w2-col--${k}`}>
                        <div className="w2-track">
                            {[...col, ...col].map((src, i) => (
                                <div key={i} className="w2-ph">
                                    <Image src={src} alt="" fill sizes="130px" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <div className="w2-fade" />
            <div className="w2-in">
                <Image className="w2-buddy" src={`${A}/brand/buddy.webp`} alt="" width={112} height={112} />
                <p className="w2-h">Your shop online.</p>
                <p className="w2-sub">Made from your phone.</p>
                <div className="door door--accent w2-go">Get started</div>
                <p className="w2-link">I already have an account</p>
            </div>
        </Shell>
    );
}

// =====================================================================================
// design-picker: one big real design at a time, swipe, open, use it
// =====================================================================================
const DESIGNS = [
    { id: "f", name: "Barbershop 1" },
    { id: "g", name: "Barbershop 2" },
    { id: "i", name: "Barbershop 3" },
    { id: "j", name: "Barbershop 4" },
];
export function DesignPickerScreen({ playing, epoch = 0 }: ScreenProps) {
    const ref = useScreen(playing, epoch, (el, run) => {
        const cards = qa(el, ".dp-card");
        const rail = q(el, ".dp-rail");
        const name = q(el, ".dp-name");
        const dots = qa(el, ".dp-dots i");
        const fulls = qa(el, ".dp-full");
        const title = q(el, ".dp-sheet-t");
        const use = q(el, ".dp-use");
        let chosen = -1;
        const go = (k: number) => {
            rail.style.transform = `translateX(${-k * 262}px)`;
            cards.forEach((c, i) => {
                c.classList.toggle("is-cur", i === k);
                c.classList.toggle("is-on", i === chosen);
            });
            dots.forEach((d, i) => d.classList.toggle("is-on", i === k));
            name.textContent = DESIGNS[k].name;
        };
        const tap = (n: HTMLElement) => {
            n.classList.add("is-tap");
            run.after(200, () => n.classList.remove("is-tap"));
        };
        const open = (k: number) => {
            fulls.forEach((f, i) => {
                f.style.display = i === k ? "block" : "none";
                f.style.transition = "none";
                f.style.transform = "none";
            });
            reflow(fulls[k]);
            title.textContent = DESIGNS[k].name;
            tap(cards[k]);
            el.classList.add("is-open");
        };
        const close = () => el.classList.remove("is-open");
        const cycle = () => {
            chosen = -1;
            close();
            go(0);
            run.after(1300, () => go(1));
            run.after(2500, () => go(2));
            run.after(3700, () => go(1));
            run.after(4700, () => open(1));
            run.after(5300, () => {
                fulls[1].style.transition = "transform 3600ms cubic-bezier(.45,0,.25,1)";
                fulls[1].style.transform = "translateY(-60%)";
            });
            run.after(9200, () => tap(use));
            run.after(9500, () => {
                chosen = 1;
                close();
                go(1);
            });
            run.after(12000, cycle);
        };
        return {
            reset: () => {
                chosen = -1;
                close();
                go(1);
            },
            end: () => {
                chosen = 1;
                close();
                go(1);
            },
            play: cycle,
        };
    });
    return (
        <Shell name="design-picker" rootRef={ref}>
            <PhoneStatusBar />
            <div className="dp-top">
                <b className="s-step-n">3 / 4</b>
                <p className="a-display a-display--md">Choose your design</p>
            </div>
            <div className="dp-car">
                <div className="dp-rail">
                    {DESIGNS.map((d) => (
                        <div key={d.id} className="dp-card">
                            <Image src={`${A}/designs/barber-${d.id}-m.webp`} alt="" fill sizes="250px" />
                            <span className="dp-check">
                                <Check size={16} strokeWidth={3} />
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="dp-meta">
                <b className="dp-name">{DESIGNS[1].name}</b>
                <span className="dp-dots">
                    {DESIGNS.map((d) => (
                        <i key={d.id} />
                    ))}
                </span>
            </div>
            <div className="dp-foot">
                <div className="door door--accent dp-pick">Use this design</div>
            </div>
            <div className="dp-sheet">
                <div className="dp-sheet-top">
                    <span className="dp-back">
                        <ChevronLeft size={22} strokeWidth={2.4} />
                    </span>
                    <b className="dp-sheet-t" />
                    <span className="dp-back dp-back--ghost" />
                </div>
                <div className="dp-view">
                    {DESIGNS.map((d) => (
                        <Image key={d.id} className="dp-full" src={`${A}/designs/barber-${d.id}-m-long.webp`} alt="" width={600} height={4308} sizes="370px" />
                    ))}
                </div>
                <div className="dp-sheet-foot">
                    <div className="door door--accent dp-use">Use this design</div>
                </div>
            </div>
        </Shell>
    );
}

// =====================================================================================
// interview-cam: full-bleed camera, the question low like a subtitle, Next is biggest
// =====================================================================================
export function InterviewCamScreen({ playing, epoch = 0, priority }: ScreenProps & { priority?: boolean }) {
    const N = QUESTIONS.length;
    const ref = useScreen(playing, epoch, (el, run) => {
        const vid = q<HTMLVideoElement>(el, ".rv-vid");
        const time = q(el, ".rv-time");
        const qEl = q(el, ".rv-q");
        const nEl = q(el, ".rv-n");
        const next = q(el, ".rv-next");
        const nextT = q(el, ".rv-next-t");
        const hintT = q(el, ".cam-hint-t");
        const segs = qa(el, ".cam-segs i");
        const lv = qa(el, ".rv-lvl i");
        let cur = 0;
        let secs = 0;
        const setT = (v: number) => {
            secs = v;
            time.textContent = fmt(v);
        };
        // the question arrives word by word, like someone saying it
        const showQ = (k: number, animate: boolean) => {
            cur = k;
            const say = k >= N ? EXTRA_QUESTION : QUESTIONS[k];
            qEl.replaceChildren(
                ...say.split(" ").flatMap((w, wi) => {
                    const s = document.createElement("span");
                    s.style.setProperty("--w", String(wi));
                    s.textContent = w;
                    return wi ? [document.createTextNode(" "), s] : [s];
                }),
            );
            nEl.textContent = k >= N ? "Last one" : `${k + 1} / ${N}`;
            el.classList.toggle("is-last", k >= N);
            nextT.textContent = k >= N ? "Finish" : "Next question";
            segs.forEach((sg, j) => {
                sg.classList.toggle("is-done", j < k);
                sg.classList.toggle("is-cur", j === k);
            });
            if (animate) {
                el.classList.remove("is-in");
                reflow(el);
            }
            el.classList.add("is-in");
        };
        const levels = () => {
            lv.forEach((b) => (b.style.transform = `scaleY(${(0.25 + Math.random() * 0.75).toFixed(2)})`));
            run.after(140, levels);
        };
        const tickT = () =>
            run.after(1000, () => {
                setT(secs + 1);
                tickT();
            });
        const advance = () =>
            run.after(5200, () => {
                next.classList.add("is-press");
                run.after(200, () => next.classList.remove("is-press"));
                if (cur < N) {
                    showQ(cur + 1, true);
                    advance();
                    return;
                }
                run.after(1600, () => begin(false));
            });
        // the app checks the framing once (level + hint), then starts asking
        const begin = (first: boolean) => {
            el.classList.remove("is-good", "is-in");
            el.classList.add("is-framing");
            hintT.textContent = "Hold the phone straight";
            segs.forEach((sg) => sg.classList.remove("is-done", "is-cur"));
            run.after(1500, () => {
                el.classList.add("is-good");
                hintT.textContent = "Good. Start talking";
            });
            run.after(2700, () => {
                el.classList.remove("is-framing");
                setT(0);
                showQ(0, true);
                if (first) {
                    tickT();
                    levels();
                }
                advance();
            });
        };
        const idle = () => {
            el.classList.remove("is-framing");
            setT(72);
            showQ(0, false);
            el.classList.add("is-good");
        };
        return {
            reset: () => {
                vid.pause();
                idle();
            },
            end: idle,
            play: () => {
                vid.play().catch(() => {});
                setT(0);
                begin(true);
            },
            pause: () => vid.pause(),
        };
    });
    return (
        <Shell name="interview-cam" dark rootRef={ref}>
            <div className="rv-cam">
                <Image className="rv-poster" src={INTERVIEW_VIDEO.poster} alt="" fill sizes="390px" priority={priority} loading={priority ? undefined : "eager"} style={{ objectPosition: "20% 50%" }} />
                <video
                    className="rv-vid"
                    muted
                    playsInline
                    loop
                    preload={priority ? "auto" : "none"}
                    src={INTERVIEW_VIDEO.src}
                    style={{ objectPosition: "20% 50%" }}
                    onLoadedData={(e) => e.currentTarget.closest(".scr")?.classList.add("has-video")}
                />
            </div>
            <div className="cam-shade" />
            <PhoneStatusBar dark />
            <div className="cam-top">
                <span className="cam-btn">
                    <X size={20} strokeWidth={2.4} />
                </span>
                <span className="rv-rec">
                    <i className="rv-dot" />
                    <b className="rv-time">1:12</b>
                    <span className="rv-lvl">
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                    </span>
                </span>
                <span className="cam-chip">
                    <Languages size={16} strokeWidth={2.2} />
                    <b>EN</b>
                </span>
            </div>
            <div className="cam-segs">
                {QUESTIONS.map((_, i) => (
                    <i key={i} className={i === 0 ? "is-cur" : undefined} />
                ))}
            </div>
            <div className="cam-level">
                <i />
                <b />
                <i />
            </div>
            <div className="cam-hint">
                <span className="cam-hint-ic">
                    <Smartphone size={16} strokeWidth={2.2} />
                </span>
                <span className="cam-hint-ok">
                    <Check size={16} strokeWidth={3} />
                </span>
                <span className="cam-hint-t">Hold the phone straight</span>
            </div>
            <div className="rv-prompt">
                <span className="rv-n">1 / {N}</span>
                <p className="rv-q">{QUESTIONS[0]}</p>
            </div>
            <div className="rv-ctl">
                <span className="rv-pause">
                    <i>
                        <Pause size={22} strokeWidth={0} className="s-fill" />
                    </i>
                </span>
                <span className="rv-next">
                    <b className="rv-next-t">Next question</b>
                    <span className="rv-next-a">
                        <ArrowRight size={22} strokeWidth={2.6} />
                    </span>
                    <span className="rv-next-c">
                        <Check size={22} strokeWidth={3} />
                    </span>
                </span>
            </div>
        </Shell>
    );
}

// =====================================================================================
// shot-guide: the guided photo camera, one task at a time, "photo, photo, photo"
// =====================================================================================
const OFF = "translate(2%, -1.5%) rotate(-1.5deg) scale(1.06)";
export function ShotGuideScreen({ playing, epoch = 0 }: ScreenProps) {
    const n = SHOTS.length;
    const ref = useScreen(playing, epoch, (el, run) => {
        const imgs = qa(el, ".sg-img");
        const slots = qa(el, ".sg-slot");
        const lasts = qa(el, ".sg-last img");
        const task = q(el, ".sg-task");
        const tT = q(el, ".sg-t");
        const tH = q(el, ".sg-h");
        const iEl = q(el, ".sg-i");
        const fbT = q(el, ".sg-fb-t");
        const flash = q(el, ".sg-flash");
        const shutter = q(el, ".sg-shutter");
        const flys = q(el, ".sg-flys");
        const lastBox = q(el, ".sg-last");

        const setStrip = (c: number) => {
            slots.forEach((s, i) => (s.className = `sg-slot ${i < c ? "is-done" : i === c ? "is-cur" : ""}`));
            lasts.forEach((im, i) => im.classList.toggle("is-on", i === Math.max(0, c - 1)));
            lastBox.classList.toggle("is-empty", c === 0);
        };
        const setTask = (i: number) => {
            const s = SHOTS[i];
            tT.textContent = s.t;
            tH.textContent = s.h;
            iEl.textContent = String(i + 1);
            fbT.textContent = "Step back a little";
        };
        const setGood = (on: boolean) => {
            el.classList.toggle("is-good", on);
            if (on) fbT.textContent = "Perfect, hold still";
        };
        const layer = (i: number, off: boolean) => {
            imgs.forEach((im, k) => im.classList.toggle("is-on", k === i));
            imgs[i].style.transition = "none";
            imgs[i].style.transform = off ? OFF : "none";
            reflow(imgs[i]);
            imgs[i].style.transition = "";
        };
        const show = (i: number) => {
            setTask(i);
            setStrip(i);
            layer(i, false);
            setGood(true);
        };
        const fly = (i: number) => {
            const src = imgs[i].querySelector("img");
            if (!src) return;
            const r = el.getBoundingClientRect();
            const k = r.width / 390 || 1;
            const sr = slots[i].getBoundingClientRect();
            const f = src.cloneNode() as HTMLImageElement;
            f.removeAttribute("style");
            f.className = "sg-fly";
            f.setAttribute("style", "left:115px;top:190px;width:160px;height:210px");
            flys.appendChild(f);
            reflow(f);
            const x = (sr.left - r.left) / k;
            const y = (sr.top - r.top) / k;
            f.style.transform = `translate(${x - 115}px, ${y - 190}px) scale(${sr.width / k / 160}, ${sr.height / k / 210})`;
            f.style.opacity = "0.2";
            run.after(700, () => f.remove());
        };
        const shoot = (i: number) => {
            const img = imgs[i];
            el.classList.remove("is-good");
            el.classList.add("is-off");
            setTask(i);
            setStrip(i);
            run.after(250, () => {
                el.classList.remove("is-off");
                img.style.transition = `transform 600ms ${EASE}, opacity 500ms ${EASE}`;
                img.style.transform = "none";
            });
            run.after(850, () => setGood(true));
            run.after(1150, () => {
                shutter.classList.add("is-press");
                run.after(160, () => shutter.classList.remove("is-press"));
                flash.classList.add("is-on");
                run.after(80, () => flash.classList.remove("is-on"));
                fly(i);
            });
            run.after(1600, () => {
                setStrip(i + 1);
                if (i + 1 >= n) {
                    run.after(1800, () => {
                        el.classList.add("is-fade");
                        run.after(420, () => {
                            el.classList.remove("is-fade");
                            start();
                        });
                    });
                    return;
                }
                nextTask(i + 1);
            });
        };
        const nextTask = (i: number) => {
            task.classList.add("is-out");
            layer(i, true);
            run.after(120, () => {
                task.classList.remove("is-out");
                task.classList.add("is-in");
                reflow(task);
                task.classList.remove("is-in");
                shoot(i);
            });
        };
        const start = () => {
            flys.replaceChildren();
            layer(0, true);
            shoot(0);
        };
        const idle = () => {
            el.classList.remove("is-off", "is-fade");
            show(0);
        };
        return {
            reset: idle,
            end: idle,
            play: start,
            pause: () => {
                flys.replaceChildren();
                el.classList.remove("is-fade");
            },
        };
    });
    return (
        <Shell name="shot-guide" rootRef={ref}>
            <div className="sg-vf">
                <div className="sg-ph">
                    {SHOTS.map((s, i) => (
                        <div key={s.src} className={`sg-img${i === 0 ? " is-on" : ""}`}>
                            <Image src={photo(s.src)} alt="" fill sizes="420px" />
                        </div>
                    ))}
                </div>
            </div>
            <div className="sg-scrim" />
            <PhoneStatusBar dark />
            <div className="sg-top">
                <span className="ic-btn">
                    <X size={20} strokeWidth={2.4} />
                </span>
                <span className="sg-of">
                    Shot <b className="sg-i">1</b> of {n}
                </span>
                <span className="ic-btn">
                    <ZapOff size={18} strokeWidth={2.2} />
                </span>
            </div>
            <div className="sg-task">
                <b className="sg-t">{SHOTS[0].t}</b>
                <span className="sg-h">{SHOTS[0].h}</span>
            </div>
            <div className="cam-level">
                <i />
                <b />
                <i />
            </div>
            <div className="sg-fb">
                <span className="sg-fb-ok">
                    <Check size={15} strokeWidth={3} />
                </span>
                <span className="sg-fb-t">Perfect, hold still</span>
            </div>
            <div className="sg-flash" />
            <div className="sg-sheet">
                <div className="sg-strip">
                    {SHOTS.map((s, i) => (
                        <span key={s.src} className={`sg-slot${i === 0 ? " is-cur" : ""}`}>
                            <span className="clip">
                                <Image src={photo(s.src)} alt="" fill sizes="40px" />
                            </span>
                            <i>
                                <Check size={9} strokeWidth={3.6} />
                            </i>
                        </span>
                    ))}
                </div>
                <div className="sg-ctl">
                    <span className="sg-last is-empty">
                        {SHOTS.map((s, i) => (
                            <Image key={s.src} className={i === 0 ? "is-on" : undefined} src={photo(s.src)} alt="" width={54} height={54} sizes="60px" />
                        ))}
                    </span>
                    <span className="sg-shutter">
                        <i />
                    </span>
                    <span className="sg-skip">Skip</span>
                </div>
            </div>
            <div className="sg-flys" />
        </Shell>
    );
}

// =====================================================================================
// site-building: Tendso builds the site (~20 min), then "Ready to check"
// =====================================================================================
const BUILD_ROWS = [
    { t: "Reading your interview", Icon: Mic },
    { t: "Writing your pages", Icon: PenLine },
    { t: "Polishing your photos", Icon: ImageIcon },
    { t: "Building your site", Icon: LayoutTemplate },
];
export function SiteBuildingScreen({ playing, epoch = 0 }: ScreenProps) {
    const ref = useScreen(playing, epoch, (el, run) => {
        const rows = qa(el, ".sbd-row");
        const bar = q(el, ".sbd-bar i");
        const good = q(el, ".sbd-good");
        const state = (k: number) => {
            rows.forEach((r, i) => {
                r.classList.toggle("is-done", i < k);
                r.classList.toggle("is-now", i === k);
            });
            bar.style.transform = `scaleX(${(0.06 + (0.94 * k) / 4).toFixed(3)})`;
            el.classList.toggle("is-photos", k === 2);
        };
        const cycle = () => {
            el.classList.remove("is-review");
            state(0);
            [1, 2, 3, 4].forEach((k, i) => run.after(1300 + i * 1500 + (k === 3 ? 900 : 0), () => state(k)));
            run.after(8000, () => el.classList.add("is-review"));
            run.after(10200, () => {
                good.classList.add("is-tap");
                run.after(220, () => good.classList.remove("is-tap"));
            });
            run.after(12000, cycle);
        };
        return {
            reset: () => {
                el.classList.remove("is-review");
                state(2);
            },
            end: () => {
                state(4);
                el.classList.add("is-review");
            },
            play: cycle,
        };
    });
    return (
        <Shell name="site-building" rootRef={ref}>
            <PhoneStatusBar />
            <div className="sbd-work">
                <Image className="sbd-buddy" src={`${A}/brand/buddy.webp`} alt="" width={92} height={92} />
                <p className="a-display a-display--md sbd-h">Building your site</p>
                <p className="s-sub sbd-eta">About 20 minutes</p>
                <div className="sbd-bar">
                    <i />
                </div>
                <div className="sbd-rows">
                    {BUILD_ROWS.map(({ t, Icon }) => (
                        <div key={t} className="sbd-row">
                            <span className="sbd-ic">
                                <Icon size={18} strokeWidth={2.2} />
                            </span>
                            <b>{t}</b>
                            <span className="sbd-st">
                                <i className="sbd-spin" />
                                <span className="sbd-ok">
                                    <Check size={16} strokeWidth={3} />
                                </span>
                            </span>
                        </div>
                    ))}
                </div>
                <div className="sbd-photo">
                    <Image className="sbd-ph sbd-ph--a" src={photo("phone-headshot")} alt="" fill sizes="140px" />
                    <Image className="sbd-ph sbd-ph--b" src={photo("pro2-headshot")} alt="" fill sizes="140px" />
                </div>
            </div>
            <div className="sbd-review">
                <p className="a-display a-display--md">Ready to check</p>
                <div className="sbd-site">
                    <Image src={`${A}/sites/forge-m.webp`} alt="" fill sizes="360px" />
                </div>
                <div className="sbd-btns">
                    <div className="door door--ghost sbd-change">Ask for a change</div>
                    <div className="door door--accent sbd-good">Looks good</div>
                </div>
            </div>
        </Shell>
    );
}

// =====================================================================================
// site-ready: see it first, pay once to publish
// =====================================================================================
export function SiteReadyScreen({ playing, epoch = 0 }: ScreenProps) {
    const ref = useScreen(playing, epoch, (el, run) => {
        const page = q(el, ".sr-thumb");
        const img = q(el, ".sr-img");
        const maxScroll = () => Math.max(0, page.clientWidth * (4000 / 600) - page.clientHeight);
        const to = (p: number, ms: number, ease = EASE) => {
            img.style.transition = ms ? `transform ${ms}ms ${ease}` : "none";
            img.style.transform = `translateY(${-p * maxScroll()}px)`;
        };
        const cycle = () => {
            to(0, 0);
            reflow(img);
            run.after(1200, () => {
                to(1, 16000, EASE_INOUT);
                run.after(17800, () => {
                    to(0, 2400);
                    run.after(3800, cycle);
                });
            });
        };
        return {
            reset: () => to(0, 0),
            end: () => to(0, 0),
            play: cycle,
            pause: () => {
                const m = getComputedStyle(img).transform;
                img.style.transition = "none";
                img.style.transform = m === "none" ? "" : m;
            },
        };
    });
    return (
        <Shell name="site-ready" rootRef={ref}>
            <PhoneStatusBar />
            <StepHead n={4} total={4} />
            <div className="s-body">
                <p className="a-display a-display--md s-title">Your site is ready!</p>
                <div className="sr-row">
                    <div className="sr-thumb">
                        <Image className="sr-img" src={`${A}/sites/forge-m-long.webp`} alt="" width={600} height={4000} sizes="140px" />
                    </div>
                    <div className="sr-side">
                        <div className="sr-addr">
                            <span className="s-lbl">Free address</span>
                            <b>forge.sites.tendso.com</b>
                        </div>
                        <div className="sr-dom">
                            <b>Want forge.com?</b>
                            <span>Optional, we set it up</span>
                        </div>
                        <span className="sr-change">Change anything →</span>
                    </div>
                </div>
                <div className="a-card a-card--lg sr-price">
                    <div className="sr-amt">
                        <b>{PRICE.once}</b>
                        <span>once</span>
                    </div>
                    <p className="sr-when">or start with {PRICE.downPayment} down</p>
                    <div className="sr-inc">
                        {["Your web address", "Hosting", "Your photos and words"].map((t) => (
                            <div key={t} className="sr-li">
                                <span className="sr-ck">
                                    <Check size={13} strokeWidth={3} />
                                </span>
                                {t}
                                <em>Included</em>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="s-foot sr-foot">
                <div className="door door--accent">Publish for {PRICE.once}</div>
                <p className="sr-pay">GCash, Maya or card · No monthly fees</p>
            </div>
        </Shell>
    );
}

// =====================================================================================
// agents-near: field agents on a quiet vector map, one selected, book a visit
// =====================================================================================
const MAP_H = 844;
function buildMap() {
    let seed = 7;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const xs = [-200];
    while (xs[xs.length - 1] < 600) xs.push(xs[xs.length - 1] + 54 + Math.round(rnd() * 26));
    const ys = [-180];
    while (ys[ys.length - 1] < MAP_H + 180) ys.push(ys[ys.length - 1] + 44 + Math.round(rnd() * 22));
    const blocks: { x: number; y: number; w: number; h: number }[] = [];
    for (let i = 0; i < xs.length - 1; i++) {
        for (let j = 0; j < ys.length - 1; j++) {
            const x = xs[i] + 6, y = ys[j] + 6, w = xs[i + 1] - xs[i] - 12, h = ys[j + 1] - ys[j] - 12;
            if (rnd() < 0.18 && w > 40) {
                const s = Math.round(w * (0.4 + rnd() * 0.2));
                blocks.push({ x, y, w: s - 3, h }, { x: x + s + 3, y, w: w - s - 3, h });
            } else blocks.push({ x, y, w, h });
        }
    }
    return { xs, ys, blocks };
}
const MAP = buildMap();
const ROT = `rotate(-13 195 ${MAP_H / 2})`;
const RIVER = `M-20 ${MAP_H - 70} C 60 ${MAP_H - 96}, 110 ${MAP_H - 56}, 180 ${MAP_H - 74} S 300 ${MAP_H - 120}, 410 ${MAP_H - 104}`;
function MapSvg() {
    const { xs, ys, blocks } = MAP;
    const avX = new Set([4, 8]);
    const avY = new Set([6]);
    return (
        <svg className="an-svg" viewBox={`0 0 390 ${MAP_H}`} preserveAspectRatio="xMidYMid slice">
            <rect width="390" height={MAP_H} className="an-base" />
            <g transform={ROT}>
                <g className="an-blocks">
                    {blocks.map((b, i) => (
                        <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="3" />
                    ))}
                </g>
                <rect x={xs[6] + 6} y={ys[2] + 6} width={xs[7] - xs[6] - 12} height={ys[4] - ys[2] - 12} rx="4" className="an-park" />
            </g>
            <path className="an-river" d={RIVER} />
            <g transform={ROT}>
                <g className="an-streets">
                    {xs.map((x, i) => (
                        <line key={`x${i}`} x1={x} y1={-300} x2={x} y2={MAP_H + 300} strokeWidth={avX.has(i) ? 11 : 6} />
                    ))}
                    {ys.map((y, j) => (
                        <line key={`y${j}`} x1={-300} y1={y} x2={700} y2={y} strokeWidth={avY.has(j) ? 11 : 6} />
                    ))}
                </g>
            </g>
            <path className="an-river an-river--top" d={RIVER} />
            <g transform={ROT}>
                <g className="an-streets">
                    <line x1={xs[4]} y1={-300} x2={xs[4]} y2={MAP_H + 300} strokeWidth={11} />
                    <line x1={xs[8]} y1={-300} x2={xs[8]} y2={MAP_H + 300} strokeWidth={11} />
                </g>
            </g>
        </svg>
    );
}

interface FaceCrop {
    src: string;
    /** natural width / height */
    ar: number;
    /** face centre, 0..1 of the image */
    fx: number;
    fy: number;
    /** image width ÷ avatar width */
    z: number;
}
function Face({ f, size }: { f: FaceCrop; size: number }) {
    const w = f.z * 100;
    return (
        <Image
            src={person(f.src)}
            alt=""
            width={640}
            height={Math.round(640 / f.ar)}
            sizes={`${Math.round(size * f.z)}px`}
            style={{ width: `${w}%`, left: `${50 - f.fx * w}%`, top: `${50 - (f.fy * w) / f.ar}%` }}
        />
    );
}
const NEAR = [
    { name: "Joy Dizon", first: "Joy", dist: "0.8 km", x: 150, y: 214, sel: true, face: { src: "17-mika", ar: 0.8, fx: 0.51, fy: 0.21, z: 3.6 } },
    { name: "Jun", x: 62, y: 152, face: { src: "14-garage", ar: 1.25, fx: 0.3, fy: 0.25, z: 6 } },
    { name: "Carlo", x: 304, y: 136, face: { src: "04-team", ar: 1.49, fx: 0.16, fy: 0.22, z: 7.5 } },
    { name: "Bea", x: 50, y: 336, face: { src: "12-salon", ar: 0.8, fx: 0.67, fy: 0.29, z: 5.5 } },
    { name: "Andrea", x: 314, y: 306, face: { src: "04-team", ar: 1.49, fx: 0.52, fy: 0.28, z: 7.5 } },
    { name: "", x: 112, y: 404, face: { src: "10-scooter", ar: 1.49, fx: 0.42, fy: 0.23, z: 7.5 } },
];
const BUILT = [
    { name: "Forge", src: photo("after-barber") },
    { name: "Héla Hair", src: photo("hela-hero") },
    { name: "Labaná", src: photo("labana-stacks") },
];
export function AgentsNearScreen({ playing, epoch = 0 }: ScreenProps) {
    const ref = useScreen(playing, epoch, (el, run) => {
        const pins = qa(el, ".an-pin");
        const sheet = q(el, ".an-sheet");
        const setPins = (on: boolean, animate: boolean) =>
            pins.forEach((p, i) => {
                p.style.transition = animate ? `opacity 600ms ${EASE} ${i * 120}ms, transform 700ms ${EASE} ${i * 120}ms` : "none";
                p.classList.toggle("is-in", on);
            });
        const setSheet = (on: boolean, animate: boolean) => {
            sheet.style.transition = animate ? `transform 900ms ${EASE}` : "none";
            sheet.classList.toggle("is-in", on);
        };
        const cycle = () => {
            setPins(false, false);
            setSheet(false, false);
            reflow(el);
            run.after(400, () => {
                setPins(true, true);
                run.after(120 * pins.length + 500, () => {
                    setSheet(true, true);
                    run.after(7100, () => {
                        setSheet(false, true);
                        run.after(700, () => {
                            pins.forEach((p) => {
                                p.style.transition = `opacity 400ms ${EASE}`;
                                p.classList.remove("is-in");
                            });
                            run.after(600, cycle);
                        });
                    });
                });
            });
        };
        const idle = () => {
            setPins(true, false);
            setSheet(true, false);
        };
        return { reset: idle, end: idle, play: cycle };
    });
    const m = NEAR[0];
    return (
        <Shell name="agents-near" rootRef={ref}>
            <PhoneStatusBar />
            <div className="an-map">
                <MapSvg />
            </div>
            <div className="an-top">
                <span className="a-back">
                    <ChevronLeft size={20} strokeWidth={2.4} />
                </span>
                <span className="an-count">{NEAR.length} field agents near you</span>
            </div>
            {NEAR.map((a, i) => (
                <div key={i} className={`an-pin is-in${a.sel ? " is-sel" : ""}`} style={{ left: a.x, top: a.y }}>
                    {a.sel && <span className="an-halo" />}
                    <span className="an-av">
                        <Face f={a.face} size={a.sel ? 66 : 46} />
                    </span>
                    {a.sel ? (
                        <span className="an-lbl an-lbl--sel">
                            {a.first} · {a.dist}
                        </span>
                    ) : (
                        a.name && <span className="an-lbl">{a.name}</span>
                    )}
                </div>
            ))}
            <div className="an-pin an-shop is-in" style={{ left: 226, top: 338 }}>
                <span className="an-shop-ph">
                    <Image src={INTERVIEW_VIDEO.poster} alt="" width={42} height={42} sizes="48px" />
                </span>
                <span className="an-lbl an-lbl--ink">Your shop</span>
            </div>
            <div className="an-sheet is-in">
                <span className="an-grab" />
                <div className="an-who">
                    <span className="an-av an-av--lg">
                        <Face f={m.face} size={58} />
                    </span>
                    <div className="an-meta">
                        <b>
                            {m.name} <span>· {m.dist}</span>
                        </b>
                        <span className="an-rate">
                            <Star size={14} strokeWidth={0} className="s-fill" />
                            4.9 · 23 sites built · Marikina
                        </span>
                    </div>
                </div>
                <p className="an-quote">“I&apos;ll visit, take your photos, and set up the site with you.”</p>
                <div className="an-built">
                    <span className="s-lbl">Sites {m.first} built</span>
                    <div className="an-thumbs">
                        {BUILT.map((b) => (
                            <div key={b.name}>
                                <Image src={b.src} alt="" width={200} height={148} sizes="110px" />
                                <span>{b.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="an-cta">
                    <div className="door door--accent">Book a free visit</div>
                    <div className="door door--ghost an-chat">Chat</div>
                </div>
            </div>
        </Shell>
    );
}

export const SCREENS = {
    welcome: WelcomeScreen,
    "design-picker": DesignPickerScreen,
    "interview-cam": InterviewCamScreen,
    "shot-guide": ShotGuideScreen,
    "site-building": SiteBuildingScreen,
    "site-ready": SiteReadyScreen,
    "agents-near": AgentsNearScreen,
} as const;
export type ScreenName = keyof typeof SCREENS;
