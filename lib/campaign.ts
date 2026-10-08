/**
 * Remembering which campaign sent somebody, between the landing page and the
 * form they fill in later.
 *
 * WHY IT IS REMEMBERED AT ALL. The OTR viewer scans a code, reads the offer, and
 * very often comes back later to actually do it — on the same phone, from their
 * history or by typing the address. The discount has to survive that, or the
 * page promised something the form then refuses.
 *
 * NOTHING HERE DECIDES A PRICE. This is a hint the browser carries; the server
 * resolves it against the campaigns we actually run and works out the amount
 * itself. See convex/ownerIntake.ts. Storing a price here would let anyone edit
 * one in their own browser.
 */

import { normalizeCampaign } from "./pricing";

const KEY = "tendso:campaign:v1";
const AFFILIATE_KEY = "tendso:affiliate:v1";
const GIVEAWAY_KEY = "tendso:giveaway:v1";
const FULL_PRICE_KEY = "tendso:start:full-price:v1";

/** How long a scan keeps its discount. Matches what the landing page promises. */
export const CAMPAIGN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type RememberedCampaign = {
    campaign: string;
    /** Which placement sent them: a QR in the video, a poster, a link. */
    source: string | null;
    expiresAt: number;
};

export type RememberedAffiliate = { handle: string; expiresAt: number };

function clearFullPrice(): void {
    try { window.sessionStorage?.removeItem(FULL_PRICE_KEY); } catch { /* optional storage */ }
}

/** Tags are stored and counted, never rendered as markup or trusted as input. */
function cleanSource(value?: string | null): string | null {
    if (!value) return null;
    const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
    return cleaned || null;
}

export function rememberCampaign(campaign: string, source?: string | null): void {
    const resolved = normalizeCampaign(campaign);
    if (resolved) clearFullPrice();
    try {
        window.localStorage.removeItem(AFFILIATE_KEY);
        // The giveaway is an application, never a remembered discount. Clear
        // any earlier offer when a caller supplies an unsupported campaign.
        if (!resolved) {
            window.localStorage.removeItem(KEY);
            return;
        }
        const entry: RememberedCampaign = {
            campaign: resolved,
            source: cleanSource(source),
            expiresAt: Date.now() + CAMPAIGN_TTL_MS,
        };
        window.localStorage.removeItem(GIVEAWAY_KEY);
        window.localStorage.setItem(KEY, JSON.stringify(entry));
    } catch {
        // Private windows and blocked site data. The link still carries the
        // campaign in its query, and the code on the page is the other way back.
    }
}

/** A fresh affiliate entrance replaces older offers before lookup. An unknown
 *  or suspended handle still means full price, rather than reviving old OTR. */
export function rememberAffiliate(handle: string): void {
    clearFullPrice();
    try {
        window.localStorage.removeItem(KEY);
        window.localStorage.removeItem(GIVEAWAY_KEY);
        window.localStorage.setItem(AFFILIATE_KEY, JSON.stringify({
            handle, expiresAt: Date.now() + CAMPAIGN_TTL_MS,
        }));
    } catch {
        // The explicit affiliate query keeps this visit working without storage.
    }
}

export function readAffiliate(): RememberedAffiliate | null {
    try {
        const raw = window.localStorage.getItem(AFFILIATE_KEY);
        if (!raw) return null;
        const entry = JSON.parse(raw) as Partial<RememberedAffiliate>;
        if (typeof entry?.handle !== "string" || typeof entry.expiresAt !== "number"
            || !Number.isFinite(entry.expiresAt) || entry.expiresAt <= Date.now()) {
            window.localStorage.removeItem(AFFILIATE_KEY);
            return null;
        }
        return { handle: entry.handle, expiresAt: entry.expiresAt };
    } catch {
        return null;
    }
}

function affiliateFromLocation(): string | null {
    try { return new URLSearchParams(window.location.search).get("affiliate"); }
    catch { return null; }
}

/** What we remember, or null once it has expired or was never stored. */
export function readCampaign(): RememberedCampaign | null {
    try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return null;
        const entry = JSON.parse(raw) as Partial<RememberedCampaign>;
        if (typeof entry?.campaign !== "string" || typeof entry?.expiresAt !== "number") return null;
        const campaign = normalizeCampaign(entry.campaign);
        if (!campaign || !Number.isFinite(entry.expiresAt) || entry.expiresAt <= Date.now()) {
            window.localStorage.removeItem(KEY);
            return null;
        }
        return {
            campaign,
            source: cleanSource(entry.source ?? null),
            expiresAt: entry.expiresAt,
        };
    } catch {
        return null;
    }
}

/**
 * The campaign hint in the URL for this page load.
 *
 * The URL wins so a fresh scan of a different placement re-stamps the source,
 * and reading it here rather than through useSearchParams keeps the page out of
 * a Suspense boundary it would otherwise need.
 */
export function campaignFromLocation(): { campaign: string | null; source: string | null } {
    try {
        const params = new URLSearchParams(window.location.search);
        return {
            campaign: params.get("campaign") ?? params.get("code"),
            source: cleanSource(params.get("src")),
        };
    } catch {
        return { campaign: null, source: null };
    }
}

/** Resolve only discount campaigns. An explicit URL replaces older memory,
 *  including giveaway links, which must always leave the ordinary quote intact. */
export function discountCampaignForPage(): { campaign: string | null; source: string | null } {
    const fromUrl = campaignFromLocation();
    if (fromUrl.campaign !== null) {
        rememberCampaign(fromUrl.campaign, fromUrl.source);
        return { campaign: normalizeCampaign(fromUrl.campaign), source: fromUrl.source };
    }
    const remembered = readCampaign();
    return {
        campaign: remembered?.campaign ?? null,
        source: fromUrl.source ?? remembered?.source ?? null,
    };
}

/** An application hint kept separately from discounts. Availability is checked by /start. */
export function rememberGiveaway(source?: string | null): void {
    clearFullPrice();
    try {
        window.localStorage.removeItem(KEY);
        window.localStorage.removeItem(AFFILIATE_KEY);
        window.localStorage.setItem(GIVEAWAY_KEY, JSON.stringify({
            source: cleanSource(source), expiresAt: Date.now() + CAMPAIGN_TTL_MS,
        }));
    } catch {
        // The application link still carries the mode and source.
    }
}

function readGiveaway(): { source: string | null } | null {
    try {
        const raw = window.localStorage.getItem(GIVEAWAY_KEY);
        if (!raw) return null;
        const entry = JSON.parse(raw) as { source?: unknown; expiresAt?: unknown };
        if (typeof entry.expiresAt !== "number" || !Number.isFinite(entry.expiresAt) || entry.expiresAt <= Date.now()) {
            window.localStorage.removeItem(GIVEAWAY_KEY);
            return null;
        }
        return { source: cleanSource(typeof entry.source === "string" ? entry.source : null) };
    } catch {
        return null;
    }
}

export function clearCampaign(): void {
    try {
        window.localStorage.removeItem(KEY);
        window.localStorage.removeItem(GIVEAWAY_KEY);
        window.localStorage.removeItem(AFFILIATE_KEY);
    } catch {
        // Storage can be disabled; ordinary intake still defaults to full price.
    }
}

/** Explicitly choosing the paid CTA also overrides a saved giveaway draft. */
export function requestFullPriceIntake(): void {
    clearCampaign();
    try {
        window.sessionStorage.setItem(FULL_PRICE_KEY, "1");
    } catch {
        // If storage is unavailable there is no stored giveaway draft to override.
    }
}

export type IntakeCampaign = {
    giveaway: boolean;
    campaign: string | null;
    source: string | null;
    fullPrice?: boolean;
    /** Kept even when the public offer is unavailable; the server decides it. */
    affiliateHandle?: string;
};

export function intakeCampaignForPage(): IntakeCampaign {
    const fromUrl = campaignFromLocation();
    // An explicit application remains separate from paid-sale attribution.
    if (fromUrl.campaign?.trim().toLowerCase() === "giveaway") {
        rememberGiveaway(fromUrl.source);
        return { giveaway: true, campaign: null, source: fromUrl.source };
    }
    const handle = affiliateFromLocation();
    if (handle !== null) {
        rememberAffiliate(handle);
        return { giveaway: false, campaign: null, source: fromUrl.source, affiliateHandle: handle };
    }
    if (fromUrl.campaign !== null) {
        clearFullPrice();
        const campaign = normalizeCampaign(fromUrl.campaign);
        clearCampaign();
        if (campaign) rememberCampaign(campaign, fromUrl.source);
        return { giveaway: false, campaign, source: fromUrl.source };
    }
    try {
        if (window.sessionStorage?.getItem(FULL_PRICE_KEY) === "1") {
            return { giveaway: false, campaign: null, source: null, fullPrice: true };
        }
    } catch { /* optional storage */ }
    const giveaway = readGiveaway();
    if (giveaway) return { giveaway: true, campaign: null, source: fromUrl.source ?? giveaway.source };
    const affiliate = readAffiliate();
    if (affiliate) return { giveaway: false, campaign: null, source: fromUrl.source, affiliateHandle: affiliate.handle };
    const discount = discountCampaignForPage();
    return { giveaway: false, ...discount };
}
