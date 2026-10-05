/*
 * The palette's "Recent" group: the last few articles this browser opened.
 * A per-reader convenience, so localStorage is the right place; it may be
 * missing (private windows, blocked site data) and the palette is fine
 * without it. Same key as before the redesign, so nobody's list resets.
 */

const RECENT_KEY = "tendso.kb.recent.v1";

export function getRecent(): string[] {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
        return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    } catch {
        return [];
    }
}

export function pushRecent(slug: string): void {
    try {
        const r = getRecent().filter((x) => x !== slug);
        r.unshift(slug);
        localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 5)));
    } catch {
        /* storage unavailable: no Recent group, nothing else changes */
    }
}
