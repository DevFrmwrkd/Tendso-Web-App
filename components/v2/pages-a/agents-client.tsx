"use client";

import { Minus, Plus } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { PhoneFrame } from "@/components/v2";

import { pesos } from "./data";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Money (packages/shared/pricing.ts): website ₱4,999; a field agent picks any price
 * from ₱999 to ₱4,999 (₱100 steps in the app, snapped to ₱500 here) and keeps 50%.
 * A month = shops a week x 4 weeks. Every result on the page is labelled Example.
 */
const FLOOR = 999;
const CEIL = 4999;
const STEP = 500;
const RATE = 0.5;
const WEEKS = 4;
const keep = (p: number) => Math.round(p * RATE);
const snap = (v: number) => Math.max(FLOOR, Math.min(CEIL, FLOOR + Math.round((v - FLOOR) / STEP) * STEP));

/** A number that counts from its current value to the new one (calm ease-out). With reduced motion it jumps. */
function useCount(target: number, ms = 520, from = target) {
    const [v, setV] = useState(from);
    const cur = useRef(from);
    useEffect(() => {
        if (reduced() || cur.current === target) {
            cur.current = target;
            return;
        }
        const a = cur.current;
        const t0 = performance.now();
        let raf = 0;
        const tick = (now: number) => {
            const k = Math.min(1, (now - t0) / ms);
            cur.current = a + (target - a) * easeOut(k);
            setV(cur.current);
            if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, ms]);
    return reduced() ? target : v;
}

/** The "paid" card arrives after the phone; its number counts up once. */
export function PaidCard() {
    const [on, setOn] = useState(false);
    const [target, setTarget] = useState(0);
    const v = useCount(target, 1300, 0);
    useEffect(() => {
        const instant = reduced();
        const t1 = setTimeout(() => setOn(true), instant ? 0 : 1100);
        const t2 = setTimeout(() => setTarget(1500), instant ? 0 : 1360);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, []);
    return (
        <div className={`ag-paid${on ? " is-in" : ""}`} aria-label="Example: Forge Barbers paid 2,999 pesos, you keep 1,500 pesos">
            <div className="ag-paid-top">
                <Image src="/v2/pages-a/photos/phone-outside.jpg" alt="" width={46} height={46} />
                <span>
                    <b>Forge Barbers</b>
                    <small>Paid ₱2,999</small>
                </span>
                <em className="ag-tag">Example</em>
            </div>
            <div className="ag-paid-keep">
                <span>You keep</span>
                <strong>{pesos(v)}</strong>
            </div>
        </div>
    );
}

const STEPS = [
    { title: "Find a shop", body: "Pick a shop near you that has no website yet.", cap: "Your map: shops with no website yet", img: "agent-map", alt: "The Tendso app map with a shop selected" },
    { title: "Ask 10 questions", body: "The owner talks on camera. The app shows one question at a time.", cap: "The owner talks, the app asks", img: "agent-interview-q", alt: "The Tendso app recording an owner's interview" },
    { title: "Take 10 photos", body: "The app shows you each shot. Hold still, tap.", cap: "The app shows each shot", img: "agent-shot-guide", alt: "The Tendso app guiding a photo" },
    {
        title: "Send it",
        body: "The site is ready the same day, about 20 minutes later. The owner sees the finished site first, then pays once to publish.",
        cap: "What the owner sees, the same day",
        img: "agent-site-ready",
        alt: "The Tendso app showing a finished site",
    },
] as const;

/** One phone, four steps. Plays through on its own while in view; a click picks a step. */
export function VisitStepper() {
    const [cur, setCur] = useState(0);
    const [dur, setDur] = useState(6500);
    const [visible, setVisible] = useState(false);
    const [capText, setCapText] = useState<string>(STEPS[0].cap);
    const [swap, setSwap] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const capTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => {
        const el = root.current;
        if (!el) return;
        const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
        io.observe(el);
        return () => io.disconnect();
    }, []);

    // caption swaps with a short fade
    const show = useCallback((i: number) => {
        setCur(i);
        setSwap(true);
        clearTimeout(capTimer.current);
        capTimer.current = setTimeout(() => {
            setCapText(STEPS[i].cap);
            setSwap(false);
        }, 200);
    }, []);

    // while in view, go to the next step when the bar has run
    const auto = visible && !reduced();
    useEffect(() => {
        if (!auto) return;
        const t = setTimeout(() => {
            setDur(6500);
            show((cur + 1) % STEPS.length);
        }, dur);
        return () => clearTimeout(t);
    }, [auto, cur, dur, show]);

    return (
        <div className="ag-visit" id="visit" ref={root} data-reveal="">
            <ol className="ag-steps">
                {STEPS.map((s, i) => (
                    <li key={s.title} className={`ag-step${i === cur ? " is-on" : ""}${i === cur && auto ? " is-timing" : ""}`} style={{ ["--ag-dur" as string]: `${dur}ms` }}>
                        <button
                            type="button"
                            className="ag-step-btn"
                            aria-expanded={i === cur}
                            aria-controls="visit-stage"
                            onClick={() => {
                                setDur(12000);
                                show(i);
                            }}
                        >
                            <span className="ag-step-n">{i + 1}</span>
                            <span className="ag-step-t">{s.title}</span>
                        </button>
                        <div className="ag-step-body">
                            <div>
                                <p>{s.body}</p>
                            </div>
                        </div>
                        <span className="ag-step-bar" aria-hidden="true">
                            <i key={`${cur}-${dur}`} />
                        </span>
                    </li>
                ))}
            </ol>
            <div className="ag-visit-stage" id="visit-stage" aria-live="polite">
                <div className="ag-visit-phone">
                    <PhoneFrame size="md">
                        {STEPS.map((s, i) => (
                            <div key={s.img} className={`ag-layer${i === cur ? " is-on" : ""}`} aria-hidden={i !== cur}>
                                <Image src={`/v2/pages-a/screens/${s.img}.jpg`} alt={i === cur ? s.alt : ""} width={390} height={844} sizes="300px" style={{ width: 390, height: 844 }} />
                            </div>
                        ))}
                    </PhoneFrame>
                </div>
                <p className={`ag-visit-cap${swap ? " is-swap" : ""}`}>{capText}</p>
            </div>
        </div>
    );
}

/** Price slider + shops per week, with an "Example" result. */
export function EarnCalc() {
    const [price, setPrice] = useState(2999);
    const [shops, setShops] = useState(2);
    const k = keep(price);
    const keepV = useCount(k);
    const monthV = useCount(k * shops * WEEKS);
    const pct = ((price - FLOOR) / (CEIL - FLOOR)) * 100;
    return (
        <div className="ag-calc" data-reveal="">
            <div className="ag-calc-in">
                <div className="ag-field">
                    <label className="ag-field-l" htmlFor="calc-price">
                        Price you give the shop
                    </label>
                    <output className="ag-price-out" htmlFor="calc-price">
                        {pesos(price)}
                    </output>
                    <div className="ag-range">
                        <input
                            type="range"
                            id="calc-price"
                            min={FLOOR}
                            max={CEIL}
                            step={STEP}
                            value={price}
                            aria-valuetext={pesos(price)}
                            style={{ ["--p" as string]: `${pct}%` }}
                            onChange={(e) => setPrice(snap(+e.target.value))}
                        />
                    </div>
                    <div className="ag-range-ends">
                        <span>{pesos(FLOOR)}</span>
                        <span>{pesos(CEIL)}</span>
                    </div>
                    <p className="ag-keep-inline" aria-hidden="true">
                        You keep <b>{pesos(k)}</b>
                    </p>
                </div>

                <div className="ag-field ag-field--row">
                    <span className="ag-field-l" id="calc-shops-l">
                        Shops per week
                    </span>
                    <div className="ag-stepper" role="group" aria-labelledby="calc-shops-l">
                        <button type="button" className="ag-stepper-b" aria-label="One shop less" disabled={shops <= 1} onClick={() => setShops((n) => Math.max(1, n - 1))}>
                            <Minus size={18} strokeWidth={1.8} aria-hidden="true" />
                        </button>
                        <output className="ag-stepper-v" aria-live="polite">
                            {shops}
                        </output>
                        <button type="button" className="ag-stepper-b" aria-label="One shop more" disabled={shops >= 10} onClick={() => setShops((n) => Math.min(10, n + 1))}>
                            <Plus size={18} strokeWidth={1.8} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="ag-calc-out" aria-live="polite">
                <span className="ag-tag ag-tag--ink ag-out-tag">Example</span>
                <p className="ag-out-l">You keep</p>
                <p className="ag-out-big">{pesos(keepV)}</p>
                <p className="ag-out-per">per site</p>
                <p className="ag-out-month">
                    <span>Example:</span> <b>{pesos(monthV)}</b> a month
                </p>
            </div>
        </div>
    );
}
