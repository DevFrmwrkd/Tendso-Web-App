/**
 * AES-256-GCM encryption for secrets at rest (e.g. creators' BYOK Gemini keys).
 *
 * Uses the Web Crypto API (`crypto.subtle`), which is available in Convex's V8
 * runtime, modern browsers, and Node 18+ — so the same code runs in queries,
 * actions, and tests. Async because crypto.subtle is async.
 *
 * Storage format (a single self-describing string, stored in the existing
 * `aiKeys.key` column): `enc:v1:<base64url(iv)>:<base64url(ciphertext+tag)>`
 *
 * The `enc:v1:` prefix lets readers distinguish encrypted values from any
 * legacy plaintext rows written before encryption shipped (isEncrypted()).
 *
 * The encryption key is derived from the KEY_ENCRYPTION_SECRET env var via
 * SHA-256 (→ a 256-bit AES key). Set a long random secret in the Convex
 * dashboard; rotating it makes existing ciphertext undecryptable (by design).
 */

const PREFIX = 'enc:v1:';
const IV_BYTES = 12; // 96-bit IV, standard for GCM

function getSubtle(): SubtleCrypto {
    // globalThis.crypto.subtle exists in Convex V8, browsers, and Node 18+.
    const c = (globalThis as any).crypto;
    if (!c?.subtle) {
        throw new Error('Web Crypto (crypto.subtle) is not available in this runtime.');
    }
    return c.subtle as SubtleCrypto;
}

function getRandomBytes(n: number): Uint8Array<ArrayBuffer> {
    const c = (globalThis as any).crypto;
    if (!c?.getRandomValues) {
        throw new Error('crypto.getRandomValues is not available in this runtime.');
    }
    return c.getRandomValues(new Uint8Array(new ArrayBuffer(n)));
}

// ---- base64url helpers (no Buffer dependency, runtime-agnostic) ----

function toBase64Url(bytes: Uint8Array): string {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const out = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function utf8(s: string): Uint8Array<ArrayBuffer> {
    const bytes = new TextEncoder().encode(s);
    // Copy into a guaranteed plain-ArrayBuffer-backed view for SubtleCrypto's
    // BufferSource typing (TextEncoder's output is typed as ArrayBufferLike).
    const out = new Uint8Array(new ArrayBuffer(bytes.length));
    out.set(bytes);
    return out;
}

/** Derive a 256-bit AES-GCM key from the secret string via SHA-256. */
async function deriveKey(secret: string): Promise<CryptoKey> {
    if (!secret || secret.length < 16) {
        throw new Error('KEY_ENCRYPTION_SECRET must be set and at least 16 characters.');
    }
    const subtle = getSubtle();
    const hash = await subtle.digest('SHA-256', utf8(secret));
    return subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** True if a stored value is in the encrypted format (vs. legacy plaintext). */
export function isEncrypted(stored: string): boolean {
    return typeof stored === 'string' && stored.startsWith(PREFIX);
}

/** Encrypt a plaintext secret. Returns the `enc:v1:iv:ciphertext` string. */
export async function encryptSecret(plaintext: string, secret: string): Promise<string> {
    const key = await deriveKey(secret);
    const iv = getRandomBytes(IV_BYTES);
    const subtle = getSubtle();
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8(plaintext));
    return `${PREFIX}${toBase64Url(iv)}:${toBase64Url(new Uint8Array(ct))}`;
}

/**
 * Decrypt a stored value. If it's legacy plaintext (no enc: prefix) it's
 * returned as-is, so reads keep working during the migration window.
 */
export async function decryptSecret(stored: string, secret: string): Promise<string> {
    if (!isEncrypted(stored)) return stored; // legacy plaintext — pass through
    const body = stored.slice(PREFIX.length);
    const sep = body.indexOf(':');
    if (sep === -1) throw new Error('Malformed encrypted value.');
    const iv = fromBase64Url(body.slice(0, sep));
    const ct = fromBase64Url(body.slice(sep + 1));
    const key = await deriveKey(secret);
    const subtle = getSubtle();
    const pt = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(pt);
}
