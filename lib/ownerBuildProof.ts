/**
 * Proof that a page was built by OUR server, for the owner-publish path.
 *
 * An owner signs in with their own Clerk token, so a browser could in principle
 * call the Convex "commit this HTML to my site" action directly with whatever
 * HTML it likes. The site is built by a Next route (Astro needs Node), so that
 * route signs `HMAC-SHA256(secret, submissionId + sha256(html))` after it has
 * built the owner's saved draft, and the Convex action refuses HTML whose
 * signature does not match. The secret is INTERNAL_API_SECRET, which already
 * exists on both sides (Convex actions call the Next internal routes with it).
 *
 * Web Crypto only (no Node imports): it runs in Convex's runtime, Node 20 and
 * the tests alike.
 */

const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(text: string): Promise<string> {
    const subtle = (globalThis as { crypto: Crypto }).crypto.subtle;
    return toHex(await subtle.digest('SHA-256', encoder.encode(text)));
}

export async function signOwnerBuild(secret: string, submissionId: string, html: string): Promise<string> {
    if (!secret) throw new Error('INTERNAL_API_SECRET is not set');
    const subtle = (globalThis as { crypto: Crypto }).crypto.subtle;
    const key = await subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const message = `owner-build\n${submissionId}\n${await sha256Hex(html)}`;
    return toHex(await subtle.sign('HMAC', key, encoder.encode(message)));
}

/** Constant-time compare, so a wrong proof leaks nothing about a right one. */
export async function verifyOwnerBuild(
    secret: string | undefined,
    submissionId: string,
    html: string,
    proof: string,
): Promise<boolean> {
    if (!secret || typeof proof !== 'string' || proof.length !== 64) return false;
    const expected = await signOwnerBuild(secret, submissionId, html);
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ proof.charCodeAt(i);
    return diff === 0;
}
