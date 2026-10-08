export const POSTER_TARGET_SETTING = "poster_redirect_target";
export const DEFAULT_POSTER_TARGET = "/libre?src=poster";

/** Only web addresses are usable QR destinations. Invalid settings keep the printed QR working. */
export function posterTarget(value: unknown): string {
    if (typeof value !== "string") return DEFAULT_POSTER_TARGET;
    const target = value.trim();
    if (!target || target.includes("\\") || target.startsWith("//")) return DEFAULT_POSTER_TARGET;
    try {
        const url = new URL(target, "https://tendso.com");
        if (url.protocol !== "https:" || url.username || url.password || url.pathname === "/poster" || url.pathname === "/poster/") {
            return DEFAULT_POSTER_TARGET;
        }
        if (target.startsWith("/")) return `${url.pathname}${url.search}${url.hash}`;
        return target.startsWith("https://") ? url.toString() : DEFAULT_POSTER_TARGET;
    } catch {
        return DEFAULT_POSTER_TARGET;
    }
}
