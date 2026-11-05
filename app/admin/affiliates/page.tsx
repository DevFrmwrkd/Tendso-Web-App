"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

import AdminLayout from "@/app/admin/components/AdminLayout";
import { Button, EmptyState, Loading, PageHeader, SkeletonRows, Status } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useAdminAuth } from "@/hooks/useAdmin";
import styles from "./Affiliates.module.css";

export default function AdminAffiliatesPage() {
    const { isAdmin, loading } = useAdminAuth();
    const { isAuthenticated } = useConvexAuth();
    const affiliates = useQuery(api.affiliates.list, isAdmin && isAuthenticated ? {} : "skip");

    if (!loading && !isAdmin) return <div className="r1 p-6"><EmptyState title="Admin access required" /></div>;

    return (
        <AdminLayout>
            <PageHeader title="Affiliates" sub="Review new affiliate accounts before they can share their page. Manage active accounts here." />
            {loading || !isAuthenticated || affiliates === undefined ? (
                <Loading label="Loading affiliates"><SkeletonRows count={4} /></Loading>
            ) : affiliates.length === 0 ? (
                <EmptyState title="No affiliates yet" body="New affiliate accounts will appear here." />
            ) : (
                <div className={styles.workspace}>
                    <dl className={styles.summary} aria-label="Affiliate accounts">
                        <div className={styles.metric}><dt>Awaiting approval</dt><dd>{affiliates.filter(account => account.status === "pending").length}</dd></div>
                        <div className={styles.metric}><dt>Active affiliates</dt><dd>{affiliates.filter(account => account.status === "active").length}</dd></div>
                        <div className={styles.metric}><dt>Total accounts</dt><dd>{affiliates.length}</dd></div>
                    </dl>
                    <div className={styles.listHead}><h2>Affiliate accounts</h2><p>New applications first. Select an action to update their access.</p></div>
                    <ul className={styles.list}>
                        {[...affiliates].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"))
                            .map((affiliate) => <AffiliateRow key={affiliate._id} affiliate={affiliate} />)}
                    </ul>
                </div>
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
        <li className={styles.row}>
            <div className={styles.identity}>
                <span className={styles.avatar} aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>
                <div className={styles.person}>
                    <h3>{name}</h3>
                    {affiliate.affiliateHandle ? <p className={styles.handle}>@{affiliate.affiliateHandle}</p> : null}
                    <p className={styles.contacts}><span>{affiliate.email}</span>{affiliate.phone ? <span>{affiliate.phone}</span> : null}</p>
                </div>
            </div>
            <div className={styles.actions}>
                <Status tone={pending ? "attn" : suspended ? "bad" : active ? "done" : "off"}
                    word={pending ? "Pending approval" : suspended ? "Suspended" : active ? "Active" : "Unavailable"} />
                {action && <Button variant={pending ? "primary" : "secondary"} disabled={saving} aria-busy={saving} aria-label={`${action} ${name}`} onClick={changeStatus}>
                    {saving ? "Saving…" : action}
                </Button>}
            </div>
        </li>
    );
}
