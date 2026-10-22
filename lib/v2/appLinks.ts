/**
 * Where the "Download on the App Store" and "Get it on Google Play" buttons go.
 *
 * The real listings are NOT in the repo: Theo sets them in the admin's "App
 * links" panel (Convex settings keys `play_store_url` and `app_store_url`, edited
 * in app/admin/featured-sites). lib/v2/creatorData.ts (`useStoreLinks`) reads those
 * settings first and falls back to the constants below, so the day a real link is
 * saved the buttons use it without a deploy.
 *
 * Until real listings are configured, the buttons show a coming-soon message.
 */

/** The Android package id from apps/mobile/app.json. */
export const ANDROID_PACKAGE = "com.negosyodigital.app";

export const PLAY_STORE_URL = "";
export const APP_STORE_URL = "";

/** The Convex settings keys the admin panel writes. */
export const PLAY_STORE_SETTING = "play_store_url";
export const APP_STORE_SETTING = "app_store_url";

export interface StoreLinks {
    appStore: string;
    googlePlay: string;
}

export const DEFAULT_STORE_LINKS: StoreLinks = { appStore: APP_STORE_URL, googlePlay: PLAY_STORE_URL };

/** Only https links without credentials are used; anything else falls back to the constant. */
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
