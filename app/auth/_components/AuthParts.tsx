"use client";

import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button, ButtonLink, Dot, Icon, Status, buttonClass, cx, useDelayed } from "@/components/r1";

import type { Strength } from "./authLogic";

/** The error box at the top of a form (board: "That email and password don't match"): a red dot and the problem in words. */
export function AuthAlert({ children }: { children: ReactNode }) {
    return (
        <div role="alert" className="flex items-start gap-2.5 rounded-r1 border border-r1-red-line bg-r1-red-bg px-3 py-2.5 text-[13px] leading-[18px] text-r1-red">
            <Dot tone="bad" className="mt-[5px]" />
            <span className="min-w-0">{children}</span>
        </div>
    );
}

export function OrDivider() {
    return (
        <div className="flex items-center gap-3 text-[13px] leading-[18px] text-r1-ink-3">
            <hr className="t-divider flex-1" />
            <span>or</span>
            <hr className="t-divider flex-1" />
        </div>
    );
}

/** The spinner a busy button shows in place of its icon. Still under reduced motion. */
export function ButtonSpinner() {
    return <Icon icon={Loader2} className="animate-spin motion-reduce:animate-none" />;
}

/** Google's G drawn in the text colour, as on the board: no brand colours on the white ground. */
function GoogleGlyph() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
    );
}

/** The large secondary "Continue with Google" button. While busy the G becomes a spinner and the label stays. */
export function GoogleButton({ onClick, busy, disabled }: { onClick: () => void; busy: boolean; disabled: boolean }) {
    return (
        <Button size="lg" block onClick={onClick} disabled={disabled} aria-busy={busy || undefined}>
            {busy ? <ButtonSpinner /> : <GoogleGlyph />}
            Continue with Google
        </Button>
    );
}

/**
 * How long "Signing you in" waits before it offers a way out. A healthy
 * hand-off takes a second or two; offering the link sooner invites a tap that
 * abandons a sign-in Clerk is still finishing.
 */
const STUCK_AFTER_MS = 8000;

/**
 * The board's "Signing you in" body: a spinner, one line, and after a while
 * "Not moving?" with a way on. The way on is a plain link on purpose: a full
 * page load arrives with the session cookie already set, where a client-side
 * transition can beat Clerk's session to the page and get bounced back to
 * /login (see the note in app/login/page.tsx).
 */
export function SigningIn({ line, escape, cancelHref }: { line: string; escape: { href: string; label: string }; cancelHref?: string }) {
    const stuck = useDelayed(STUCK_AFTER_MS);
    return (
        <div className="flex flex-col items-center gap-4 px-6 py-10 text-center sm:px-8" role="status" aria-live="polite">
            <span className="size-8 animate-spin rounded-full border-2 border-r1-line border-t-r1-ink motion-reduce:animate-none" aria-hidden="true" />
            <p className="t-body">{line}</p>
            {stuck && (
                <a href={escape.href} className={buttonClass()}>
                    {escape.label}
                </a>
            )}
            {cancelHref && (
                <ButtonLink variant="ghost" size="sm" href={cancelHref}>
                    Cancel
                </ButtonLink>
            )}
        </div>
    );
}

/**
 * The password meter (board: four bars, then a status word and a tip). The
 * bars are decoration; the word and the tip are the text a screen reader
 * hears, through the field's aria-describedby.
 */
export function PasswordStrength({ strength }: { strength: Strength }) {
    if (strength.level === 0) return null;
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex gap-1" aria-hidden="true">
                {[1, 2, 3, 4].map((bar) => (
                    <span
                        key={bar}
                        className={cx("h-1 flex-1 rounded-full", bar > strength.level ? "bg-r1-line" : strength.level === 1 ? "bg-r1-red-dot" : "bg-r1-ink")}
                    />
                ))}
            </div>
            <div className="flex items-center justify-between gap-3">
                <Status tone={strength.tone} word={strength.word} />
                <span className="t-help text-right">{strength.tip}</span>
            </div>
        </div>
    );
}
