/*
 * Content for the v2 landing (/v2), ported from the mock's js/data.js and
 * corrected to the facts in docs/FEATURES-QUESTIONS.md "Decisions":
 *  - the site is built about 20 minutes after the interview and photos;
 *  - ₱4,999 once, or a down payment from ₱500; "See it first. Pay once to publish.";
 *  - no peso figures for agencies or Wix/Webflow until Theo gives real ones;
 *  - field agents shown here are not Mika Santos (she stays the sample creator).
 * Showcase captures, photos and people are sample material from the design mock.
 */

import { V2_ROUTES } from "@/components/v2/links";

/** Asset root (public/v2/landing). */
export const A = "/v2/landing";

// ---- links ---------------------------------------------------------------------
export const STORE_AVAILABILITY = "Download links are temporarily unavailable.";

/** The /v2 site map (components/v2/links.ts). */
export const LANDING_LINKS = {
    fieldAgents: V2_ROUTES.fieldAgents,
    creators: V2_ROUTES.creators,
    help: V2_ROUTES.help,
    contact: V2_ROUTES.contact,
    privacy: V2_ROUTES.privacy,
    terms: V2_ROUTES.terms,
} as const;

/**
 * Where a showcase card opens (new tab). The 22 example sites are shipped as
 * static example pages by the pages stream (IMPLEMENTATION-HANDOFF §4A,
 * "Examples"); this is the one place to change if that route moves.
 */
export const exampleHref = (id: string) => `/v2/examples/${id}`;

// ---- showcase sites ------------------------------------------------------------
export interface Showcase {
    id: string;
    name: string;
}
/** The 22 showcase sites, alternating looks so no gallery column shows two alike in a row. */
export const SHOWCASE: Showcase[] = [
    { id: "bike", name: "Bike shop" },
    { id: "surf", name: "Surf school" },
    { id: "dental", name: "Dental clinic" },
    { id: "florist", name: "Liwayway Flowers" },
    { id: "phonefix", name: "Phone repair" },
    { id: "tattoo", name: "Tattoo studio" },
    { id: "forge", name: "Forge Barbers" },
    { id: "petgroom", name: "Pet grooming" },
    { id: "dive", name: "Dive shop" },
    { id: "carpenter", name: "Lakan Woodworks" },
    { id: "sarisari", name: "Sari-sari store" },
    { id: "photo", name: "Photo studio" },
    { id: "print", name: "Print shop" },
    { id: "baker", name: "Rosal Bakeshop" },
    { id: "halohalo", name: "Halo-halo stand" },
    { id: "tutor", name: "Tutoring centre" },
    { id: "vulca", name: "Vulca Garage" },
    { id: "hela", name: "Héla Hair Studio" },
    { id: "tailor", name: "Tailor" },
    { id: "labana", name: "Labaná Laundry" },
    { id: "ceramics", name: "Ceramics studio" },
    { id: "domingo", name: "Domingo Hardware" },
];
export const siteShot = (id: string) => `${A}/sites/${id}-d.webp`;

/** The four homepages that slide out of the hero phone (mirrored: outer, inner, inner, outer). */
export const HERO_SITES: Showcase[] = [
    { id: "baker", name: "Rosal Bakeshop" },
    { id: "florist", name: "Liwayway Flowers" },
    { id: "carpenter", name: "Lakan Woodworks" },
    { id: "hela", name: "Héla Hair Studio" },
];

// ---- interview + photos --------------------------------------------------------
export const INTERVIEW_VIDEO = { src: `${A}/video/interview-2.mp4`, poster: `${A}/video/interview-2.webp` };

export const QUESTIONS = [
    "What's your shop called?",
    "Where are you?",
    "What do you sell?",
    "What do people love most?",
    "How did you start?",
    "What makes you special?",
    "What are your prices?",
    "When are you open?",
    "How can people reach you?",
    "What should people know?",
];
export const EXTRA_QUESTION = "Anything else?";

/** The owner's words (interview) and the site copy that came from them. */
export const WORDS = {
    transcript: "Forge, on J.P. Rizal in Marikina. Clean fades, scissor cuts, a hot-towel shave. Walk in, no fuss, no waiting.",
    copy: ["Sharp cuts.", "No fuss,", "no waiting."],
};

/** Barbershop shot list (the photo camera demo) with the phone photo for each task. */
export const SHOTS: { t: string; h: string; src: string }[] = [
    { t: "Owner headshot", h: "Face and shoulders, plain background", src: "phone-headshot" },
    { t: "Profile picture", h: "Owner at work, half body", src: "phone-profile" },
    { t: "Haircut in progress", h: "Barber and client, side angle", src: "phone-haircut" },
    { t: "Inside", h: "Wide, from the door", src: "phone-inside" },
    { t: "Chairs and equipment", h: "The chairs, mirrors and stations", src: "phone-chair" },
    { t: "Finished cut", h: "Back and side of the client", src: "phone-finished" },
    { t: "Outside", h: "The whole shop front from across", src: "phone-outside" },
    { t: "Sign", h: "Straight on, fill the frame", src: "phone-sign" },
    { t: "Tools", h: "Clippers and scissors, close up", src: "phone-tools" },
    { t: "Price list", h: "Straight on, readable", src: "phone-prices" },
];
export const photo = (name: string) => `${A}/photos/${name}.webp`;
export const person = (name: string) => `${A}/people/${name}.webp`;

/** Images tile: the same man in the same shop, phone shot → Tendso shot. */
export const IMAGE_PAIRS: [string, string, string][] = [
    ["phone-headshot", "pro3-headshot", "Owner"],
    ["phone-outside", "pro3-outside", "Shop front"],
    ["phone-tools", "pro3-tools", "Tools"],
    ["phone-finished", "pro3-finished", "Finished cut"],
    ["phone-haircut", "pro3-detail", "Detail"],
];

// ---- money ---------------------------------------------------------------------
export const PRICE = {
    once: "₱4,999",
    downPayment: "₱500",
};
/** Cost tile: who charges every month. No figures until Theo confirms them. */
export const MONTHLY_RIVALS = ["Web agency", "Wix or Webflow"];

// ---- field agents (sample) ------------------------------------------------------
export const AGENTS = [
    { name: "Joy Dizon", initial: "J", dist: "350 m", note: "Available today" },
    { name: "Paolo Reyes", initial: "P", dist: "1.2 km", note: "Tomorrow, 10:00" },
    { name: "Ana Cruz", initial: "A", dist: "2.4 km", note: "Available today" },
];

// ---- people cloud ---------------------------------------------------------------
/** layer 0 = front and sharp, 1 = back, smaller and blurred. `ar` = width / height. */
export const PEOPLE: { src: string; alt: string; layer: 0 | 1; ar: number }[] = [
    { src: "01-sarisari", alt: "A field agent records a sari-sari store owner", layer: 0, ar: 0.8 },
    { src: "15-carinderia", alt: "An agent records a carinderia cook in Cebu", layer: 0, ar: 1.488 },
    { src: "03-barber", alt: "An agent records a barber in Manila", layer: 0, ar: 1.25 },
    { src: "12-salon", alt: "A salon owner and an agent look at her site", layer: 0, ar: 0.8 },
    { src: "02-panaderya", alt: "An agent photographs a panaderya display", layer: 0, ar: 0.753 },
    { src: "06-agent", alt: "A field agent outside an auto shop", layer: 0, ar: 0.8 },
    { src: "09-cafe", alt: "An agent shows a café owner her site", layer: 1, ar: 0.8 },
    { src: "16-baguio", alt: "A florist in Baguio sees her site", layer: 0, ar: 0.8 },
    { src: "14-garage", alt: "A mechanic talks while an agent records", layer: 1, ar: 1.25 },
    { src: "11-workshop", alt: "Field agent training workshop", layer: 1, ar: 1.488 },
    { src: "04-team", alt: "The Tendso team at work", layer: 1, ar: 1.488 },
    { src: "08-stairs", alt: "The Tendso team", layer: 1, ar: 1.488 },
    { src: "05-creator", alt: "A creator photographs halo-halo", layer: 0, ar: 0.8 },
    { src: "10-scooter", alt: "A field agent on the way to a visit", layer: 1, ar: 1.488 },
    { src: "07-lisbon", alt: "A florist in Lisbon", layer: 1, ar: 1.25 },
    { src: "13-nairobi", alt: "A creator at a flower stall in Nairobi", layer: 1, ar: 0.8 },
];
