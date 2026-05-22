"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import RejectCreatorDialog from "../../components/RejectCreatorDialog";
import { Search, CheckCircle2, Loader2, UserCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

type PendingCreator = {
    _id: Id<"creators">;
    clerkId: string;
    email: string;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    phone: string | null;
    profileImage: string | null;
    quizPassedAt: number;
    createdAt: number | null;
    referredByCode: string | null;
    referredByName: string | null;
};

function timeAgo(ts: number): string {
    const diffMs = Date.now() - ts;
    const min = Math.floor(diffMs / 60_000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
}

function fullName(c: PendingCreator): string {
    const parts = [c.firstName, c.middleName, c.lastName].filter(Boolean) as string[];
    return parts.length > 0 ? parts.join(" ") : "(name not set)";
}

export default function PendingApprovalsView({ isAdmin }: { isAdmin: boolean }) {
    const pending = useQuery(api.creators.listPendingApproval, isAdmin ? {} : "skip") as
        | PendingCreator[]
        | undefined;
    const approveCreator = useMutation(api.creators.approveCreator);

    const [search, setSearch] = useState("");
    const [approvingId, setApprovingId] = useState<string | null>(null);
    const [rejectTarget, setRejectTarget] = useState<PendingCreator | null>(null);

    const filtered = useMemo(() => {
        if (!pending) return [];
        const q = search.trim().toLowerCase();
        if (!q) return pending;
        return pending.filter(
            (c) =>
                fullName(c).toLowerCase().includes(q) ||
                c.email.toLowerCase().includes(q) ||
                (c.phone?.toLowerCase().includes(q) ?? false),
        );
    }, [pending, search]);

    async function handleApprove(creator: PendingCreator) {
        setApprovingId(String(creator._id));
        try {
            await approveCreator({ id: creator._id });
            toast.success(`${fullName(creator)} approved — they're now a certified creator.`);
        } catch (e: any) {
            toast.error(e?.message ?? "Approval failed");
        } finally {
            setApprovingId(null);
        }
    }

    return (
        <div className="space-y-6">
            {/* Editorial header — mono eyebrow + serif display + body lede */}
            <div className="flex items-start justify-between gap-6 flex-wrap">
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        <span className="ed-eyebrow">
                            Pending Approval · {String(pending?.length ?? 0).padStart(2, "0")} creators
                        </span>
                        <span className="ed-live-dot" />
                    </div>
                    <h2 className="ed-display-md" style={{ color: "var(--ed-ink)" }}>
                        Awaiting your{" "}
                        <em style={{ fontStyle: "italic", color: "var(--ed-accent)" }}>
                            approval.
                        </em>
                    </h2>
                    <p className="ed-body mt-3 flex items-start gap-2" style={{ maxWidth: "56ch" }}>
                        <UserCheck
                            className="w-4 h-4 mt-1 flex-shrink-0"
                            style={{ color: "var(--ed-accent)" }}
                        />
                        <span>
                            Creators who passed the onboarding quiz and are waiting for admin
                            certification. Approving releases the mobile Pending Review gate.
                        </span>
                    </p>
                </div>
                <div className="text-right">
                    <div
                        className="ed-display-md"
                        style={{ color: "var(--ed-ink)", fontVariantNumeric: "tabular-nums" }}
                    >
                        {pending?.length ?? "—"}
                    </div>
                    <div className="ed-label mt-1">waiting</div>
                </div>
            </div>

            <hr className="ed-rule" />

            {/* Search */}
            <div className="relative">
                <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: "var(--ed-ink-3)" }}
                />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, email, or phone…"
                    className="w-full pl-10 pr-4 py-3 text-sm focus:outline-none transition-colors"
                    style={{
                        background: "var(--ed-paper-3)",
                        border: "1px solid var(--ed-rule)",
                        borderRadius: "var(--ed-radius-sm)",
                        fontFamily: "var(--ed-sans)",
                        color: "var(--ed-ink)",
                    }}
                />
            </div>

            {/* Queue list */}
            {pending === undefined ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--ed-ink-3)" }} />
                </div>
            ) : filtered.length === 0 ? (
                <div className="ed-card-xl text-center">
                    <CheckCircle2
                        className="w-10 h-10 mx-auto mb-3"
                        style={{ color: "var(--ed-accent)" }}
                    />
                    <h3 className="ed-display-sm" style={{ color: "var(--ed-ink)" }}>
                        {search ? (
                            <>
                                No <em style={{ color: "var(--ed-accent)" }}>matches</em>
                            </>
                        ) : (
                            <>
                                Inbox <em style={{ color: "var(--ed-accent)" }}>zero</em>.
                            </>
                        )}
                    </h3>
                    <p className="ed-body-sm mt-2" style={{ color: "var(--ed-ink-2)" }}>
                        {search
                            ? "Try a different search term."
                            : "Every creator who passed the quiz has been approved. Nice."}
                    </p>
                </div>
            ) : (
                <div
                    className="overflow-hidden"
                    style={{
                        background: "var(--ed-paper-3)",
                        border: "1px solid var(--ed-rule)",
                        borderRadius: "var(--ed-radius-lg)",
                    }}
                >
                    <table className="w-full">
                        <thead
                            style={{
                                background: "var(--ed-paper-2)",
                                borderBottom: "1px solid var(--ed-rule)",
                            }}
                        >
                            <tr>
                                <th className="ed-label text-left px-6 py-3">Creator</th>
                                <th className="ed-label text-left px-6 py-3">Email</th>
                                <th className="ed-label text-left px-6 py-3">Phone</th>
                                <th className="ed-label text-left px-6 py-3">Waiting</th>
                                <th className="ed-label text-left px-6 py-3">Referrer</th>
                                <th className="ed-label text-right px-6 py-3">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((c, i) => {
                                const isApproving = approvingId === String(c._id);
                                return (
                                    <tr
                                        key={String(c._id)}
                                        className="transition-colors hover:bg-[var(--ed-paper-2)]"
                                        style={{
                                            borderTop:
                                                i === 0 ? "none" : "1px solid var(--ed-rule)",
                                        }}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
                                                    style={{
                                                        background: "var(--ed-paper-2)",
                                                        border: "1px solid var(--ed-rule)",
                                                    }}
                                                >
                                                    {c.profileImage ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={c.profileImage}
                                                            alt={fullName(c)}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <span
                                                            style={{
                                                                fontFamily: "var(--ed-serif)",
                                                                fontSize: 16,
                                                                color: "var(--ed-ink-2)",
                                                            }}
                                                        >
                                                            {(
                                                                c.firstName?.[0] ?? c.email[0]
                                                            ).toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div
                                                        className="text-sm"
                                                        style={{
                                                            fontFamily: "var(--ed-serif)",
                                                            fontSize: 16,
                                                            color: "var(--ed-ink)",
                                                        }}
                                                    >
                                                        {fullName(c)}
                                                    </div>
                                                    <div className="ed-label mt-1">
                                                        quiz passed {timeAgo(c.quizPassedAt)}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm" style={{ color: "var(--ed-ink-2)" }}>
                                            {c.email}
                                        </td>
                                        <td className="px-6 py-4 text-sm" style={{ color: "var(--ed-ink-2)" }}>
                                            {c.phone ?? "—"}
                                        </td>
                                        <td
                                            className="px-6 py-4 text-sm whitespace-nowrap"
                                            style={{
                                                fontFamily: "var(--ed-mono)",
                                                fontSize: 11,
                                                letterSpacing: "0.08em",
                                                color: "var(--ed-ink-2)",
                                            }}
                                        >
                                            {timeAgo(c.quizPassedAt).toUpperCase()}
                                        </td>
                                        <td className="px-6 py-4 text-sm" style={{ color: "var(--ed-ink-2)" }}>
                                            {c.referredByName ?? c.referredByCode ?? "—"}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="inline-flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setRejectTarget(c)}
                                                    disabled={isApproving}
                                                    className="ed-door ed-door-danger-ghost inline-flex items-center"
                                                    style={{ minHeight: 38, padding: "8px 14px", fontSize: 13 }}
                                                    title="Reject creator"
                                                >
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    <span style={{ marginLeft: 8 }}>Reject</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleApprove(c)}
                                                    disabled={isApproving}
                                                    className="ed-door ed-door-accent inline-flex items-center"
                                                    style={{ minHeight: 38, padding: "8px 16px", fontSize: 13 }}
                                                >
                                                    {isApproving ? (
                                                        <>
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            <span style={{ marginLeft: 8 }}>Approving…</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            <span style={{ marginLeft: 8 }}>Approve</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <RejectCreatorDialog
                creator={rejectTarget}
                open={rejectTarget !== null}
                onClose={() => setRejectTarget(null)}
                onSuccess={({ displayName }) => {
                    toast.success(
                        `${displayName} rejected — they'll see the rejection screen on next app open.`,
                    );
                }}
            />
        </div>
    );
}
