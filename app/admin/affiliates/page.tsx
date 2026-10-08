"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

import AdminLayout from "@/app/admin/components/AdminLayout";
import { Button, EmptyState, Loading, PageHeader, SkeletonRows, Status } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useAdminAuth } from "@/hooks/useAdmin";

export default function AdminAffiliatesPage() {
    const { isAdmin, loading } = useAdminAuth();
    const { isAuthenticated } = useConvexAuth();
    const affiliates = useQuery(api.affiliates.list, isAdmin && isAuthenticated ? {} : "skip");

    if (loading || (isAdmin && !isAuthenticated)) return <AdminLayout><Loading label="Loading affiliates"><SkeletonRows count={4} /></Loading></AdminLayout>;
    if (!isAdmin) return <div className="r1 p-6"><EmptyState title="Admin access required" /></div>;

    return (
        <AdminLayout>
            <PageHeader title="Affiliates" sub="Affiliate accounts are active after signup. Suspend access here when needed." />
            {affiliates === undefined ? (
                <Loading label="Loading affiliates"><SkeletonRows count={4} /></Loading>
            ) : affiliates.length === 0 ? (
                <EmptyState title="No affiliates yet" body="New affiliate accounts will appear here." />
            ) : (
                <ul className="t-card divide-y divide-r1-line">
                    {affiliates.map((affiliate) => <AffiliateRow key={affiliate._id} affiliate={affiliate} />)}
                </ul>
            )}
        </AdminLayout>
    );
}

function AffiliateRow({ affiliate }: { affiliate: Doc<"creators"> }) {
    const updateStatus = useMutation(api.creators.updateStatus);
    const [saving, setSaving] = useState(false);
    const suspended = affiliate.status === "suspended";
    const name = [affiliate.firstName, affiliate.lastName].filter(Boolean).join(" ") || affiliate.email;

    async function toggleStatus() {
        if (saving) return;
        setSaving(true);
        try {
            await updateStatus({ id: affiliate._id, status: suspended ? "active" : "suspended" });
            toast.success(`${name} ${suspended ? "reactivated" : "suspended"}.`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not update this account.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <li className="flex flex-wrap items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
                <p className="t-row-title">{name}</p>
                <p className="t-meta break-words">@{affiliate.affiliateHandle} · {affiliate.email} · {affiliate.phone}</p>
            </div>
            <Status tone={suspended ? "bad" : "done"} word={suspended ? "Suspended" : "Active"} />
            <Button variant="secondary" disabled={saving} aria-busy={saving} aria-label={`${suspended ? "Reactivate" : "Suspend"} ${name}`} onClick={toggleStatus}>
                {saving ? "Saving…" : suspended ? "Reactivate" : "Suspend"}
            </Button>
        </li>
    );
}
