/**
 * Pure helpers for creator-link attribution. The raw IP never leaves the
 * HTTP action that reads it: only a salted SHA-256 of it is stored.
 */

/** How far back a click from the same network may be offered as "Did <name> send you?". */
export const ATTRIBUTION_SUGGEST_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The same cookie clicking the same link again within this window is one click. */
export const ATTRIBUTION_CLICK_DEDUPE_MS = 30 * 60 * 1000;

export const ATTRIBUTION_COOKIE_MAX = 100;
export const ATTRIBUTION_UA_MAX = 400;

/** The caller's IP from the proxy headers, first hop of x-forwarded-for last. */
export function clientIpFromHeaders(headers: { get(name: string): string | null }): string | null {
    const direct = headers.get('cf-connecting-ip') ?? headers.get('x-real-ip');
    const forwarded = headers.get('x-forwarded-for')?.split(',')[0];
    const ip = (direct ?? forwarded ?? '').trim();
    if (!ip || ip.length > 64 || !/^[0-9a-fA-F:.]+$/.test(ip)) return null;
    return ip.toLowerCase();
}

/** Salted SHA-256 hex. Null without a salt or IP: no salt means no IP matching at all. */
export async function hashIp(ip: string | null, salt: string | undefined): Promise<string | null> {
    if (!ip || !salt) return null;
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`));
    return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function cleanCookieId(value: string | undefined | null): string | undefined {
    const trimmed = (value ?? '').trim();
    if (!trimmed || trimmed.length > ATTRIBUTION_COOKIE_MAX || !/^[A-Za-z0-9_-]+$/.test(trimmed)) return undefined;
    return trimmed;
}

export function cleanUserAgent(value: string | undefined | null): string | undefined {
    const trimmed = (value ?? '').trim();
    return trimmed ? trimmed.slice(0, ATTRIBUTION_UA_MAX) : undefined;
}
