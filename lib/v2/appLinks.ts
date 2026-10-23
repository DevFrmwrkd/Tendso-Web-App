/**
 * Where every "App Store" / "Google Play" button on the web goes. ONE helper for
 * all /v2 pages (landing, business/examples/field-agents, /v2/start, creators).
 *
 * Order: the admin's "App links" panel first (Convex settings `app_store_url` /
 * `play_store_url`, edited in app/admin/featured-sites), then the deploy env
 * (NEXT_PUBLIC_APP_STORE_URL / NEXT_PUBLIC_GOOGLE_PLAY_URL), then Tendso's
 * released listings. Read them with `useStoreLinks()` (./useStoreLinks).
 */

/** The Android package id from apps/mobile/app.json. */
export const ANDROID_PACKAGE = "com.negosyodigital.app";

/** The Convex settings keys the admin panel writes. */
export const PLAY_STORE_SETTING = "play_store_url";
export const APP_STORE_SETTING = "app_store_url";

export interface StoreLinks {
    /** An empty value means the link is unavailable. */
    appStore: string;
    googlePlay: string;
}

/** Only https links without credentials are used; anything else falls back. */
export function safeStoreUrl(value: unknown, fallback: string): string {
    if (typeof value !== "string" || !value) return fallback;
    try {
        const url = new URL(value);
        if (url.protocol === "https:" && !url.username && !url.password) return url.toString();
    } catch {
        /* a bad setting uses the default */
    }
    return fallback;
}

/** Existing released listings, also configured in the production App links settings. */
export const RELEASED_STORE_LINKS: StoreLinks = {
    appStore: "https://apps.apple.com/ph/app/tendso/id6786666106",
    googlePlay: `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
};

/** Env overrides are inlined at build time; loading/missing settings still get working links. */
export const DEFAULT_STORE_LINKS: StoreLinks = {
    appStore: safeStoreUrl(process.env.NEXT_PUBLIC_APP_STORE_URL, RELEASED_STORE_LINKS.appStore),
    googlePlay: safeStoreUrl(process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL, RELEASED_STORE_LINKS.googlePlay),
};

export const hasAnyStoreLink = (links: StoreLinks) => Boolean(links.appStore || links.googlePlay);
