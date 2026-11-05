/**
 * Step 2 of the pipeline: facts → page copy.
 *
 * The copy model sees ONLY the validated facts (never the raw transcript), so
 * it has nothing to invent from. validateCopy then enforces the word limits,
 * strips exclamation marks and emoji, and blanks any line that carries a number
 * the facts do not contain ("10 years", "500 happy customers").
 * Pure. See docs/v2-ai-pipeline.md.
 */

import type { Copy, Facts } from './types';
import { capWords, isRecord, numbersIn, spokenNumbersIn, str, strList, wordCount } from './json';

export const EMPTY_COPY: Copy = {
    tagline: '',
    heroKicker: '',
    heroHeadline: '',
    heroSub: '',
    aboutHeadline: '',
    aboutLead: '',
    aboutParagraphs: [],
    servicesHeadline: '',
    serviceDescriptions: [],
    ctaHeading: '',
    footerBlurb: '',
};

/** Word ceilings per field. Short on purpose: the page must breathe. */
export const COPY_LIMITS = {
    tagline: 10,
    heroKicker: 5,
    heroHeadline: 8,
    heroSub: 25,
    aboutHeadline: 10,
    aboutLead: 35,
    aboutParagraph: 40,
    servicesHeadline: 6,
    serviceDesc: 15,
    ctaHeading: 8,
    footerBlurb: 25,
} as const;

export const COPY_SYSTEM = `You write the text of a one-page website for a small Filipino business, from facts the owner gave.
Rules:
- Use only the facts. Do not add services, prices, years, awards, numbers, staff names or promises that are not in the facts.
- Sound like the owner talking to a neighbour: plain, warm, concrete. Reuse the owner's own phrases where they fit.
- Short. Respect every word limit. No exclamation marks, no emoji, no hashtags.
- No marketing clichés ("one-stop shop", "world-class", "look no further", "elevate").
- A field you cannot fill from the facts is "".
- Return one JSON object, exactly the shape given, nothing else.`;

export function buildCopyPrompt(facts: Facts, opts: { languageHint?: string } = {}): string {
    const lang = opts.languageHint
        ?? (facts.language === 'tl' || facts.language === 'taglish'
            ? 'English, keeping a short Tagalog phrase of the owner\'s where it reads naturally'
            : 'English');
    const L = COPY_LIMITS;
    return `FACTS (the only source you may use):
${JSON.stringify(facts, null, 2)}

Write in ${lang}.

Return JSON in exactly this shape:
{
  "tagline": "what the business is, max ${L.tagline} words",
  "heroKicker": "trade · place, max ${L.heroKicker} words",
  "heroHeadline": "max ${L.heroHeadline} words",
  "heroSub": "max ${L.heroSub} words",
  "aboutHeadline": "max ${L.aboutHeadline} words",
  "aboutLead": "from the story, max ${L.aboutLead} words",
  "aboutParagraphs": ["at most 2, each max ${L.aboutParagraph} words, only from the story / customersLove"],
  "servicesHeadline": "max ${L.servicesHeadline} words",
  "serviceDescriptions": [{ "name": "a service name from the facts, unchanged", "desc": "max ${L.serviceDesc} words, only from that service's note; '' if it has none" }],
  "ctaHeading": "max ${L.ctaHeading} words",
  "footerBlurb": "max ${L.footerBlurb} words"
}`;
}

// Built from a string so the TS target (ES2017) does not reject the property escape.
const EMOJI = new RegExp('[\\p{Extended_Pictographic}\\u{FE0F}]', 'gu');

/** Remove emoji, exclamation marks and surrounding quotes. */
export function cleanLine(s: string): string {
    return s
        .replace(EMOJI, '')
        .replace(/!+/g, '.')
        .replace(/\.{2,}/g, '.')
        .replace(/^["'“”]+|["'“”]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

const CLICHES = /\b(one[- ]stop[- ]shop|world[- ]class|look no further|elevate|unparalleled|second to none|best in town|premier)\b/i;

export interface CopyReport {
    blanked: string[];
    trimmed: string[];
}

/**
 * Coerce model output to the Copy shape, enforce limits, and blank any field
 * that carries a number missing from the facts or a banned cliché.
 */
export function validateCopy(raw: unknown, facts: Facts): { copy: Copy; report: CopyReport } {
    const r = isRecord(raw) ? raw : {};
    const factNumbers = new Set([...numbersIn(JSON.stringify(facts)), ...spokenNumbersIn(JSON.stringify(facts))]);
    const report: CopyReport = { blanked: [], trimmed: [] };

    const field = (name: string, value: unknown, limit: number): string => {
        let s = cleanLine(str(value, 600));
        if (!s) return '';
        if ([...numbersIn(s), ...spokenNumbersIn(s)].some((n) => !factNumbers.has(n)) || CLICHES.test(s)) {
            report.blanked.push(name);
            return '';
        }
        if (wordCount(s) > limit) {
            report.trimmed.push(name);
            s = capWords(s, limit);
        }
        return s;
    };

    const L = COPY_LIMITS;
    const factServiceNames = new Map(facts.services.map((s) => [s.name.toLowerCase(), s]));
    const serviceDescriptions: Copy['serviceDescriptions'] = [];
    if (Array.isArray(r.serviceDescriptions)) {
        for (const item of r.serviceDescriptions) {
            if (!isRecord(item)) continue;
            const fact = factServiceNames.get(str(item.name, 80).toLowerCase());
            // A service the facts do not have is dropped; a description for a
            // service with no note in the facts is dropped too (it could only
            // have been made up).
            if (!fact) continue;
            const desc = fact.note ? field(`serviceDescriptions.${fact.name}`, item.desc, L.serviceDesc) : '';
            serviceDescriptions.push({ name: fact.name, desc });
        }
    }

    const paragraphs = strList(r.aboutParagraphs, 2, 600)
        .map((p, i) => field(`aboutParagraphs.${i}`, p, L.aboutParagraph))
        .filter(Boolean);

    return {
        report,
        copy: {
            tagline: field('tagline', r.tagline, L.tagline),
            heroKicker: field('heroKicker', r.heroKicker, L.heroKicker),
            heroHeadline: field('heroHeadline', r.heroHeadline, L.heroHeadline),
            heroSub: field('heroSub', r.heroSub, L.heroSub),
            aboutHeadline: field('aboutHeadline', r.aboutHeadline, L.aboutHeadline),
            aboutLead: field('aboutLead', r.aboutLead, L.aboutLead),
            aboutParagraphs: paragraphs,
            servicesHeadline: field('servicesHeadline', r.servicesHeadline, L.servicesHeadline),
            serviceDescriptions,
            ctaHeading: field('ctaHeading', r.ctaHeading, L.ctaHeading),
            footerBlurb: field('footerBlurb', r.footerBlurb, L.footerBlurb),
        },
    };
}
