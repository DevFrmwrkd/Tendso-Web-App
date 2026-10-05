"use client";

/**
 * Business Owner Portal — My website (Round 1, board OwnerHome). Shows the
 * websites the signed-in owner has claimed. Owners are a separate audience from
 * creators; this whole route group is gated by Clerk + a businessOwners row.
 *
 * READ-ONLY BY DESIGN. Owners do not edit their own site here: edits are
 * REQUESTED via /contact and Tendso makes the change. There is no self-serve
 * owner editor, so this route must never imply one — see the note at the top of
 * app/my-business/[submissionId]/page.tsx for why the old editor was removed.
 *
 * One site (the usual case) gets the board's full card here; an owner with
 * several gets a row per site, each opening /my-business/[submissionId].
 *
 * See docs/changes/OWNER-PORTAL-PRICING-PLAN.md Phase 1.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";

import { PageHeader } from "@/components/r1";
import { OwnerShell } from "@/components/shells/OwnerShell";
import { api } from "@/convex/_generated/api";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";

import { NoSite, SiteList, SiteOverview, SiteOverviewLoading } from "./_components/OwnerHome";

export default function MyBusinessDashboard() {
    const { isOwner, isSignedIn, loading } = useOwnerAuth();
    const router = useRouter();
    const websites = useQuery(api.businessOwners.getMyWebsites, isOwner ? {} : "skip");

    useEffect(() => {
        if (!loading && isSignedIn === false) router.replace("/login");
    }, [loading, isSignedIn, router]);

    // Signed out means the redirect above is on its way (the proxy normally
    // gets there first), so it keeps the loading shape instead of flashing
    // "No website here yet".
    const waiting = loading || !isSignedIn || (isOwner && websites === undefined);

    return (
        <OwnerShell>
            <PageHeader title="My website" sub="Is my website live, and what do I owe?" />
            {waiting ? (
                <SiteOverviewLoading />
            ) : !isOwner || !websites || websites.length === 0 ? (
                // Signed in but no claimed sites yet → point at the one channel that works.
                <NoSite />
            ) : websites.length === 1 ? (
                <SiteOverview site={websites[0]} />
            ) : (
                <SiteList sites={websites} />
            )}
        </OwnerShell>
    );
}
