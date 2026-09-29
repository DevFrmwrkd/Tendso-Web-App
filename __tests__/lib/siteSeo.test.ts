/**
 * lib/site-seo.ts — the head injected into a published customer site.
 *
 * The things worth pinning down here are the ones that would be invisible if
 * they broke: a canonical that silently duplicates one the template already
 * had, JSON-LD that closes its own <script> because an owner typed a `<` into
 * their address, and structured data that claims facts the page does not show.
 */
import {
    buildLocalBusinessJsonLd,
    injectSiteSeo,
    readHeadFacts,
    schemaTypeFor,
    serializeJsonLd,
    siteRobotsTxt,
    siteSitemapXml,
} from '@/lib/site-seo';

const CANONICAL = 'https://aurora-villa.sites.tendso.com/';

/** A minimal document shaped like the ones the templates actually emit. */
function doc(head: string, body = '<h1>Hi</h1>'): string {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;
}

describe('schemaTypeFor', () => {
    it('prefers the business type the owner chose', () => {
        expect(schemaTypeFor('Coffee Shop', 'generic:A')).toBe('CafeOrCoffeeShop');
        expect(schemaTypeFor('barbershop', null)).toBe('HairSalon');
    });

    it('falls back to the template family when the type is unclassifiable', () => {
        // 19 of 30 real intake submissions answer "Other", and a villa is one
        // of them — the hospitality family is the only thing that knows.
        expect(schemaTypeFor('Other', 'hospitality:BJ')).toBe('LodgingBusiness');
        expect(schemaTypeFor('', 'florist:BR')).toBe('Florist');
    });

    it('is a plain LocalBusiness when nothing identifies the trade', () => {
        expect(schemaTypeFor('Other', 'layouts:AV')).toBe('LocalBusiness');
        expect(schemaTypeFor(null, null)).toBe('LocalBusiness');
    });
});

describe('readHeadFacts', () => {
    it('reads the description and og:image the template already wrote', () => {
        const facts = readHeadFacts(doc(
            '<meta name="description" content="A private retreat in Iloilo City">' +
            '<meta property="og:image" content="https://cdn.example/hero.jpg">',
        ));
        expect(facts.description).toBe('A private retreat in Iloilo City');
        expect(facts.image).toBe('https://cdn.example/hero.jpg');
    });

    it('decodes entities so the JSON-LD does not carry markup escapes', () => {
        const facts = readHeadFacts(doc('<meta name="description" content="Jen &amp; Agie&#39;s">'));
        expect(facts.description).toBe("Jen & Agie's");
    });

    it('falls back to og:description, and reports nothing when there is nothing', () => {
        expect(readHeadFacts(doc('<meta property="og:description" content="Fallback">')).description)
            .toBe('Fallback');
        expect(readHeadFacts(doc('')).description).toBeUndefined();
    });
});

describe('buildLocalBusinessJsonLd', () => {
    it('describes a business with everything it has', () => {
        const ld = buildLocalBusinessJsonLd({
            canonicalUrl: CANONICAL,
            businessName: 'Aurora Villa',
            businessType: 'Other',
            heroStyle: 'hospitality:BJ',
            description: 'A private retreat',
            image: 'https://cdn.example/hero.jpg',
            telephone: '+63 962 285 8067',
            address: '12 Sampaguita St, Jaro',
            city: 'Iloilo City',
            region: 'Iloilo',
            postalCode: '5000',
            latitude: 10.72,
            longitude: 122.56,
            mapUrl: 'https://maps.google.com/?q=aurora',
            socialUrls: ['https://facebook.com/auroravilla'],
        })!;

        expect(ld['@type']).toBe('LodgingBusiness');
        expect(ld['@id']).toBe(`${CANONICAL}#business`);
        expect(ld.url).toBe(CANONICAL);
        expect(ld.telephone).toBe('+63 962 285 8067');
        expect(ld.address).toEqual({
            '@type': 'PostalAddress',
            streetAddress: '12 Sampaguita St, Jaro',
            addressLocality: 'Iloilo City',
            addressRegion: 'Iloilo',
            postalCode: '5000',
            addressCountry: 'PH',
        });
        expect(ld.geo).toEqual({ '@type': 'GeoCoordinates', latitude: 10.72, longitude: 122.56 });
        expect(ld.sameAs).toEqual(['https://facebook.com/auroravilla']);
    });

    it('never repeats a place the typed address already names', () => {
        const ld = buildLocalBusinessJsonLd({
            canonicalUrl: CANONICAL,
            businessName: 'Aurora Villa',
            address: '12 Sampaguita St, Jaro, Iloilo City, 5000',
            city: 'Iloilo City',
            postalCode: '5000',
        })!;
        const address = ld.address as Record<string, unknown>;
        expect(address.addressLocality).toBeUndefined();
        expect(address.postalCode).toBeUndefined();
        expect(address.streetAddress).toBe('12 Sampaguita St, Jaro, Iloilo City, 5000');
    });

    it('drops province and postal code when there is no address to qualify', () => {
        const ld = buildLocalBusinessJsonLd({
            canonicalUrl: CANONICAL,
            businessName: 'Aurora Villa',
            city: 'Iloilo City',
            region: 'Iloilo',
            postalCode: '5000',
        })!;
        expect(ld.address).toEqual({
            '@type': 'PostalAddress',
            addressLocality: 'Iloilo City',
            addressCountry: 'PH',
        });
    });

    it('omits every field the page has no value for, rather than emptying it', () => {
        const ld = buildLocalBusinessJsonLd({ canonicalUrl: CANONICAL, businessName: 'Kel Meatshop' })!;
        expect(Object.keys(ld).sort()).toEqual(['@context', '@id', '@type', 'name', 'url']);
    });

    it('never claims opening hours — the only hours we hold are free text', () => {
        const ld = buildLocalBusinessJsonLd({ canonicalUrl: CANONICAL, businessName: 'Kel Meatshop' })!;
        expect(ld.openingHours).toBeUndefined();
        expect(ld.openingHoursSpecification).toBeUndefined();
    });

    it('refuses to build anything for a nameless business', () => {
        expect(buildLocalBusinessJsonLd({ canonicalUrl: CANONICAL, businessName: '   ' })).toBeNull();
    });

    it('keeps only real URLs in sameAs, so a typed handle is not published as a link', () => {
        const ld = buildLocalBusinessJsonLd({
            canonicalUrl: CANONICAL,
            businessName: 'Kel Meatshop',
            socialUrls: ['@kelmeatshop', 'https://facebook.com/kel'],
        })!;
        expect(ld.sameAs).toEqual(['https://facebook.com/kel']);
    });
});

describe('serializeJsonLd', () => {
    it('escapes < so a typed angle bracket cannot close the script element', () => {
        const json = serializeJsonLd({ name: 'A </script><img src=x> B' });
        expect(json).not.toContain('</script');
        expect(JSON.parse(json).name).toBe('A </script><img src=x> B');
    });
});

describe('injectSiteSeo', () => {
    it('adds canonical, og:url, og:type and the JSON-LD block', () => {
        const out = injectSiteSeo(doc('<title>Aurora Villa</title>'), {
            canonicalUrl: CANONICAL,
            jsonLd: '{"@type":"LodgingBusiness"}',
        });
        expect(out).toContain(`<link rel="canonical" href="${CANONICAL}">`);
        expect(out).toContain(`<meta property="og:url" content="${CANONICAL}">`);
        expect(out).toContain('<meta property="og:type" content="website">');
        expect(out).toContain('<script type="application/ld+json">{"@type":"LodgingBusiness"}</script>');
        // Inserted inside the head, not after it.
        expect(out.indexOf('rel="canonical"')).toBeLessThan(out.indexOf('</head>'));
    });

    it('adds no second opinion about the address when the template states one', () => {
        const out = injectSiteSeo(
            doc('<link rel="canonical" href="https://benjoetiresupply.com/">'),
            { canonicalUrl: CANONICAL, jsonLd: '{"@type":"AutoRepair"}' },
        );
        expect(out.match(/rel="canonical"/g)).toHaveLength(1);
        expect(out).toContain('https://benjoetiresupply.com/');
        // Not the canonical, not og:url, and not structured data naming it.
        expect(out).not.toContain(CANONICAL);
        expect(out).not.toContain('application/ld+json');
        // og:type says nothing about the address, so it is still added.
        expect(out).toContain('<meta property="og:type" content="website">');
    });

    it('leaves an og:type the template already chose alone', () => {
        const out = injectSiteSeo(doc('<meta property="og:type" content="article">'), {
            canonicalUrl: CANONICAL,
        });
        expect(out.match(/property="og:type"/g)).toHaveLength(1);
        expect(out).toContain('content="article"');
    });

    it('does not add a second JSON-LD block when the document already has one', () => {
        const out = injectSiteSeo(
            doc('<script type="application/ld+json">{"@type":"Restaurant"}</script>'),
            { canonicalUrl: CANONICAL, jsonLd: '{"@type":"LodgingBusiness"}' },
        );
        expect(out.match(/application\/ld\+json/g)).toHaveLength(1);
    });

    it('escapes the canonical it writes into the attribute', () => {
        const out = injectSiteSeo(doc(''), { canonicalUrl: 'https://x.sites.tendso.com/?a=1&b=2' });
        expect(out).toContain('href="https://x.sites.tendso.com/?a=1&amp;b=2"');
    });

    it('returns the input untouched when there is no head to inject into', () => {
        const notADocument = '<h1>whatever this row holds</h1>';
        expect(injectSiteSeo(notADocument, { canonicalUrl: CANONICAL })).toBe(notADocument);
    });
});

describe('crawler files', () => {
    it('points robots.txt at the site’s own sitemap', () => {
        const txt = siteRobotsTxt('https://aurora-villa.sites.tendso.com');
        expect(txt).toContain('User-agent: *');
        expect(txt).toContain('Allow: /');
        expect(txt).toContain('Sitemap: https://aurora-villa.sites.tendso.com/sitemap.xml');
    });

    it('lists the one page a site has, dated from its publish', () => {
        const xml = siteSitemapXml(CANONICAL, Date.parse('2026-09-28T02:30:00.000Z'));
        expect(xml).toContain(`<loc>${CANONICAL}</loc>`);
        expect(xml).toContain('<lastmod>2026-09-28T02:30:00.000Z</lastmod>');
        expect(xml.match(/<url>/g)).toHaveLength(1);
    });

    it('omits lastmod rather than inventing one', () => {
        expect(siteSitemapXml(CANONICAL, null)).not.toContain('lastmod');
    });
});
