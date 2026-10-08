export type CreatorPlatform = "android" | "ios" | "other";

/** Matches /otr, including iPadOS's desktop-style user agent. */
export function creatorPlatform(userAgent: string, touchMac = false): CreatorPlatform {
    if (/android/i.test(userAgent)) return "android";
    if (/iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && touchMac)) return "ios";
    return "other";
}

export function affiliateBuyHref(handle: string): string {
    // Keep unavailable handles too: the server must replace older discounts.
    return `/start?affiliate=${encodeURIComponent(handle)}`;
}

function safeStoreUrl(value?: string | null): string | null {
    if (!value) return null;
    try {
        const url = new URL(value);
        if (url.protocol === "https:" && !url.username && !url.password) return url.toString();
    } catch { /* A missing or invalid setting uses the existing app explainer. */ }
    return null;
}

/** Same settings and phone destinations as /otr; both stores on desktop. */
export function creatorStoreButtons(platform: CreatorPlatform, playUrl?: string | null, iosUrl?: string | null): { href: string; label: string }[] {
    const play = safeStoreUrl(playUrl);
    const ios = safeStoreUrl(iosUrl);
    if (platform === "android" && play) return [{ href: play, label: "Get it on Google Play" }];
    if (platform === "ios" && ios) return [{ href: ios, label: "Download on the App Store" }];
    if (platform === "other") {
        const stores = [
            ...(ios ? [{ href: ios, label: "Download on the App Store" }] : []),
            ...(play ? [{ href: play, label: "Get it on Google Play" }] : []),
        ];
        if (stores.length) return stores;
    }
    return [{ href: "/for-creators#app", label: "Get the Tendso app" }];
}
