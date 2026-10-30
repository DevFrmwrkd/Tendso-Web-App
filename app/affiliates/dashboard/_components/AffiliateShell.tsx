"use client";

import { SignOutButton, useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { Gift, Home, ShoppingBag, Store, User, Wallet } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, type ReactNode } from "react";

import { AUTH_BODY, AuthFrame } from "@/app/auth/_components/AuthFrame";
import { AuthAlert } from "@/app/auth/_components/AuthParts";
import { AppShell, Button, TabBar, type NavLinkEntry, type SidebarProps } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { CREATOR_PAGE_EDITOR_HREF } from "@/lib/v2/creatorPortalNavigation";

import { AffiliateAccountLoading, DifferentAccount } from "../../_components/AccountState";
import { affiliateHref, type AffiliateSection } from "../_lib/navigation";
import { AffiliatePageFrame } from "./AffiliatePageFrame";

const AffiliateAccount = createContext<Doc<"creators"> | null>(null);

export function useAffiliateAccount() {
    const account = useContext(AffiliateAccount);
    if (!account) throw new Error("Affiliate account boundary is required");
    return account;
}

/** One session-derived account gate protects every section, including direct URLs. */
export function AffiliateDashboardBoundary({ children }: { children?: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const canonicalPage = pathname?.replace(/\/$/, "") === CREATOR_PAGE_EDITOR_HREF;
    const { user, isLoaded, isSignedIn } = useUser();
    const { isAuthenticated, isLoading } = useConvexAuth();
    const ready = isLoaded && isSignedIn && !isLoading && isAuthenticated && !!user;
    const session = useQuery(api.adminAccess.me, ready ? {} : "skip");
    const current = ready && session?.clerkId === user.id;
    const account = current ? session.creator : undefined;

    useEffect(() => {
        if (isLoaded && (!isSignedIn || (current && account === null && !session.isOwner))) {
            const destination = canonicalPage
                ? isSignedIn ? "/v2/creators/signup" : "/v2/creators/signup?login=1"
                : "/affiliates/join";
            router.replace(destination);
        }
    }, [isLoaded, isSignedIn, current, account, session, canonicalPage, router]);

    if (!current || account === undefined) return <AffiliateAccountLoading />;
    if (account === null) return session.isOwner ? <DifferentAccount role="owner" /> : <AffiliateAccountLoading />;
    if (account.clerkId !== user.id) return <AffiliateAccountLoading />;
    if (account.isDeleted || account.status === "deleted") return <UnavailableAffiliate />;
    if (account.role !== "affiliate") return <DifferentAccount role={account.role} />;
    if (account.status === "pending") return <PendingAffiliate />;
    if (account.status !== "active" && account.status !== "suspended") return <UnavailableAffiliate />;

    return (
        <AffiliateAccount.Provider value={account}>
            <AffiliateShellView account={account}>
                {account.status === "suspended" && (
                    <AuthAlert>Page changes, sharing, and payouts are paused. You can still view your sales and earnings. Contact <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> for help.</AuthAlert>
                )}
                {children}
            </AffiliateShellView>
        </AffiliateAccount.Provider>
    );
}

function PendingAffiliate() {
    return (
        <AuthFrame title="Waiting for admin approval" sub="Your affiliate signup is complete.">
            <div className={AUTH_BODY}>
                <p className="t-body">An admin will review your account before you can set up and share your page or refer creators.</p>
                <p className="t-body">This screen will update when your account is approved. You can also sign in again later.</p>
                <p className="t-meta">Need help? Contact <a className="t-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
                <SignOutButton redirectUrl="/affiliates"><Button block>Sign out</Button></SignOutButton>
            </div>
        </AuthFrame>
    );
}

function UnavailableAffiliate() {
    return (
        <AuthFrame title="Account unavailable">
            <div className={AUTH_BODY}>
                <p className="t-body">This account cannot open the affiliate dashboard. Contact <a className="t-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> for help.</p>
                <SignOutButton redirectUrl="/affiliates"><Button block>Sign out</Button></SignOutButton>
            </div>
        </AuthFrame>
    );
}

/** Shared live/preview frame; it performs no account or financial reads. */
export function AffiliateShellView({ account, children, preview = false, section = "home" }: {
    account: Doc<"creators">;
    children?: ReactNode;
    preview?: boolean;
    section?: AffiliateSection;
}) {
    const pathname = usePathname();
    const pageRoute = preview ? section === "my-page"
        : ["/affiliates/dashboard/my-page", CREATOR_PAGE_EDITOR_HREF].includes(pathname?.replace(/\/$/, "") ?? "");
    if (pageRoute) return <AffiliatePageFrame account={account} preview={preview}>{children}</AffiliatePageFrame>;
    const name = [account.firstName, account.lastName].filter(Boolean).join(" ") || "Affiliate";
    const entry = (key: AffiliateSection, label: string, icon: NavLinkEntry["icon"]): NavLinkEntry => ({
        href: affiliateHref(key, preview), label, icon, exact: key === "home",
        ...(preview ? { isCurrent: () => section === key } : {}),
    });
    const home = entry("home", "Home", Home);
    const page = entry("my-page", "My page", Store);
    const sales = entry("sales", "Sales", ShoppingBag);
    const wallet = entry("wallet", "Wallet", Wallet);
    const referrals = entry("referrals", "Referrals", Gift);
    const accountLink = entry("account", "Account", User);
    const sidebar: SidebarProps = {
        homeHref: affiliateHref("home", preview), roleLabel: "Affiliate",
        items: [home, page, sales, wallet, referrals], footItems: [accountLink],
        me: { name, meta: "Affiliate", href: accountLink.href },
    };
    return <AppShell sidebar={sidebar} tabbar={<TabBar items={[home, sales, wallet, referrals]} />}>{children}</AppShell>;
}
