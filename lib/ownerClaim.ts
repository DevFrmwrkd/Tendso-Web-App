/**
 * Business-owner claim + ownership — pure helpers, no DB/framework deps. Unit-tested.
 *
 * The security model (see docs/changes/OWNER-PORTAL-PRICING-PLAN.md Phase 1):
 *  - A business owner is a separate identity (businessOwners table), not a creator.
 *  - They prove ownership of a website by possessing the email it was sold to
 *    (submissions.ownerEmail) — the same email the payment link goes to. Email is
 *    the identity anchor, never an instruction channel.
 *  - "Edit my website" emails carry a single-use claim token (this module mints +
 *    validates it). First click claims the site; later sign-in is Clerk passwordless.
 *
 * These functions are the load-bearing trust boundary, so they're pure + tested:
 * token format/expiry, and the email-match + ownership checks the server enforces.
 */

const CLAIM_TOKEN_BYTES = 32; // 256-bit, same strength as paymentTokens
export const CLAIM_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Generate a 64-char hex claim token (crypto random). Uses the Web Crypto API,
 *  available in Convex's V8 runtime, browsers, and Node 18+ — no Node-only deps. */
export function generateClaimToken(): string {
    const bytes = new Uint8Array(CLAIM_TOKEN_BYTES);
    (globalThis as { crypto: Crypto }).crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A claim token is well-formed iff it's 64 lowercase hex chars. */
export function isValidClaimTokenFormat(token: string): boolean {
    return typeof token === 'string' && /^[0-9a-f]{64}$/.test(token);
}

/** When a freshly-minted token should expire, given "now". */
export function claimTokenExpiry(nowMs: number): number {
    return nowMs + CLAIM_TOKEN_TTL_MS;
}

export interface ClaimTokenState {
    status: 'pending' | 'consumed' | 'expired' | 'cancelled';
    expiresAt: number;
}

/**
 * Whether a claim token can be redeemed right now. A token is usable only if it's
 * still `pending` AND not past expiry. Centralized so the mutation and any UI agree.
 */
export function isClaimTokenUsable(token: ClaimTokenState, nowMs: number): boolean {
    if (token.status !== 'pending') return false;
    if (nowMs >= token.expiresAt) return false;
    return true;
}

/** Normalize an email for comparison (trim + lowercase). The owner-email match anchor. */
export function normalizeEmail(email: string | undefined | null): string {
    return (email ?? '').trim().toLowerCase();
}

/**
 * The core ownership-trust check at claim time: the signed-in Clerk identity's
 * verified email must match the email the submission was sold to. Without this,
 * anyone with a leaked claim link could attach a site to their own account.
 */
export function emailMatchesSubmission(
    signedInEmail: string | undefined | null,
    submissionOwnerEmail: string | undefined | null,
): boolean {
    const a = normalizeEmail(signedInEmail);
    const b = normalizeEmail(submissionOwnerEmail);
    return a.length > 0 && a === b;
}

export interface OwnershipRow {
    businessOwnerId: string;
    submissionId: string;
}

/**
 * Whether `ownerId` may act on `submissionId`, given their ownership rows.
 * This is the check EVERY owner-facing content mutation must run server-side —
 * the line that stops one owner editing another's site by guessing an ID.
 */
export function ownsSubmission(
    ownerId: string,
    submissionId: string,
    ownerships: OwnershipRow[],
): boolean {
    return ownerships.some(
        (o) => o.businessOwnerId === ownerId && o.submissionId === submissionId,
    );
}
