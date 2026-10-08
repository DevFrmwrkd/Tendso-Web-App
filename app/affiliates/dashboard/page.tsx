"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthAlert } from "@/app/auth/_components/AuthParts";
import { Button, FunnelHeader, PublicFooter, PublicPage } from "@/components/r1";
import { api } from "@/convex/_generated/api";

import { AffiliateAccountLoading, DifferentAccount } from "../_components/AccountState";
import { DashboardContent } from "./_components/Dashboard";

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

    return (
        <PublicPage
            header={<FunnelHeader exit={{ href: "/affiliates", label: "About affiliates" }} />}
            footer={<PublicFooter />}
            mainClassName="items-center px-4 py-8 sm:px-6 sm:py-12"
        >
            <div className="flex w-full max-w-[1120px] flex-col gap-8">
                {error && <AuthAlert>{error}</AuthAlert>}
                <DashboardContent key={account._id} account={account} />
                <Button variant="ghost" className="self-start" onClick={handleSignOut} disabled={signingOut} aria-busy={signingOut}>
                    {signingOut ? "Signing out…" : "Sign out"}
                </Button>
            </div>
        </PublicPage>
    );
}
