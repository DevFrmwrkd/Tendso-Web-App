"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { Button, PhoneFrame } from "@/components/v2";

import { A, HERO_SITES, siteShot } from "./content";
import { StoreStatus } from "./StoreStatus";
import { ease, lerp, onFrame, prog, useReducedMotion } from "./motion";
import { InterviewCamScreen } from "./screens";

/*
 * Hero (mock js/hero.js, "Hero v2", Theo 2026-10-21: calm and symmetric).
 * One phone in the centre shows the interview. The Tendso buddy pops up and types
 * "Got it. I'll build your website.", a loading bar runs, the phone turns into the
 * finished site and four homepages slide out from behind it into a mirrored layout.
 * Loops every 16 s.
 *
 * The stage belongs to this section and scrolls away with it. The gallery below
 * reveals independently; no fixed overlay or shared scroll geometry is needed.
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
    const cameraOn = useRef(true);
    const [camEpoch, setCamEpoch] = useState(0);
    const [cameraPlaying, setCameraPlaying] = useState(true);

    useEffect(() => {
        const hero = heroRef.current;
        if (!hero) return;
        const world = hero.querySelector<HTMLElement>(".world")!;
        const phoneEl = hero.querySelector<HTMLElement>(".hero-phone")!;
        const buddyEl = hero.querySelector<HTMLElement>(".buddy")!;
        const say = hero.querySelector<HTMLElement>(".buddy-say")!;
        const bar = hero.querySelector<HTMLElement>(".buddy-load i")!;
        const cards = [...hero.querySelectorAll<HTMLElement>(".site-card")].map((el) => ({ el, w: 0, h: 0, blur: -1 }));
        let mobile = false;

        let W = 0, H = 0, pw = 0, ph = 0, cx = 0, cy = 0;
        let slots: Slot[] = [];
        let t0: number | null = null;
        let mx = 0, my = 0, tx = 0, ty = 0;
        let siteOn = phoneEl.classList.contains("is-site");
        let n = -1;
        let visible = false;
        let stopFrames: (() => void) | undefined;
        let pausedAt: number | null = null;
        let resizeFrame = 0;

        function syncPlayback() {
            const playing = !reduced && !document.hidden && visible;
            hero!.classList.toggle("is-paused", !playing);
            if (playing && !stopFrames) {
                if (pausedAt !== null && t0 !== null) t0 += performance.now() - pausedAt;
                pausedAt = null;
                stopFrames = onFrame(frame);
            } else if (!playing && stopFrames) {
                stopFrames();
                stopFrames = undefined;
                pausedAt = performance.now();
            }
            const nextCamera = playing && !siteOn;
            if (nextCamera !== cameraOn.current) {
                cameraOn.current = nextCamera;
                setCameraPlaying(nextCamera);
            }
        }

        function layout() {
            // Match the stable 100svh section, not Safari's changing toolbar viewport.
            W = hero!.clientWidth;
            H = hero!.clientHeight;
            mobile = W < 760;
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
                syncPlayback();
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
                const blur = mobile ? 0 : Math.round((s.blur + (1 - p) * 12) * 2) / 2;
                if (blur !== c.blur) {
                    c.el.style.filter = blur ? `blur(${blur}px)` : "none";
                    c.blur = blur;
                }
                c.el.style.zIndex = String(10 + s.z);
            });
        }

        const onMove = (e: PointerEvent) => {
            if (e.pointerType !== "mouse") return;
            tx = (e.clientX / innerWidth - 0.5) * 2;
            ty = (e.clientY / innerHeight - 0.5) * 2;
        };
        const onResize = () => {
            if (resizeFrame) return;
            resizeFrame = requestAnimationFrame(() => {
                resizeFrame = 0;
                layout();
                frame(pausedAt ?? performance.now());
            });
        };

        layout();
        hero.classList.toggle("is-static", reduced);
        frame(performance.now());
        const io = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting && entry.intersectionRatio >= 0.01;
            syncPlayback();
        }, { threshold: 0.01 });
        io.observe(hero);
        syncPlayback();
        addEventListener("resize", onResize);
        addEventListener("pointermove", onMove, { passive: true });
        document.addEventListener("visibilitychange", syncPlayback);
        return () => {
            stopFrames?.();
            io.disconnect();
            if (resizeFrame) cancelAnimationFrame(resizeFrame);
            removeEventListener("resize", onResize);
            removeEventListener("pointermove", onMove);
            document.removeEventListener("visibilitychange", syncPlayback);
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
                                <InterviewCamScreen playing={cameraPlaying} epoch={camEpoch} priority />
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
