import { ownerReturnPath } from "@/lib/ownerReturnPath";
import { creatorPortalReturnPath } from "@/lib/v2/creatorPortalReturnPath";

export type LoginReturnPath = string;
export const SIGN_IN_CONTINUE_PATH = "/auth/continue";
const BASE = "https://login.tendso.invalid";

/** Keep only known workspace destinations. The verified role decides whether to use them. */
export function loginReturnPath(value: string | string[] | undefined): LoginReturnPath {
    const requested = Array.isArray(value) ? value[0] : value;
    if (!requested || !requested.startsWith("/") || requested.startsWith("//") || /[\s\\\u0000-\u001f\u007f]/.test(requested)) return SIGN_IN_CONTINUE_PATH;
    if (requested === "/knowledge?ws=wiki") return requested;
    try {
        const target = new URL(requested, BASE);
        if (target.origin !== BASE || requested.split(/[?#]/)[0].split("/").some(part => /^\.{1,2}$/.test(decodeURIComponent(part)))) return SIGN_IN_CONTINUE_PATH;
        if (target.hash && !target.pathname.startsWith("/affiliates/dashboard") && !target.pathname.startsWith("/v2/creators/portal")) return SIGN_IN_CONTINUE_PATH;
        if (/^\/admin(?:\/[A-Za-z0-9_-]+)*\/?$/.test(target.pathname)) return target.pathname.replace(/\/$/, "");
        if (/^\/my-business(?:\/|$)/.test(target.pathname) || /^\/(?:v2\/)?pay\/[a-fA-F0-9]{64}$/.test(target.pathname)) {
            return ownerReturnPath(requested).replace(/^\/v2\/pay\//, "/pay/");
        }
        if (/^\/(?:affiliates\/dashboard|v2\/creators\/portal)(?:\/|$)/.test(target.pathname)) return creatorPortalReturnPath(requested);
        if (requested === "/profile") return requested;
    } catch { /* Malformed URLs use the verified account's home. */ }
    return SIGN_IN_CONTINUE_PATH;
}

/** Every sign-in method passes through the same verified account-routing boundary. */
export function loginContinuationHref(value: LoginReturnPath): string {
    const destination = loginReturnPath(value);
    return destination === SIGN_IN_CONTINUE_PATH ? SIGN_IN_CONTINUE_PATH : `${SIGN_IN_CONTINUE_PATH}?returnTo=${encodeURIComponent(destination)}`;
}

export function loginHrefForReturn(value: LoginReturnPath): string {
    const destination = loginReturnPath(value);
    return destination === SIGN_IN_CONTINUE_PATH ? "/login" : `/login?redirect_url=${encodeURIComponent(destination)}`;
}
