import { notFound, redirect } from "next/navigation";
import { CREATOR_ACCOUNT_HREF, CREATOR_PAGE_EDITOR_HREF, CREATOR_PORTAL_HREF, CREATOR_PAYOUTS_HREF } from "@/lib/v2/creatorPortalNavigation";
import type { PageSearchParams } from "@/components/landing/legacyRedirect";

function withQuery(path: string, params: Record<string, string | string[] | undefined>) {
    const target = new URL(path, "https://portal.invalid");
    for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) value.forEach(item => target.searchParams.append(key, item));
        else if (value !== undefined) target.searchParams.append(key, value);
    }
    return target.pathname + target.search + target.hash;
}

/** Every entry point opens the redesigned creator portal. */
export default async function AffiliateSectionPage({ params, searchParams = Promise.resolve({}) }: { params: Promise<{ section: string }>; searchParams?: PageSearchParams }) {
    const { section } = await params;
    const destinations: Record<string, string> = {
        home: CREATOR_PORTAL_HREF,
        wallet: CREATOR_PAYOUTS_HREF,
        payouts: CREATOR_PAYOUTS_HREF,
        "my-page": CREATOR_PAGE_EDITOR_HREF,
        account: CREATOR_ACCOUNT_HREF,
        links: `${CREATOR_PORTAL_HREF}#pt-links`,
        agents: `${CREATOR_PORTAL_HREF}#pt-agents`,
        referrals: `${CREATOR_PORTAL_HREF}#pt-agents`,
        shops: `${CREATOR_PORTAL_HREF}#pt-shops`,
        sales: `${CREATOR_PORTAL_HREF}#pt-shops`,
    };
    if (Object.hasOwn(destinations, section)) redirect(withQuery(destinations[section], await searchParams));
    notFound();
}
