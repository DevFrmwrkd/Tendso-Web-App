"use client";

import { useAuth, useClerk, useSignIn, useSignUp, useUser } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";

import { clerkCode, clerkMessage, emailProblem } from "@/app/auth/_components/authLogic";
import {
    CREATORS_SAMPLE,
    errorMessage,
    useApplyAsCreator,
    useAvailability,
    useCreatorCodeAvailability,
    useDebounced,
    useMyApplication,
} from "@/lib/v2/creatorData";
import {
    AUDIENCE_CHOICES,
    CODE_PERCENT_OFF,
    KEEP_PER_SHOP,
    OVERRIDE_PER_SALE,
    SOCIAL_PLATFORMS,
    cleanHandle,
    earnLinkFor,
    peso,
    shopLinkFor,
    type SocialPlatform,
} from "@/lib/v2/creatorProgram";
import { CREATOR_CODE_MAX_LENGTH, creatorCodeError, normalizeCreatorCode } from "@/lib/creatorCodes";

import { SoloBar } from "./Chrome";
import { CreatorsBoundary } from "./CreatorsBoundary";
import { BackIcon, ClockIcon } from "./icons";
import { Photo } from "./Photo";

type Step = 1 | 2 | 3 | 4 | 5;
const STEPS = 5;

/** Splits "Mika Santos" into a first name and the rest. */
function splitName(full: string): { firstName: string; lastName?: string } {
    const parts = full.trim().split(/\s+/);
    return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") || undefined };
}

/** The sign-up: one step per screen. Email code through Clerk (no password), then the application. */
export function SignupFlow() {
    const { user } = useUser();
    return (
        <CreatorsBoundary>
            <SignupInner key={user?.id ?? "signed-out"} />
        </CreatorsBoundary>
    );
}

function SignupInner() {
    const router = useRouter();
    const params = useSearchParams();
    const loginOnly = params.get("login") === "1";
    const previewStep = CREATORS_SAMPLE ? Math.min(STEPS, Math.max(1, Number(params.get("step")) || 1)) : 1;

    const { isLoaded: authLoaded, isSignedIn } = useAuth();
    const { isAuthenticated: convexReady } = useConvexAuth();
    const { user } = useUser();
    const { signOut } = useClerk();
    const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();
    const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();
    const application = useMyApplication();
    const apply = useApplyAsCreator();

    const [step, setStep] = useState<Step>(previewStep as Step);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mode = useRef<"signin" | "signup">("signup");
    const headingRef = useRef<HTMLHeadingElement | null>(null);
    const stepped = useRef(false);

    // step 1
    const [name, setName] = useState(CREATORS_SAMPLE && previewStep > 1 ? "Mika Santos" : "");
    const [email, setEmail] = useState(CREATORS_SAMPLE && previewStep > 1 ? "mika.santos@gmail.com" : "");
    // step 2
    const [code, setCode] = useState("");
    const [resent, setResent] = useState(false);
    // step 3
    const [platforms, setPlatforms] = useState<Record<SocialPlatform, boolean>>({ tiktok: CREATORS_SAMPLE, instagram: CREATORS_SAMPLE, facebook: false, youtube: false });
    const [socials, setSocials] = useState<Record<SocialPlatform, string>>({ tiktok: CREATORS_SAMPLE ? "@mikasantos.ph" : "", instagram: CREATORS_SAMPLE ? "@mika.santos" : "", facebook: "", youtube: "" });
    const [audience, setAudience] = useState<number | null>(CREATORS_SAMPLE ? AUDIENCE_CHOICES[1].value : null);
    // step 4
    const [handle, setHandle] = useState(CREATORS_SAMPLE && previewStep > 3 ? "mikasan" : "");
    const [creatorCode, setCreatorCode] = useState(CREATORS_SAMPLE && previewStep > 3 ? "MIKASAN30" : "");
    const debouncedHandle = useDebounced(handle);
    const debouncedCreatorCode = useDebounced(creatorCode);
    const availability = useAvailability(step === 4 && debouncedHandle.length >= 3 && debouncedHandle === handle ? { handle: debouncedHandle } : null);
    const codeCheck = useCreatorCodeAvailability(step === 4 && creatorCode && !creatorCodeError(creatorCode) && debouncedCreatorCode === creatorCode ? creatorCode : null, { signup: true });

    const go = (next: Step) => {
        setError(null);
        stepped.current = true;
        setStep(next);
    };

    // Move the focus to the new step's heading, but not on first paint.
    useEffect(() => {
        if (stepped.current) headingRef.current?.focus({ preventScroll: true });
    }, [step]);

    // Already signed in? Skip the email steps. Already a creator? Go to the portal or the waiting screen.
    useEffect(() => {
        if (CREATORS_SAMPLE || !authLoaded) return;
        if (!isSignedIn || !application) return;
        if (application.status === "active" || application.status === "suspended") {
            router.replace("/v2/creators/portal");
        } else if (application.status === "pending") {
            setStep(5);
        } else if (application.status === "none" && step <= 2) {
            setStep(3);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoaded, isSignedIn, application, router]);

    const signedInEmail = user?.primaryEmailAddress?.emailAddress ?? email;

    // ---- step 1: send the code ----
    async function sendCode(e?: FormEvent) {
        e?.preventDefault();
        if (busy) return;
        const emailIssue = emailProblem(email);
        if (!loginOnly && !name.trim()) return setError("Enter your name.");
        if (emailIssue) return setError(emailIssue);
        if (!signInLoaded || !signUpLoaded || !signIn || !signUp) return setError("One moment, then try again.");
        setBusy(true);
        setError(null);
        try {
            let started = false;
            try {
                // A returning creator signs in; a new one is created below.
                const attempt = await signIn.create({ identifier: email.trim() });
                const factor = attempt.supportedFirstFactors?.find((f) => f.strategy === "email_code");
                if (!factor || !("emailAddressId" in factor)) throw new Error("This account cannot use an email code.");
                await signIn.prepareFirstFactor({ strategy: "email_code", emailAddressId: factor.emailAddressId });
                mode.current = "signin";
                started = true;
            } catch (err) {
                if (clerkCode(err) !== "form_identifier_not_found") throw err;
                if (loginOnly) throw new Error("We could not find that email. Apply as a creator first.");
            }
            if (!started) {
                await signUp.create({ emailAddress: email.trim(), ...splitName(name) });
                await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
                mode.current = "signup";
            }
            setCode("");
            go(2);
        } catch (err) {
            setError(clerkMessage(err, "We could not send the code. Check the email and try again."));
        } finally {
            setBusy(false);
        }
    }

    // ---- step 2: check the code ----
    async function verify(value: string) {
        if (busy || value.length !== 6) return;
        setBusy(true);
        setError(null);
        try {
            if (mode.current === "signin") {
                const res = await signIn?.attemptFirstFactor({ strategy: "email_code", code: value });
                if (res?.status === "complete" && setActiveSignIn) await setActiveSignIn({ session: res.createdSessionId });
                else throw new Error("We could not finish signing you in. Please try again.");
            } else {
                const res = await signUp?.attemptEmailAddressVerification({ code: value });
                if (res?.status === "complete" && setActiveSignUp) await setActiveSignUp({ session: res.createdSessionId });
                else throw new Error("We could not finish creating your login. Please try again.");
            }
            go(3);
        } catch (err) {
            setCode("");
            setError(clerkMessage(err, "That code did not work. Check it and try again."));
        } finally {
            setBusy(false);
        }
    }

    async function resend() {
        setError(null);
        setResent(false);
        try {
            if (mode.current === "signin") {
                const factor = signIn?.supportedFirstFactors?.find((f) => f.strategy === "email_code");
                if (factor && "emailAddressId" in factor) await signIn?.prepareFirstFactor({ strategy: "email_code", emailAddressId: factor.emailAddressId });
            } else {
                await signUp?.prepareEmailAddressVerification({ strategy: "email_code" });
            }
            setResent(true);
        } catch (err) {
            setError(clerkMessage(err, "We could not send a new code. Wait a moment and try again."));
        }
    }

    // ---- step 3/4 checks ----
    const chosen = SOCIAL_PLATFORMS.filter((p) => platforms[p.key]);
    const socialsReady = chosen.length > 0 && chosen.every((p) => socials[p.key].trim().length > 1) && audience !== null;
    const handleOk = handle.length >= 3;
    const checked = debouncedHandle === handle && availability?.handle?.value === handle;
    const handleFree = !!checked && availability?.handle?.available === true;
    const codeProblem = creatorCode ? creatorCodeError(creatorCode) : null;
    const codeChecked = debouncedCreatorCode === creatorCode && codeCheck.status === "checked" && codeCheck.result?.value === creatorCode;
    const codeFree = codeChecked && codeCheck.result?.available === true;
    const free = handleFree && codeFree;
    const handleProblem = !handle
        ? null
        : handle.length < 3
          ? "Use at least 3 letters or numbers."
          : checked && !handleFree
            ? (availability?.handle?.error ?? "That name is taken. Try another.")
            : null;

    async function submit(e: FormEvent) {
        e.preventDefault();
        if (busy || !handleOk || !free || (!CREATORS_SAMPLE && !convexReady)) return;
        setBusy(true);
        setError(null);
        try {
            const { firstName, lastName } = splitName(name || user?.fullName || user?.firstName || "");
            await apply({
                firstName: firstName || "Creator",
                lastName,
                handle,
                code: creatorCode,
                socials: chosen.map((p) => ({ platform: p.key, handle: socials[p.key].trim() })),
                audienceSize: audience ?? undefined,
            });
            go(5);
        } catch (err) {
            setError(errorMessage(err, "We could not send your application. Please try again."));
            codeCheck.retry();
        } finally {
            setBusy(false);
        }
    }

    const canGoBack = step > 1 && step < STEPS && !(step === 3 && (isSignedIn || CREATORS_SAMPLE));

    return (
        <>
            <SoloBar
                right={
                    <>
                        Already a creator?{" "}
                        <Link className="u" href="/v2/creators/signup?login=1">
                            Log in
                        </Link>
                    </>
                }
            />
            <main className="wrap su-wrap">
                <aside className="su-aside" aria-label="What you get">
                    <figure className="su-photo">
                        <Photo name="mika.jpg" alt="Mika Santos, a Tendso creator" sizes="(max-width: 900px) 0px, 40vw" position="50% 22%" priority />
                    </figure>
                    <div className="su-ways">
                        <div className="su-way su-way--now">
                            <span>Money now</span>
                            <b>{peso(KEEP_PER_SHOP)}</b>
                            <small>per shop that uses your code</small>
                        </div>
                        <div className="su-way su-way--monthly">
                            <span>Monthly money</span>
                            <b>{peso(OVERRIDE_PER_SALE)}</b>
                            <small>per sale by your agents, 12 months</small>
                        </div>
                    </div>
                </aside>

                <section className="su-card" aria-live="polite">
                    <div className="su-top">
                        <button type="button" className="su-back" aria-label="Back" disabled={!canGoBack} onClick={() => go(Math.max(1, step - 1) as Step)}>
                            <BackIcon />
                        </button>
                        <span className="su-prog" role="progressbar" aria-label="Sign-up progress" aria-valuemin={0} aria-valuemax={STEPS} aria-valuenow={step}>
                            <i style={{ "--p": `${(step / STEPS) * 100}%` } as CSSProperties} />
                        </span>
                    </div>

                    {error && (
                        <p className="su-error" role="alert">
                            {error}
                        </p>
                    )}

                    {step === 1 && (
                        <form className="su-step is-on" onSubmit={sendCode} noValidate>
                            <h1 className="su-h" ref={headingRef} tabIndex={-1}>
                                {loginOnly ? "Log in." : "Become a Tendso creator."}
                            </h1>
                            <p className="su-p">{loginOnly ? "We email you a code. No password." : "Free to join. No password: we email you a code."}</p>
                            <div className="su-fields">
                                {!loginOnly && (
                                    <label className="su-f">
                                        <span>Your name</span>
                                        <span className="su-in">
                                            <input type="text" value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} />
                                        </span>
                                    </label>
                                )}
                                <label className="su-f">
                                    <span>Email</span>
                                    <span className="su-in">
                                        <input type="email" value={email} autoComplete="email" inputMode="email" onChange={(e) => setEmail(e.target.value)} />
                                    </span>
                                </label>
                            </div>
                            <div className="su-go">
                                <button className="btn btn--accent" type="submit" disabled={busy} aria-busy={busy}>
                                    {busy ? "Sending…" : "Email me a code"}
                                </button>
                            </div>
                        </form>
                    )}

                    {step === 2 && (
                        <form
                            className="su-step is-on"
                            onSubmit={(e) => {
                                e.preventDefault();
                                void verify(code);
                            }}
                        >
                            <h1 className="su-h" ref={headingRef} tabIndex={-1}>
                                Check your email.
                            </h1>
                            <p className="su-p">
                                We sent a 6-digit code to <b>{email}</b>.
                            </p>
                            <div className="su-code6-in">
                                <div className="su-code6" aria-hidden="true">
                                    {Array.from({ length: 6 }, (_, i) => (
                                        <span key={i} className={i === code.length ? "is-cur" : code[i] ? "is-filled" : undefined}>
                                            {code[i] ?? ""}
                                        </span>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    autoFocus
                                    maxLength={6}
                                    pattern="[0-9]*"
                                    value={code}
                                    aria-label="6-digit code"
                                    onChange={(e) => {
                                        const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                                        setCode(v);
                                        if (v.length === 6) void verify(v);
                                    }}
                                />
                            </div>
                            <div className="su-go">
                                <button className="btn btn--accent" type="submit" disabled={busy || code.length !== 6} aria-busy={busy}>
                                    {busy ? "Checking…" : "Continue"}
                                </button>
                                <p className="su-note">
                                    {resent ? "A new code is on its way. " : "No email? "}
                                    <button type="button" className="su-link-btn" onClick={resend}>
                                        Send a new code
                                    </button>
                                </p>
                            </div>
                        </form>
                    )}

                    {step === 3 && (
                        <form
                            className="su-step is-on"
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (socialsReady) go(4);
                            }}
                        >
                            <h1 className="su-h" ref={headingRef} tabIndex={-1}>
                                Where do you post?
                            </h1>
                            <div className="su-plat" role="group" aria-label="Where you post">
                                {SOCIAL_PLATFORMS.map((p) => (
                                    <button
                                        key={p.key}
                                        type="button"
                                        aria-pressed={platforms[p.key]}
                                        className={platforms[p.key] ? "is-on" : undefined}
                                        onClick={() => setPlatforms((s) => ({ ...s, [p.key]: !s[p.key] }))}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                            <div className="su-fields">
                                {chosen.map((p) => (
                                    <label className="su-f" key={p.key}>
                                        <span>{p.label}</span>
                                        <span className="su-in">
                                            <input
                                                type="text"
                                                value={socials[p.key]}
                                                placeholder={p.key === "youtube" ? "Channel name or link" : p.key === "facebook" ? "Page name or link" : "@yourname"}
                                                autoCapitalize="off"
                                                spellCheck={false}
                                                onChange={(e) => setSocials((s) => ({ ...s, [p.key]: e.target.value }))}
                                            />
                                        </span>
                                    </label>
                                ))}
                            </div>
                            <p className="su-sub" id="su-size-l">
                                How many people follow you?
                            </p>
                            <div className="su-sizes" role="radiogroup" aria-labelledby="su-size-l">
                                {AUDIENCE_CHOICES.map((c) => (
                                    <button key={c.label} type="button" role="radio" aria-checked={audience === c.value} className={audience === c.value ? "is-on" : undefined} onClick={() => setAudience(c.value)}>
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                            <div className="su-go">
                                <button className="btn btn--accent" type="submit" disabled={!socialsReady}>
                                    Continue
                                </button>
                            </div>
                        </form>
                    )}

                    {step === 4 && (
                        <form className="su-step is-on" onSubmit={submit} noValidate>
                            <h1 className="su-h" ref={headingRef} tabIndex={-1}>
                                Choose your link and code.
                            </h1>
                            <p className="su-p">Pick a page name and a code people can remember.</p>
                            <label className="su-f">
                                <span>Your name on Tendso</span>
                                <span className="su-in">
                                    <span className="pre">tendso.com/v2/a/</span>
                                    <input
                                        type="text"
                                        value={handle}
                                        disabled={busy}
                                        maxLength={16}
                                        autoCapitalize="off"
                                        autoComplete="off"
                                        spellCheck={false}
                                        placeholder="yourname"
                                        aria-describedby="su-handle-status"
                                        aria-invalid={!!handleProblem}
                                        onChange={(e) => { setHandle(cleanHandle(e.target.value)); setError(null); }}
                                    />
                                    {handleFree && handleOk && (
                                        <span className="ok">
                                            <i aria-hidden="true" />
                                            Free
                                        </span>
                                    )}
                                </span>
                            </label>
                            <p id="su-handle-status" className={`su-hint${handleProblem ? " is-bad" : ""}`} role="status" aria-live="polite">{handleProblem ?? (handle && handleOk && !checked ? "Checking page name…" : handleFree ? "This page name is available." : "")}</p>
                            <label className="su-f">
                                <span>Your creator code</span>
                                <span className="su-in"><input type="text" value={creatorCode} disabled={busy} maxLength={CREATOR_CODE_MAX_LENGTH} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="MIKA30" aria-describedby="su-creator-code-status su-creator-code-help" aria-invalid={!!codeProblem || !!codeChecked && !codeFree} onChange={event => { setCreatorCode(normalizeCreatorCode(event.target.value)); setError(null); }} /></span>
                            </label>
                            <p id="su-creator-code-help" className="su-hint">Use 4–16 letters or numbers. Every code gives {CODE_PERCENT_OFF}% off. Choose carefully. You cannot change this code later.</p>
                            <p id="su-creator-code-status" className={`su-hint${codeProblem || codeChecked && !codeFree || codeCheck.status === "error" ? " is-bad" : ""}`} role="status" aria-live="polite">{codeProblem ?? (codeCheck.status === "error" ? codeCheck.error : codeFree ? "This code is available." : codeChecked ? codeCheck.result?.error ?? "That code is already taken. Choose another one." : creatorCode ? "Checking code availability…" : "")}</p>
                            {codeCheck.status === "error" && !codeProblem ? <button type="button" className="btn btn--line btn--sm" disabled={busy} onClick={codeCheck.retry}>Check again</button> : null}
                            <div className="su-preview">
                                <div>
                                    <span>For shops</span>
                                    <b>{shopLinkFor(handle || "yourname")}</b>
                                </div>
                                <div>
                                    <span>For field agents</span>
                                    <b>{earnLinkFor(handle || "yourname")}</b>
                                </div>
                                <div>
                                    <span>Your code · {CODE_PERCENT_OFF}% off</span>
                                    <b className="code">{creatorCode || "YOURCODE"}</b>
                                </div>
                            </div>
                            <div className="su-go">
                                <button className="btn btn--accent" type="submit" disabled={busy || !handleOk || !free || (!CREATORS_SAMPLE && !convexReady)} aria-busy={busy}>
                                    {busy ? "Sending…" : !CREATORS_SAMPLE && !convexReady ? "Signing you in…" : "Send for review"}
                                </button>
                                <p className="su-note">
                                    By sending, you agree to the <Link href="/v2/terms">creator rules</Link>.
                                </p>
                            </div>
                        </form>
                    )}

                    {step === 5 && (
                        <div className="su-step is-on su-pending-state">
                            <span className="su-pend-ic">
                                <ClockIcon />
                            </span>
                            <h1 className="su-h" ref={headingRef} tabIndex={-1}>
                                We&apos;ll review it.
                            </h1>
                            <p className="su-p">
                                We review your application. This screen updates when you&apos;re approved, and your link and code go live. You can also sign in again later.
                            </p>
                            <ol className="su-time">
                                <TimelineItem state="done" title="Applied" note="Today" />
                                <TimelineItem state="now" title="We check your page" note="A real person looks at it" />
                                <TimelineItem title="Your link goes live" note="Then start sharing" />
                            </ol>
                            <div className="su-go">
                                <Link className="btn btn--line" href="/v2/creators">
                                    Back to Tendso for creators
                                </Link>
                                {isSignedIn && !CREATORS_SAMPLE ? (
                                    <p className="su-note">
                                        <button type="button" className="su-link-btn" onClick={() => signOut({ redirectUrl: "/v2/creators" })}>
                                            Log out
                                        </button>
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    )}

                    {application?.status === "other_account" && step <= 3 && <OtherAccount onSignOut={() => signOut({ redirectUrl: "/v2/creators/signup" })} />}
                </section>
            </main>
            <div className="wrap" style={{ paddingBottom: 40 }} />
        </>
    );
}

function TimelineItem({ state, title, note }: { state?: "done" | "now"; title: string; note: string }) {
    return (
        <li className={state}>
            <i />
            <div>
                <b>{title}</b>
                <span>{note}</span>
            </div>
        </li>
    );
}

function OtherAccount({ onSignOut }: { onSignOut: () => void }): ReactNode {
    return (
        <div className="su-error" role="alert">
            This email already has another kind of Tendso account (a field agent, business or admin). Log out and use a different email to become a creator.{" "}
            <button type="button" className="su-link-btn" onClick={onSignOut}>
                Log out
            </button>
        </div>
    );
}

