"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { Button, PhoneFrame } from "@/components/v2";

import { A, HERO_SITES, siteShot } from "./content";
import { StoreStatus } from "./StoreStatus";
import { clamp, ease, lerp, onFrame, prog, useReducedMotion } from "./motion";
import { InterviewCamScreen } from "./screens";

/*
 * Hero (mock js/hero.js, "Hero v2", Theo 2026-10-21: calm and symmetric).
 * One phone in the centre shows the interview. The Tendso buddy pops up and types
 * "Got it. I'll build your website.", a loading bar runs, the phone turns into the
 * finished site and four homepages slide out from behind it into a mirrored layout.
 * Loops every 16 s.
 *
 * Collapse: over the first 0.9 viewport heights of scroll the fixed stage shrinks
 * into the first grid tile (#slot-stage) and fades; the gallery in that tile
 * takes over. One progress value drives the stage box; the world inside keeps
 * its full-screen layout and is scaled to fit.
 */

const SAY = "Got it. I'll build your website.";
const TL = { buddy: 2600, type0: 2900, type1: 4200, load0: 4400, load1: 5700, site: 5700, out0: 5800, done: 6500, bubbleOff: 10000, retract: 15000, loop: 16000 };

interface Slot {
    x: number;
    y: number;
    s: number;
    ry: number;
    blur: number;
    z: number;
}

export function Hero() {
    const reduced = useReducedMotion();
    const heroRef = useRef<HTMLElement>(null);
    const [camEpoch, setCamEpoch] = useState(0);
    const [docked, setDocked] = useState(false);

    useEffect(() => {
        const hero = heroRef.current;
        if (!hero) return;
        const stage = hero.querySelector<HTMLElement>(".stage")!;
        const world = hero.querySelector<HTMLElement>(".world")!;
        const copy = hero.querySelector<HTMLElement>(".hero-copy")!;
        const phoneEl = hero.querySelector<HTMLElement>(".hero-phone")!;
        const buddyEl = hero.querySelector<HTMLElement>(".buddy")!;
        const say = hero.querySelector<HTMLElement>(".buddy-say")!;
        const bar = hero.querySelector<HTMLElement>(".buddy-load i")!;
        const cards = [...hero.querySelectorAll<HTMLElement>(".site-card")].map((el) => ({ el, w: 0, h: 0, blur: -1 }));
        const slot = document.getElementById("slot-stage");
        const slotRadius = slot ? parseFloat(getComputedStyle(slot).borderTopLeftRadius) || 40 : 40;

        let W = 0, H = 0, pw = 0, ph = 0, cx = 0, cy = 0;
        let slots: Slot[] = [];
        let t0: number | null = null;
        let mx = 0, my = 0, tx = 0, ty = 0;
        let siteOn = false;
        let n = -1;
        let isDocked = false;
        let lastY = -1;

        function layout() {
            W = innerWidth;
            H = innerHeight;
            const mobile = W < 760;
            world.style.width = `${W}px`;
            world.style.height = `${H}px`;
            pw = mobile ? Math.round(Math.min(W * 0.46, H * 0.28)) : Math.round(Math.min(280, Math.max(220, H * 0.3)));
            phoneEl.style.setProperty("--hp", `${pw}px`);
            // frame padding 3.1% of the width on each side around a 390:844 screen
            ph = pw * 0.062 + (pw * 0.938 * 844) / 390;
            cx = W / 2;
            cy = mobile ? H * 0.38 : H * 0.48;
            const cw = mobile ? Math.round(W * 0.46) : Math.round(Math.min(440, Math.max(280, W * 0.24)));
            cards.forEach((c) => {
                c.el.style.setProperty("--cw", `${cw}px`);
                // the card box is known (30px bar + a 1440:900 shot), so no layout read is needed
                c.w = cw;
                c.h = 30 + (cw * 900) / 1440;
            });
            const inner = pw / 2 + cw * (mobile ? 0.18 : 0.46);
            const outer = pw / 2 + cw * (mobile ? 0.62 : 1.18);
            slots = [
                { x: -outer, y: mobile ? 34 : 70, s: mobile ? 0.7 : 0.78, ry: 18, blur: 2.5, z: 1 },
                { x: -inner, y: mobile ? -26 : -46, s: mobile ? 0.86 : 1, ry: 12, blur: 0, z: 2 },
                { x: inner, y: mobile ? -26 : -46, s: mobile ? 0.86 : 1, ry: -12, blur: 0, z: 2 },
                { x: outer, y: mobile ? 34 : 70, s: mobile ? 0.7 : 0.78, ry: -18, blur: 2.5, z: 1 },
            ];
            buddyEl.style.setProperty("--bs", `${mobile ? 72 : 104}px`);
            buddyEl.style.left = `${cx + pw / 2 - (mobile ? 34 : 30)}px`;
            buddyEl.style.top = `${cy + ph / 2 - (mobile ? 40 : 160)}px`;
            lastY = -1;
            hero!.classList.add("is-ready");
        }

        function frame(now: number) {
            if (t0 == null) t0 = now;
            const t = reduced ? TL.done + 1000 : (now - t0) % TL.loop;
            const sec = now / 1000;
            mx += (tx - mx) * 0.045;
            my += (ty - my) * 0.045;

            // phone: centre, upright, a slow breath
            const bob = reduced ? 0 : Math.sin(sec * 0.8) * 6;
            const px = cx - pw / 2 + mx * 10, py = cy - ph / 2 + bob + my * 6;
            phoneEl.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) perspective(1400px) rotateY(${(mx * 4).toFixed(2)}deg) rotateX(${(-my * 3).toFixed(2)}deg)`;

            // phone screen: interview → finished site
            const on = t >= TL.site && t < TL.retract;
            if (on !== siteOn) {
                siteOn = on;
                phoneEl.classList.toggle("is-site", on);
                if (!on) setCamEpoch((e) => e + 1);
            }

            // buddy + bubble
            hero!.classList.toggle("buddy-on", t >= TL.buddy && t < TL.bubbleOff);
            const k = Math.round(prog(t, TL.type0, TL.type1) * SAY.length);
            if (k !== n) {
                n = k;
                say.textContent = SAY.slice(0, k);
            }
            hero!.classList.toggle("typing", t >= TL.type0 && t < TL.type1);
            bar.style.transform = `scaleX(${ease.inout(prog(t, TL.load0, TL.load1)).toFixed(3)})`;
            hero!.classList.toggle("loading", t >= TL.load0 && t < TL.done);
            hero!.classList.toggle("built", t >= TL.done);

            // homepages: out from behind the phone into mirrored slots, float, retract at the end of the loop
            cards.forEach((c, i) => {
                const s = slots[i];
                const start = TL.out0 + (s.z === 2 ? 0 : 180);
                let p = ease.expo(prog(t, start, start + 900));
                if (t >= TL.retract) p = 1 - ease.inout(prog(t, TL.retract, TL.retract + 800));
                const fl = reduced ? 0 : Math.sin(sec * 0.55 + (s.z === 2 ? 0 : 1.3)) * 7; // same phase per pair → symmetric
                const x = cx + s.x * p - c.w / 2 + mx * 18 * s.s;
                const y = cy + s.y * p - c.h / 2 + fl + my * 10 * s.s;
                const sc = lerp(0.55, s.s, p);
                c.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${sc.toFixed(4)}) perspective(1400px) rotateY(${(s.ry * p).toFixed(2)}deg)`;
                c.el.style.opacity = prog(p, 0.05, 0.5).toFixed(3);
                const blur = Math.round((s.blur + (1 - p) * 12) * 2) / 2;
                if (blur !== c.blur) {
                    c.el.style.filter = blur ? `blur(${blur}px)` : "none";
                    c.blur = blur;
                }
                c.el.style.zIndex = String(10 + s.z);
            });
        }

        // the world keeps its full-screen layout; in the tile it is scaled to fit, centred
        function fitWorld(w: number, h: number, p: number) {
            const s = Math.min(w / W, h / H) * lerp(1, 1.08, clamp(p, 0, 1));
            world.style.transform = `translate3d(${((w - W * s) / 2).toFixed(1)}px, ${((h - H * s) / 2).toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
        }

        function collapse() {
            if (!slot || reduced) return;
            const y = window.scrollY;
            if (y === lastY) return;
            lastY = y;
            const raw = clamp(y / (H * 0.9), 0, 1);
            const p = ease.out(raw);
            const c = prog(raw, 0, 0.38);
            copy.style.opacity = (1 - c).toFixed(3);
            copy.style.filter = c > 0.01 ? `blur(${(c * 10).toFixed(1)}px)` : "none";
            copy.style.transform = `translate3d(0, ${(-c * 24).toFixed(1)}px, 0)`;
            copy.style.visibility = c >= 1 ? "hidden" : "visible";
            slot.style.setProperty("--gal", prog(raw, 0.55, 1).toFixed(3));
            const dock = raw >= 1;
            if (dock !== isDocked) {
                isDocked = dock;
                stage.classList.toggle("is-docked", dock);
                slot.classList.toggle("is-docked", dock);
                setDocked(dock);
            }
            if (dock) return;
            const r = slot.getBoundingClientRect();
            const w = lerp(W, r.width, p), h = lerp(H, r.height, p);
            stage.style.left = `${lerp(0, r.left, p).toFixed(1)}px`;
            stage.style.top = `${lerp(0, r.top, p).toFixed(1)}px`;
            stage.style.width = `${w.toFixed(1)}px`;
            stage.style.height = `${h.toFixed(1)}px`;
            stage.style.borderRadius = `${lerp(0, slotRadius, p).toFixed(1)}px`;
            stage.style.opacity = (1 - 0.85 * prog(raw, 0.7, 1)).toFixed(3);
            fitWorld(w, h, p);
        }

        const onMove = (e: PointerEvent) => {
            if (e.pointerType !== "mouse") return;
            tx = (e.clientX / innerWidth - 0.5) * 2;
            ty = (e.clientY / innerHeight - 0.5) * 2;
        };
        const onResize = () => {
            layout();
            if (reduced) {
                fitWorld(hero!.clientWidth, hero!.clientHeight, 0);
                frame(performance.now());
            }
            collapse();
        };

        layout();
        if (reduced) {
            hero.classList.add("is-static");
            slot?.style.setProperty("--gal", "1");
            fitWorld(hero.clientWidth, hero.clientHeight, 0);
            frame(performance.now());
        }
        collapse();
        addEventListener("resize", onResize);
        addEventListener("pointermove", onMove, { passive: true });
        const off = reduced
            ? () => {}
            : onFrame((now) => {
                  collapse();
                  if (!isDocked) frame(now);
              });
        return () => {
            off();
            removeEventListener("resize", onResize);
            removeEventListener("pointermove", onMove);
        };
    }, [reduced]);

    return (
        <section className="hero" ref={heroRef} aria-labelledby="lv2-hero-title">
            <div className="stage" aria-hidden="true">
                <div className="world">
                    <div className="world-in">
                        {HERO_SITES.map((s, i) => (
                            <div key={s.id} className="site-card">
                                <div className="site-bar">
                                    <i />
                                    <i />
                                    <i />
                                </div>
                                <div className="site-shot">
                                    <Image src={siteShot(s.id)} alt="" fill sizes="(max-width: 760px) 46vw, 440px" priority={i === 1 || i === 2} />
                                </div>
                            </div>
                        ))}
                        <div className="hero-phone">
                            <PhoneFrame size="md" theme="dark">
                                <InterviewCamScreen playing={!docked} epoch={camEpoch} priority />
                                <div className="hero-site">
                                    <Image src={`${A}/sites/forge-m-long.webp`} alt="" width={600} height={4000} sizes="300px" />
                                </div>
                            </PhoneFrame>
                        </div>
                        <div className="buddy">
                            <div className="buddy-bubble">
                                <span className="buddy-say" />
                                <i className="buddy-caret" />
                                <div className="buddy-load">
                                    <i />
                                </div>
                                <span className="buddy-done">Done. Here&apos;s your site.</span>
                            </div>
                            <Image className="buddy-img" src={`${A}/brand/buddy.webp`} alt="" width={104} height={104} sizes="104px" />
                        </div>
                    </div>
                </div>
            </div>
            <div className="hero-copy v2-wrap">
                <h1 className="hero-title" id="lv2-hero-title">
                    The thinking ends here.
                </h1>
                <div className="hero-ctas">
                    <Button href="#hire" size="lg">
                        Request a field agent
                    </Button>
                    <StoreStatus variant="icons" />
                </div>
            </div>
        </section>
    );
}
