"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Search, Loader2, XCircle, MessageSquare } from "lucide-react";

type RejectedCreator = {
    _id: Id<"creators">;
    clerkId: string;
    email: string;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    phone: string | null;
    profileImage: string | null;
    quizPassedAt: number | null;
    rejectedAt: number;
    rejectionReason: string | null;
    rejectedBy: string | null;
    createdAt: number | null;
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

function fullName(c: RejectedCreator): string {
    const parts = [c.firstName, c.middleName, c.lastName].filter(Boolean) as string[];
    return parts.length > 0 ? parts.join(" ") : "(name not set)";
}

export default function RejectedCreatorsView({ isAdmin }: { isAdmin: boolean }) {
    const rejected = useQuery(api.creators.listRejected, isAdmin ? {} : "skip") as
        | RejectedCreator[]
        | undefined;

    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
        if (!rejected) return [];
        const q = search.trim().toLowerCase();
        if (!q) return rejected;
        return rejected.filter(
            (c) =>
                fullName(c).toLowerCase().includes(q) ||
                c.email.toLowerCase().includes(q) ||
                (c.phone?.toLowerCase().includes(q) ?? false) ||
                (c.rejectionReason?.toLowerCase().includes(q) ?? false),
        );
    }, [rejected, search]);

    return (
        <div className="space-y-6">
            {/* Editorial header */}
            <div className="flex items-start justify-between gap-6 flex-wrap">
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        <span className="ed-eyebrow" style={{ color: "var(--ed-danger)" }}>
                            Rejected · {String(rejected?.length ?? 0).padStart(2, "0")} creators
                        </span>
                    </div>
                    <h2 className="ed-display-md" style={{ color: "var(--ed-ink)" }}>
                        Not approved{" "}
                        <em style={{ fontStyle: "italic", color: "var(--ed-danger)" }}>
                            this time.
                        </em>
                    </h2>
                    <p className="ed-body mt-3 flex items-start gap-2" style={{ maxWidth: "60ch" }}>
                        <XCircle
                            className="w-4 h-4 mt-1 flex-shrink-0"
                            style={{ color: "var(--ed-danger)" }}
                        />
                        <span>
                            Creators rejected after their onboarding quiz. They see a locked
                            rejection screen on mobile and can retake the quiz at any time —
                            doing so removes them from this list automatically.
                        </span>
                    </p>
                </div>
                <div className="text-right">
                    <div
                        className="ed-display-md"
                        style={{ color: "var(--ed-ink)", fontVariantNumeric: "tabular-nums" }}
                    >
                        {rejected?.length ?? "—"}
                    </div>
                    <div className="ed-label mt-1">on the bench</div>
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
                    placeholder="Search by name, email, phone, or reason…"
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

            {rejected === undefined ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2
                        className="w-6 h-6 animate-spin"
                        style={{ color: "var(--ed-ink-3)" }}
                    />
                </div>
            ) : filtered.length === 0 ? (
                <div className="ed-card-xl text-center">
                    <h3 className="ed-display-sm" style={{ color: "var(--ed-ink)" }}>
                        {search ? (
                            <>
                                No <em style={{ color: "var(--ed-accent)" }}>matches</em>
                            </>
                        ) : (
                            <>
                                No <em style={{ color: "var(--ed-accent)" }}>rejections</em> on the
                                bench.
                            </>
                        )}
                    </h3>
                    <p className="ed-body-sm mt-2" style={{ color: "var(--ed-ink-2)" }}>
                        {search
                            ? "Try a different search term."
                            : "Nobody has been rejected — or everyone retook the quiz."}
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
                                <th className="ed-label text-left px-6 py-3">Rejected</th>
                                <th className="ed-label text-left px-6 py-3">Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((c, i) => (
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
                                                {c.quizPassedAt && (
                                                    <div className="ed-label mt-1">
                                                        quiz passed {timeAgo(c.quizPassedAt)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td
                                        className="px-6 py-4 text-sm"
                                        style={{ color: "var(--ed-ink-2)" }}
                                    >
                                        {c.email}
                                    </td>
                                    <td
                                        className="px-6 py-4 text-sm"
                                        style={{ color: "var(--ed-ink-2)" }}
                                    >
                                        {c.phone ?? "—"}
                                    </td>
                                    <td
                                        className="px-6 py-4 text-sm whitespace-nowrap"
                                        style={{
                                            fontFamily: "var(--ed-mono)",
                                            fontSize: 11,
                                            letterSpacing: "0.08em",
                                            color: "var(--ed-danger)",
                                        }}
                                        title={new Date(c.rejectedAt).toLocaleString()}
                                    >
                                        {timeAgo(c.rejectedAt).toUpperCase()}
                                    </td>
                                    <td
                                        className="px-6 py-4 text-sm"
                                        style={{ color: "var(--ed-ink-2)", maxWidth: 360 }}
                                    >
                                        {c.rejectionReason ? (
                                            <div className="flex items-start gap-2">
                                                <MessageSquare
                                                    className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                                                    style={{ color: "var(--ed-ink-3)" }}
                                                />
                                                <span
                                                    className="line-clamp-2"
                                                    title={c.rejectionReason}
                                                >
                                                    {c.rejectionReason}
                                                </span>
                                            </div>
                                        ) : (
                                            <span
                                                className="ed-label"
                                                style={{ color: "var(--ed-ink-3)" }}
                                            >
                                                No reason given
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
