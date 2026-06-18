/**
 * ════════════════════════════════════════════════════════════════════════════
 *  LANDING PAGE — SINGLE SOURCE OF TRUTH FOR HARDCODED CONTENT
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  THE ONE FILE — add a website here and it shows everywhere it should.
 *
 *  ┌──────────────────────────────────────────────────────────────────────────┐
 *  │  SECTION                          │  EDIT WHICH EXPORT                  │
 *  │──────────────────────────────────│─────────────────────────────────────│
 *  │  Live map pins                    │  SHOWCASE_SITES (every entry)       │
 *  │  Featured-work carousel + filter  │  SHOWCASE_SITES (entries w/ src+url)│
 *  │  Hero "live sites" counter        │  derived from SHOWCASE_SITES        │
 *  │  Creator carousel (auto-scroll)   │  FALLBACK_CREATORS                  │
 *  │  Business pricing tiers           │  BUSINESS_TIERS                     │
 *  │  Creator earning rates            │  CREATOR_EARNINGS                   │
 *  │  FAQ — for-creators tab           │  FAQ_CREATOR                        │
 *  │  FAQ — for-business tab           │  FAQ_BUSINESS                       │
 *  │  Knowledge-base entries           │  KNOWLEDGE_BASE                     │
 *  │  Testimonials                     │  TESTIMONIALS                       │
 *  │  Map region presets               │  REGIONS                            │
 *  │  City-name → coords fallback      │  CITY_CENTROIDS                     │
 *  │  Counter seed values              │  COUNTERS_GROWTH                    │
 *  └──────────────────────────────────────────────────────────────────────────┘
 *
 *  Pricing values mirror the canonical model in lib/pricing.ts (imported below):
 *    - Business website: ₱999 (Standard) / ₱1,499 (With Custom Domain)
 *    - Creator earnings: 50% of every sale — ₱500 at the ₱999 base price,
 *      up to ₱2,500 as higher pricing unlocks · ₱1,000 referral bonus
 *
 *  ADD A NEW LIVE WEBSITE = paste one object into SHOWCASE_SITES below.
 *    - Required: slug, name, tag, category, lat, lng, city
 *    - Optional: src (thumbnail path), url (live URL), address
 *    - Map pin appears automatically.
 *    - Carousel card appears only if BOTH src + url are set.
 *    - Filter pill auto-appears if `tag` is new.
 *    - Counter increments only when src+url are present (live sites only).
 *    - Drop the screenshot at /public/Pages/<slug>.png.
 */

import { BASE_PRICE, CUSTOM_DOMAIN_PRICE, REFERRAL_BONUS, commissionFor } from "@/lib/pricing";

export type Creator = {
    id: string;
    name: string;
    city: string;
    lat: number;
    lng: number;
    sites: number;
    langs: string[];
    hue: number;
    response: string;
    samples: string[];
};

export type LiveBusiness = {
    id: string;
    name: string;
    category: string;
    city: string;
    creator?: string;
    lat: number;
    lng: number;
    builtOn?: string;
    liveUrl: string;
    /** Optional screenshot path (e.g. /Pages/<slug>.png) shown in the
     *  detail sheet when a map pin is clicked. */
    src?: string;
};

export type Region = {
    id: string;
    label: string;
    center: [number, number];
    zoom: number;
};

export type Testimonial = {
    name: string;
    city: string;
    claim: string;
    initial: string;
    hue: number;
};

export type FaqEntry = { q: string; a: string };

export type KnowledgeEntry = {
    id: string;
    category: string;
    title: string;
    read: string;
    excerpt: string;
};

// ── Pricing — preserved from existing landing ──────────────────────────────
export const BUSINESS_TIERS = [
    {
        slug: "standard",
        name: "Standard",
        price: BASE_PRICE,
        tagline: "A page built around the work, not the other way around.",
        ctaLabel: "Get Started",
        ctaHref: "/login",
        featured: false,
        features: [
            "Real coded website — not a template you have to fill in",
            "Free subdomain: yourbusiness.tendso.ph",
            "Built from your photos, your words, your business",
            "Mobile-first — your customers find you on their phones",
            "Live in 48 hours, hosted with SSL",
            "Free edits within 7 days of launch",
        ],
    },
    {
        slug: "custom-domain",
        name: "With Custom Domain",
        price: CUSTOM_DOMAIN_PRICE,
        tagline: "Your own .com — fully owned, never tied to us.",
        ctaLabel: "Get a Custom Domain",
        ctaHref: "/login",
        featured: true,
        features: [
            "Everything in Standard",
            "Custom domain (.com / .net / .shop / .store / others)",
            "Year 1 of the domain included free",
            "You own the domain — we never auto-renew",
            "30-day reminder before renewal",
            "Same 48-hour deployment",
        ],
    },
] as const;

export const CREATOR_EARNINGS = [
    {
        slug: "per-submission",
        title: "Per Submission",
        amount: commissionFor(BASE_PRICE),
        desc: "Earn 50% of every website you sell, paid straight to your Wise wallet — ₱500 at the starter price, up to ₱2,500 as you unlock higher pricing. Video or audio capture, same rate.",
        featured: false,
    },
    {
        slug: "referral",
        title: "Referral Bonus",
        amount: REFERRAL_BONUS,
        desc: "Invite another creator. When they complete their first paid submission, you get the bonus.",
        featured: true,
    },
] as const;

// ── Hardcoded map fallback (used when Convex listPublished is empty) ───────
// 4 real client addresses — coords are approximate (geocoded from address text).
// Replace with precise lat/lng once submissions store precise coordinates.
export const FALLBACK_SITES: LiveBusiness[] = [
    {
        id: "addr-bangkal-pasay",
        name: "1747-E Evangelista, Bangkal",
        category: "Retail",
        city: "Pasay",
        lat: 14.5414,
        lng: 121.0067,
        liveUrl: "#",
    },
    {
        id: "addr-meycauayan-mafe",
        name: "Ma. Fe Bldg, El Camino Rd, Sto. Niño",
        category: "Retail",
        city: "Meycauayan, Bulacan",
        lat: 14.7297,
        lng: 120.9647,
        liveUrl: "#",
    },
    {
        id: "addr-meycauayan-ema",
        name: "Block 82 Lot 5, Camalig Ema Town Center",
        category: "Retail",
        city: "Meycauayan, Bulacan",
        lat: 14.7350,
        lng: 120.9620,
        liveUrl: "#",
    },
    {
        id: "addr-marilao-heritage",
        name: "Heritage Homes",
        category: "Retail",
        city: "Marilao, Bulacan",
        lat: 14.7625,
        lng: 120.9523,
        liveUrl: "#",
    },
];

// ════════════════════════════════════════════════════════════════════════════
//  SHOWCASE_SITES — THE master list of everything we display.
// ════════════════════════════════════════════════════════════════════════════
//
// Drop ONE entry here and it appears in:
//   • The live map (a pin at lat/lng)
//   • The carousel under "Businesses we've built" (only if src+url are present)
//   • The filter pills (auto-derived from `tag`)
//   • The hero + directory "live sites" counter
//
// Fields:
//   slug       — unique kebab-case id (used as React key, never shown)
//   name       — display name on card + map tooltip
//   tag        — short filter pill label ("Auto", "Salon", "Retail", etc.)
//   category   — long subtitle shown under the name on cards
//   lat, lng   — map coordinates (required — every entry pins on the map)
//   city       — city label (also seeds map tooltips)
//   address    — optional street address (shown on detail sheets later)
//   src        — optional thumbnail at /public/Pages/<slug>.png
//                (entries without src render as map-only pins, skipped in carousel)
//   url        — optional live URL the card opens (also skipped from carousel
//                if missing)
//
// To add a new live site: paste a new object below with at minimum
//   slug + name + tag + category + lat + lng + city.
// Add `src` + `url` if you have a live website to link to.
export type ShowcaseSite = {
    slug: string;
    name: string;
    tag: string;
    category: string;
    lat: number;
    lng: number;
    city: string;
    address?: string;
    src?: string;
    url?: string;
};

export const SHOWCASE_SITES: ShowcaseSite[] = [
    // ── Live sites with screenshots (carousel + map) ───────────────────────
    {
        slug: "ben-joe",
        name: "Ben Joe Tire Supply",
        tag: "Auto",
        category: "Auto · Tire Supply",
        lat: 14.676,
        lng: 121.0437,
        city: "Quezon City",
        src: "/Pages/ben-joe.png",
        url: "https://benjoetiresupply.com/",
    },
    {
        slug: "aloja",
        name: "Aloja Carvajal",
        tag: "Beauty",
        category: "Beauty Studio",
        lat: 10.3157,
        lng: 123.8854,
        city: "Cebu City",
        src: "/Pages/aloja2.png",
        url: "https://aloja-carvajal-aesthetic-and-beauty-studio.frmwrkd-media.workers.dev/",
    },
    {
        slug: "hapag",
        name: "Hapag",
        tag: "Restaurant",
        category: "Restaurant",
        lat: 14.5547,
        lng: 121.0244,
        city: "Makati",
        src: "/Pages/hapag.png",
        url: "https://hapag.pages.dev/",
    },
    {
        slug: "beauty-me",
        name: "Beauty Me",
        tag: "Salon",
        category: "Salon · Massage · Spa",
        lat: 14.5995,
        lng: 120.9842,
        city: "Manila",
        src: "/Pages/beauty-me.png",
        url: "https://beauty-me-salon-massage-spa.frmwrkd-media.workers.dev/",
    },
];

// Carousel = only sites with a screenshot + live URL. Map = everything above.
export const CAROUSEL_SITES: ShowcaseSite[] = SHOWCASE_SITES.filter(
    (s) => !!s.src && !!s.url,
);

// "Live sites" counter — counts entries that have a real published URL.
export const HARDCODED_LIVE_SITE_COUNT = CAROUSEL_SITES.length;

// Unique filter-pill labels derived from CAROUSEL_SITES (the ones in the rail).
export const SHOWCASE_TAGS: readonly string[] = [
    "All",
    ...Array.from(new Set(CAROUSEL_SITES.map((s) => s.tag))),
];

// ── Fallback creators (display roster on map until backend exposes a query) ─
export const FALLBACK_CREATORS: Creator[] = [
    { id: "c-mark", name: "Mark", city: "Cebu City", lat: 10.3157, lng: 123.8854, sites: 12, langs: ["EN", "TL", "CEB"], hue: 35, response: "Replies in 2h", samples: ["Sari-sari Marivic", "Barangay Tindahan", "Café Maya"] },
    { id: "c-janelle", name: "Janelle", city: "Cebu City", lat: 10.327, lng: 123.9015, sites: 12, langs: ["EN", "TL", "CEB"], hue: 18, response: "Replies in 1h", samples: ["Janet's Salon", "La Cocina Cebu", "Bukid Coffee"] },
    { id: "c-pao", name: "Paolo", city: "Quezon City", lat: 14.676, lng: 121.0437, sites: 9, langs: ["EN", "TL"], hue: 50, response: "Replies in 4h", samples: ["Tatay's Lechon", "K-9 Grooming", "Pao Optical"] },
    { id: "c-aira", name: "Aira", city: "Makati", lat: 14.5547, lng: 121.0244, sites: 18, langs: ["EN", "TL"], hue: 5, response: "Replies in 30m", samples: ["Manila Made", "Studio Aira", "Frame & Foil"] },
    { id: "c-rodel", name: "Rodel", city: "Davao City", lat: 7.1907, lng: 125.4553, sites: 7, langs: ["EN", "TL", "CEB"], hue: 65, response: "Replies in 3h", samples: ["Davao Durian Co", "R&K Auto", "Bahay Bukid"] },
    { id: "c-leah", name: "Leah", city: "Iloilo City", lat: 10.7202, lng: 122.5621, sites: 14, langs: ["EN", "TL", "HIL"], hue: 28, response: "Replies in 1h", samples: ["Tita Lou's Bakery", "Iloilo Tours", "La Paz Batchoy"] },
    { id: "c-mira", name: "Mira", city: "Manila", lat: 14.5995, lng: 120.9842, sites: 15, langs: ["EN", "TL"], hue: 8, response: "Replies in 1h", samples: ["Intramuros Tours", "Mira Studio", "Roxas Books"] },
    { id: "c-tonio", name: "Tonio", city: "Baguio", lat: 16.4023, lng: 120.596, sites: 11, langs: ["EN", "TL", "ILO"], hue: 70, response: "Replies in 1h", samples: ["Baguio Brew", "Cordillera Trails", "Tonio Print"] },
];

// ── City → coords for submissions without explicit lat/lng ─────────────────
export const CITY_CENTROIDS: Record<string, [number, number]> = {
    "manila": [14.5995, 120.9842],
    "quezon city": [14.676, 121.0437],
    "makati": [14.5547, 121.0244],
    "pasig": [14.5764, 121.0851],
    "taguig": [14.5176, 121.0509],
    "cebu city": [10.3157, 123.8854],
    "davao city": [7.1907, 125.4553],
    "iloilo city": [10.7202, 122.5621],
    "bacolod": [10.6713, 122.9511],
    "cagayan de oro": [8.4542, 124.6319],
    "baguio": [16.4023, 120.596],
    "tagaytay": [14.1124, 120.9627],
    "zamboanga": [6.9214, 122.079],
    "dumaguete": [9.3068, 123.3054],
    "iligan": [8.228, 124.2452],
    "tacloban": [11.2421, 125.0048],
    "laoag": [18.1979, 120.5937],
    "general santos": [6.1164, 125.1716],
    "angeles": [15.145, 120.5938],
    "antipolo": [14.5872, 121.176],
    "pasay": [14.5378, 121.0014],
    "meycauayan": [14.7297, 120.9647],
    "meycauayan, bulacan": [14.7297, 120.9647],
    "marilao": [14.7625, 120.9523],
    "marilao, bulacan": [14.7625, 120.9523],
    "bulacan": [14.7956, 120.8794],
};

export function geocodeCity(city: string | undefined | null): [number, number] | null {
    if (!city) return null;
    const k = city.trim().toLowerCase();
    return CITY_CENTROIDS[k] ?? null;
}

// ── Filter chip values ─────────────────────────────────────────────────────
export const CATEGORIES = ["All", "Café", "Food", "Retail", "Beauty", "Apparel", "Health", "Tourism", "Auto", "Salon", "Restaurant"] as const;

export const REGIONS: Region[] = [
    { id: "all", label: "All Philippines", center: [13.5, 121.5], zoom: 6 },
    { id: "mm", label: "Metro Manila", center: [14.5995, 120.9842], zoom: 11 },
    { id: "bulacan", label: "Bulacan", center: [14.7956, 120.8794], zoom: 11 },
    { id: "cebu", label: "Cebu", center: [10.3157, 123.8854], zoom: 11 },
    { id: "davao", label: "Davao", center: [7.1907, 125.4553], zoom: 11 },
    { id: "iloilo", label: "Iloilo", center: [10.7202, 122.5621], zoom: 11 },
    { id: "bacolod", label: "Bacolod", center: [10.6713, 122.9511], zoom: 11 },
    { id: "baguio", label: "Baguio", center: [16.4023, 120.596], zoom: 11 },
];

// ── Testimonials (current marketing) ───────────────────────────────────────
export const TESTIMONIALS: Testimonial[] = [
    { name: "Janelle", city: "Cebu", claim: "I never had to stop kneading. They asked questions, took photos, and the site was live by the next morning.", initial: "J", hue: 18 },
    { name: "Mark", city: "Cebu", claim: "I don't sit down to design. I cut hair. They built the page around the work, not the other way.", initial: "M", hue: 35 },
    { name: "Aira", city: "Makati", claim: "My hands are full. Tendso doesn't ask me to put anything down.", initial: "A", hue: 5 },
];

// ── FAQ ────────────────────────────────────────────────────────────────────
export const FAQ_CREATOR: FaqEntry[] = [
    { q: "How do I get paid?", a: "Straight to your Wise account. The app handles invoices, taxes, and receipts. You don't touch a spreadsheet." },
    { q: "When do I get paid?", a: "Within 48 hours of the business owner approving their site. Faster on weekends — we don't sit on your money." },
    { q: "Do I need experience?", a: "No. The guided capture walks you through every interview, every photo, every step. If you can use TikTok, you can use this." },
    { q: "What if my English isn't strong?", a: "The app speaks Tagalog, Cebuano, Hiligaynon, and Ilocano. Interview prompts come pre-translated. Your owner stays in their language." },
    { q: "Do I need a smartphone?", a: "Yes — anything from the last four years works. iOS 15+ or Android 10+." },
    { q: "Can I work part-time?", a: "Most creators start that way. You pick the jobs, you set the pace. There's no minimum." },
];

export const FAQ_BUSINESS: FaqEntry[] = [
    { q: "Will I need to learn design?", a: "No. You won't choose a template, pick a font, or stare at a blank page. A creator visits, asks a few questions, takes photos, and your site forms from that." },
    { q: "How long does it take?", a: "Live in 48 hours from the interview. The interview itself is around 30 minutes — at your shop, while you keep working." },
    { q: "Do I have to prepare anything?", a: "No. The creator brings the camera, the questions, and the patience. You answer between customers." },
    { q: "What if I don't like it?", a: "You don't pay until the site is live and you've approved it. If you reject the draft, the creator revises it once for free." },
    { q: "Can I update it later?", a: "Yes — message your creator through the app. Small edits are included for the first year. After that, a flat fee per change." },
    { q: "Who owns the website?", a: "You do. The domain, the photos, the copy — all yours. You can take it elsewhere any time, no penalty." },
    { q: "How much does it cost?", a: "₱999 for a Tendso subdomain site, ₱1,499 if you want a custom domain (.com included for year 1). One-time fee — no monthly hosting bills." },
];

// ── Knowledge base seed ────────────────────────────────────────────────────
export const KNOWLEDGE_BASE: KnowledgeEntry[] = [
    { id: "kb-1", category: "Getting started", title: "What happens in the 30-minute interview?", read: "3 min", excerpt: "A creator visits your shop with a phone and a checklist. You keep working. They ask, they photograph, the site forms around it. The thinking ends there." },
    { id: "kb-2", category: "For creators", title: "Your first week as a certified creator", read: "6 min", excerpt: "Day-by-day map of what to expect: certification, your first match, your first interview, your first payout." },
    { id: "kb-3", category: "Payouts", title: "How Wise payouts work", read: "4 min", excerpt: "Link your Wise account in the app. Funds land within 48 hours of a site going live. No paperwork." },
    { id: "kb-4", category: "Photography", title: "Shooting a small shop — the 12-shot list", read: "5 min", excerpt: "Front, side, sign, hands at work, hero product, two close-ups, two wide, three portraits. The app prompts you, in order." },
    { id: "kb-5", category: "For businesses", title: "What happens if you don't like the result?", read: "2 min", excerpt: "You don't pay until you approve. If you reject the draft, the creator revises once — free. Then it's yours or it's nothing." },
    { id: "kb-6", category: "Referrals", title: "How the ₱1,000 friend bonus actually works", read: "3 min", excerpt: "Share your link. Your friend signs up and lands their first paid submission. You earn ₱1,000 the day that submission is approved." },
];

// ── Stable counters (no longer randomized) ─────────────────────────────────
export const COUNTERS_EARLY = {
    creators: 18, businesses: 47, cities: 6, countries: 1,
    monthEarnings: null as number | null,
};
export const COUNTERS_GROWTH = {
    creators: 124, businesses: 380, cities: 12, countries: 1,
    monthEarnings: 142000,
};

// ── Tick formatter ─────────────────────────────────────────────────────────
export function fmt(n: number | null | undefined): string {
    if (n == null) return "—";
    if (n >= 1000) return n.toLocaleString();
    return n.toString();
}
