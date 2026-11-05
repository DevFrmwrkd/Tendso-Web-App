"use client";

/** Private preview, payment and change requests for a business in the owner's verified list. */

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";

import { OwnerPageHeader, OwnerShell } from "@/components/shells/OwnerShell";
import { api } from "@/convex/_generated/api";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";

import { SiteNotAvailable, SiteOverviewLoading } from "../_components/OwnerHome";
import { OwnerWebsiteOverview } from '../_components/OwnerPrivateWebsite';

export default function OwnerWebsitePage() {
    const params = useParams();
    const submissionId = params.submissionId as string;
    const router = useRouter();
    const { isOwner, isSignedIn, loading, error } = useOwnerAuth();

    const workspace = useQuery(api.owners.me, isOwner ? {} : "skip");
    const websites = workspace?.sites;

    useEffect(() => {
        if (!loading && isSignedIn === false) router.replace(`/my-business/sign-in?returnTo=${encodeURIComponent(`/my-business/${submissionId}`)}`);
    }, [loading, isSignedIn, router, submissionId]);

    // Signed out: the redirect above is on its way, so keep the loading shape.
    const waiting = loading || !isSignedIn || (isOwner && websites === undefined);
    const site = websites?.find((w) => w.submissionId === submissionId);

    return (
        <OwnerShell>
            <OwnerPageHeader title={site?.businessName || "Your business"} subtitle="Your website preview, payments and updates, together." back />
            {error ? <p role="alert">{error}</p> : waiting ? (
                <SiteOverviewLoading />
            ) : site ? (
                <OwnerWebsiteOverview site={site} />
            ) : (
                // Not in the owner's list → not owned, or nothing built yet.
                <SiteNotAvailable />
            )}
        </OwnerShell>
    );
}
