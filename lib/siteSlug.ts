/**
 * The address a hosted site lives at: <slug>.sites.tendso.com
 *
 * WHY THIS IS NOT `generateProjectName`. That function (app/api/publish-website)
 * built a Cloudflare Worker NAME, where ugliness is invisible — nobody reads
 * `kel-s-meatshop` because nobody sees it. A subdomain is read aloud by the
 * owner, printed on a tarpaulin, and typed by their customers. Measured against
 * the real production submissions, the old rules produce:
 *
 *     Kel's Meatshop               -> kel-s-meatshop          (apostrophe split)
 *     Jennifer & Agie's Flowershop -> jennifer-agie-s-flowershop
 *     Lumière Candles              -> lumi-re-candles         (accent destroyed)
 *
 * and there are TWO "Lumière Candles" in production, so they would also fight
 * over one hostname.
 *
 * So: fold accents instead of deleting them, drop apostrophes instead of
 * splitting on them, refuse the names that belong to the platform, and let the
 * caller resolve collisions against what is already published.
 */

/** Hostnames under this suffix are hosted customer sites. */
export const SITES_SUFFIX = '.sites.tendso.com';

/**
 * Names a customer site may never take. Some are ours (`www`, `api`), some are
 * conventions people assume exist (`mail`, `ftp`), and taking any of them means
 * a shop called "Admin Supplies" quietly becomes admin.sites.tendso.com.
 */
export const RESERVED_SLUGS = new Set([
    'www', 'api', 'admin', 'app', 'mail', 'email', 'smtp', 'imap', 'pop', 'ftp',
    'ns', 'ns1', 'ns2', 'dns', 'mx', 'cdn', 'static', 'assets', 'img', 'images',
    'dashboard', 'login', 'signup', 'auth', 'account', 'billing', 'pay', 'checkout',
    'start', 'otr', 'sites', 'site', 'preview', 'staging', 'dev', 'test', 'demo',
    'support', 'help', 'docs', 'blog', 'status', 'about', 'contact', 'tendso',
]);

/** Longest a DNS label may be. */
const MAX_LABEL = 63;

/**
 * Business name -> the label part of the hostname.
 *
 * Returns '' when nothing usable survives (a name of pure punctuation, or
 * emoji). The caller decides what to do with that — this function will not
 * invent a name for a business.
 */
export function slugifyBusinessName(name: string | undefined | null): string {
    let s = (name || '').toLowerCase();

    // Fold accents to their base letter: é -> e, ñ -> n, ü -> u. NFD splits the
    // letter from its combining mark, then the mark is dropped. Without this,
    // "Lumière" loses the è entirely and becomes "lumi-re".
    s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');

    // Apostrophes JOIN, they do not separate. "Kel's" is one word to a reader,
    // so kels-meatshop, not kel-s-meatshop. Covers the typographic ’ as well as
    // the ASCII ', because owners type both.
    s = s.replace(/['‘’ʼ]/g, '');

    // Ampersand reads as "and" far more naturally than as a gap.
    s = s.replace(/&/g, ' and ');

    // Everything else that is not a letter or digit becomes a single hyphen.
    s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    if (s.length > MAX_LABEL) {
        // Trim at a hyphen so the name does not end mid-word.
        s = s.slice(0, MAX_LABEL);
        const lastDash = s.lastIndexOf('-');
        if (lastDash > 20) s = s.slice(0, lastDash);
        s = s.replace(/-+$/, '');
    }
    return s;
}

/** Is this label usable as a hostname on its own? */
export function isUsableSlug(slug: string): boolean {
    if (!slug) return false;
    if (slug.length > MAX_LABEL) return false;
    if (RESERVED_SLUGS.has(slug)) return false;
    // A DNS label may not start or end with a hyphen, and we allow only the
    // characters we generate.
    return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug);
}

/**
 * The final slug for a business, given the slugs already taken.
 *
 * Collisions are real: production holds two businesses both called "Lumière
 * Candles". The second gets `-2`, not a random suffix — a number is something
 * an owner can be told over the phone.
 *
 * `fallback` is used when the name yields nothing usable (or a reserved word);
 * pass the submission id so the site still gets a stable address rather than
 * failing to publish.
 */
export function resolveSiteSlug(
    businessName: string | undefined | null,
    taken: Iterable<string> = [],
    // NOT 'site': that is itself in RESERVED_SLUGS, so it failed the very check
    // it was the fallback for. Caught by the "always returns something DNS
    // accepts" test, which is exactly why that test exists.
    fallback = 'business',
): string {
    const takenSet = new Set(taken);
    let base = slugifyBusinessName(businessName);

    // A reserved or unusable base is SUFFIXED rather than replaced, so the
    // owner's name is still recognisable: "admin" -> "admin-site".
    if (!isUsableSlug(base)) {
        base = slugifyBusinessName(base ? `${base}-site` : fallback);
    }
    // Last resort, and it must be a label that passes on its own — anything
    // reaching here had a name made of punctuation or a reserved word.
    if (!isUsableSlug(base)) base = slugifyBusinessName(fallback);
    if (!isUsableSlug(base)) base = 'business';

    if (!takenSet.has(base)) return base;
    for (let n = 2; n < 1000; n++) {
        const candidate = `${base}-${n}`.slice(0, MAX_LABEL).replace(/-+$/, '');
        if (!takenSet.has(candidate)) return candidate;
    }
    // A thousand businesses with one name is not a case worth guessing at.
    return `${base}-${Date.now().toString(36)}`.slice(0, MAX_LABEL);
}

/**
 * The slug a request is for, or null when the host is not a hosted site.
 *
 * Deliberately strict: exactly ONE label in front of the suffix. A host like
 * `a.b.sites.tendso.com` is not a site we issued, and treating it as `a.b`
 * would let anyone mint lookalike addresses under a hostname that resolves.
 */
export function slugFromHost(host: string | undefined | null): string | null {
    const h = (host || '').toLowerCase().trim().split(':')[0];
    if (!h.endsWith(SITES_SUFFIX)) return null;
    const label = h.slice(0, -SITES_SUFFIX.length);
    if (!label || label.includes('.')) return null;
    return isUsableSlug(label) ? label : null;
}

/**
 * Is this hostname under the hosted-sites wildcard at all?
 *
 * Broader than slugFromHost on purpose. *.sites.tendso.com is a wildcard, so
 * EVERY name under it resolves and reaches the app — including reserved words
 * and multi-label names that are not sites we issued. Those must still be
 * answered by the hosted route (which 404s with noindex), not fall through to
 * the marketing homepage, or each one becomes another copy of it in the index.
 */
export function isSitesHost(host: string | undefined | null): boolean {
    const h = (host || '').toLowerCase().trim().split(':')[0];
    return h.endsWith(SITES_SUFFIX) && h.length > SITES_SUFFIX.length;
}

/** The public address of a hosted site. */
export function siteUrlForSlug(slug: string): string {
    return `https://${slug}${SITES_SUFFIX}`;
}

/**
 * The home page of the hosted site a URL points into, written the way that
 * site's canonical writes it ("https://<slug>.sites.tendso.com/"), or null when
 * the URL is not one of our hosted sites. For the tendso.com sitemap, which
 * lists the featured sites under the address each one declares.
 */
export function hostedSiteHome(url: string | undefined | null): string | null {
    let host: string;
    try {
        host = new URL((url || '').trim()).host;
    } catch {
        return null;
    }
    const slug = slugFromHost(host);
    return slug ? `${siteUrlForSlug(slug)}/` : null;
}

/**
 * The https origin for a site's own domain, or null when it has none.
 *
 * `customDomain` is stored inconsistently — `setCustomDomainOnWebsite` writes a
 * bare hostname, but the field is old enough that a row could hold a full URL or
 * a trailing slash. Both the publish path and the hosted route's canonical need
 * the same origin out of it, so the normalising happens once, here.
 */
export function customDomainOrigin(domain: string | undefined | null): string | null {
    const host = (domain || '')
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/\/+$/, '')
        .toLowerCase();
    return host ? `https://${host}` : null;
}

/**
 * The request header proxy.ts uses to hand the requested path to the hosted
 * route.
 *
 * Needed because the rewrite has to replace the pathname with the route's own,
 * and the route still has to tell the site itself (`/`) apart from
 * /robots.txt, /sitemap.xml and the invented paths it should refuse.
 *
 * Declared in this file rather than beside the rest of the SEO code so that
 * proxy.ts can import it without pulling anything else into the middleware
 * bundle — this module has no imports of its own, which is why proxy.ts uses
 * it already.
 */
export const SITE_PATH_HEADER = 'x-tendso-site-path';
