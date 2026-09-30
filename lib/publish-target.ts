/**
 * Where a publish sends a site, and whether it still needs a Cloudflare Worker.
 *
 * Both answers used to be implicit in app/api/publish-website/route.ts, which is
 * the wrong place for a policy this consequential: getting `needsCloudflareWorker`
 * wrong in one direction silently breaks the paid custom-domain tier, and in the
 * other direction quietly resumes filling a Cloudflare account that has a hard
 * 100-script ceiling. They live here so they can be stated once and tested.
 */
import { customDomainOrigin, siteUrlForSlug } from './siteSlug';

/** The fields of a generatedWebsites row these decisions read. */
export interface PublishTargetSite {
    /** The Worker script name, when this site has ever had one. */
    cfPagesProjectName?: string | null;
    /** Set once a purchased domain is attached. */
    customDomain?: string | null;
    /** Assigned at first publish. Present means the site has a hosted address. */
    slug?: string | null;
}

/** The fields of a submissions row these decisions read. */
export interface PublishTargetSubmission {
    /** The domain the owner asked for at intake, before the site is published. */
    requestedDomain?: string | null;
}

/**
 * Does publishing this site still have to deploy a Cloudflare Worker?
 *
 * Publishing no longer deploys one in the ordinary case — app/hosted/[slug] serves
 * any number of sites from the stored HTML, which is the point: one Worker per
 * business could never scale past Cloudflare's per-account script cap.
 *
 * Three reasons remain, and every one of them is about custom domains:
 *
 *  1. `customDomain` — a domain is live, and the Worker IS what serves it.
 *     Skipping the deploy would freeze a paying customer's site at whatever it
 *     last contained.
 *  2. `requestedDomain` — the owner has bought or asked for a domain.
 *     convex/domains.ts runs after payment and attaches the domain to a Worker
 *     BY NAME (addCustomDomainToWorker), failing the whole setup with "No
 *     Cloudflare Pages project found" when there is no script. The request is
 *     recorded at intake, before publish, so this catches those customers in
 *     time.
 *  3. `cfPagesProjectName` AND NO `slug` — the site has a Worker and that Worker
 *     is still its only address, so it has to keep being refreshed or whoever
 *     holds the link gets a stale page.
 *
 * THE `slug` QUALIFIER ON (3) IS LOAD-BEARING, and it is the whole reason this
 * function exists rather than a one-line check. `cfPagesProjectName` is a record
 * that a Worker was once deployed; it is NOT evidence that one exists now. Two
 * legacy Workers have already been deleted by hand, and PUT
 * /workers/scripts/{name} is create-or-update — so treating the field alone as
 * "needs a Worker" would RESURRECT a deleted script on the next publish or
 * unpublish, serving a second copy of a page that already has a canonical
 * address. Once a site has a hosted address, its Worker is either a redirect or
 * gone, and either way we stop touching it.
 *
 * KNOWN GAP: an owner who buys a domain AFTER their site was published without
 * one has no Worker, so the domain setup will fail until the site is republished
 * (which this function then sends down the Worker path, because `requestedDomain`
 * is set by then). Republishing is the workaround; moving custom domains onto
 * Vercel is the real fix.
 */
export function needsCloudflareWorker(
    site: PublishTargetSite | null | undefined,
    submission: PublishTargetSubmission | null | undefined,
): boolean {
    if (site?.customDomain || submission?.requestedDomain) return true;
    return Boolean(site?.cfPagesProjectName && !site?.slug);
}

/**
 * The one address a published site is advertised at — what the admin UI shows,
 * what `submission.websiteUrl` records, and what the owner's email links to.
 *
 * A live custom domain wins, because it is what the owner paid for and what goes
 * on their signage; convex/domains.ts force-sets `publishedUrl` to the same thing
 * when the certificate is issued. Otherwise it is the hosted address.
 *
 * NEVER the workers.dev URL. That was the reported address until this change, and
 * it is why owner emails, the admin UI and the submission row all pointed at a
 * hostname nobody would ever print.
 */
export function publishAddressFor(
    site: PublishTargetSite | null | undefined,
    slug: string,
): string {
    return customDomainOrigin(site?.customDomain) ?? siteUrlForSlug(slug);
}
