import type { Metadata } from "next";
import { CreatorsRoot } from "@/components/v2/creators/CreatorsRoot";
import { ShopLinkPage } from "@/components/v2/creators/ShopLinkPage";

type PageProps = { params: Promise<{ handle: string }> };
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { handle } = await params;
    return { title: "A website for your shop — Tendso", description: "A website for your shop, built from your photos and your story. Preview it, request changes, and pay once to publish.",
        alternates: { canonical: `/a/${encodeURIComponent(handle)}` }, robots: { index: true, follow: true } };
}
export default async function AffiliatePage({ params }: PageProps) {
    const { handle } = await params;
    return <CreatorsRoot solo><ShopLinkPage handle={handle} /></CreatorsRoot>;
}
