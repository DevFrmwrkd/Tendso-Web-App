import type { StatusWord } from "@/components/r1";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * The Leads map (board LeadsMap) has two layers, one per route:
 *   discover  /leads/discover  "Businesses to visit": prospects nobody has interviewed yet
 *   live      /leads/live      "Live Tendso sites": interviewed businesses whose site is online
 */
export type MapLayer = "discover" | "live";

/** Kilometres, or "all" (the live layer only: every live site, wherever it is). */
export type Radius = number | "all";

type PinBase = {
    /** Stable across renders and data sources; the selection and the React key. */
    key: string;
    lat: number;
    lng: number;
    name: string;
    /** "Restaurant · Jaro": category and area, whatever the row has. */
    meta: string;
    /** From the creator's position; null when location is off. */
    distanceKm: number | null;
    /** The dot inside the pin. Null when this view does not know it (another creator's site). */
    status: StatusWord | null;
};

/** What "I'll interview this" writes to: a legacy scraped lead, or a pool prospect. */
export type ClaimTarget = { kind: "lead"; id: Id<"leads"> } | { kind: "prospect"; id: Id<"prospects"> };

export type ProspectPin = PinBase & {
    layer: "discover";
    rating: number | null;
    reviewCount: number | null;
    address: string | null;
    phone: string | null;
    claimedBy: { displayName: string; isMine: boolean } | null;
    /** Null for a fresh-search row the database has not matched yet: nothing to claim. */
    claim: ClaimTarget | null;
    /** Set only when the pin is a row in `leads` (what /leads?lead= can open). */
    leadId: string | null;
};

export type SitePin = PinBase & {
    layer: "live";
    /** Submitted by the creator looking at the map. */
    mine: boolean;
    submittedBy: string | null;
    address: string | null;
    submissionId: string | null;
    /** The business's row in `leads` (listForMap is a list of leads). */
    leadId: string;
    websiteUrl: string | null;
    /** The creator's own money on this site, from their ledger. Only on their own sites. */
    note: string | null;
};

export type MapPin = ProspectPin | SitePin;
