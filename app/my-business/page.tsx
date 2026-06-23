"use client";

/**
 * Business Owner Portal — dashboard. Lists the websites the signed-in owner has
 * claimed (via the "Edit my website" email link). Owners are a separate audience
 * from creators; this whole route group is gated by Clerk + a businessOwners row.
 *
 * See docs/changes/OWNER-PORTAL-PRICING-PLAN.md Phase 1.
 */

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";
import { Loader2, Globe, Pencil, Users, ExternalLink } from "lucide-react";

export default function MyBusinessDashboard() {
    const { isOwner, isSignedIn, loading } = useOwnerAuth();
    const router = useRouter();
    const websites = useQuery(api.businessOwners.getMyWebsites, isOwner ? {} : "skip");

    useEffect(() => {
        if (!loading && isSignedIn === false) router.replace("/login");
    }, [loading, isSignedIn, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "#FBF3E0" }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#E4B05E" }} />
            </div>
        );
    }

    // Signed in but no claimed sites yet → nudge to use the email link.
    if (!isOwner) {
        return (
            <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#FBF3E0" }}>
                <div className="max-w-md text-center space-y-4">
                    <Globe className="w-12 h-12 mx-auto" style={{ color: "#E4B05E" }} />
                    <h1 className="text-2xl font-bold" style={{ color: "#5C3A0F" }}>No website claimed yet</h1>
                    <p style={{ color: "#C89548" }}>
                        Open the <strong>&quot;Edit my website&quot;</strong> link in any email from Tendso to claim and manage your site here.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen px-6 py-12" style={{ background: "#FBF3E0", color: "#5C3A0F" }}>
            <div className="max-w-2xl mx-auto space-y-6">
                <header>
                    <h1 className="text-3xl font-bold">My business</h1>
                    <p className="mt-1" style={{ color: "#C89548" }}>Manage your website&apos;s content.</p>
                </header>

                {websites === undefined ? (
                    <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#E4B05E" }} />
                ) : websites.length === 0 ? (
                    <p style={{ color: "#C89548" }}>No websites yet.</p>
                ) : (
                    <div className="space-y-4">
                        {websites.map((w) => (
                            <div key={w.submissionId} className="bg-white rounded-2xl p-5" style={{ border: "1px solid #F5E4C0" }}>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-semibold">{w.businessName}</h2>
                                        <p className="text-xs mt-1 capitalize" style={{ color: "#71717a" }}>Status: {w.status}</p>
                                        <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#71717a" }}>
                                            <Users className="w-3.5 h-3.5" /> {w.leadCount} lead{w.leadCount === 1 ? "" : "s"}
                                        </p>
                                    </div>
                                    {w.publishedUrl && (
                                        <a
                                            href={w.publishedUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-sm inline-flex items-center gap-1 hover:underline"
                                            style={{ color: "#C89548" }}
                                        >
                                            View <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                    )}
                                </div>
                                <div className="mt-4">
                                    <Link
                                        href={`/my-business/${w.submissionId}`}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium text-sm"
                                        style={{ background: "#E4B05E" }}
                                    >
                                        <Pencil className="w-4 h-4" /> Edit website
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
