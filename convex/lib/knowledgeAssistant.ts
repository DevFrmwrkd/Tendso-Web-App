import {
    BASE_PRICE, PRICE_CEILING, WEBSITE_PRICE, CREATOR_CODE_DISCOUNT, CREATOR_CODE_PRICE,
    COMMISSION_RATE, CREATOR_OVERRIDE_RATE, CREATOR_OVERRIDE_MONTHS, REFERRAL_BONUS,
    CUSTOM_DOMAIN_ADDON, commissionFor, formatPHP,
} from '../../packages/shared/pricing';
import type { KnowledgeAudience } from '../../packages/shared/knowledge';

/** Policy values come from the same module as checkout and the earnings ledger. */
export function assistantPolicyFacts(audience: KnowledgeAudience): string {
    const shared = [
        `The standard website list price is ${formatPHP(WEBSITE_PRICE)}. Existing saved quotes keep their quoted price.`,
        `Creator/affiliate codes give a fixed ${CREATOR_CODE_DISCOUNT * 100}% discount: ${formatPHP(CREATOR_CODE_PRICE)}. Affiliates cannot adjust that offer.`,
        `The custom-domain starting add-on is ${formatPHP(CUSTOM_DOMAIN_ADDON)}; confirmed registrar costs and saved order quotes take precedence. Domain charges are excluded from commission.`,
        'An owner can request changes from Tendso; owners do not edit the completed website themselves.',
        'A checkout return screen or an unmatched bank transfer does not prove payment. Use the verified payment status; transfers without a matching reference require team verification.',
    ];
    if (audience === 'affiliate' || audience === 'admin') shared.push(
        `An affiliate earns ${COMMISSION_RATE * 100}% of the website price on their direct code sales (${formatPHP(commissionFor(CREATOR_CODE_PRICE))} at the current code offer).`,
        `For eligible recruited field agents, the affiliate earns ${CREATOR_OVERRIDE_RATE * 100}% of the website price for ${CREATOR_OVERRIDE_MONTHS} calendar months from the agent's join date, only after the shop pays in full. This is one level, not recruit-of-recruit earnings. Legacy referrals can follow their original terms.`,
        'A creator chooses an available, readable code once, confirms it, and cannot change it afterward.',
    );
    if (audience === 'field_agent' || audience === 'admin') shared.push(
        `Field agents may quote captured websites between ${formatPHP(BASE_PRICE)} and ${formatPHP(PRICE_CEILING)} and earn ${COMMISSION_RATE * 100}% of the website price.`,
        `The field-agent friend referral bonus is ${formatPHP(REFERRAL_BONUS)}, payable when the friend's first site is fully paid. Affiliate recruit overrides follow the separate rule above.`,
    );
    return shared.join('\n');
}

export type AccountQuestion = 'balance' | 'approval' | 'sites';
type QuestionTurn = { role: 'user' | 'assistant'; text: string };

/** Personal requests never fall through to a plausible answer from a general article. */
export function accountQuestion(query: string): AccountQuestion | null {
    const personal = /\b(?:my|our|i|we|me|us|mine|ours)\b/i.test(query);
    // An owner's balance due is a business record, distinct from a creator's
    // cash-out wallet. Payment rejection must not become profile rejection.
    if (/\b(?:my|our)\b/i.test(query) && /\b(?:sites?|websites?|business(?:es)?|submissions?|shops?)\b/i.test(query)
        && /\b(?:status|paid|payment|ready|live|publish\w*|review|progress|quote|balance|due|owe)\b/i.test(query)) return 'sites';
    if (/\bbalances?\b/i.test(query)
        || (personal && /\b(?:wallets?|payouts?|cash[ -]?outs?|withdraw\w*|earnings|available funds)\b/i.test(query))
        || /\bhow much (?:have|did) (?:i|we) (?:earn(?:ed)?|ma(?:de|ke))\b/i.test(query)
        || /\b(?:did|have|was|were|am|are) (?:i|we)\b.*\b(?:paid|received? (?:my |our )?(?:money|payment))\b/i.test(query)
        || (personal && /\bhow much\b/i.test(query) && /\b(?:in (?:my|our) account|(?:i|we) have|available)\b/i.test(query))) return 'balance';
    if (personal && /\bpayments?\b/i.test(query) && /\b(?:status|approv\w*|reject\w*|pending|expir\w*|fail\w*|confirm\w*|arriv\w*|received?)\b/i.test(query)) return 'sites';
    if (personal && /\b(approv\w*|reject\w*|certif\w*|quiz (?:status|results?|pass\w*)|passed (?:the )?quiz)\b/i.test(query)) return 'approval';
    if (/\b(?:did|have) (?:i|we)\b.*\b(?:pass(?:ed)?|complet(?:e|ed))\b.*\b(?:quiz|training)\b/i.test(query)) return 'approval';
    return null;
}

function accountFollowup(query: string): boolean {
    const text = query.trim().replace(/[?!.]+$/, '');
    if (/\b(?:photos?|images?|designs?|templates?|camera|interviews?|domains?|codes?|discounts?|referrals?|notifications?|emails?|login|sign[ -]?in)\b/i.test(text)) return false;
    if (/^(?:and |but |so |also )?(?:why|why not|now|and now|any updates?|what happened|tell me more|more|how much(?: now| today| this month| last month)?|what about (?:now|today|this month|last month)|and (?:today|this month|last month))$/i.test(text)) return true;
    return /^(?:and |but |so |also )?(?:why|when|how|what|is|are|has|have|can|could|will|does|do|did|was|were)\b/i.test(text)
        && /\b(?:it|that|this|they|those|these)\b/i.test(text);
}

/** Only prior user intent resolves a personal follow-up; assistant text never supplies account facts. */
export function accountQuestionInContext(query: string, history: readonly QuestionTurn[]): AccountQuestion | null {
    const direct = accountQuestion(query);
    if (direct || !accountFollowup(query)) return direct;
    for (let index = history.length - 1; index >= 0; index--) {
        const turn = history[index];
        if (turn.role !== 'user') continue;
        const previous = accountQuestion(turn.text);
        if (previous) return previous;
        // Stop at a new topic instead of reviving an older personal question.
        if (!accountFollowup(turn.text)) return null;
    }
    return null;
}

/** Financial claims must come from canonical policy or live records during an AI outage. */
export function isFinancialQuestion(text: string): boolean {
    return /[₱$€£%]|\bPHP\s*\d|\b(?:php|pesos?|prices?|pricing|costs?|fees?|charges?|amounts?|quotes?|discounts?|commissions?|earn\w*|payouts?|cash[ -]?outs?|withdraw\w*|refund\w*|money|paid|payments?|pay|balances?|wallets?|funds|bonuses?|percent(?:age)?|profits?)\b/i.test(text)
        || /\b(?:keep|receive|get|share|cut)\b.*\b(?:sale|site|website|commission)\b/i.test(text);
}

/** Direct policy questions can be answered reliably even during an AI outage. */
export function policyAnswer(query: string, audience: KnowledgeAudience): string | null {
    if (/\bdomain\b/i.test(query) && /\b(?:cost|price|how much|fee|charge|add-on)\b/i.test(query)) {
        return `Custom-domain add-ons start at ${formatPHP(CUSTOM_DOMAIN_ADDON)}. Confirmed registrar costs and your saved order quote take precedence. Domain charges are separate from website commission.`;
    }
    if ((/\b(?:website|site|tendso)\b/i.test(query) && /\b(?:cost|price|how much)\b/i.test(query)
        || /\b(?:starting|base|standard|upfront|one[ -]time) (?:fee|price|cost|charge)\b/i.test(query))
        && !/\b(?:earn\w*|keep|commission)\b/i.test(query)) {
        return `A website is ${formatPHP(WEBSITE_PRICE)} at the standard price. A creator code gives ${CREATOR_CODE_DISCOUNT * 100}% off, bringing it to ${formatPHP(CREATOR_CODE_PRICE)}. Your saved quote is the amount due; a custom domain costs extra.`;
    }
    if (/\b(?:code|discount|offer)\b/i.test(query) && /\b(?:price|discount|percent|off|how much|adjust|change the price)\b/i.test(query)) {
        return `Creator codes give a fixed ${CREATOR_CODE_DISCOUNT * 100}% off the ${formatPHP(WEBSITE_PRICE)} website: ${formatPHP(CREATOR_CODE_PRICE)}. Creators cannot change that discount. Existing quoted orders keep their saved price.`;
    }
    if ((audience === 'affiliate' || audience === 'admin') && /\b(?:recruit\w*|invited? agents?|my agents?|agent(?:'s|s')? sales)\b/i.test(query) && /\b(?:earn\w*|commission|months?|bonus|percent|paid|how much)\b/i.test(query)) {
        return `For eligible field agents who join through your creator link or code, you earn ${CREATOR_OVERRIDE_RATE * 100}% of their website sales for ${CREATOR_OVERRIDE_MONTHS} calendar months from their join date. It is credited only after the shop pays in full, excludes custom-domain charges, and covers your direct recruits only. Older referrals may retain their original terms.`;
    }
    if (audience === 'field_agent' && /\b(?:friend|invit\w*|referr\w*)\b/i.test(query) && /\b(?:earn\w*|commission|bonus|paid|how much|works?)\b/i.test(query)) {
        return `Invite a friend to become a field agent. You earn a one-time ${formatPHP(REFERRAL_BONUS)} bonus when their first website is fully paid. Joining, passing training, or submitting a shop alone does not earn the bonus.`;
    }
    if ((audience === 'affiliate' || audience === 'field_agent') && (/\b(?:commission|how much (?:do|can|will) i (?:earn|keep))\b/i.test(query)
        || /\b(?:what|how much|what percentage)\b.*\b(?:i|we)\b.*\b(?:earn|keep|receive|get)\b.*\b(?:sale|site|website)\b/i.test(query)
        || /\b(?:my|our) (?:cut|commission share)\b/i.test(query))) {
        return audience === 'affiliate'
            ? `You earn ${COMMISSION_RATE * 100}% of the website price on direct creator-code sales: ${formatPHP(commissionFor(CREATOR_CODE_PRICE))} at today's ${formatPHP(CREATOR_CODE_PRICE)} offer. Custom-domain charges are excluded. Recruited-agent sales use the separate ${CREATOR_OVERRIDE_RATE * 100}% override.`
            : `You keep ${COMMISSION_RATE * 100}% of the website price, excluding custom-domain charges. Captured websites can be quoted from ${formatPHP(BASE_PRICE)} to ${formatPHP(PRICE_CEILING)}. The earnings ledger shows what has actually been credited to your account.`;
    }
    return null;
}
