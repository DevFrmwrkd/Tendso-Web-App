"use client";

/**
 * /leads/[leadId] — Creator-side lead detail view.
 *
 * Mirrors mobile's `app/(app)/leads/[leadId].tsx`. Reads
 * `api.leads.getDetailForMobileCRM` for the full lead bundle (lead + business
 * + interviewers + notes + admin-curated content). Lets the creator post a
 * note via `api.leadNotes.create`, and — if the lead is theirs — change the
 * status via `api.leads.updateStatus`. Admin elevation also unlocks status.
 */
import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
    ArrowLeft, Phone, Mail, MapPin, Loader2, Send, Building2, ExternalLink, Globe,
} from "lucide-react";

type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "lost";
const STATUS_OPTIONS: LeadStatus[] = ["new", "contacted", "qualified", "converted", "lost"];

const STATUS_PILL_STYLES: Record<string, { bg: string; ink: string }> = {
    new:       { bg: "var(--ed-status-new-bg, #E4E9F0)",       ink: "var(--ed-status-new-ink, #1F3654)" },
    contacted: { bg: "var(--ed-status-contacted-bg, #FBE9C4)", ink: "var(--ed-status-contacted-ink, #C68A12)" },
    qualified: { bg: "var(--ed-status-qualified-bg, #EDE9FE)", ink: "var(--ed-status-qualified-ink, #6D28D9)" },
    converted: { bg: "var(--ed-status-converted-bg, #D1FAE5)", ink: "var(--ed-status-converted-ink, #064E3B)" },
    lost:      { bg: "var(--ed-status-lost-bg, #F3D7CF)",      ink: "var(--ed-status-lost-ink, #B43A1F)" },
};

function timeAgo(ts: number | null | undefined): string {
    if (!ts) return "—";
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60_000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
}

export default function CreatorLeadDetailPage({
    params,
}: {
    params: Promise<{ leadId: string }>;
}) {
    const router = useRouter();
    const { user, isLoaded, isSignedIn } = useUser();
    const { leadId } = use(params);

    const creator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip",
    );

    useEffect(() => {
        if (isLoaded && !isSignedIn) router.push("/login");
    }, [isLoaded, isSignedIn, router]);
    useEffect(() => {
        if (isLoaded && isSignedIn && creator === null) router.push("/onboarding");
    }, [isLoaded, isSignedIn, creator, router]);
    useEffect(() => {
        if (isLoaded && isSignedIn && creator && creator.role !== "admin" && !creator.certifiedAt) {
            router.replace("/training");
        }
    }, [isLoaded, isSignedIn, creator, router]);

    const ready =
        isLoaded && isSignedIn && creator !== undefined && !!creator && (creator.role === "admin" || !!creator.certifiedAt);

    if (!ready) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
            </div>
        );
    }

    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
                </div>
            }
        >
            <DetailContent leadId={leadId as Id<"leads">} creator={creator} />
        </Suspense>
    );
}

function DetailContent({ leadId, creator }: { leadId: Id<"leads">; creator: any }) {
    const data = useQuery(api.leads.getDetailForMobileCRM, { id: leadId });
    const updateStatus = useMutation(api.leads.updateStatus);
    const addNote = useMutation(api.leadNotes.create);

    const [noteDraft, setNoteDraft] = useState("");
    const [posting, setPosting] = useState(false);

    if (data === undefined) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
            </div>
        );
    }
    if (data === null) {
        return (
            <div
                className="min-h-screen pb-20"
                style={{ background: "var(--ed-paper)", color: "var(--ed-ink)", fontFamily: "var(--ed-sans)" }}
            >
                <div className="max-w-2xl mx-auto px-4 pt-6 sm:pt-8 sm:px-6">
                    <Link
                        href="/leads"
                        className="inline-flex items-center gap-1.5 text-[12px] mb-6"
                        style={{ color: "var(--ed-ink-3)" }}
                    >
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to Leads
                    </Link>
                    <div
                        className="rounded-2xl py-10 px-6 text-center"
                        style={{ background: "var(--ed-paper-3)", border: "1px solid var(--ed-rule)" }}
                    >
                        <h2 style={{ fontFamily: "var(--ed-serif)", fontSize: 28, color: "var(--ed-ink)" }}>
                            Lead not found.
                        </h2>
                        <p className="text-[14px] mt-2" style={{ color: "var(--ed-ink-2)" }}>
                            It may have been deleted or you don&apos;t have access.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const { lead, submittedBy, isMine, business, adminContent, interviewers, notes } = data as any;
    const isAdmin = creator?.role === "admin";
    const canChangeStatus = isMine || isAdmin;

    const handlePostNote = async () => {
        const trimmed = noteDraft.trim();
        if (!trimmed || !creator?._id) return;
        setPosting(true);
        try {
            await addNote({
                leadId,
                creatorId: creator._id as Id<"creators">,
                content: trimmed,
            });
            setNoteDraft("");
        } catch (e: any) {
            alert(e?.message ?? "Failed to post note");
        } finally {
            setPosting(false);
        }
    };

    return (
        <div
            className="min-h-screen pb-24"
            style={{ background: "var(--ed-paper)", color: "var(--ed-ink)", fontFamily: "var(--ed-sans)" }}
        >
            <div className="max-w-2xl mx-auto px-4 pt-6 sm:pt-8 sm:px-6 space-y-5">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Link
                        href="/leads"
                        className="w-9 h-9 rounded-full inline-flex items-center justify-center transition-colors"
                        style={{ background: "var(--ed-paper-3)", border: "1px solid var(--ed-rule)" }}
                    >
                        <ArrowLeft className="w-4 h-4" style={{ color: "var(--ed-ink-2)" }} />
                    </Link>
                    <div className="flex items-center gap-2 text-[11px]" style={{
                        fontFamily: "var(--ed-mono)",
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--ed-ink-3)",
                    }}>
                        <span>03 / Lead Detail</span>
                        {isMine && (
                            <>
                                <span>·</span>
                                <span style={{ color: "var(--ed-accent)" }}>Mine</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Title row */}
                <div>
                    <h1
                        style={{
                            fontFamily: "var(--ed-serif)",
                            fontSize: 36,
                            lineHeight: 1.05,
                            letterSpacing: "-0.02em",
                            color: "var(--ed-ink)",
                            margin: 0,
                        }}
                    >
                        {business?.businessName ?? lead.name ?? "(unnamed)"}
                    </h1>
                    {business && (
                        <p className="text-[14px] mt-2" style={{ color: "var(--ed-ink-2)" }}>
                            {[business.businessType, business.city].filter(Boolean).join(" · ")}
                        </p>
                    )}
                </div>

                {/* Submitter strip */}
                {submittedBy && (
                    <div
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                        style={{ background: "var(--ed-paper-3)", border: "1px solid var(--ed-rule)" }}
                    >
                        {submittedBy.profileImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={submittedBy.profileImage}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                            />
                        ) : (
                            <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] flex-shrink-0"
                                style={{
                                    background: "var(--ed-paper-2)",
                                    color: "var(--ed-ink)",
                                    fontFamily: "var(--ed-serif)",
                                    fontWeight: 500,
                                }}
                            >
                                {(submittedBy.displayName ?? "?").slice(0, 1).toUpperCase()}
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <div className="text-[14px]" style={{ color: "var(--ed-ink)" }}>
                                Submitted by{" "}
                                <span className="font-semibold">{submittedBy.displayName}</span>
                            </div>
                            <div
                                className="text-[11px]"
                                style={{
                                    fontFamily: "var(--ed-mono)",
                                    color: "var(--ed-ink-3)",
                                    letterSpacing: "0.04em",
                                }}
                            >
                                {timeAgo(lead._creationTime)}
                            </div>
                        </div>
                    </div>
                )}

                {/* Status — pill if read-only, dropdown if can change */}
                <div className="flex items-center gap-3">
                    <div
                        className="text-[11px]"
                        style={{
                            fontFamily: "var(--ed-mono)",
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            color: "var(--ed-ink-3)",
                        }}
                    >
                        Status
                    </div>
                    {canChangeStatus ? (
                        <select
                            value={lead.status}
                            onChange={async (e) => {
                                try {
                                    await updateStatus({ id: leadId, status: e.target.value as LeadStatus });
                                } catch (err: any) {
                                    alert(err?.message ?? "Failed to update status");
                                }
                            }}
                            className="text-[12px] px-3 py-1.5 rounded-full"
                            style={{
                                background: STATUS_PILL_STYLES[lead.status]?.bg ?? "var(--ed-paper-2)",
                                color: STATUS_PILL_STYLES[lead.status]?.ink ?? "var(--ed-ink)",
                                border: "none",
                                fontFamily: "var(--ed-mono)",
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                fontWeight: 700,
                            }}
                        >
                            {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    ) : (
                        <span
                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                            style={{
                                background: STATUS_PILL_STYLES[lead.status]?.bg ?? "var(--ed-paper-2)",
                                color: STATUS_PILL_STYLES[lead.status]?.ink ?? "var(--ed-ink)",
                            }}
                        >
                            {lead.status}
                        </span>
                    )}
                </div>

                {/* Admin social card (when curated content present) */}
                {adminContent?.hasEnrichedContent && (
                    <div
                        className="rounded-2xl overflow-hidden"
                        style={{ background: "var(--ed-paper-3)", border: "1px solid var(--ed-rule)" }}
                    >
                        {adminContent.previewImageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={adminContent.previewImageUrl}
                                alt=""
                                className="w-full object-cover"
                                style={{ maxHeight: 280 }}
                            />
                        )}
                        <div className="p-4 space-y-3">
                            {adminContent.description && (
                                <p className="text-[14px]" style={{ color: "var(--ed-ink)", lineHeight: 1.5 }}>
                                    {adminContent.description}
                                </p>
                            )}
                            {adminContent.externalPreviewUrl && (
                                <a
                                    href={adminContent.externalPreviewUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-[13px]"
                                    style={{ color: "var(--ed-accent)" }}
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    {adminContent.externalPreviewUrl}
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {/* Lead contact (the customer who inquired) */}
                {(lead.name || lead.phone || lead.email) && (
                    <div
                        className="rounded-2xl p-4 space-y-3"
                        style={{ background: "var(--ed-paper-3)", border: "1px solid var(--ed-rule)" }}
                    >
                        <div
                            className="text-[10px]"
                            style={{
                                fontFamily: "var(--ed-mono)",
                                letterSpacing: "0.14em",
                                textTransform: "uppercase",
                                color: "var(--ed-ink-3)",
                            }}
                        >
                            Customer Inquiry
                        </div>
                        {lead.name && (
                            <div className="text-[15px] font-semibold" style={{ color: "var(--ed-ink)" }}>
                                {lead.name}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {lead.phone && (
                                <a
                                    href={`tel:${lead.phone.replace(/[^0-9+]/g, "")}`}
                                    className="inline-flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-full"
                                    style={{
                                        background: "var(--ed-paper-2)",
                                        color: "var(--ed-ink)",
                                        border: "1px solid var(--ed-rule)",
                                    }}
                                >
                                    <Phone className="w-3.5 h-3.5" /> {lead.phone}
                                </a>
                            )}
                            {lead.email && (
                                <a
                                    href={`mailto:${lead.email}`}
                                    className="inline-flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-full"
                                    style={{
                                        background: "var(--ed-paper-2)",
                                        color: "var(--ed-ink)",
                                        border: "1px solid var(--ed-rule)",
                                    }}
                                >
                                    <Mail className="w-3.5 h-3.5" /> {lead.email}
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {/* Business details */}
                {business && (
                    <div
                        className="rounded-2xl p-4 space-y-3"
                        style={{ background: "var(--ed-paper-3)", border: "1px solid var(--ed-rule)" }}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <Building2 className="w-4 h-4" style={{ color: "var(--ed-accent)" }} />
                            <div
                                className="text-[10px]"
                                style={{
                                    fontFamily: "var(--ed-mono)",
                                    letterSpacing: "0.14em",
                                    textTransform: "uppercase",
                                    color: "var(--ed-ink-3)",
                                }}
                            >
                                Business Profile
                            </div>
                        </div>
                        <h2
                            style={{
                                fontFamily: "var(--ed-serif)",
                                fontSize: 22,
                                color: "var(--ed-ink)",
                                margin: 0,
                                lineHeight: 1.15,
                            }}
                        >
                            {business.businessName}
                        </h2>
                        {business.businessDescription && (
                            <p className="text-[14px]" style={{ color: "var(--ed-ink-2)", lineHeight: 1.5 }}>
                                {business.businessDescription}
                            </p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                            {business.ownerName && (
                                <Field label="Owner" value={business.ownerName} />
                            )}
                            {business.ownerPhone && (
                                <Field label="Phone" value={business.ownerPhone} link={`tel:${business.ownerPhone.replace(/[^0-9+]/g, "")}`} />
                            )}
                            {business.address && (
                                <Field label="Address" value={business.address} full />
                            )}
                            {(business.barangay || business.city || business.province) && (
                                <Field
                                    label="Location"
                                    value={[business.barangay, business.city, business.province].filter(Boolean).join(", ")}
                                />
                            )}
                        </div>
                        {business.websiteUrl && (
                            <a
                                href={business.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-[13px]"
                                style={{ color: "var(--ed-accent)" }}
                            >
                                <Globe className="w-3.5 h-3.5" /> {business.websiteUrl}
                            </a>
                        )}
                    </div>
                )}

                {/* Other interviewers */}
                {interviewers && interviewers.length > 1 && (
                    <div
                        className="rounded-2xl p-4 space-y-3"
                        style={{ background: "var(--ed-paper-3)", border: "1px solid var(--ed-rule)" }}
                    >
                        <div
                            className="text-[10px]"
                            style={{
                                fontFamily: "var(--ed-mono)",
                                letterSpacing: "0.14em",
                                textTransform: "uppercase",
                                color: "var(--ed-ink-3)",
                            }}
                        >
                            Other Interviewers · {interviewers.length}
                        </div>
                        <ul className="space-y-2.5">
                            {interviewers.map((i: any) => (
                                <li key={i.submissionId} className="flex items-center justify-between gap-3 text-[13px]">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        {i.creatorProfileImage ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={i.creatorProfileImage} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                                        ) : (
                                            <div
                                                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] flex-shrink-0"
                                                style={{
                                                    background: "var(--ed-paper-2)",
                                                    color: "var(--ed-ink)",
                                                    fontFamily: "var(--ed-serif)",
                                                    fontWeight: 500,
                                                }}
                                            >
                                                {(i.creatorName ?? "?").slice(0, 1).toUpperCase()}
                                            </div>
                                        )}
                                        <span className="truncate" style={{ color: "var(--ed-ink)" }}>
                                            {i.creatorName}
                                            {i.isMine && <span style={{ color: "var(--ed-accent)" }}> · mine</span>}
                                        </span>
                                    </div>
                                    <span className="ed-label flex-shrink-0" style={{ color: "var(--ed-ink-3)" }}>
                                        {timeAgo(i.interviewedAt)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Notes */}
                <div
                    className="rounded-2xl p-4 space-y-3"
                    style={{ background: "var(--ed-paper-3)", border: "1px solid var(--ed-rule)" }}
                >
                    <div
                        className="text-[10px]"
                        style={{
                            fontFamily: "var(--ed-mono)",
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            color: "var(--ed-ink-3)",
                        }}
                    >
                        Notes · {notes?.length ?? 0}
                    </div>

                    {/* Composer */}
                    <div className="space-y-2">
                        <textarea
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder="Add a follow-up note…"
                            rows={3}
                            className="w-full px-3 py-2.5 text-[14px] focus:outline-none resize-y"
                            style={{
                                background: "var(--ed-paper)",
                                border: "1px solid var(--ed-rule)",
                                borderRadius: 12,
                                color: "var(--ed-ink)",
                                fontFamily: "var(--ed-sans)",
                            }}
                        />
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={handlePostNote}
                                disabled={posting || !noteDraft.trim()}
                                className="inline-flex items-center gap-1.5 text-[11px] px-3.5 py-2 rounded-full disabled:opacity-50"
                                style={{
                                    background: "var(--ed-ink)",
                                    color: "var(--ed-paper-3)",
                                    fontFamily: "var(--ed-mono)",
                                    letterSpacing: "0.08em",
                                    textTransform: "uppercase",
                                }}
                            >
                                {posting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                Post note
                            </button>
                        </div>
                    </div>

                    {/* Notes list */}
                    {notes && notes.length > 0 ? (
                        <ul className="space-y-3 pt-2" style={{ borderTop: "1px solid var(--ed-rule)" }}>
                            {notes.map((n: any) => (
                                <li key={n._id} className="text-[14px]">
                                    <div
                                        className="text-[10px] mb-1"
                                        style={{
                                            fontFamily: "var(--ed-mono)",
                                            color: "var(--ed-ink-3)",
                                            letterSpacing: "0.04em",
                                        }}
                                    >
                                        {timeAgo(n.createdAt)}
                                    </div>
                                    <p style={{ color: "var(--ed-ink)", whiteSpace: "pre-wrap" }}>{n.content}</p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-[12px] italic" style={{ color: "var(--ed-ink-3)" }}>
                            No notes yet. Be the first to add one.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

function Field({
    label, value, full, link,
}: {
    label: string;
    value: string | null | undefined;
    full?: boolean;
    link?: string;
}) {
    if (!value) return null;
    const inner = (
        <>
            <div
                className="text-[10px] mb-0.5"
                style={{
                    fontFamily: "var(--ed-mono)",
                    color: "var(--ed-ink-3)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                }}
            >
                {label}
            </div>
            <div style={{ color: link ? "var(--ed-accent)" : "var(--ed-ink)" }}>{value}</div>
        </>
    );
    return (
        <div className={full ? "sm:col-span-2" : ""}>
            {link ? (
                <a href={link} style={{ textDecoration: "none" }}>
                    {inner}
                </a>
            ) : (
                inner
            )}
        </div>
    );
}
