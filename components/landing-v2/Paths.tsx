"use client";

import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";

import { Button } from "@/components/v2";

import { LANDING_LINKS, STORE_AVAILABILITY, person } from "./content";
import { Arrow } from "./icons";

/*
 * Paths, always last before the footer (mock js/paths.js): Download the app ·
 * Hire an agent (short form → a website lead in admin Leads) · Join us (field
 * agent or creator).
 */

type Turnstile = {
    render: (element: HTMLElement, options: Record<string, unknown>) => string;
    remove: (id: string) => void;
    reset: (id: string) => void;
};
const turnstile = () => (window as Window & { turnstile?: Turnstile }).turnstile;

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
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const challenge = useRef<HTMLDivElement>(null);
    const widget = useRef<string | null>(null);
    const [ready, setReady] = useState(false);
    const [token, setToken] = useState("");
    const [values, setValues] = useState<Record<Field, string>>({ shopName: "", area: "", mobile: "" });
    const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
    const [formError, setFormError] = useState("");
    const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
    const refs = useRef<Partial<Record<Field, HTMLInputElement | null>>>({});

    const sent = state === "sent";
    useEffect(() => {
        const api = turnstile();
        if (!ready || !siteKey || sent || !challenge.current || !api) return;
        const id = api.render(challenge.current, {
            sitekey: siteKey, size: "compact", action: "landing-visit", callback: setToken,
            "expired-callback": () => setToken(""), "error-callback": () => setToken(""),
        });
        widget.current = id;
        return () => { api.remove(id); widget.current = null; };
    }, [ready, siteKey, sent]);

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
            const response = await fetch("/api/landing-visit", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...values, token }),
            });
            const data = await response.json();
            if (!response.ok) throw data;
            setState("sent");
        } catch (err) {
            setState("idle");
            const data = err as { field?: Field | null; message?: string } | null;
            if (data?.field) {
                setErrors({ [data.field]: data.message });
                refs.current[data.field]?.focus();
            } else {
                setFormError(data?.message ?? "That did not go through. Check your connection and try again.");
            }
        } finally {
            setToken("");
            if (widget.current) turnstile()?.reset(widget.current);
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
            {siteKey ? <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setReady(true)} /> : null}
            <div ref={challenge} />
            {!siteKey ? <p role="status">Visit requests are temporarily unavailable.</p> : null}
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
            <Button type="submit" variant="dark" className="hire-go" disabled={state === "sending" || !token}>
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
                                <p role="status">{STORE_AVAILABILITY}</p>
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
