/**
 * Facts + copy → the template content object (`generatedWebsites.extractedContent`).
 *
 * Writes the paths declared in components/editor/genericContentSchema.ts (the
 * template field system every Astro template binds through data-field), plus the
 * legacy keys /api/generate-website still reads (business_name, tagline, …).
 * The full set is written whatever template is chosen, so the owner can switch
 * design later and keep the content (brief §4D).
 *
 * Honesty rules, enforced here and not left to a prompt:
 *  - Conversion blocks with nothing to say are EMPTY ARRAYS (why, how,
 *    credentials): astro-builder hides an empty block, and an empty array also
 *    stops /api/generate-website from asking Groq to write some.
 *  - The FAQ is built from facts only (hours, payment, location, areas).
 *  - Fallbacks reuse facts ("Barbershop in Lipa"), never stock phrases.
 * Pure. See docs/v2-ai-pipeline.md.
 */

import type { Copy, Facts, PipelineInput } from './types';
import { capWords } from './json';

// The template content is free-form JSON (genericContentSchema paths); typed loosely on purpose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Content = Record<string, any>;

/** "0917 123 4567" → "tel:+639171234567". Empty when there are too few digits. */
export function telHref(phone: string): string {
    const digits = (phone || '').replace(/\D/g, '');
    if (digits.length < 7) return '';
    if (digits.startsWith('63')) return `tel:+${digits}`;
    if (digits.startsWith('0') && digits.length === 11) return `tel:+63${digits.slice(1)}`;
    if (digits.length === 10 && digits.startsWith('9')) return `tel:+63${digits}`;
    return `tel:${digits}`;
}

/** "Mon-Sat 8am-7pm · Sun 9am-5pm". */
export function hoursText(facts: Facts): string {
    return facts.hours.map((h) => [h.days, h.time].filter(Boolean).join(' ')).filter(Boolean).join(' · ');
}

/** Split a headline into at most 3 balanced lines of words. */
export function headlineLines(headline: string): string[] {
    const words = headline.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    if (words.length <= 3) return [words.join(' ')];
    const lines = words.length <= 5 ? 2 : 3;
    const per = Math.ceil(words.length / lines);
    const out: string[] = [];
    for (let i = 0; i < words.length; i += per) out.push(words.slice(i, i + per).join(' '));
    return out;
}

function sentenceList(items: string[]): string {
    if (items.length <= 1) return items.join('');
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** FAQ rows answerable from the facts alone. */
export function factFaq(facts: Facts, input: Pick<PipelineInput, 'address' | 'city'>): Array<{ q: string; a: string }> {
    const faq: Array<{ q: string; a: string }> = [];
    const hours = hoursText(facts);
    if (hours) faq.push({ q: 'When are you open?', a: [hours, facts.hoursNote].filter(Boolean).join('. ') + '.' });
    const where = [facts.address || input.address, facts.city || input.city].filter(Boolean).join(', ');
    if (where) faq.push({ q: 'Where are you?', a: `${where}${facts.landmark ? `, ${facts.landmark}` : ''}.` });
    if (facts.paymentMethods.length > 0) faq.push({ q: 'How can I pay?', a: `${sentenceList(facts.paymentMethods)}.` });
    if (facts.areasServed.length > 0) faq.push({ q: 'Which areas do you serve?', a: `${sentenceList(facts.areasServed)}.` });
    return faq;
}

export function buildTemplateContent(facts: Facts, copy: Copy, input: PipelineInput): Content {
    const name = facts.businessName || input.businessName;
    const city = facts.city || input.city;
    const type = facts.businessType || input.businessType;
    const address = [facts.address || input.address, city].filter(Boolean).join(', ');
    const phone = facts.phone || input.ownerPhone;
    const email = facts.email || input.ownerEmail;
    const tel = telHref(phone);
    const hours = hoursText(facts);
    const fbUrl = /^https?:\/\//i.test(facts.facebook) ? facts.facebook : '';

    const tagline = copy.tagline || [type, city].filter(Boolean).join(' in ') || name;
    const heroHeadline = copy.heroHeadline || name;
    const aboutLead = copy.aboutLead || capWords(facts.story, 35);
    const descByName = new Map(copy.serviceDescriptions.map((d) => [d.name.toLowerCase(), d.desc]));
    const serviceItems = facts.services.map((s) => ({
        title: s.name,
        desc: descByName.get(s.name.toLowerCase()) || s.note || '',
        price: s.price,
        note: '',
    }));

    const cta1 = tel ? { text: 'Call us', href: tel } : { text: 'Visit us', href: '#visit' };
    const faq = factFaq(facts, input);

    const content: Content = {
        // ── legacy keys /api/generate-website reads ──
        business_name: name,
        tagline,
        tone: 'warm, plain, local',
        about_headline: copy.aboutHeadline || undefined,
        about_description: aboutLead || undefined,
        unique_selling_points: facts.customersLove.slice(0, 4),
        featured_headline: copy.servicesHeadline || 'Services',
        featured_subheadline: copy.heroSub || tagline,
        // Must be non-empty, or the route fills in stock "projects".
        featured_products: serviceItems.length > 0
            ? serviceItems.slice(0, 3).map((s) => ({ title: s.title, description: s.desc, tags: s.price ? [s.price] : [] }))
            : [{ title: name, description: tagline, tags: [] }],
        navbar_links: [
            { label: 'About', href: '#about' },
            { label: 'Services', href: '#services' },
            { label: 'Visit', href: '#visit' },
        ],
        navCtaText: cta1.text,
        navCtaHref: cta1.href,
        contact: {
            phone,
            email,
            address,
            ...(fbUrl ? { messenger: fbUrl } : {}),
        },

        // ── genericContentSchema paths ──
        hero: {
            kicker: copy.heroKicker || [type, city].filter(Boolean).join(' · '),
            headline: heroHeadline,
            headlineLines: headlineLines(heroHeadline),
            sub: copy.heroSub || '',
            cta1,
            cta2: { text: 'See services', href: '#services' },
            ...(facts.yearStarted ? { meta1: `Since ${facts.yearStarted}` } : {}),
            ...(hours ? { meta2: hours } : {}),
        },
        about: {
            tag: 'Our story',
            headline: copy.aboutHeadline || name,
            lead: aboutLead,
            paragraphs: copy.aboutParagraphs,
            ...(facts.ownerName || input.ownerName ? { signatureName: `${facts.ownerName || input.ownerName}, owner` } : {}),
            ...(facts.yearStarted ? { stampYear: facts.yearStarted, stampTag: 'EST.' } : {}),
        },
        services: {
            tag: 'Services',
            headline: copy.servicesHeadline || 'Services',
            items: serviceItems,
        },
        ...(facts.services.length >= 2 ? { marquee: { text: facts.services.map((s) => s.name).join(' ✺ ') } } : {}),
        ...(facts.areasServed.length > 0 ? {
            area: { tag: 'Where we serve', headline: 'Areas we serve', places: facts.areasServed },
            serviceArea: { heading: 'Areas we serve', places: facts.areasServed },
        } : {}),
        location: {
            tag: 'Visit',
            headline: 'Find us',
            address,
            phone,
            ...(hours ? { hours } : {}),
            ...(input.coordinates ? { lat: input.coordinates.lat, lng: input.coordinates.lng } : {}),
            ...(facts.landmark ? { directions: { text: facts.landmark } } : {}),
        },
        footer: {
            brand: name,
            locality: city,
            blurb: copy.footerBlurb || tagline,
            brand_blurb: copy.footerBlurb || tagline,
            hours: facts.hours.map((h) => ({ day: h.days, time: h.time })),
            social: fbUrl ? [{ platform: 'Facebook', url: fbUrl }] : [],
            social_links: fbUrl ? [{ platform: 'Facebook', url: fbUrl }] : [],
        },

        // ── conversion blocks: facts or nothing ──
        why: [],
        how: [],
        credentials: [],
        faq,
        // The route's testimonial guard still decides whether these may show.
        testimonials: facts.customerQuotes.map((quote) => ({ quote })),
        ctaBand: {
            heading: copy.ctaHeading || (tel ? 'Call or drop by' : 'Drop by'),
            primaryLabel: cta1.text,
            primaryLink: cta1.href,
        },
    };
    return content;
}

/** Read a dotted path; `N` means "the first row of that list". */
export function readPath(obj: unknown, path: string): unknown {
    let cur: unknown = obj;
    for (const part of path.split('.')) {
        if (cur == null || typeof cur !== 'object') return undefined;
        cur = part === 'N' ? (Array.isArray(cur) ? cur[0] : undefined) : (cur as Record<string, unknown>)[part];
    }
    return cur;
}

const isFilled = (v: unknown) =>
    Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== '';

/**
 * Which text fields a template binds that this content leaves empty. Image and
 * link-target paths are ignored (photos are placed by the builder). The report
 * is stored on the run so an admin sees what the owner never said.
 */
export function templateCoverage(content: Content, templatePaths: string[]): { filled: string[]; empty: string[] } {
    const filled: string[] = [];
    const empty: string[] = [];
    for (const path of templatePaths) {
        if (/(^|\.)(image\d*|images|photo|photos|lat|lng|href|link)(\.|$)/i.test(path)) continue;
        (isFilled(readPath(content, path)) ? filled : empty).push(path);
    }
    return { filled, empty };
}
