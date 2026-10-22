"use client";

/**
 * /v2/my-site — the shop owner edits their own site.
 *
 * Who is the owner: the same identity /my-business uses (a Clerk sign-in with a
 * businessOwners row, and the sites linked to it by websiteOwnerships). Every
 * Convex call under this page re-checks that link server-side, so the page
 * only has to pick a site; it cannot grant access.
 *
 * One site opens straight into the editor. An owner with several picks one
 * (/v2/my-site?site=<id> goes to it directly).
 */

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";

import { Button } from "@/components/v2";
import { api } from "@/convex/_generated/api";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";
import { ConvexOwnerEditor } from "@/components/v2/owner-editor/ConvexOwnerEditor";

export default function MySitePage() {
    return (
        <Suspense fallback={<Centered>Opening your site…</Centered>}>
            <MySite />
        </Suspense>
    );
}

function MySite() {
    const { isOwner, isSignedIn, loading } = useOwnerAuth();
    const router = useRouter();
    const wanted = useSearchParams().get("site");
    const sites = useQuery(api.businessOwners.getMyWebsites, isOwner ? {} : "skip");

    useEffect(() => {
        if (!loading && isSignedIn === false) router.replace("/login?redirect_url=/v2/my-site");
    }, [loading, isSignedIn, router]);

    if (loading || !isSignedIn || (isOwner && sites === undefined)) return <Centered>Opening your site…</Centered>;
    if (!isOwner || !sites || sites.length === 0) {
        return (
            <Centered>
                <p className="mb-4 max-w-[340px] text-center">We could not find a website for this email.</p>
                <Button href="/contact">Ask for help</Button>
            </Centered>
        );
    }
    const site = sites.find((s) => s.submissionId === wanted) ?? (sites.length === 1 ? sites[0] : null);
    if (!site) {
        return (
            <Centered>
                <p className="mb-4 text-[24px] font-medium">Which site?</p>
                <ul className="flex w-full max-w-[420px] flex-col gap-3 px-4">
                    {sites.map((s) => (
                        <li key={s.submissionId}>
                            <Button block size="lg" variant="ghost" href={`/v2/my-site?site=${s.submissionId}`}>{s.businessName}</Button>
                        </li>
                    ))}
                </ul>
            </Centered>
        );
    }
    return <ConvexOwnerEditor key={site.submissionId} submissionId={site.submissionId} />;
}

function Centered({ children }: { children: React.ReactNode }) {
    return <div className="flex min-h-dvh flex-col items-center justify-center bg-v2-stage px-4 text-[20px] font-medium text-v2-ink-2">{children}</div>;
}
