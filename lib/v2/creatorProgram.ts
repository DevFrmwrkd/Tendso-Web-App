/**
 * The creator program's numbers and the maths behind the "Money now vs Monthly
 * money" calculator. Source of truth for the rules: docs/CREATOR-PROGRAM.md
 * (design-mock branch) and the backend's packages/shared/pricing.ts
 * (CREATOR_OVERRIDE_RATE, CREATOR_OVERRIDE_MONTHS, CREATOR_CODE_DEFAULT_PRICE).
 * Copied here as plain numbers because the web pages only ever show them; the
 * server decides what is actually paid.
 */

/** What a shop pays with no code. */
export const LIST_PRICE = 4999;
/** A new creator's code starts at 30% off. */
export const CODE_PERCENT_OFF = 30;
/** ₱4,999 × 0.7. */
export const CODE_PRICE = 3499;
/** What a shop saves with the default code (₱1,500). */
export const CODE_SAVING = LIST_PRICE - CODE_PRICE;
/** The creator keeps half of what the shop pays: ₱3,499 / 2, rounded. */
export const KEEP_PER_SHOP = Math.round(CODE_PRICE / 2);
/** A creator can discount down to this price and still keeps half. */
export const FLOOR_PRICE = 999;

/** The creator's share of each sale by a field agent they recruited. */
export const OVERRIDE_RATE = 0.05;
/** How long it runs, from the agent's join date. */
export const OVERRIDE_MONTHS = 12;
/** The example sale the program page uses everywhere. */
export const EXAMPLE_SALE = 2999;
/** 5% of the example sale: ₱150. */
export const OVERRIDE_PER_SALE = Math.round(EXAMPLE_SALE * OVERRIDE_RATE);

/** What a field agent keeps on the example sale, used on the "Join <name>'s team" page. */
export const AGENT_EXAMPLE = { shopsPerWeek: 5, price: EXAMPLE_SALE, keepPerShop: Math.round(EXAMPLE_SALE / 2) } as const;

export type Busy = "slow" | "steady" | "strong";

/** How busy a recruited field agent is: the share of them that sold this month, and sales each. */
export const BUSY: Record<Busy, { share: number; sales: number; label: string }> = {
    slow: { share: 0.25, sales: 2, label: "Slow" },
    steady: { share: 0.5, sales: 4, label: "Steady" },
    strong: { share: 0.8, sales: 8, label: "Strong" },
};

export const peso = (n: number) => "₱" + Math.round(n).toLocaleString("en-US");

export interface MonthExample {
    /** Recruited agents who sold something this month. */
    active: number;
    /** Sales by those agents. */
    sales: number;
    /** Money now: shops using the code × what the creator keeps. */
    now: number;
    /** Monthly money: sales by the agents × 5% of the example sale. */
    monthly: number;
    total: number;
}

/** One example month. Everything it returns is labelled "Example" where it is shown. */
export function exampleMonth({ shops, agents, busy }: { shops: number; agents: number; busy: Busy }): MonthExample {
    const b = BUSY[busy];
    const active = Math.round(agents * b.share);
    const sales = active * b.sales;
    const now = shops * KEEP_PER_SHOP;
    const monthly = sales * OVERRIDE_PER_SALE;
    return { active, sales, now, monthly, total: now + monthly };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Date parts in Asia/Manila, so server and browser print the same thing. */
function manilaParts(ms: number) {
    const d = new Date(ms + MANILA_OFFSET_MS);
    return { day: d.getUTCDate(), month: d.getUTCMonth(), year: d.getUTCFullYear() };
}

/** "19 Oct". */
export function fmtDay(ms: number): string {
    const p = manilaParts(ms);
    return `${p.day} ${MONTHS[p.month]}`;
}

/** "3 Feb 2027". */
export function fmtDate(ms: number): string {
    const p = manilaParts(ms);
    return `${p.day} ${MONTHS[p.month]} ${p.year}`;
}

/** "October" (the portal's "Here is October so far"). */
export function fmtMonthName(ms: number): string {
    return new Date(ms + MANILA_OFFSET_MS).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
}

export function fmtMonthYear(ms: number): string {
    return `${fmtMonthName(ms)} ${manilaParts(ms).year}`;
}

/** First word of a name, for "Hi, Mika." */
export function firstName(name: string): string {
    return name.trim().split(/\s+/)[0] || name;
}

/** Two letters for an avatar without a photo. */
export function initials(name: string): string {
    return (
        name
            .trim()
            .split(/\s+/)
            .map((w) => w[0] ?? "")
            .join("")
            .slice(0, 2)
            .toUpperCase() || "?"
    );
}

/** A code derived from a page handle: letters and numbers only, upper case. */
export function codeFromHandle(handle: string): string {
    return handle.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/** Page handles typed in the sign-up: lower case letters and numbers only (the mock strips everything else). */
export function cleanHandle(raw: string): string {
    return raw.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
}

/** How many people follow the creator, as the app asks it, mapped to the number the API stores. */
export const AUDIENCE_CHOICES = [
    { label: "Under 1k", value: 500 },
    { label: "1k to 10k", value: 5000 },
    { label: "10k to 100k", value: 50000 },
    { label: "Over 100k", value: 100000 },
] as const;

export const SOCIAL_PLATFORMS = [
    { key: "tiktok", label: "TikTok" },
    { key: "instagram", label: "Instagram" },
    { key: "facebook", label: "Facebook" },
    { key: "youtube", label: "YouTube" },
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]["key"];

/** Where creators' links live. The shop link is /v2/a/<handle>, the agent link /v2/a/<handle>/earn. */
export const SITE_HOST = "tendso.com";
export const shopLinkFor = (handle: string) => `${SITE_HOST}/v2/a/${handle}`;
export const earnLinkFor = (handle: string) => `${SITE_HOST}/v2/a/${handle}/earn`;
