import { WEBSITE_PRICE, formatPHP } from "./pricing";

export const GIVEAWAY_POSTER_PATH = "/100-pages-giveaway-poster.pdf";

/** Shared between the landing page and a form whose last slot was taken. */
export const GIVEAWAY_CLOSED = {
    heading: "Off the Record’s giveaway is currently closed.",
    thanks: "New applications are currently closed. Thank you for your interest in a free Tendso website from Off the Record.",
    applied: "Already applied? Applications already under review stay in the queue. Tendso will email your website link if your application qualifies.",
    paid: `Still want a website? You can still get one for ${formatPHP(WEBSITE_PRICE)}.`,
} as const;

/** Closing intake, reserving all slots and delivering all sites are different events. */
export function giveawayClosedCopy(status?: { slotsLeft: number; given: number }) {
    if (status && status.given >= 100) return {
        ...GIVEAWAY_CLOSED,
        heading: "Off the Record’s 100 free websites have been given away.",
        thanks: "Thank you to the businesses that joined this one-time giveaway from Off the Record.",
    };
    if (status && status.slotsLeft <= 0) return {
        ...GIVEAWAY_CLOSED,
        heading: "All giveaway slots are currently reserved.",
        thanks: "Off the Record is reviewing applications for the 100 free Tendso websites. Reserved slots include applications still awaiting review.",
    };
    return GIVEAWAY_CLOSED;
}
