"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { PEOPLE, person } from "./content";
import { clamp, onFrame, useReducedMotion } from "./motion";

/*
 * People (mock js/people.js, ramp.design "Beyond the work"): a photo cloud in
 * depth around a big headline. A tall section with a sticky stage; each photo
 * has a gathered position and a speed. Front layer faster and sharp, back layer
 * slower, smaller, blurred. Transforms only.
 *
 * x: fraction of stage width from centre; y: fraction of viewport height from
 * centre; w: px at 1440 x 900 (390 wide on phones). sp = scroll speed,
 * r = rotation (deg), dx = x drift per viewport scrolled. i = index in PEOPLE.
 */
interface Spot {
    i: number;
    x: number;
    y: number;
    w: number;
    sp: number;
    r: number;
    dx: number;
}
const DESK: Spot[] = [
    { i: 0, x: -0.37, y: -0.27, w: 214, sp: 1.32, r: -1.6, dx: -0.01 },
    { i: 1, x: 0.31, y: -0.33, w: 262, sp: 1.42, r: 1.2, dx: 0.012 },
    { i: 2, x: -0.19, y: 0.31, w: 236, sp: 1.25, r: 1.4, dx: 0.008 },
    { i: 3, x: 0.39, y: 0.2, w: 196, sp: 1.36, r: -1.8, dx: -0.012 },
    { i: 4, x: -0.06, y: -0.58, w: 176, sp: 1.48, r: 0.8, dx: 0.006 },
    { i: 5, x: 0.14, y: 0.55, w: 192, sp: 1.3, r: -1.0, dx: -0.008 },
    { i: 7, x: -0.41, y: 0.62, w: 182, sp: 1.4, r: 1.9, dx: 0.01 },
    { i: 12, x: 0.43, y: -0.78, w: 170, sp: 1.52, r: -1.2, dx: -0.01 },
    { i: 6, x: -0.16, y: -0.2, w: 150, sp: 0.66, r: -1.4, dx: 0.006 },
    { i: 8, x: 0.19, y: -0.12, w: 176, sp: 0.72, r: 1.6, dx: -0.006 },
    { i: 9, x: -0.3, y: 0.04, w: 184, sp: 0.62, r: -0.8, dx: 0.008 },
    { i: 10, x: 0.29, y: 0.38, w: 170, sp: 0.7, r: 1.0, dx: -0.004 },
    { i: 11, x: 0.04, y: 0.22, w: 160, sp: 0.64, r: -1.2, dx: 0.004 },
    { i: 13, x: -0.43, y: -0.62, w: 150, sp: 0.78, r: 1.4, dx: 0.006 },
    { i: 14, x: 0.46, y: -0.06, w: 156, sp: 0.68, r: -1.8, dx: -0.006 },
    { i: 15, x: -0.03, y: 0.78, w: 132, sp: 0.74, r: 1.8, dx: 0.004 },
];
const MOB: Spot[] = [
    { i: 0, x: -0.27, y: -0.3, w: 128, sp: 1.32, r: -1.6, dx: -0.02 },
    { i: 1, x: 0.24, y: -0.42, w: 150, sp: 1.44, r: 1.4, dx: 0.02 },
    { i: 2, x: 0.22, y: 0.28, w: 140, sp: 1.26, r: 1.2, dx: -0.02 },
    { i: 3, x: -0.25, y: 0.46, w: 118, sp: 1.38, r: -1.8, dx: 0.02 },
    { i: 5, x: 0.2, y: 0.76, w: 112, sp: 1.3, r: -1.0, dx: -0.01 },
    { i: 12, x: -0.18, y: -0.74, w: 110, sp: 1.5, r: 1.0, dx: 0.01 },
    { i: 6, x: 0.3, y: -0.08, w: 92, sp: 0.66, r: -1.4, dx: 0.01 },
    { i: 9, x: -0.3, y: 0.1, w: 112, sp: 0.62, r: 1.0, dx: -0.01 },
    { i: 11, x: 0.02, y: 0.52, w: 104, sp: 0.7, r: -1.2, dx: 0.01 },
    { i: 13, x: 0.1, y: -0.6, w: 100, sp: 0.74, r: 1.6, dx: -0.01 },
];

export function People() {
    const reduced = useReducedMotion();
    const [mobile, setMobile] = useState(false);
    const root = useRef<HTMLElement>(null);
    const set = mobile ? MOB : DESK;

    useEffect(() => {
        const check = () => setMobile(innerWidth < 760);
        check();
        addEventListener("resize", check);
        return () => removeEventListener("resize", check);
    }, []);

    useEffect(() => {
        const sec = root.current;
        if (!sec) return;
        const stage = sec.querySelector<HTMLElement>(".people-stage")!;
        const els = [...stage.querySelectorAll<HTMLElement>(".pc")];
        let vw = 0, vh = 0, secTop = 0, secH = 0, lastY = -1;
        const sizes = els.map(() => ({ w: 0, h: 0 }));

        const measure = () => {
            vw = stage.clientWidth || innerWidth;
            vh = innerHeight;
            secTop = sec.getBoundingClientRect().top + scrollY;
            secH = sec.offsetHeight;
            const k = mobile ? clamp(vw / 390, 0.82, 1.3) : clamp(Math.min(vw / 1440, vh / 900), 0.62, 1.25);
            els.forEach((el, n) => {
                const s = set[n];
                const w = Math.round(s.w * k);
                const h = Math.round(w / PEOPLE[s.i].ar);
                sizes[n] = { w, h };
                el.style.width = `${w}px`;
                el.style.height = `${h}px`;
                el.style.marginLeft = `${-w / 2}px`;
                el.style.marginTop = `${-h / 2}px`;
            });
            lastY = -1;
        };
        // d = px away from the gathered moment (the middle of the pinned stretch)
        const place = () => {
            const y = scrollY;
            if (y === lastY) return;
            lastY = y;
            const pinLen = Math.max(1, secH - vh);
            const s = y - secTop;
            if (s < -vh * 1.1 || s > secH + vh * 0.1) return;
            const d = reduced ? 0 : s - pinLen * 0.5;
            const ySpread = reduced ? (mobile ? 0.62 : 0.66) : 1;
            els.forEach((el, n) => {
                const c = set[n];
                const tx = c.x * vw + (d / vh) * c.dx * vw;
                const ty = c.y * vh * ySpread - d * c.sp;
                const rot = c.r + (d / vh) * c.r * 0.35;
                el.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`;
            });
        };
        measure();
        place();
        const ro = new ResizeObserver(() => {
            measure();
            place();
        });
        ro.observe(document.body);
        const off = reduced ? () => {} : onFrame(place);
        return () => {
            ro.disconnect();
            off();
        };
    }, [mobile, reduced, set]);

    return (
        <section className={`people${reduced ? " is-static" : ""}`} id="people" ref={root} aria-labelledby="lv2-people-h">
            <div className="people-stage">
                <div className="people-copy">
                    <h2 className="people-h" id="lv2-people-h">
                        The people behind the sites.
                    </h2>
                    <p className="people-sub">Field agents, creators and the team. Filipino first, local everywhere.</p>
                </div>
                {set.map((s) => {
                    const p = PEOPLE[s.i];
                    return (
                        <figure key={`${mobile ? "m" : "d"}-${s.i}`} className={`pc pc--l${p.layer}`}>
                            <Image src={person(p.src)} alt={p.alt} fill sizes={`${Math.round(s.w * 1.25)}px`} draggable={false} />
                        </figure>
                    );
                })}
            </div>
        </section>
    );
}
