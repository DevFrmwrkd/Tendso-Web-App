"use client";

import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type CSSProperties, type FormEvent } from "react";

import { Button } from "@/components/v2";
import { api } from "@/convex/_generated/api";

import { LANDING_LINKS, STORE_LINKS, person } from "./content";
import { AppleIcon, Arrow, PlayIcon } from "./icons";

/*
 * Paths, always last before the footer (mock js/paths.js): Download the app ·
 * Hire an agent (short form → a website lead in admin Leads) · Join us (field
 * agent or creator).
 */

// A believable QR: 25 x 25 modules, three finder squares, timing rows, seeded noise.
// PLACEHOLDER until the real store listing exists; it encodes nothing.
const QR_CELLS = (() => {
    const n = 25;
    const cells: [number, number][] = [];
    let s = 7;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
    for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
            if (inFinder(x, y)) continue;
            if (x >= 16 && x <= 20 && y >= 16 && y <= 20) continue;
            if (y === 6) {
                if (x % 2 === 0) cells.push([x, y]);
                continue;
            }
            if (x === 6) {
                if (y % 2 === 0) cells.push([x, y]);
                continue;
            }
            if (rnd() > 0.52) cells.push([x, y]);
        }
    return cells;
})();
function Finder({ x, y }: { x: number; y: number }) {
    return (
        <>
            <rect x={x} y={y} width="7" height="7" rx="1.6" />
            <rect x={x + 1} y={y + 1} width="5" height="5" rx="1" fill="#fff" />
            <rect x={x + 2} y={y + 2} width="3" height="3" rx=".6" />
        </>
    );
}
function Qr() {
    return (
        <svg viewBox="-2 -2 29 29" role="img" aria-label="QR code to download the app (placeholder)">
            <rect x="-2" y="-2" width="29" height="29" rx="3" fill="#fff" />
            <g fill="currentColor">
                {QR_CELLS.map(([x, y]) => (
                    <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" />
                ))}
                <Finder x={0} y={0} />
                <Finder x={18} y={0} />
                <Finder x={0} y={18} />
                <rect x="16" y="16" width="5" height="5" rx="1" />
                <rect x="17" y="17" width="3" height="3" fill="#fff" />
                <rect x="18" y="18" width="1" height="1" />
            </g>
        </svg>
    );
}

// ---------------------------------------------------------------------------- hire form
type Field = "shopName" | "area" | "mobile";
const RULES: Record<Field, (v: string) => string> = {
    shopName: (v) => (v.trim().length < 2 ? "Add your business name." : ""),
    area: (v) => (v.trim().length < 2 ? "Add your city or area." : ""),
    mobile: (v) => (v.replace(/\D/g, "").length < 10 ? "Add a number we can message, like 0917 123 4567." : ""),
};
const FIELDS: { k: Field; label: string; type: string; auto: string; placeholder: string; inputMode?: "tel" }[] = [
    { k: "shopName", label: "Shop name", type: "text", auto: "organization", placeholder: "Forge Barbers" },
    { k: "area", label: "Area", type: "text", auto: "address-level2", placeholder: "Marikina" },
    { k: "mobile", label: "Mobile", type: "tel", auto: "tel", placeholder: "0917 123 4567", inputMode: "tel" },
];

function HireForm() {
    const requestVisit = useMutation(api.landingLeads.requestVisit);
    const [values, setValues] = useState<Record<Field, string>>({ shopName: "", area: "", mobile: "" });
    const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
    const [formError, setFormError] = useState("");
    const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
    const refs = useRef<Partial<Record<Field, HTMLInputElement | null>>>({});

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const next: Partial<Record<Field, string>> = {};
        (Object.keys(RULES) as Field[]).forEach((k) => {
            const m = RULES[k](values[k]);
            if (m) next[k] = m;
        });
        setErrors(next);
        setFormError("");
        const first = FIELDS.find((f) => next[f.k]);
        if (first) {
            refs.current[first.k]?.focus();
            return;
        }
        setState("sending");
        try {
            await requestVisit(values);
            setState("sent");
        } catch (err) {
            setState("idle");
            const data = err instanceof ConvexError ? (err.data as { field?: Field | null; message?: string }) : null;
            if (data?.field) {
                setErrors({ [data.field]: data.message });
                refs.current[data.field]?.focus();
            } else {
                setFormError(data?.message ?? "That did not go through. Check your connection and try again.");
            }
        }
    };

    if (state === "sent") {
        return (
            <div className="hire-done" role="status">
                <span className="done-mark" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 22 22">
                        <path d="M5 11.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </span>
                <p className="done-h">Request sent.</p>
                <p className="done-p">A field agent will message you to pick a time.</p>
                <Button
                    variant="ghost"
                    size="sm"
                    className="done-again"
                    onClick={() => {
                        setValues({ shopName: "", area: "", mobile: "" });
                        setState("idle");
                    }}
                >
                    Send another
                </Button>
            </div>
        );
    }

    return (
        <form className="hire" noValidate onSubmit={onSubmit}>
            {FIELDS.map((f) => {
                const err = errors[f.k];
                return (
                    <div key={f.k} className={`f${err ? " is-bad" : ""}`}>
                        <label htmlFor={`lv2-h-${f.k}`}>{f.label}</label>
                        <input
                            ref={(el) => {
                                refs.current[f.k] = el;
                            }}
                            id={`lv2-h-${f.k}`}
                            name={f.k}
                            type={f.type}
                            inputMode={f.inputMode}
                            autoComplete={f.auto}
                            placeholder={f.placeholder}
                            value={values[f.k]}
                            aria-invalid={err ? true : undefined}
                            aria-describedby={err ? `lv2-h-${f.k}-e` : undefined}
                            onChange={(e) => {
                                const v = e.target.value;
                                setValues((s) => ({ ...s, [f.k]: v }));
                                if (err && !RULES[f.k](v)) setErrors((s) => ({ ...s, [f.k]: "" }));
                            }}
                        />
                        {err && (
                            <p className="f-err" id={`lv2-h-${f.k}-e`} role="alert">
                                {err}
                            </p>
                        )}
                    </div>
                );
            })}
            {formError && (
                <p className="f-err" role="alert">
                    {formError}
                </p>
            )}
            <Button type="submit" variant="dark" className="hire-go" disabled={state === "sending"}>
                {state === "sending" ? "Sending…" : "Request a visit"} <Arrow />
            </Button>
        </form>
    );
}

// ---------------------------------------------------------------------------- paths
export function Paths() {
    return (
        <section className="paths" id="paths" aria-labelledby="lv2-paths-h">
            <div className="v2-wrap">
                <h2 className="paths-h" id="lv2-paths-h" data-reveal="">
                    Pick your way in.
                </h2>
                <div className="paths-grid">
                    <div className="path-cell" data-reveal="" style={{ "--i": 0 } as CSSProperties}>
                        <article className="v2-tile path path--download" id="download">
                            <h3 className="path-line">Talk, snap, done. On your phone.</h3>
                            <div className="path-foot dl">
                                <figure className="qr">
                                    <Qr />
                                </figure>
                                <div className="stores">
                                    <a className="store" href={STORE_LINKS.appStore}>
                                        <AppleIcon />
                                        <span>
                                            <small>Download on the</small>
                                            <b>App Store</b>
                                        </span>
                                    </a>
                                    <a className="store" href={STORE_LINKS.googlePlay}>
                                        <PlayIcon />
                                        <span>
                                            <small>Get it on</small>
                                            <b>Google Play</b>
                                        </span>
                                    </a>
                                </div>
                            </div>
                        </article>
                    </div>
                    <div className="path-cell" data-reveal="" style={{ "--i": 1 } as CSSProperties}>
                        <article className="v2-tile path path--hire" id="hire">
                            <h3 className="path-line">A field agent visits your shop. About 30 minutes.</h3>
                            <HireForm />
                        </article>
                    </div>
                    <div className="path-cell" data-reveal="" style={{ "--i": 2 } as CSSProperties}>
                        <article className="v2-tile v2-tile--quiet path path--join" id="join">
                            <h3 className="path-line">Work with Tendso. Near you or online.</h3>
                            <figure className="join-photo">
                                <Image src={person("06-agent")} alt="A field agent outside an auto shop" fill sizes="(max-width: 760px) 92vw, 420px" />
                            </figure>
                            <div className="path-foot join">
                                <Link className="join-row" href={LANDING_LINKS.fieldAgents}>
                                    <span>
                                        <b>Join as a field agent</b>
                                        <small>Visit shops near you</small>
                                    </span>
                                    <Arrow />
                                </Link>
                                <Link className="join-row" href={LANDING_LINKS.creators}>
                                    <span>
                                        <b>Become a creator</b>
                                        <small>Share Tendso online with your link</small>
                                    </span>
                                    <Arrow />
                                </Link>
                            </div>
                        </article>
                    </div>
                </div>
            </div>
        </section>
    );
}
