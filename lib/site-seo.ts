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
import { formatPhoneDisplay } from './phone';

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
    // Furniture makers, cabinetry shops and joiners. schema.org has no
    // Carpenter type; FurnitureStore (LocalBusiness > Store) is the closest
    // one that describes what these businesses sell.
    woodworks: 'FurnitureStore',
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
    title?: string;
    description?: string;
    image?: string;
}

/**
 * Read the title, description and og:image back out of the document.
 *
 * Deliberately taken from the HTML rather than from Convex: all three are
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
        title: meta(/<title[^>]*>([\s\S]*?)<\/title>/i)?.replace(/\s+/g, ' ').trim() || undefined,
        description:
            meta(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) ??
            meta(/<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i),
        image: meta(/<meta\s+property=["']og:image["']\s+content=["']([^"']*)["']/i),
    };
}

/**
 * A photograph of the business, for the link preview.
 *
 * WHY THIS IS NEEDED AT ALL. Every template writes og:image behind a guard:
 *
 *     {(layout.ogImage || layout.favicon) && <meta property="og:image" ...>}
 *
 * and the admin editor has exactly one control that can fill either — "Set
 * favicon". There is no og:image slot at all. So a site published without that
 * one upload carries NO og:image, NO og:title and NO og:description, and every
 * share of its link — Slack, Messenger, Viber, iMessage — renders an empty grey
 * box. That is not hypothetical: it is what the first two sites published
 * through the hosted path look like in Slack right now.
 *
 * A favicon would be the wrong fix even when present. It is a small square
 * logo, and a social card wants roughly 1200x630. The site's hero photo is
 * both available and correct.
 *
 * FOUND THROUGH THE EDITOR CONTRACT, which is the one thing every template
 * shares: the hero carries `data-image-field="hero.image"`. Measured across
 * four live sites, that attribute sits on four different shapes —
 *
 *   <img data-image-field="hero.image" src="…">                    florist BS
 *   <div data-image-field="hero.image" style="background-image:url(…)">
 *   <div class="well" data-image-field="hero.image"><img src="…">  woodworks BY
 *   <div data-image-field="hero.image">   (no image assigned)
 *
 * — so rather than guess at the shape, this takes the first absolute image URL
 * within a bounded window after the attribute. The window is why the last shape
 * degrades gracefully: it finds the next section's photo instead, which is
 * still a real photograph of the business, and that is also exactly what the
 * document-order fallback below would have returned.
 *
 * data: URIs are skipped throughout — the templates use inline SVG noise
 * textures as backgrounds, and one of those as a link preview would be worse
 * than none.
 */
export function readHeroImage(html: string): string | null {
    const heroAt = html.search(/data-image-field=["']hero\.image\d*["']/i);
    if (heroAt >= 0) {
        const tagStart = html.lastIndexOf('<', heroAt);
        const found = firstAbsoluteImageUrl(
            html.slice(tagStart >= 0 ? tagStart : heroAt, heroAt + HERO_WINDOW),
        );
        if (found) return found;
    }
    // No hero attribute, or nothing image-shaped near it. Any photograph the
    // page shows is a better card than an empty grey box.
    return firstAbsoluteImageUrl(html);
}

/**
 * How far past the hero marker to look. Generous enough to clear the attribute
 * salad Astro emits (data-astro-cid-*, loading, fetchpriority, decoding) and to
 * reach an <img> nested one level in, short enough that it is still the hero's
 * own neighbourhood.
 */
const HERO_WINDOW = 1000;

/** The first http(s) image URL in a fragment, from an <img src> or a CSS background. */
function firstAbsoluteImageUrl(fragment: string): string | null {
    // `[^>]*` and not `[^>]+`: the latter required at least one attribute before
    // `src`, so a bare `<img src="…">` — which is how three of the four template
    // shapes write it — matched nothing at all.
    const pattern = /(?:<img[^>]*\ssrc=["'](https?:\/\/[^"']+)["']|background-image:\s*url\(\s*["']?(https?:\/\/[^"')]+))/i;
    const m = pattern.exec(fragment);
    const url = m?.[1] || m?.[2];
    return url ? decodeEntities(url.trim()) : null;
}

/**
 * The coordinates the page's own map is centred on, when it has one.
 *
 * WHY THIS IS SCRAPED OUT OF THE MARKUP rather than read from the row. The build
 * resolves coordinates in `transformToAstroData()` — admin-typed, then
 * `submission.coordinates`, then a Nominatim lookup of the typed address — and
 * writes them into the site-data.json it builds from. It never writes them back
 * to `extractedContent.location`. So a published page can show a correctly
 * placed map while the Convex row holds no coordinates at all: measured on
 * Aurora Villa, whose live page centres on 10.74088, 122.563293 and whose row
 * returns null for both.
 *
 * The templates emit the pair through Astro's `define:vars`, which serialises
 * them as two adjacent `const` declarations in the Leaflet boot script. Matching
 * them as a PAIR, in that order, and only as bare numbers is what keeps this
 * from picking up some other `lat` in some other script: a template with no
 * coordinates emits `const lat = null;`, which does not match.
 *
 * The root cause is worth fixing separately — the build should persist what it
 * resolved — but that would only help a site after somebody republished it,
 * and this helps every site already live.
 */
export function readMapCoords(html: string): { latitude: number; longitude: number } | null {
    const m = /\bconst\s+lat\s*=\s*(-?\d+(?:\.\d+)?)\s*;\s*\r?\n\s*const\s+lng\s*=\s*(-?\d+(?:\.\d+)?)\s*;/.exec(html);
    if (!m) return null;
    const latitude = Number(m[1]);
    const longitude = Number(m[2]);
    // A page can carry a nonsense pair as easily as a good one; refuse anything
    // outside the only range a coordinate can occupy. `0, 0` is Null Island —
    // the shape a failed geocode takes, and never a Philippine business.
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
    if (latitude === 0 && longitude === 0) return null;
    return { latitude, longitude };
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
    /**
     * The phone as the draft holds it, raw. Normalised here with the SAME
     * function the builder uses for the page, because the builder formats at
     * build time and never writes the formatted value back — so the draft still
     * holds what the owner typed. See lib/phone.ts.
     */
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

    const telephone = formatPhoneDisplay(input.telephone);
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
        // formatPhoneDisplay, not the raw value: `9622858067` in structured data
        // is a number Google cannot resolve to a country, and it contradicts the
        // `+63 962 285 8067` the same page prints.
        ...(telephone ? { telephone } : {}),
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
    /**
     * The link-preview card, filled in only where the template left it out.
     * See readHeroImage for why that is the common case rather than the rare
     * one.
     */
    social?: {
        title?: string;
        description?: string;
        /** Absolute URL of a photograph of the business. */
        image?: string | null;
    };
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
    // og:type says nothing about which address the page lives at, so it is safe
    // to add either way. No template sets one, and a card without it is treated
    // as a generic link.
    if (!/<meta\s[^>]*property=["']og:type["']/i.test(head)) {
        tags.push(`<meta property="og:type" content="website">`);
    }

    // ── The link-preview card ─────────────────────────────────────────────
    //
    // Every one of these is written by the templates ONLY when somebody
    // uploaded a favicon, because they sit behind `{(ogImage || favicon) && …}`
    // and the editor has no og:image control at all. Skip that single upload —
    // which is the normal case — and the page ships with none of them, so every
    // share of the link renders an empty grey box with a scraped title.
    //
    // Each is filled in only where it is missing, so a site that DOES have a
    // favicon keeps exactly the card it has today.
    const social = options.social;
    if (social?.title && !/<meta\s[^>]*property=["']og:title["']/i.test(head)) {
        tags.push(`<meta property="og:title" content="${attr(social.title)}">`);
    }
    if (social?.description && !/<meta\s[^>]*property=["']og:description["']/i.test(head)) {
        tags.push(`<meta property="og:description" content="${attr(social.description)}">`);
    }
    if (social?.image && !/<meta\s[^>]*property=["']og:image["']/i.test(head)) {
        tags.push(`<meta property="og:image" content="${attr(social.image)}">`);
        // summary_large_image, because the image is a photograph of the
        // business rather than a logo. Paired with the image and gated on the
        // same condition: a large-image card with no image is a worse result
        // than the small card it replaces.
        if (!/<meta\s[^>]*name=["']twitter:card["']/i.test(head)) {
            tags.push(`<meta name="twitter:card" content="summary_large_image">`);
        }
        if (!/<meta\s[^>]*name=["']twitter:image["']/i.test(head)) {
            tags.push(`<meta name="twitter:image" content="${attr(social.image)}">`);
        }
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
