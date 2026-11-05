"use client";

/** Ownership-gated business workspace, using the same phase/balance summary as mobile. */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";

import { OwnerPageHeader, OwnerShell } from "@/components/shells/OwnerShell";
import { api } from "@/convex/_generated/api";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";

import { NoSite, SiteList, SiteOverviewLoading } from "./_components/OwnerHome";
import { OwnerWebsiteOverview } from './_components/OwnerPrivateWebsite';

export default function MyBusinessDashboard() {
    const { isOwner, isSignedIn, loading, error } = useOwnerAuth();
    const router = useRouter();
    const workspace = useQuery(api.owners.me, isOwner ? {} : "skip");
    const websites = workspace?.sites;

    useEffect(() => {
        if (!loading && isSignedIn === false) router.replace('/my-business/sign-in');
    }, [loading, isSignedIn, router]);

    // Signed out means the redirect above is on its way (the proxy normally
    // gets there first), so it keeps the loading shape instead of flashing
    // "No website here yet".
    const waiting = loading || !isSignedIn || (isOwner && websites === undefined);

    return (
        <OwnerShell>
            <OwnerPageHeader title="Your businesses" subtitle="Check your websites, pick up where you left off and see what needs you next." />
            {error ? <p role="alert">{error}</p> : waiting ? (
                <SiteOverviewLoading />
            ) : !isOwner || !websites || websites.length === 0 ? (
                // Signed in but no claimed sites yet → point at the one channel that works.
                <NoSite />
            ) : websites.length === 1 ? (
                <OwnerWebsiteOverview site={websites[0]} />
            ) : (
                <SiteList sites={websites} />
            )}
        </OwnerShell>
    );
}
