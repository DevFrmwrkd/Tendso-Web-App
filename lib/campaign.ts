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

const KEY = "tendso:campaign:v1";

/** How long a scan keeps its discount. Matches what the landing page promises. */
export const CAMPAIGN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type RememberedCampaign = {
    campaign: string;
    /** Which placement sent them: a QR in the video, a poster, a link. */
    source: string | null;
    expiresAt: number;
};

/** Tags are stored and counted, never rendered as markup or trusted as input. */
function cleanSource(value?: string | null): string | null {
    if (!value) return null;
    const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
    return cleaned || null;
}

export function rememberCampaign(campaign: string, source?: string | null): void {
    try {
        const entry: RememberedCampaign = {
            campaign: campaign.trim().toLowerCase(),
            source: cleanSource(source),
            expiresAt: Date.now() + CAMPAIGN_TTL_MS,
        };
        window.localStorage.setItem(KEY, JSON.stringify(entry));
    } catch {
        // Private windows and blocked site data. The link still carries the
        // campaign in its query, and the code on the page is the other way back.
    }
}

/** What we remember, or null once it has expired or was never stored. */
export function readCampaign(): RememberedCampaign | null {
    try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return null;
        const entry = JSON.parse(raw) as Partial<RememberedCampaign>;
        if (typeof entry?.campaign !== "string" || typeof entry?.expiresAt !== "number") return null;
        if (entry.expiresAt < Date.now()) {
            window.localStorage.removeItem(KEY);
            return null;
        }
        return {
            campaign: entry.campaign,
            source: cleanSource(entry.source ?? null),
            expiresAt: entry.expiresAt,
        };
    } catch {
        return null;
    }
}

/**
 * The campaign for this page load: what the URL says, else what we remembered.
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
