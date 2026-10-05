"use client";

import { useQuery } from "convex/react";
import { CircleHelp, CreditCard, Globe } from "lucide-react";
import type { ReactNode } from "react";

import { AppShell, type NavBadge, type SidebarProps } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";

/**
 * The business owner's frame (boards OwnerHome, Account owner variant):
 * My website, Payment and Help, and the owner at the foot opening Account.
 * Owners and admins have no primary action under the logo.
 *
 * Payment says Due while a site is live and awaiting the owner's payment, and
 * Paid once it is paid; it opens that site on My website, where its payment
 * state is. It deliberately does NOT look up the /pay/<token> link: the only
 * query that returns a token by submission (paymentTokens.getBySubmissionId)
 * has no auth check, and an owner-gated way to fetch the pay link does not
 * exist yet. The payment email remains the way to the pay page.
 *
 * Read-only: the pages inside keep their own auth checks (useOwnerAuth).
 */

const DUE = new Set(["deployed", "pending_payment"]);
const PAID = new Set(["paid", "completed"]);

type Site = { submissionId: Id<"submissions">; businessName?: string; status: string };

export function OwnerShell({ children }: { children: ReactNode }) {
    const { owner, isOwner } = useOwnerAuth();
    const sites = useQuery(api.businessOwners.getMyWebsites, isOwner ? {} : "skip") as Site[] | undefined;

    const due = sites?.find((s) => DUE.has(s.status));
    const paid = !due && sites?.some((s) => PAID.has(s.status));
    const payHref = due ? `/my-business/${due.submissionId}` : "/my-business";
    const payBadge: NavBadge | null = due ? { tone: "attn", word: "Due" } : paid ? { tone: "done", word: "Paid" } : null;

    const first = sites?.[0];
    const sidebar: SidebarProps = {
        homeHref: "/my-business",
        items: [
            { href: "/my-business", label: "My website", icon: Globe },
            {
                href: payHref,
                label: "Payment",
                icon: CreditCard,
                badge: payBadge,
                // My website already lights for /my-business/*; Payment only for the pay page itself.
                isCurrent: (p) => p.startsWith("/pay/"),
            },
            { href: "/knowledge", label: "Help", icon: CircleHelp },
        ],
        me: owner
            ? {
                  name: owner.name || owner.email,
                  meta: first?.businessName ? `Owner of ${first.businessName}` : "Owner",
                  href: "/profile",
              }
            : null,
    };

    return <AppShell sidebar={sidebar}>{children}</AppShell>;
}
