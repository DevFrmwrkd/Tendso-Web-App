"use client";

/**
 * ALL data access for the creator pages (/v2/creators, /v2/creators/signup,
 * /v2/creators/portal, /v2/a/<handle>, /v2/a/<handle>/earn). Components import
 * hooks from here and nothing else talks to Convex, so swapping a function name is
 * a one-file change.
 *
 * The backend is docs/v2-api-creators.md (creatorProgram.*, attribution.*,
 * creatorPortal.summary), called through the generated `api`.
 *
 * SAMPLE MODE. In development, with NEXT_PUBLIC_V2_CREATORS_SAMPLE=1 no Convex or Clerk call is made
 * for creator data: the portal is Mika Santos's sample portal, /a/mika resolves, every
 * other handle is "not found". That is for developing and screenshotting these pages
 * before the backend is deployed. It is off by default and never on in production.
 */

import { useAuth } from "@clerk/nextjs";
import { useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/convex/_generated/api";

import { APP_STORE_SETTING, DEFAULT_STORE_LINKS, PLAY_STORE_SETTING, safeStoreUrl, type StoreLinks } from "./appLinks";
import { SAMPLE_CREATOR_CARD, SAMPLE_PICTURES, SAMPLE_PORTAL } from "./creatorSample";
import type { ApplyArgs, Availability, CreatorCard, MyApplication, PortalPictures, PortalSummary } from "./creatorTypes";

export type { ApplyArgs, Availability, CreatorCard, MyApplication, PortalPictures, PortalSummary } from "./creatorTypes";

/** True while developing without the backend. See the header comment. */
export const CREATORS_SAMPLE = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_V2_CREATORS_SAMPLE === "1";

// ---- function references (docs/v2-api-creators.md) ---------------------------------------
const fn = {
    getCreatorByCode: api.creatorProgram.getCreatorByCode,
    myApplication: api.creatorProgram.myApplication,
    checkAvailability: api.creatorProgram.checkAvailability,
    apply: api.creatorProgram.apply,
    recordClick: api.attribution.recordClick,
    portalSummary: api.creatorPortal.summary,
};

/** A sentence to show the person, from a Convex error or any other failure. */
export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
    if (err instanceof ConvexError && typeof err.data === "string") return err.data;
    return fallback;
}

// ---- creator card (/a/<handle>, /a/<handle>/earn) -----------------------------------------
export type CardState = { status: "loading" } | { status: "found"; card: CreatorCard } | { status: "missing" };

/** The public card behind a handle or code. `missing` also covers a pending or suspended creator. */
export function useCreatorCard(handle: string): CardState {
    const live = useQuery(fn.getCreatorByCode, CREATORS_SAMPLE ? "skip" : { code: handle });
    if (CREATORS_SAMPLE) {
        return handle.toLowerCase() === SAMPLE_CREATOR_CARD.handle ? { status: "found", card: SAMPLE_CREATOR_CARD } : { status: "missing" };
    }
    if (live === undefined) return { status: "loading" };
    if (live === null) return { status: "missing" };
    return { status: "found", card: live };
}

// ---- clicks ---------------------------------------------------------------------------------
const COOKIE_NAME = "tendso_cid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

/**
 * A random id kept in a first-party cookie (and localStorage when cookies are blocked), so
 * the same browser reopening the same link is one visit. [A-Za-z0-9_-], at most 100 chars.
 */
export function getCookieId(): string | null {
    if (typeof document === "undefined") return null;
    const read = () => document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1) ?? null;
    let id = read();
    if (!id) {
        try {
            id = window.localStorage.getItem(COOKIE_NAME);
        } catch {
            /* storage is optional */
        }
    }
    if (!id || !/^[A-Za-z0-9_-]{8,100}$/.test(id)) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
    try {
        document.cookie = `${COOKIE_NAME}=${id}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
        window.localStorage.setItem(COOKIE_NAME, id);
    } catch {
        /* the click still counts for this visit */
    }
    return id;
}

/** `https://<name>.convex.cloud` to `https://<name>.convex.site`, where the HTTP actions live. */
function convexSiteUrl(): string | null {
    const explicit = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    if (explicit) return explicit.replace(/\/$/, "");
    const cloud = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (cloud && /\.convex\.cloud\/?$/.test(cloud)) return cloud.replace(/\.convex\.cloud\/?$/, ".convex.site");
    return null;
}

/**
 * Record that this page was opened from a creator's link. Fires once per page load.
 * It POSTs to the HTTP endpoint /attribution/click, which also stores a salted hash of the
 * visitor's IP (what lets iOS match a click to the first app open), and falls back to the
 * attribution.recordClick mutation if that request fails. Never throws, never blocks the page.
 */
export function useRecordClick(handle: string, kind: "shop" | "earn") {
    const convex = useConvex();
    const sent = useRef<string | null>(null);
    useEffect(() => {
        if (CREATORS_SAMPLE) return;
        const key = `${handle}:${kind}`;
        if (sent.current === key) return;
        sent.current = key;
        const cookieId = getCookieId();
        if (!cookieId) return;
        const site = convexSiteUrl();
        const viaMutation = () => convex.mutation(fn.recordClick, { handle, kind, cookieId, userAgent: navigator.userAgent }).catch(() => undefined);
        if (!site) {
            void viaMutation();
            return;
        }
        fetch(`${site}/attribution/click`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ handle, kind, cookieId }),
            keepalive: true,
        })
            .then((res) => (res.ok ? undefined : viaMutation()))
            .catch(viaMutation);
    }, [convex, handle, kind]);
}

// ---- app store links -----------------------------------------------------------------------
/** The two store buttons: admin settings first, then lib/v2/appLinks.ts. */
export function useStoreLinks(): StoreLinks {
    const play = useQuery(api.settings.get, CREATORS_SAMPLE ? "skip" : { key: PLAY_STORE_SETTING }) as string | null | undefined;
    const ios = useQuery(api.settings.get, CREATORS_SAMPLE ? "skip" : { key: APP_STORE_SETTING }) as string | null | undefined;
    return {
        appStore: safeStoreUrl(ios, DEFAULT_STORE_LINKS.appStore),
        googlePlay: safeStoreUrl(play, DEFAULT_STORE_LINKS.googlePlay),
    };
}

// ---- sign-up -------------------------------------------------------------------------------
/** Where the signed-in person stands as a creator. `undefined` while loading. */
export function useMyApplication(): MyApplication | undefined {
    const { isLoading, isAuthenticated } = useConvexAuth();
    const live = useQuery(fn.myApplication, CREATORS_SAMPLE || isLoading ? "skip" : {});
    if (CREATORS_SAMPLE) return { status: "signed_out" };
    if (isLoading) return undefined;
    if (!isAuthenticated) return { status: "signed_out" };
    return live;
}

/** Live check of a page handle and its code while the person types. Pass null to skip. */
export function useAvailability(input: { handle: string; code: string } | null): Availability | undefined {
    const live = useQuery(fn.checkAvailability, CREATORS_SAMPLE || !input ? "skip" : { handle: input.handle, code: input.code });
    if (CREATORS_SAMPLE && input) {
        // Sample mode: only the sample creator's own name is taken.
        const taken = input.handle === "mika";
        const err = "That page handle is already taken. Choose another one.";
        return {
            handle: { value: input.handle, available: !taken, error: taken ? err : null },
            code: { value: input.code, available: !taken, error: taken ? "That code is already taken. Choose another one." : null },
        };
    }
    return live;
}

/** Send the application. Throws a ConvexError with a sentence to show. */
export function useApplyAsCreator(): (args: ApplyArgs) => Promise<void> {
    const apply = useMutation(fn.apply);
    return useCallback(
        async (args: ApplyArgs) => {
            if (CREATORS_SAMPLE) return;
            await apply(args);
        },
        [apply],
    );
}

// ---- portal --------------------------------------------------------------------------------
export type PortalState =
    | { status: "loading" }
    | { status: "signed_out" }
    | { status: "none" }
    | { status: "other_account" }
    | { status: "pending"; handle: string | null; code: string | null }
    | { status: "ready"; data: PortalSummary; pictures?: PortalPictures };

/** The signed-in creator's portal. The summary is only asked for once the account is active. */
export function usePortal(): PortalState {
    const { isLoaded: clerkLoaded } = useAuth();
    const { isLoading, isAuthenticated } = useConvexAuth();
    const application = useMyApplication();
    const ready = application?.status === "active" || application?.status === "suspended";
    const summary = useQuery(fn.portalSummary, CREATORS_SAMPLE || !ready ? "skip" : {});

    if (CREATORS_SAMPLE) return { status: "ready", data: SAMPLE_PORTAL, pictures: SAMPLE_PICTURES };
    if (!clerkLoaded || isLoading) return { status: "loading" };
    if (!isAuthenticated) return { status: "signed_out" };
    if (!application) return { status: "loading" };
    switch (application.status) {
        case "signed_out":
            return { status: "signed_out" };
        case "none":
            return { status: "none" };
        case "other_account":
            return { status: "other_account" };
        case "pending":
            return { status: "pending", handle: application.handle, code: application.code };
        default:
            return summary === undefined ? { status: "loading" } : { status: "ready", data: summary };
    }
}

/** Small helper for the screens that wait a moment before showing a result. */
export function useDebounced<T>(value: T, ms = 350): T {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
}
