import { notFound } from "next/navigation";

import { AffiliateSectionContent } from "../_components/AffiliateSectionContent";
import { AFFILIATE_SECTIONS, affiliateSection } from "../_lib/navigation";

export default async function AffiliateSectionPage({ params }: { params: Promise<{ section: string }> }) {
    const { section } = await params;
    if (!AFFILIATE_SECTIONS.some((value) => value === section) || section === "home") notFound();
    return <AffiliateSectionContent section={affiliateSection(section)} />;
}
