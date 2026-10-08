import { WEBSITE_PRICE, formatPHP } from "./pricing";

export const GIVEAWAY_POSTER_PATH = "/100-pages-giveaway-poster.pdf";

/** Shared between the landing page and a form whose last slot was taken. */
export const GIVEAWAY_CLOSED = {
    heading: "Thank you! All 100 free websites have been given away.",
    thanks: "So many of you applied that every slot is taken. Thank you for joining.",
    applied: "Already applied? Your slot is safe. We'll email you once your application is reviewed.",
    paid: `Still want a website? You can still get one for ${formatPHP(WEBSITE_PRICE)}.`,
} as const;
