import type { Tone } from "@/components/r1";

/*
 * The pure parts of the sign-in screens (board: SignIn): the checks a form
 * runs before Clerk sees it, the password meter's reading, and how a Clerk
 * error is read. No React here, so they can be tested on their own.
 */

/** The board's email check. An empty string means the address looks fine. */
export function emailProblem(value: string): string {
    const email = value.trim();
    if (!email) return "Enter your email address.";
    const at = email.indexOf("@");
    if (at < 1 || email.indexOf(".", at) < 0) {
        return "That does not look like an email address. Check the @ and the part after it.";
    }
    return "";
}

/**
 * j•••@gmail.com: the domain is enough to recognise the address, and the rest
 * stays off a screen someone else may be looking at.
 */
export function maskEmail(value: string): string {
    const email = value.trim();
    const at = email.indexOf("@");
    if (at < 1) return "your email";
    return `${email.charAt(0)}•••${email.slice(at)}`;
}

export type Strength = { level: 0 | 1 | 2 | 3 | 4; word: string; tip: string; tone?: Tone };

/**
 * The password meter. Same thresholds the reset page has always used: under 8
 * characters is too short; 8 or more is fair, good with mixed case plus a
 * number or a symbol, strong with all three. Level 0 (nothing typed) shows no
 * meter at all.
 */
export function passwordStrength(password: string): Strength {
    if (!password) return { level: 0, word: "", tip: "" };
    if (password.length < 8) return { level: 1, word: "Too short", tip: "Use at least 8 characters", tone: "bad" };
    const mixedCase = /[A-Z]/.test(password) && /[a-z]/.test(password);
    const number = /\d/.test(password);
    const symbol = /[^A-Za-z0-9]/.test(password);
    if (mixedCase && number && symbol) return { level: 4, word: "Strong", tip: "Good to go", tone: "done" };
    if (mixedCase && (number || symbol)) {
        // Name what is missing: the board's one tip ("add a symbol") was wrong
        // for a password that already had a symbol and lacked a number.
        return { level: 3, word: "Good", tip: number ? "Add a symbol to make it strong" : "Add a number to make it strong", tone: "progress" };
    }
    return { level: 2, word: "Fair", tip: "Mix capitals and numbers", tone: "off" };
}

/*
 * Clerk errors. A failed Clerk call throws an object whose `errors` list
 * carries a code, a short and a long message, and (for a form error) the
 * field it is about in meta.paramName. Read structurally rather than with
 * `instanceof`, so a network error or a plain Error falls through to its own
 * message instead of throwing a second time inside the catch.
 */
type ClerkIssue = { code?: string; message?: string; longMessage?: string; meta?: { paramName?: string } };

function firstIssue(err: unknown): ClerkIssue | undefined {
    if (typeof err !== "object" || err === null) return undefined;
    const errors = (err as { errors?: unknown }).errors;
    return Array.isArray(errors) ? (errors[0] as ClerkIssue | undefined) : undefined;
}

/** Clerk's own long message, if it sent one. */
export function clerkLongMessage(err: unknown): string | undefined {
    return firstIssue(err)?.longMessage || undefined;
}

/**
 * What these screens have always shown for a failed call: Clerk's long
 * message, else the error's own message, else the screen's fallback.
 */
export function clerkMessage(err: unknown, fallback: string): string {
    const own = typeof err === "object" && err !== null ? (err as { message?: unknown }).message : undefined;
    return clerkLongMessage(err) || (typeof own === "string" && own) || fallback;
}

/** Clerk's error code, e.g. "form_password_incorrect". */
export function clerkCode(err: unknown): string | undefined {
    return firstIssue(err)?.code;
}

/** The field a Clerk form error is about ("identifier", "code", "password"…), if any. */
export function clerkField(err: unknown): string | undefined {
    return firstIssue(err)?.meta?.paramName;
}
