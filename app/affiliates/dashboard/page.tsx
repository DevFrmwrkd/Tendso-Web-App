"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthAlert } from "@/app/auth/_components/AuthParts";
import { Button, FunnelHeader, PublicFooter, PublicPage, Status } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import { SUPPORT_EMAIL } from "@/lib/contact";

import { AffiliateAccountLoading, DifferentAccount } from "../_components/AccountState";

export default function AffiliateDashboardPage() {
    const router = useRouter();
    const { user, isLoaded, isSignedIn } = useUser();
    const { signOut } = useClerk();
    const { isAuthenticated } = useConvexAuth();
    const account = useQuery(api.creators.getByClerkId, user && isAuthenticated ? { clerkId: user.id } : "skip");
    const owner = useQuery(api.businessOwners.me, user && isAuthenticated ? {} : "skip");
    const [signingOut, setSigningOut] = useState(false);
    const [error, setError] = useState<string>();

    useEffect(() => {
        if (isLoaded && (!isSignedIn || (account === null && owner === null))) router.replace("/affiliates/join");
    }, [isLoaded, isSignedIn, account, owner, router]);

    async function handleSignOut() {
        if (signingOut) return;
        setSigningOut(true);
        setError(undefined);
        try {
            await signOut({ redirectUrl: "/affiliates" });
        } catch {
            setError("We could not sign you out. Please try again.");
            setSigningOut(false);
        }
    }

    if (!isLoaded || !isSignedIn || !isAuthenticated || account === undefined || (account === null && owner === undefined)) return <AffiliateAccountLoading />;
    if (account === null) return owner ? <DifferentAccount role="owner" /> : <AffiliateAccountLoading />;
    if (account.role !== "affiliate") return <DifferentAccount role={account.role} />;

    const suspended = account.status === "suspended";

    return (
        <PublicPage
            header={<FunnelHeader exit={{ href: "/affiliates", label: "About affiliates" }} />}
            footer={<PublicFooter />}
            mainClassName="items-center px-4 py-10 sm:px-6 sm:py-16"
        >
            <div className="flex w-full max-w-[640px] flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <p className="t-label">Affiliate dashboard</p>
                    <h1 className="t-h1">Welcome, {account.firstName || "affiliate"}.</h1>
                    <Status tone={suspended ? "bad" : "done"} word={suspended ? "Suspended" : "Active"} />
                </div>
                {error && <AuthAlert>{error}</AuthAlert>}
                <section className="t-card t-card-pad flex flex-col gap-3">
                    <h2 className="t-h2">{suspended ? "Your account is suspended" : "Your affiliate account is ready"}</h2>
                    {suspended ? (
                        <p className="t-body">Contact <a className="t-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> for help with your account.</p>
                    ) : (
                        <>
                            <p className="t-body">Your page handle is <strong>@{account.affiliateHandle}</strong>.</p>
                            <p className="t-body">Your public page, price settings, and sales dashboard are coming next. You&apos;ll be able to manage them here.</p>
                        </>
                    )}
                </section>
                <Button variant="ghost" className="self-start" onClick={handleSignOut} disabled={signingOut} aria-busy={signingOut}>
                    {signingOut ? "Signing out…" : "Sign out"}
                </Button>
            </div>
        </PublicPage>
    );
}
