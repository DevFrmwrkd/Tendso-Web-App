/**
 * Browser-safe derivation of "tier-3" content defaults for the generic
 * landing-page templates. Lives outside lib/astro-builder.ts (which
 * imports Node-only modules) so the editor sidebar can import this
 * directly and mirror the resolution logic the build pipeline uses.
 *
 * Tier order (handled in lib/astro-builder.ts:transformToAstroData()):
 *   tier 1 — admin override (`extractedContent.*` values admin typed)
 *   tier 2 — AI extraction  (`extractedContent.hero.headlineLines`, etc.)
 *   tier 3 — derived from submission (this function)
 *
 * The editor sidebar (ContentFieldsAuto) treats the same tier-3 result
 * as a "final fallback" so inputs show whatever the iframe is rendering
 * — admin never sees an empty input where the website has content.
 */

export interface DeriveContentInput {
    business_name?: string;
    business_city?: string;
    business_type?: string;
    tagline?: string;
    about?: string;
    contact?: { phone?: string; email?: string; address?: string };
}

export interface DerivedSection {
    marquee: { text: string };
    hero: {
        kicker: string;
        headline: string;
        headlineLines: string[];
        sub: string;
        cta1: { text: string; href: string };
        cta2: { text: string; href: string };
        meta1: string;
        meta2: string;
    };
    about: {
        tag: string;
        headline: string;
        lead: string;
        signature: string;
        paragraphs: string[];
    };
    services: {
        tag: string;
        headline: string;
        sub: string;
        items: Array<{ title: string; desc: string; note?: string }>;
    };
    why: { tag: string; headline: string; items: Array<{ title: string; body: string }> };
    how: { tag: string; headline: string; steps: Array<{ title: string; body: string }> };
    gallery: { tag: string; headline: string; items: Array<{ caption: string; image?: string }> };
    faq: { tag: string; headline: string; items: Array<{ q: string; a: string }> };
    area: { tag: string; headline: string; body: string; places: string[] };
    location: { tag: string; headline: string };
    ctaBand: { headline: string; sub: string; cta: { text: string; href: string } };
    footer: { brand: string; blurb: string; notes: string[] };
    navbar_links: Array<{ label: string; href: string }>;
    navCtaText: string;
    navCtaHref: string;
}

export const BUSINESS_TYPE_SERVICES: Record<string, Array<{ title: string; desc: string; note?: string }>> = {
    barber: [
        { title: 'Cut & Style',     desc: 'Classic and modern cuts tailored to the way you wear your hair.', note: 'walk-in · booked' },
        { title: 'Beard Work',      desc: 'Trims, shapes, and hot-towel finishes that hold their line.',     note: 'add-on' },
        { title: 'Kids & Seniors',  desc: 'Patient, low-fuss cuts for younger and older clients.',           note: 'family-friendly' },
    ],
    salon: [
        { title: 'Cut & Style',        desc: 'Personalized cuts that suit your face, hair type, and routine.',  note: 'consultation included' },
        { title: 'Color & Highlights', desc: 'Custom color, balayage, and root touch-ups by trained colourists.', note: 'consultation included' },
        { title: 'Treatments',         desc: 'Conditioning, gloss, and bond-building treatments to keep hair healthy.', note: 'walk-in · booked' },
    ],
    auto: [
        { title: 'Repairs',     desc: 'Diagnostic and repair work for daily drivers, done right the first time.', note: 'estimates free' },
        { title: 'Maintenance', desc: 'Oil changes, brakes, tires, and the upkeep that keeps cars on the road.',  note: 'same-day' },
        { title: 'Inspections', desc: "Honest, written assessments so you know exactly what needs work and what doesn't.", note: 'walk-in' },
    ],
    restaurant: [
        { title: 'Dine-in',  desc: 'Our menu, served at the table. Walk in or reserve ahead.', note: 'reservations open' },
        { title: 'Takeout',  desc: "Order ahead and pick it up when you're ready.",            note: 'phone · in-person' },
        { title: 'Delivery', desc: 'Hot food to your door through our partner delivery apps.', note: 'partner apps' },
    ],
    cafe: [
        { title: 'Coffee & Drinks',  desc: 'Pour-overs, espresso, and seasonal drinks pulled to order.',   note: 'dine-in · to-go' },
        { title: 'Pastries & Bakes', desc: 'A small selection of baked goods made fresh through the day.', note: 'while supplies last' },
        { title: 'Beans to Go',      desc: "Take home the same coffee we're pouring at the bar.",          note: 'whole bean · ground' },
    ],
    retail: [
        { title: 'In-Store Shopping', desc: "Come by and see what's on the shelves — helpful staff, no pressure.", note: 'walk-in' },
        { title: 'Personal Picks',    desc: "Tell us what you're looking for and we'll set things aside for you.", note: 'by request' },
        { title: 'Local Delivery',    desc: 'Free local delivery on qualifying orders inside the service area.',   note: 'within city' },
    ],
    clinic: [
        { title: 'Consultations',  desc: 'Same-day appointments for new and returning patients.',         note: 'booked · walk-in' },
        { title: 'Routine Care',   desc: 'Regular check-ups and preventive care so problems stay small.', note: 'scheduled' },
        { title: 'Specialty Work', desc: 'Focused care for specific concerns, by trained practitioners.', note: 'by referral' },
    ],
    fitness: [
        { title: 'Group Classes',    desc: 'Small-group sessions led by certified instructors who know your name.',  note: 'drop-in · pass' },
        { title: 'Private Sessions', desc: 'One-on-one time built around your goals and current fitness level.',     note: 'by appointment' },
        { title: 'Memberships',      desc: 'Month-to-month access with no contracts and unlimited classes.',         note: 'monthly' },
    ],
    education: [
        { title: 'Group Classes',    desc: 'Structured small-group classes for kids, teens, and adults.', note: 'weekly · seasonal' },
        { title: 'Private Tutoring', desc: "One-on-one sessions tailored to the student's goals and pace.", note: 'by appointment' },
        { title: 'Workshops',        desc: 'Short focused workshops on specific topics throughout the year.', note: 'seasonal' },
    ],
    services: [
        { title: 'Quotes & Estimates', desc: 'Free written quotes after a quick on-site or remote consultation.', note: 'free' },
        { title: 'Booked Jobs',        desc: 'Scheduled work with clear timelines and tidy daily clean-up.',      note: 'scheduled' },
        { title: 'Emergencies',        desc: 'Same-day response for urgent issues whenever we can.',              note: 'when possible' },
    ],
};

export function normalizeBusinessType(bt: string | undefined | null): string {
    if (!bt) return '';
    const k = bt.trim().toLowerCase().replace(/[^a-z]/g, '');
    if (BUSINESS_TYPE_SERVICES[k]) return k;
    if (/(barber|barbershop)/.test(k))          return 'barber';
    if (/(salon|beauty|spa|nail|hair|aesthet)/.test(k)) return 'salon';
    if (/(auto|mechanic|carshop|carrepair|tire|garage)/.test(k)) return 'auto';
    if (/(restaurant|diner|eatery|bistro|food)/.test(k)) return 'restaurant';
    if (/(cafe|coffee|roaster|tea)/.test(k))    return 'cafe';
    if (/(retail|store|shop|boutique)/.test(k)) return 'retail';
    if (/(clinic|dental|dentist|medical|doctor|veterinary|vet)/.test(k)) return 'clinic';
    if (/(fitness|gym|yoga|pilates|crossfit|martial)/.test(k))  return 'fitness';
    if (/(school|tutor|workshop|academy|education|learning)/.test(k))   return 'education';
    if (/(trade|service|plumb|electric|hvac|landscap|clean|laundry)/.test(k)) return 'services';
    return '';
}

/**
 * Produce a complete content fallback object from a submission's form
 * data. Mirrors what lib/astro-builder.ts uses on the server.
 */
export function deriveContentDefaults(
    content: DeriveContentInput,
    photos: string[] = [],
): DerivedSection {
    const name = content.business_name || 'Your Business';
    const city = content.business_city || '';
    const bt = content.business_type || '';
    const niceType = bt
        ? bt.replace(/[_-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
        : 'Local business';
    const typeKey = normalizeBusinessType(bt);
    const services = BUSINESS_TYPE_SERVICES[typeKey] || [
        { title: 'Our Services', desc: `Learn more about what ${name} offers and how we can help.`, note: 'all customers' },
        { title: 'Get in Touch', desc: `Reach out and we'll get back to you the same day.`,        note: 'phone · email' },
        { title: 'Visit Us',     desc: `Drop by our location to see what we do in person.`,         note: 'walk-in' },
    ];
    return {
        marquee: { text: 'Quality ◆ Trusted ◆ Local ◆ Reliable' },
        hero: {
            kicker: city ? `${city} · ${niceType}` : niceType,
            headline: name,
            headlineLines: [name, '', ''],
            sub: content.tagline || (city ? `Welcome to ${name}, your local ${niceType.toLowerCase()} in ${city}.` : `Welcome to ${name}.`),
            cta1: { text: 'Get in touch', href: '#visit' },
            cta2: { text: 'See services', href: '#services' },
            meta1: '★★★★★ rated on Google',
            meta2: city ? `${city} · open daily` : 'Open daily',
        },
        about: {
            tag: 'About',
            headline: `About ${name}`,
            lead: city
                ? `${name} is a ${niceType.toLowerCase()} based in ${city}.`
                : `${name} is a local ${niceType.toLowerCase()}.`,
            signature: name,
            paragraphs: [
                `We focus on quality work, honest pricing, and customers who come back.`,
                `Get in touch and we'll walk you through what we can do for you.`,
            ],
        },
        services: {
            tag: 'What we offer',
            headline: 'Services we provide',
            sub: `A quick look at what ${name} can help you with.`,
            items: services,
        },
        why: {
            tag: 'Why us',
            headline: `Why choose ${name}`,
            items: [
                { title: 'Local & reliable', body: city ? `Serving ${city} and the surrounding area with consistent, dependable work.` : 'Consistent, dependable work close to home.' },
                { title: 'Honest pricing',   body: 'Clear quotes up front. No surprise charges when the job is done.' },
                { title: 'Real people',      body: 'Call or message and reach a real human who knows your job.' },
            ],
        },
        how: {
            tag: 'How it works',
            headline: 'Three easy steps',
            steps: [
                { title: 'Reach out',     body: "Send us a message, call, or stop by. We'll listen first." },
                { title: 'We confirm',    body: "Quick reply with what we can do, when, and what it'll cost." },
                { title: 'We get it done', body: 'On the agreed date — on time and on quote.' },
            ],
        },
        gallery: {
            tag: 'Inside',
            headline: 'A look at our work',
            items: photos.slice(0, 6).map((image, i) => ({
                image,
                caption: i === 0 ? 'Our space' : i === 1 ? 'Our work' : 'Behind the scenes',
            })),
        },
        faq: {
            tag: 'Good to know',
            headline: 'Questions, answered',
            items: [
                { q: 'How do I get in touch?', a: content.contact?.phone ? `Call ${content.contact.phone}, send us a message, or stop by our location.` : 'Send us a message or stop by our location — we reply the same day.' },
                { q: 'Where are you located?', a: content.contact?.address || (city ? `Located in ${city}. See the Location section below for full details.` : 'See the Location section below for full details.') },
                { q: 'What hours are you open?', a: 'Hours kept live on our Google Business profile — click "Hours on Google" for the latest.' },
            ],
        },
        area: {
            tag: 'Service area',
            headline: city ? `Serving ${city} and nearby` : 'Where we serve',
            body: city ? `Based in ${city}, we serve customers across the surrounding area.` : 'Based locally, we serve customers across the surrounding area.',
            places: city ? [city] : [],
        },
        location: {
            tag: 'Visit',
            headline: 'Where to find us',
        },
        ctaBand: {
            headline: `Ready when you are.`,
            sub: `Reach out to ${name} and we'll get back to you the same day.`,
            cta: { text: 'Get in touch', href: '#visit' },
        },
        footer: {
            brand: name,
            blurb: city
                ? `${name} — a ${niceType.toLowerCase()} serving ${city}.`
                : `${name} — a local ${niceType.toLowerCase()}.`,
            notes: [
                `© ${new Date().getFullYear()} ${name}`,
                'Quality work · trusted locally',
            ],
        },
        navbar_links: [
            { label: 'About',    href: '#about' },
            { label: 'Services', href: '#services' },
            { label: 'Why us',   href: '#why'   },
            { label: 'Gallery',  href: '#work'  },
            { label: 'Visit',    href: '#visit' },
        ],
        navCtaText: 'Get in touch',
        navCtaHref: '#visit',
    };
}

/**
 * Resolve a single dotted-path field from the derived content. Returns
 * `undefined` if the path doesn't exist in the derived shape. Used by
 * the editor as the FINAL fallback when admin draft + schema fallback
 * paths are all empty.
 */
export function getDerivedAt(derived: DerivedSection, path: string): any {
    const parts = path.split('.');
    let cur: any = derived;
    for (const p of parts) {
        if (cur == null) return undefined;
        cur = cur[p];
    }
    return cur;
}
