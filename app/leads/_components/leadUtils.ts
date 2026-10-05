/**
 * Shared, React-free pieces of the Leads screen (board: Leads) and its lead
 * drawer: the URL contract, the data shapes, and the small formatters the list
 * rows and the drawer both use.
 */
import type { FunctionReturnType } from "convex/server";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// ── URL contract ───────────────────────────────────────────────────────────
//
//   /leads                    For you (the default tab)
//   /leads?tab=mine           Claimed by me
//   /leads?tab=all            All shops
//   /leads?tab=interviewed    The team's interviewed leads (the old "All Leads")
//   /leads?tab=prospects      The old Prospects tab. The discover map's back link
//                             and old bookmarks still use it; it opens For you.
//   …&lead=<id>               Opens that lead in the right drawer. This is where
//                             /leads/[leadId] redirects to.
//   …&find=1                  Opens Find a local business. The Leads map's "Find
//                             more businesses" links here.
//
// Every other parameter is kept when one of these changes.

export const TAB_PARAM = "tab";
export const LEAD_PARAM = "lead";
export const FIND_PARAM = "find";

export type LeadsTab = "for-you" | "mine" | "all" | "interviewed";

export function parseTab(raw: string | null): LeadsTab {
    switch (raw) {
        case "mine":
        case "all":
        case "interviewed":
            return raw;
        default:
            return "for-you";
    }
}

/** The tab's value in the URL; For you is the bare /leads. */
export function tabParam(tab: LeadsTab): string | null {
    return tab === "for-you" ? null : tab;
}

// ── Data shapes ────────────────────────────────────────────────────────────

/** One row of api.leads.listForMobileCRM: an interviewed lead in the team feed. */
export type FeedLead = FunctionReturnType<typeof api.leads.listForMobileCRM>["leads"][number];
export type LeadDetail = NonNullable<FunctionReturnType<typeof api.leads.getDetailForMobileCRM>>;
export type ProspectDetail = NonNullable<FunctionReturnType<typeof api.outscraper.getProspect>>;

export type ClaimedBy = {
    creatorId: string;
    displayName: string;
    profileImage: string | null;
    isMine: boolean;
};

/**
 * One row of api.outscraper.listScrapedLeads. That query builds its rows as
 * `any[]`, so this spells out the fields it returns.
 */
export type Prospect = {
    _id: Id<"leads">;
    _creationTime: number;
    status: string;
    phone: string | null;
    businessName: string | null;
    businessAddress: string | null;
    businessCity: string | null;
    businessCategory: string | null;
    businessWebsite: string | null;
    businessLatitude: number | null;
    businessLongitude: number | null;
    businessRating: number | null;
    businessReviewCount: number | null;
    businessGooglePlaceId: string | null;
    scrapedAt: number | null;
    createdAt: number;
    claimedAt: number | null;
    claimedBy: ClaimedBy | null;
};

export const LEAD_STATUSES = ["new", "contacted", "qualified", "converted", "lost"] as const;
export type LeadStatusValue = (typeof LEAD_STATUSES)[number];
export type StatusFilter = "all" | LeadStatusValue;

export function isLeadStatus(s: string): s is LeadStatusValue {
    return (LEAD_STATUSES as readonly string[]).includes(s);
}

// ── Prospect filters and sort ──────────────────────────────────────────────

export type RatingFilter = "any" | "4" | "4.5";
export type DistanceFilter = "any" | "2" | "3" | "5";
export type SortKey = "closest" | "newest" | "rating" | "reviews" | "alpha";

export const RATING_OPTIONS: { value: RatingFilter; label: string }[] = [
    { value: "any", label: "Any rating" },
    { value: "4", label: "4.0 and up" },
    { value: "4.5", label: "4.5 and up" },
];

export const DISTANCE_OPTIONS: { value: DistanceFilter; label: string }[] = [
    { value: "any", label: "Any distance" },
    { value: "2", label: "Under 2 km" },
    { value: "3", label: "Under 3 km" },
    { value: "5", label: "Under 5 km" },
];

export const SORT_LABELS: Record<SortKey, string> = {
    closest: "Closest first",
    newest: "Newest found first",
    rating: "Highest rated first",
    reviews: "Most reviews first",
    alpha: "A to Z",
};

/** The category a prospect is filed under; blank ones share "Uncategorized", as before. */
export function categoryKey(raw: string | null | undefined): string {
    return (raw ?? "Uncategorized").trim() || "Uncategorized";
}

export type ProspectFilterValues = {
    category: string;
    rating: RatingFilter;
    distance: DistanceFilter;
    city: string;
};

/** A prospect with its distance from the creator (null while that is unknown). */
export type ProspectWithKm = { p: Prospect; km: number | null };

/**
 * The prospect filters: category, rating, distance, city, and the search box
 * (name, address, city, phone). Pass distance "any" while the creator's
 * position is unknown; once it is known, a shop with no pin is not "under 2 km".
 */
export function prospectMatches(r: ProspectWithKm, f: ProspectFilterValues, search: string): boolean {
    const { p, km } = r;
    if (f.category !== "all" && categoryKey(p.businessCategory) !== f.category) return false;
    const threshold = f.rating === "any" ? 0 : parseFloat(f.rating);
    if (threshold > 0 && !(typeof p.businessRating === "number" && p.businessRating >= threshold)) return false;
    if (f.distance !== "any" && (km === null || km >= Number(f.distance))) return false;
    const cityQ = f.city.trim().toLowerCase();
    if (cityQ && !(p.businessCity ?? "").toLowerCase().includes(cityQ)) return false;
    const q = search.trim().toLowerCase();
    if (
        q &&
        !(p.businessName ?? "").toLowerCase().includes(q) &&
        !(p.businessAddress ?? "").toLowerCase().includes(q) &&
        !(p.businessCity ?? "").toLowerCase().includes(q) &&
        !(p.phone ?? "").toLowerCase().includes(q)
    ) {
        return false;
    }
    return true;
}

export function sortProspects<T extends ProspectWithKm>(rows: T[], sort: SortKey): T[] {
    return [...rows].sort((a, b) => {
        switch (sort) {
            case "closest":
                // Shops with no pin go last.
                if (a.km === null || b.km === null) return a.km === null ? (b.km === null ? 0 : 1) : -1;
                return a.km - b.km;
            case "rating":
                return (b.p.businessRating ?? 0) - (a.p.businessRating ?? 0);
            case "reviews":
                return (b.p.businessReviewCount ?? 0) - (a.p.businessReviewCount ?? 0);
            case "alpha":
                return (a.p.businessName ?? "").localeCompare(b.p.businessName ?? "");
            case "newest":
            default:
                return (b.p.scrapedAt ?? b.p.createdAt ?? 0) - (a.p.scrapedAt ?? a.p.createdAt ?? 0);
        }
    });
}

// ── Distance ───────────────────────────────────────────────────────────────

export type LatLng = { lat: number; lng: number };

export function haversineKm(a: LatLng, b: LatLng): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Kilometres from the creator to a pin, or null when either end is unknown. */
export function distanceTo(pos: LatLng | null, lat: number | null | undefined, lng: number | null | undefined): number | null {
    if (!pos || lat == null || lng == null) return null;
    return haversineKm(pos, { lat, lng });
}

/** "430 m", "1.2 km", "38 km". */
export function formatKm(km: number): string {
    if (km < 1) return `${Math.max(10, Math.round(km * 100) * 10)} m`;
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km).toLocaleString("en-US")} km`;
}

// ── Time ───────────────────────────────────────────────────────────────────

export function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "just now", "5 minutes ago", "yesterday", "12 days ago", then the date. Empty when unknown. */
export function timeAgo(ts: number | null | undefined): string {
    if (!ts) return "";
    const min = Math.floor((Date.now() - ts) / 60_000);
    if (min < 1) return "just now";
    if (min < 60) return min === 1 ? "1 minute ago" : `${min} minutes ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr === 1 ? "1 hour ago" : `${hr} hours ago`;
    const days = Math.floor(hr / 24);
    if (days === 1) return "yesterday";
    if (days < 30) return `${days} days ago`;
    return formatDate(ts);
}

// ── Claims ─────────────────────────────────────────────────────────────────

/** The claim half of a prospect row's meta line (board: "Nobody has claimed it"). */
export function claimLine(p: Pick<Prospect, "claimedBy" | "claimedAt">): string {
    const when = p.claimedAt ? ` ${timeAgo(p.claimedAt)}` : "";
    if (!p.claimedBy) return "Nobody has claimed it";
    if (p.claimedBy.isMine) return `You claimed it${when}`;
    return `Claimed by ${p.claimedBy.displayName}${when}`;
}

// ── Links ──────────────────────────────────────────────────────────────────

const MAPS_SEARCH = "https://www.google.com/maps/search/?api=1&query=";

/** A prospect in Google Maps: its pin when it has one, else its address (as the old prospect card and detail did). */
export function prospectDirectionsHref(p: {
    businessLatitude: number | null;
    businessLongitude: number | null;
    businessAddress: string | null;
}): string | null {
    if (p.businessLatitude != null && p.businessLongitude != null) {
        return `${MAPS_SEARCH}${p.businessLatitude},${p.businessLongitude}`;
    }
    if (p.businessAddress) return `${MAPS_SEARCH}${encodeURIComponent(p.businessAddress)}`;
    return null;
}

/**
 * Per WEB-PROPECT-POOL.md §"Field-test fixes 2026-06-04" Fix #4: a Google Maps
 * link for a lead from the team feed, so a phoneless and emailless lead (common
 * with scraped informal businesses) still has a way to be found. Its pin and
 * place_id when it has them, else its name and city.
 *
 * Returns null when the lead has neither coords nor a real business name.
 */
export function leadDirectionsHref(lead: {
    businessLatitude: number | null;
    businessLongitude: number | null;
    businessGooglePlaceId: string | null;
    businessName: string;
    businessCity: string | null;
}): string | null {
    if (lead.businessLatitude != null && lead.businessLongitude != null) {
        const placeQuery = lead.businessGooglePlaceId ? `&query_place_id=${encodeURIComponent(lead.businessGooglePlaceId)}` : "";
        return `${MAPS_SEARCH}${lead.businessLatitude},${lead.businessLongitude}${placeQuery}`;
    }
    if (lead.businessName && lead.businessName !== "(business unavailable)") {
        const q = encodeURIComponent(lead.businessCity ? `${lead.businessName} ${lead.businessCity}` : lead.businessName);
        return `${MAPS_SEARCH}${q}`;
    }
    return null;
}

/** An interviewed business in Google Maps, by its address, city and province. */
export function businessDirectionsHref(b: { address?: string | null; city?: string | null; province?: string | null }): string | null {
    if (!b.address) return null;
    return `${MAPS_SEARCH}${encodeURIComponent([b.address, b.city, b.province].filter(Boolean).join(", "))}`;
}

export function telHref(phone: string): string {
    return `tel:${phone.replace(/[^0-9+]/g, "")}`;
}

/**
 * The interview flow, prefilled from a prospect. app/submit/info reads these
 * parameters (see lib/prospectPrefill.ts) and links the new submission back to
 * the prospect, which takes it out of the prospect lists.
 */
export function startInterviewHref(p: {
    _id: string;
    businessName: string | null;
    phone: string | null;
    businessAddress: string | null;
    businessCity: string | null;
    businessCategory: string | null;
}): string {
    return (
        `/submit/info?prospectLeadId=${encodeURIComponent(String(p._id))}` +
        (p.businessName ? `&businessName=${encodeURIComponent(p.businessName)}` : "") +
        (p.phone ? `&phone=${encodeURIComponent(p.phone)}` : "") +
        (p.businessAddress ? `&address=${encodeURIComponent(p.businessAddress)}` : "") +
        (p.businessCity ? `&city=${encodeURIComponent(p.businessCity)}` : "") +
        (p.businessCategory ? `&category=${encodeURIComponent(p.businessCategory)}` : "")
    );
}

// ── Errors ─────────────────────────────────────────────────────────────────

/** A mutation's own message when it has one ("You can only release your own claims"), else the fallback. */
export function errorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
}
