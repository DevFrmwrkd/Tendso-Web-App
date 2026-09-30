/**
 * lib/publish-target.ts — where a publish sends a site.
 *
 * These two decisions are worth pinning down because both failure directions are
 * silent. Return false from needsCloudflareWorker for a site that has a paid
 * domain and the domain setup fails later with a message about a missing
 * Cloudflare project. Return true too often and the account quietly refills
 * toward a 100-script ceiling that is the reason this change exists.
 */
import { needsCloudflareWorker, publishAddressFor } from '@/lib/publish-target';
import { customDomainOrigin } from '@/lib/siteSlug';

describe('needsCloudflareWorker', () => {
    it('is false for an ordinary new site — the case that used to mint a script', () => {
        expect(needsCloudflareWorker({}, {})).toBe(false);
        expect(needsCloudflareWorker(null, null)).toBe(false);
        expect(needsCloudflareWorker({ cfPagesProjectName: null, customDomain: null }, { requestedDomain: null }))
            .toBe(false);
    });

    it('is true when a Worker is still the site’s only address', () => {
        // No slug yet, so that Worker IS the site. Letting it go stale would
        // leave whoever holds the link on an old page.
        expect(needsCloudflareWorker({ cfPagesProjectName: 'deluxia-coffee' }, {})).toBe(true);
    });

    it('is FALSE once the site has a hosted address, even though the field is set', () => {
        // THE REGRESSION THIS GUARDS. cfPagesProjectName records that a Worker
        // was once deployed, not that one exists — aurora-villa and neighborhood
        // were deleted by hand. PUT /workers/scripts/{name} is create-or-update,
        // so returning true here would resurrect a deleted script on the next
        // publish or unpublish and put a second copy of the page back online.
        expect(needsCloudflareWorker({ cfPagesProjectName: 'aurora-villa', slug: 'aurora-villa' }, {}))
            .toBe(false);
        expect(needsCloudflareWorker({ cfPagesProjectName: 'neighborhood', slug: 'neighborhood' }, {}))
            .toBe(false);
    });

    it('still needs one for a custom-domain site that also has a slug', () => {
        // Ben-Joe: the Worker serves benjoetiresupply.com, so the slug does not
        // release us from maintaining it.
        expect(needsCloudflareWorker(
            { cfPagesProjectName: 'ben-joe-tire-supply', customDomain: 'benjoetiresupply.com', slug: 'ben-joe-tire-supply' },
            {},
        )).toBe(true);
        expect(needsCloudflareWorker(
            { cfPagesProjectName: 'x', slug: 'x' },
            { requestedDomain: 'benjoetiresupply.com' },
        )).toBe(true);
    });

    it('is true when a domain is already live on it', () => {
        // The Worker IS what serves benjoetiresupply.com.
        expect(needsCloudflareWorker({ customDomain: 'benjoetiresupply.com' }, {})).toBe(true);
    });

    it('is true when the owner has asked for a domain but it is not set up yet', () => {
        // convex/domains.ts runs after payment and needs a script to attach the
        // domain to. requestedDomain is recorded at intake, before publish.
        expect(needsCloudflareWorker({}, { requestedDomain: 'auroravilla.ph' })).toBe(true);
    });

    it('ignores an empty string, which is not a request for a domain', () => {
        expect(needsCloudflareWorker({ cfPagesProjectName: '' }, { requestedDomain: '' })).toBe(false);
    });

    it('never needs one for a site that has a slug and nothing else', () => {
        expect(needsCloudflareWorker({ slug: 'kels-meatshop' }, {})).toBe(false);
    });
});

describe('publishAddressFor', () => {
    it('is the hosted address when there is no custom domain', () => {
        expect(publishAddressFor({}, 'aurora-villa'))
            .toBe('https://aurora-villa.sites.tendso.com');
    });

    it('never reports a workers.dev address', () => {
        // The bug this replaces: the owner email, the admin UI and
        // submission.websiteUrl all pointed at a hostname nobody would print.
        expect(publishAddressFor({ cfPagesProjectName: 'aurora-villa' }, 'aurora-villa'))
            .not.toContain('workers.dev');
    });

    it('prefers a live custom domain, which is what the owner paid for', () => {
        expect(publishAddressFor({ customDomain: 'benjoetiresupply.com' }, 'ben-joe-tire-supply'))
            .toBe('https://benjoetiresupply.com');
    });
});

describe('customDomainOrigin', () => {
    it('normalises however the field happens to be stored', () => {
        expect(customDomainOrigin('benjoetiresupply.com')).toBe('https://benjoetiresupply.com');
        expect(customDomainOrigin('https://benjoetiresupply.com/')).toBe('https://benjoetiresupply.com');
        expect(customDomainOrigin('http://BenJoeTireSupply.com')).toBe('https://benjoetiresupply.com');
        expect(customDomainOrigin('  benjoetiresupply.com  ')).toBe('https://benjoetiresupply.com');
    });

    it('is null for no domain, so callers can fall through to the hosted address', () => {
        expect(customDomainOrigin(undefined)).toBeNull();
        expect(customDomainOrigin(null)).toBeNull();
        expect(customDomainOrigin('')).toBeNull();
        expect(customDomainOrigin('   ')).toBeNull();
        expect(customDomainOrigin('https://')).toBeNull();
    });
});
