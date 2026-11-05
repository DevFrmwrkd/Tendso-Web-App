import { CREATOR_OVERRIDE_MONTHS, CREATOR_OVERRIDE_RATE } from './pricing';

/** New affiliate recruits use this program; existing referral rows keep their bonus. */
export const AFFILIATE_RECRUIT_REWARD = `Earn ${Math.round(CREATOR_OVERRIDE_RATE * 100)}% of each eligible paid website sold by a field agent you invite, for ${CREATOR_OVERRIDE_MONTHS} months after they join.`;
export const AFFILIATE_RECRUIT_TERMS = 'Applies to field agents joining from October 21, 2026. Earlier referrals keep their ₱1,000 first-paid-website bonus. Free promo sites and your own websites do not count.';
