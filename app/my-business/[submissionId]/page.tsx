"use client";

/**
 * Owner site detail — READ-ONLY, ownership-gated (Round 1, board OwnerHome:
 * the same card /my-business shows for a single site; the owner sidebar's
 * Payment item opens the site that is due here).
 *
 * This page used to be a content editor. It was removed, not hidden, because it
 * could not do what it said: updateMyWebsiteContent patches the `websiteContent`
 * table, while the builder assembles pages from `generatedWebsites.extractedContent`
 * (app/api/generate-website/route.ts) and the live site is a Cloudflare Worker with
 * its HTML inlined at publish time. So an owner save changed nothing a visitor
 * could see — and worse, the next admin regenerate upserts `websiteContent` from
 * the freshly built content (generate-website/route.ts ~:916), silently discarding
 * the owner's edit even in the database. A form that reports "Saved" over that is
 * a lie a flag would only postpone, so the form is gone.
 *
 * Policy: edits are REQUESTED, not self-served. Free for the first year, via
 * /contact, and Tendso makes the change. Anything shown here must be something we
 * actually know: name, status, live URL, lead count — all from getMyWebsites,
 * which derives from websiteOwnerships, so a guessed submissionId simply isn't in
 * the list.
 */

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";

import { PageHeader } from "@/components/r1";
import { OwnerShell } from "@/components/shells/OwnerShell";
import { api } from "@/convex/_generated/api";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";

import { SiteNotAvailable, SiteOverview, SiteOverviewLoading } from "../_components/OwnerHome";

export default function OwnerWebsitePage() {
    const params = useParams();
    const submissionId = params.submissionId as string;
    const router = useRouter();
    const { isOwner, isSignedIn, loading } = useOwnerAuth();

    const websites = useQuery(api.businessOwners.getMyWebsites, isOwner ? {} : "skip");

    useEffect(() => {
        if (!loading && isSignedIn === false) router.replace("/login");
    }, [loading, isSignedIn, router]);

    // Signed out: the redirect above is on its way, so keep the loading shape.
    const waiting = loading || !isSignedIn || (isOwner && websites === undefined);
    const site = websites?.find((w) => w.submissionId === submissionId);

    return (
        <OwnerShell>
            <PageHeader title="My website" sub="Is my website live, and what do I owe?" />
            {waiting ? (
                <SiteOverviewLoading />
            ) : site ? (
                <SiteOverview site={site} />
            ) : (
                // Not in the owner's list → not owned, or nothing built yet.
                <SiteNotAvailable />
            )}
        </OwnerShell>
    );
}
