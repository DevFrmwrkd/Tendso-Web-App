/**
 * SEO head for a published customer site — canonical URL, og:url, and
 * LocalBusiness structured data.
 *
 * WHY THIS IS APPLIED AT SERVE TIME, NOT AT BUILD TIME.
 *
 * Each of the 70 Page*.astro wrappers emits its own complete document with its
 * own <head> (only the fallback stub composes with BaseLayout), so a build-time
 * fix would mean 70 edits plus one more for every future template — and it
 * would still leave every site already published without a canonical until
 * somebody republished it one by one.
 *
 * More importantly, THE BUILD CANNOT KNOW THE CANONICAL URL. The slug is
 * assigned at publish, after the HTML exists, and a site that later gets a real
 * domain must canonicalise to that domain instead. The address is knowable only
 * where the request is answered.
 *
 * So `app/hosted/[slug]/route.ts` injects these tags into the stored HTML on the
 * way out. Every published site gains them at once, with no republish.
 *
 * Everything here is injected ONLY when the document does not already carry it,
 * so a template that grows its own canonical or JSON-LD later wins and nothing
 * ends up duplicated.
 */
import { normalizeBusinessType } from './derive-content-defaults';

/**
 * schema.org type per canonical business type.
 *
 * The keys are exactly the ten values normalizeBusinessType() can return.
 * Anything it cannot classify — which is most of them, since 19 of 30 intake
 * submissions answer "Other" — falls through to plain LocalBusiness, which is
 * correct rather than merely safe: a wrong specific type is worse than a
 * general one.
 *
 * `clinic` deliberately maps to MedicalBusiness and not Dentist: the bucket
 * merges dental, medical and veterinary practices, and guessing between them
 * from a colour-scheme key would publish a claim about a business we cannot
 * support.
 */
const SCHEMA_TYPE_BY_BUSINESS_TYPE: Record<string, string> = {
    barber: 'HairSalon',
    salon: 'BeautySalon',
    auto: 'AutoRepair',
    restaurant: 'Restaurant',
    cafe: 'CafeOrCoffeeShop',
    retail: 'Store',
    clinic: 'MedicalBusiness',
    fitness: 'HealthAndBeautyBusiness',
    education: 'EducationalOrganization',
    services: 'LocalBusiness',
};

/**
 * The hospitality family has no business-type key of its own — a villa or a
 * room rental arrives as "Other" — so the template family is the only signal
 * that a site is lodging. `customizations.heroStyle` carries it as
 * `hospitality:BJ`.
 */
const SCHEMA_TYPE_BY_TEMPLATE_FAMILY: Record<string, string> = {
    hospitality: 'LodgingBusiness',
    florist: 'Florist',
    foodcraft: 'CafeOrCoffeeShop',
    restaurant: 'Restaurant',
    barbershop: 'HairSalon',
    salonspa: 'BeautySalon',
    autoshop: 'AutoRepair',
    retail: 'Store',
    medical: 'MedicalBusiness',
    fitness: 'HealthAndBeautyBusiness',
    education: 'EducationalOrganization',
    shirtstore: 'ClothingStore',
    trades: 'HomeAndConstructionBusiness',
};

/**
 * Pick the schema.org type. The typed business type wins, because an owner
 * chose it; the template family is the fallback, because an admin chose it and
 * for the hospitality and florist families it is the only thing that knows.
 */
export function schemaTypeFor(
    businessType: string | undefined | null,
    heroStyle: string | undefined | null,
): string {
    const byType = SCHEMA_TYPE_BY_BUSINESS_TYPE[normalizeBusinessType(businessType)];
    if (byType) return byType;
    const family = typeof heroStyle === 'string' ? heroStyle.split(':')[0] : '';
    return SCHEMA_TYPE_BY_TEMPLATE_FAMILY[family] || 'LocalBusiness';
}

/** What the served HTML already states about itself. */
export interface HtmlHeadFacts {
    description?: string;
    image?: string;
}

/**
 * Read the description and og:image back out of the document.
 *
 * Deliberately taken from the HTML rather than from Convex: these two are
 * already in the head of every template, and re-deriving them from the row
 * risks structured data that disagrees with the visible page — which is the one
 * thing Google treats as a reason to ignore it.
 */
export function readHeadFacts(html: string): HtmlHeadFacts {
    const head = html.slice(0, 8000);
    const meta = (pattern: RegExp): string | undefined => {
        const m = pattern.exec(head);
        const value = m?.[1]?.trim();
        return value ? decodeEntities(value) : undefined;
    };
    return {
        description:
            meta(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) ??
            meta(/<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i),
        image: meta(/<meta\s+property=["']og:image["']\s+content=["']([^"']*)["']/i),
    };
}

/** The five entities an HTML attribute can carry. Enough for meta content. */
function decodeEntities(value: string): string {
    return value
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#3[49];/g, "'")
        .replace(/&amp;/g, '&');
}

export interface JsonLdInput {
    /** The address this page is canonically served at, with trailing slash. */
    canonicalUrl: string;
    businessName: string;
    businessType?: string | null;
    /** `customizations.heroStyle`, e.g. `hospitality:BJ`. Family fallback. */
    heroStyle?: string | null;
    description?: string;
    image?: string;
    /** As displayed on the page — already +63-normalised by the builder. */
    telephone?: string | null;
    /** The single free-text address line the owner typed. */
    address?: string | null;
    /** `business_city`, when the owner gave one separately. */
    city?: string | null;
    /** Province. Only used to qualify an address we already have. */
    region?: string | null;
    /** Postal code. Only used to qualify an address we already have. */
    postalCode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    /** The owner's Google Business Profile or Maps link, when they gave one. */
    mapUrl?: string | null;
    /** Social profiles, which is what `sameAs` is for. */
    socialUrls?: string[];
}

/**
 * Build the LocalBusiness JSON-LD object, or null when there is not enough to
 * say anything true.
 *
 * NO OPENING HOURS, ON PURPOSE. The only hours we hold are two free-text fields
 * an admin types ("9am - 6pm", "Mon-Sat", "by appointment"), and
 * `openingHours` wants `Mo-Sa 09:00-18:00`. Parsing that reliably is not
 * possible, and structured data that says a shop is open when it is shut is
 * worse for the owner than no structured data at all. Google takes hours from
 * the Business Profile anyway, which is where the owner actually maintains them.
 */
export function buildLocalBusinessJsonLd(input: JsonLdInput): Record<string, unknown> | null {
    const name = input.businessName?.trim();
    if (!name) return null;

    const address = input.address?.trim();
    const city = input.city?.trim();
    const region = input.region?.trim();
    const postalCode = input.postalCode?.trim();
    /** True when `part` is not already spelled out inside the typed address. */
    const notAlreadyInAddress = (part: string | undefined): boolean =>
        !!part && !(address ?? '').toLowerCase().includes(part.toLowerCase());
    const postalAddress: Record<string, unknown> | undefined = address || city
        ? {
            '@type': 'PostalAddress',
            ...(address ? { streetAddress: address } : {}),
            // Each part only when it is not already inside the typed address —
            // otherwise the same town appears twice in one address and the whole
            // block reads like machine filler.
            ...(notAlreadyInAddress(city) ? { addressLocality: city } : {}),
            // Province and postal code qualify a street address; on their own
            // they would describe a region, not a place, so they are dropped
            // when there is no address line to attach them to.
            ...(address && notAlreadyInAddress(region) ? { addressRegion: region } : {}),
            ...(address && notAlreadyInAddress(postalCode) ? { postalCode } : {}),
            addressCountry: 'PH',
        }
        : undefined;

    const hasCoords = typeof input.latitude === 'number' && typeof input.longitude === 'number';
    const socialUrls = (input.socialUrls ?? []).filter((u) => /^https?:\/\//i.test(u));

    return {
        '@context': 'https://schema.org',
        '@type': schemaTypeFor(input.businessType, input.heroStyle),
        // A stable identity for the business, separate from the page URL, so a
        // later move to a real domain does not read as a different entity.
        '@id': `${input.canonicalUrl}#business`,
        name,
        url: input.canonicalUrl,
        ...(input.description ? { description: input.description } : {}),
        ...(input.image ? { image: input.image } : {}),
        ...(input.telephone?.trim() ? { telephone: input.telephone.trim() } : {}),
        ...(postalAddress ? { address: postalAddress } : {}),
        ...(hasCoords
            ? {
                geo: {
                    '@type': 'GeoCoordinates',
                    latitude: input.latitude,
                    longitude: input.longitude,
                },
            }
            : {}),
        ...(input.mapUrl?.trim() ? { hasMap: input.mapUrl.trim() } : {}),
        ...(socialUrls.length ? { sameAs: socialUrls } : {}),
    };
}

/**
 * Serialise for embedding in a <script> element.
 *
 * Escaping `<` is the whole job: an unescaped `</script` anywhere in the data —
 * an owner pasting markup into their address, a business called "A & B <Co>" —
 * would close the element early and spill the rest of the JSON into the page as
 * text. `<` is valid JSON and parses back to `<`.
 */
export function serializeJsonLd(value: Record<string, unknown>): string {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}

export interface InjectSeoOptions {
    /** Absolute URL this page should canonicalise to. */
    canonicalUrl: string;
    /** Already-serialised JSON-LD, or null to inject none. */
    jsonLd?: string | null;
}

/** Escape a value for use inside a double-quoted HTML attribute. */
function attr(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Insert the SEO tags into an already-built document.
 *
 * Each tag is skipped when the document already has one, so this is safe to run
 * over HTML from any template, including a future one that emits its own
 * canonical. If there is no </head> to insert before — which would mean the
 * stored HTML is not a document — the input is returned untouched rather than
 * having tags stapled to the front of it.
 */
export function injectSiteSeo(html: string, options: InjectSeoOptions): string {
    const closingHead = /<\/head\s*>/i.exec(html);
    if (!closingHead) return html;

    const head = html.slice(0, closingHead.index);
    const tags: string[] = [];

    // A DOCUMENT THAT DECLARES ITS OWN CANONICAL OWNS ITS IDENTITY, and we add
    // nothing URL-shaped to it — not og:url, not the JSON-LD `url`/`@id`.
    // Injecting a second opinion is worse than injecting none: a page whose
    // canonical, og:url and structured data name three different addresses is
    // one Google resolves by ignoring all three. No template writes one today;
    // this is the rule for the one that eventually does.
    const declaresCanonical = /<link\s[^>]*rel=["']canonical["']/i.test(head);
    if (!declaresCanonical) {
        tags.push(`<link rel="canonical" href="${attr(options.canonicalUrl)}">`);
        if (!/<meta\s[^>]*property=["']og:url["']/i.test(head)) {
            tags.push(`<meta property="og:url" content="${attr(options.canonicalUrl)}">`);
        }
    }
    // Every template sets og:title/description but none sets og:type, and a
    // card without it is treated as a generic link. Safe either way — it says
    // nothing about which address the page lives at.
    if (!/<meta\s[^>]*property=["']og:type["']/i.test(head)) {
        tags.push(`<meta property="og:type" content="website">`);
    }
    if (options.jsonLd && !declaresCanonical && !/type=["']application\/ld\+json["']/i.test(html)) {
        tags.push(`<script type="application/ld+json">${options.jsonLd}</script>`);
    }

    if (!tags.length) return html;
    return `${head}${tags.join('')}${html.slice(closingHead.index)}`;
}

/**
 * robots.txt for one customer site.
 *
 * Until this existed, /robots.txt on a customer host answered with the 1.3 MB
 * homepage and a 200 — so the first thing every crawler asks got a reply it
 * could not parse.
 */
export function siteRobotsTxt(canonicalOrigin: string): string {
    return [
        'User-agent: *',
        'Allow: /',
        '',
        `Sitemap: ${canonicalOrigin}/sitemap.xml`,
        '',
    ].join('\n');
}

/**
 * sitemap.xml for one customer site: exactly one URL, because the site is one
 * page. Small, but it is what a manual "Request indexing" in Search Console
 * wants to find, and it dates the page honestly from its publish time.
 */
export function siteSitemapXml(canonicalUrl: string, lastModified?: number | null): string {
    const lastmod = lastModified ? new Date(lastModified).toISOString() : undefined;
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <url>',
        `    <loc>${attr(canonicalUrl)}</loc>`,
        ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
        '  </url>',
        '</urlset>',
        '',
    ].join('\n');
}
