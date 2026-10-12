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
            <PageHeader title="Affiliates" sub="Review new affiliate accounts before they can share their page. Manage active accounts here." />
            {affiliates === undefined ? (
                <Loading label="Loading affiliates"><SkeletonRows count={4} /></Loading>
            ) : affiliates.length === 0 ? (
                <EmptyState title="No affiliates yet" body="New affiliate accounts will appear here." />
            ) : (
                <ul className="t-card divide-y divide-r1-line">
                    {[...affiliates].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"))
                        .map((affiliate) => <AffiliateRow key={affiliate._id} affiliate={affiliate} />)}
                </ul>
            )}
        </AdminLayout>
    );
}

function AffiliateRow({ affiliate }: { affiliate: Doc<"creators"> }) {
    const updateStatus = useMutation(api.creators.updateStatus);
    const [saving, setSaving] = useState(false);
    const pending = affiliate.status === "pending";
    const suspended = affiliate.status === "suspended";
    const active = affiliate.status === "active";
    const action = pending ? "Approve" : suspended ? "Reactivate" : active ? "Suspend" : null;
    const name = [affiliate.firstName, affiliate.lastName].filter(Boolean).join(" ") || affiliate.email;

    async function changeStatus() {
        if (saving || !action) return;
        setSaving(true);
        try {
            await updateStatus({ id: affiliate._id, status: active ? "suspended" : "active" });
            toast.success(`${name} ${pending ? "approved" : suspended ? "reactivated" : "suspended"}.`);
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
            <Status tone={pending ? "attn" : suspended ? "bad" : active ? "done" : "off"}
                word={pending ? "Pending approval" : suspended ? "Suspended" : active ? "Active" : "Unavailable"} />
            {action && <Button variant={pending ? "primary" : "secondary"} disabled={saving} aria-busy={saving} aria-label={`${action} ${name}`} onClick={changeStatus}>
                {saving ? "Saving…" : action}
            </Button>}
        </li>
    );
}
