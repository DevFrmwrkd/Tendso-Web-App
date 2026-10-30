import { notFound, redirect } from "next/navigation";

import { CREATOR_PAGE_EDITOR_HREF } from "@/lib/v2/creatorPortalNavigation";

import { AffiliateSectionContent } from "../_components/AffiliateSectionContent";
import { AFFILIATE_SECTIONS, affiliateSection } from "../_lib/navigation";

export default async function AffiliateSectionPage({ params }: { params: Promise<{ section: string }> }) {
    const { section } = await params;
    if (!AFFILIATE_SECTIONS.some((value) => value === section) || section === "home") notFound();
    if (section === "my-page") redirect(CREATOR_PAGE_EDITOR_HREF);
    return <AffiliateSectionContent section={affiliateSection(section)} />;
}
