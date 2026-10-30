"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { Label, PhoneFrame } from "@/components/v2";

import { clamp, ease, lerp, onFrame, prog, useReducedMotion } from "./motion";
import { DesignPickerScreen, InterviewCamScreen, ShotGuideScreen, SiteBuildingScreen, SiteReadyScreen, WelcomeScreen, type ScreenProps } from "./screens";

/*
 * Six steps, one pinned phone (mock js/steps.js, Klarna / Agentcard pattern).
 * Scroll drives a 0..6 position. Each step's screen slides up from below over
 * the previous one, which scales down and dims behind it. The active heading
 * turns ink and opens one line; the active screen restarts its own demo.
 */
const STEPS: { t: string; d: string; Screen: (p: ScreenProps) => ReactNode }[] = [
    { t: "Download the app", d: "Free on iPhone and Android.", Screen: WelcomeScreen },
    { t: "Choose a design", d: "Pick a look made for your kind of business.", Screen: DesignPickerScreen },
    { t: "Get interviewed", d: "10 simple questions, one at a time. Your words become the pages.", Screen: InterviewCamScreen },
    { t: "Take the photos", d: "10 guided shots for your kind of business, plus any you want to add.", Screen: ShotGuideScreen },
    { t: "We build it", d: "Our AI writes your pages, polishes your photos and builds the site. About 20 minutes. Ask for changes, or say it looks good.", Screen: SiteBuildingScreen },
    { t: "Your website is ready", d: "The same day. See it first, pay once to publish.", Screen: SiteReadyScreen },
];

export function Steps() {
    const reduced = useReducedMotion();
    const track = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(0);
    const [visible, setVisible] = useState(false);
    const [epoch, setEpoch] = useState(0);

    useEffect(() => {
        const tr = track.current;
        if (!tr) return;
        const layers = [...tr.querySelectorAll<HTMLElement>(".st-layer")];
        let lastY = -1;
        let act = -1;
        let vis = false;
        const update = (force = false) => {
            const y = scrollY;
            if (y === lastY && !force) return;
            lastY = y;
            const r = tr.getBoundingClientRect();
            const isVis = r.bottom > 0 && r.top < innerHeight;
            if (isVis !== vis) {
                vis = isVis;
                setVisible(isVis);
            }
            const span = tr.offsetHeight - innerHeight;
            const pos = clamp(-r.top / span, 0, 0.9999) * STEPS.length;
            const idx = Math.floor(pos);
            const local = pos - idx;
            // the next card starts entering in the last 35% of each step
            const enter = reduced ? (local > 0.82 ? 1 : 0) : ease.out(prog(local, 0.65, 1));
            layers.forEach((L, i) => {
                let ty = 0, sc = 1, dim = 0, show = true;
                if (i < idx) {
                    sc = 0.9;
                    dim = 0.55;
                    show = i >= idx - 1;
                } else if (i === idx) {
                    sc = lerp(1, 0.9, enter);
                    dim = lerp(0, 0.55, enter);
                } else if (i === idx + 1) {
                    ty = lerp(100, 0, enter);
                } else {
                    ty = 100;
                    show = false;
                }
                L.style.transform = `translate3d(0, ${ty.toFixed(2)}%, 0) scale(${sc.toFixed(4)})`;
                L.style.setProperty("--dim", dim.toFixed(3));
                L.style.visibility = show ? "visible" : "hidden";
            });
            const a = local > 0.82 && idx < STEPS.length - 1 ? idx + 1 : idx;
            if (a !== act) {
                act = a;
                setActive(a);
                setEpoch((e) => e + 1);
            }
        };
        update(true);
        const onResize = () => update(true);
        addEventListener("resize", onResize);
        const off = onFrame(() => update());
        return () => {
            off();
            removeEventListener("resize", onResize);
        };
    }, [reduced]);

    const goTo = (i: number) => {
        const tr = track.current;
        if (!tr) return;
        const top = tr.getBoundingClientRect().top + scrollY;
        const span = tr.offsetHeight - innerHeight;
        scrollTo({ top: top + span * ((i + 0.5) / STEPS.length), behavior: reduced ? "auto" : "smooth" });
    };

    return (
        <section className="steps" id="how" aria-labelledby="lv2-steps-h">
            <div className="v2-wrap st-head" data-reveal="">
                <Label>How it works</Label>
                <h2 className="st-h2" id="lv2-steps-h">
                    Six steps.
                    <br />
                    One phone.
                </h2>
            </div>
            <div className="st-track" ref={track} style={{ "--n": STEPS.length } as CSSProperties}>
                <div className="st-pin">
                    <div className="v2-wrap st-grid">
                        <div className="st-rail" aria-hidden="true">
                            {STEPS.map((s, i) => (
                                <i key={s.t} className={i === active ? "is-on" : undefined} />
                            ))}
                        </div>
                        <div className="st-phone">
                            <PhoneFrame size="lg" theme="dark">
                                {STEPS.map(({ t, Screen }, i) => (
                                    <div key={t} className="st-layer" style={i === 0 ? undefined : { transform: "translate3d(0, 100%, 0)", visibility: "hidden" }}>
                                        <Screen playing={visible && i === active} epoch={i === active ? epoch : 0} />
                                    </div>
                                ))}
                            </PhoneFrame>
                        </div>
                        <ol className="st-list">
                            {STEPS.map((s, i) => (
                                <li key={s.t} className={`st-item${i === active ? " is-on" : ""}`}>
                                    <button type="button" className="st-btn" aria-current={i === active ? "step" : undefined} onClick={() => goTo(i)}>
                                        <span className="st-n">{String(i + 1).padStart(2, "0")}</span>
                                        <span className="st-t">{s.t}</span>
                                    </button>
                                    <div className="st-d">
                                        <p>{s.d}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>
            </div>
        </section>
    );
}
