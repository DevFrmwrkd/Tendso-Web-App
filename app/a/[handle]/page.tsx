import type { Metadata } from "next";

import { AffiliateLanding } from "./_components/AffiliateLanding";

type PageProps = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { handle } = await params;
    return {
        title: "A website for your shop — Tendso",
        description: "Get a website built from your photos and your words. Pay once, after your website is live.",
        alternates: { canonical: `/a/${encodeURIComponent(handle)}` },
    };
}

export default async function AffiliatePage({ params }: PageProps) {
    const { handle } = await params;
    return <AffiliateLanding handle={handle} />;
}
