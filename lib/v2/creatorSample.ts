/**
 * SAMPLE DATA. Mika Santos is a made-up creator used to show what the portal looks
 * like ("What your portal looks like" on /v2/creators) and to develop the pages
 * without a backend. Nothing here is real, and every place it is shown says
 * "Sample". The numbers match the mock (docs/landing-mock/app/creator-links-screens.js):
 *   ₱12,250 money now from 7 shops (7 × ₱1,750),
 *   ₱4,350 monthly from 9 active agents of 14 (5% of each sale, ₱150 on ₱2,999),
 *   funnel 2,480 clicks → 412 downloads → 63 sign-ups → 7 sales,
 *   ₱16,000 ready to send, ₱600 waiting.
 *
 * Shaped exactly like creatorPortal.summary (lib/v2/creatorTypes.ts) so the same
 * PortalView draws it.
 */
import type { CreatorCard, PortalPictures, PortalRecruit, PortalShop, PortalSummary } from "./creatorTypes";

/** "Today" in the sample: 21 October 2026, noon in Manila. */
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const at = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 12) - MANILA_OFFSET_MS;
export const SAMPLE_TODAY = at(2026, 10, 21);

function endOf(joinedAt: number): number {
    const d = new Date(joinedAt + MANILA_OFFSET_MS);
    return Date.UTC(d.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate(), 12) - MANILA_OFFSET_MS;
}

function monthsLeft(endsAt: number): number {
    const e = new Date(endsAt + MANILA_OFFSET_MS);
    const t = new Date(SAMPLE_TODAY + MANILA_OFFSET_MS);
    const m = (e.getUTCFullYear() - t.getUTCFullYear()) * 12 + e.getUTCMonth() - t.getUTCMonth() - (e.getUTCDate() < t.getUTCDate() ? 1 : 0);
    return Math.max(0, m);
}

/** [name, city, joined, sales this month, 5% this month] */
const AGENTS: [string, string, [number, number, number], number, number][] = [
    ["Paolo Reyes", "Marikina", [2026, 2, 3], 6, 900],
    ["Joy Dizon", "Pasig", [2026, 3, 18], 5, 825],
    ["Rina Villanueva", "Cebu City", [2026, 6, 21], 4, 650],
    ["Carlo Bautista", "Quezon City", [2026, 5, 2], 4, 600],
    ["Mark Aquino", "Antipolo", [2026, 7, 9], 3, 450],
    ["Liza Mendoza", "Davao City", [2026, 7, 30], 3, 400],
    ["Jun Castillo", "Marikina", [2026, 8, 14], 2, 300],
    ["Ana Ramos", "Taguig", [2026, 9, 2], 1, 150],
    ["Bea Navarro", "Makati", [2026, 9, 26], 1, 75],
    ["Tess Garcia", "Bulacan", [2026, 4, 10], 0, 0],
    ["Noel Fernandez", "Laguna", [2026, 8, 12], 0, 0],
    ["Kim Torres", "Manila", [2026, 10, 8], 0, 0],
    ["Jessa Lim", "Iloilo City", [2026, 10, 15], 0, 0],
    ["Ramon Cruz", "Batangas", [2026, 10, 19], 0, 0],
];

const recruits: PortalRecruit[] = AGENTS.map(([name, area, [y, m, d], sales, cut], i) => {
    const joinedAt = at(y, m, d);
    const endsAt = endOf(joinedAt);
    return {
        creatorId: `sample-agent-${i + 1}`,
        name,
        area,
        joinedAt,
        salesThisMonth: sales,
        overrideThisMonth: cut,
        overrideTotal: cut * 3,
        endsAt,
        monthsLeft: monthsLeft(endsAt),
        earning: true,
    };
});

/** [photo key, name, kind, city, day in October] */
const SHOPS: [string, string, string, string, number][] = [
    ["tailor", "Lito’s Tailoring", "Tailor", "Marikina", 19],
    ["vulca", "Vulca Garage", "Auto repair", "Cebu City", 17],
    ["hela", "Héla Hair Studio", "Hair salon", "Makati", 15],
    ["bike", "Pedal Pinoy", "Bike repair", "Pasig", 12],
    ["print", "Tinta Print Shop", "Printing", "Quezon City", 9],
    ["petgroom", "Ate Grace Pet Grooming", "Pet grooming", "Taguig", 6],
    ["phonefix", "Kuya Ben Phone Fix", "Phone repair", "Manila", 2],
];

const shops: PortalShop[] = SHOPS.map(([, name, kind, city, day], i) => ({
    submissionId: `sample-shop-${i + 1}`,
    businessName: name,
    date: at(2026, 10, day),
    paidAt: at(2026, 10, day),
    listPrice: 4999,
    paid: 3499,
    kept: 1750,
    status: "paid" as const,
    meta: `${kind} · ${city}`,
}));

const creator: PortalSummary["creator"] = {
    handle: "mika",
    name: "Mika Santos",
    photo: null,
    code: "MIKA",
    listPrice: 4999,
    price: 3499,
    saving: 1500,
    percentOff: 30,
    status: "active",
    shopLink: "/a/mika",
    earnLink: "/a/mika/earn",
};

export const SAMPLE_PORTAL: PortalSummary = {
    creator,
    month: { start: Date.UTC(2026, 9, 1) - MANILA_OFFSET_MS, end: Date.UTC(2026, 10, 1) - MANILA_OFFSET_MS, label: "2026-10" },
    rates: { overrideRate: 0.05, overrideMonths: 12 },
    now: { thisMonth: 12250, shopsThisMonth: 7, shops },
    monthly: {
        thisMonth: 4350,
        activeAgents: 9,
        agentsInWindow: 14,
        nextEndDate: recruits.reduce((soonest, r) => Math.min(soonest, r.endsAt), Infinity),
    },
    funnel: {
        shop: { clicks: 2480, downloads: 412, signUps: 63, sales: 7 },
        earn: { clicks: 1130, downloads: 188, signUps: 14, sales: 96 },
    },
    recruits,
    shops,
    payouts: {
        readyToSend: 16000,
        waitingForShops: 600,
        waitingFromShops: 0,
        waitingFromTeam: 600,
        inFlight: 0,
        history: ([
            [at(2026, 9, 30), 14350],
            [at(2026, 8, 31), 11900],
            [at(2026, 7, 31), 8750],
            [at(2026, 6, 30), 4200],
        ] as [number, number][]).map(([sentAt, amount], i) => ({
            withdrawalId: `sample-payout-${i + 1}`,
            amount,
            status: "completed" as const,
            requestedAt: sentAt,
            sentAt,
        })),
    },
};

/** Real files in public/v2/creators (face crops and shop photos). Only the sample uses them. */
export const SAMPLE_PICTURES: PortalPictures = {
    creator: "/v2/creators/faces/mika.jpg",
    recruits: {
        "Paolo Reyes": "/v2/creators/faces/paolo.jpg",
        "Joy Dizon": "/v2/creators/faces/joy.jpg",
        "Rina Villanueva": "/v2/creators/faces/rina.jpg",
        "Carlo Bautista": "/v2/creators/faces/carlo.jpg",
    },
    shops: Object.fromEntries(
        SHOPS.map(([key, name]) => [
            name,
            {
                tailor: "/v2/creators/photos/tailor-owner.jpg",
                vulca: "/v2/creators/photos/vulca-owner.jpg",
                hela: "/v2/creators/photos/hela-owner.jpg",
                bike: "/v2/creators/photos/bike-owner.jpg",
                print: "/v2/creators/photos/print-owner.jpg",
                petgroom: "/v2/creators/photos/petgroom-owner.jpg",
                phonefix: "/v2/creators/photos/phonefix-owner.jpg",
            }[key] as string,
        ]),
    ),
};

/** Mika as the public sees her: the card behind /a/mika. Shown only while the sample flag is on. */
export const SAMPLE_CREATOR_CARD: CreatorCard = {
    handle: "mika",
    name: "Mika Santos",
    photo: "/v2/creators/photos/mika.jpg",
    code: "MIKA",
    listPrice: 4999,
    price: 3499,
    saving: 1500,
    percentOff: 30,
};
