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
import { toast } from "sonner";
import {
    ArrowLeft, Phone, Mail, MapPin, Loader2, Send, Building2, ExternalLink, Globe,
    Copy, Check, Hand, X as XIcon, UserCheck, ArrowRight, Star,
} from "lucide-react";

type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "lost";
const STATUS_OPTIONS: LeadStatus[] = ["new", "contacted", "qualified", "converted", "lost"];

const STATUS_PILL_STYLES: Record<string, { bg: string; ink: string }> = {
    new:       { bg: "var(--ed-status-new-bg, #E4E9F0)",       ink: "var(--ed-status-new-ink, #1F3654)" },
    contacted: { bg: "var(--ed-status-contacted-bg, #FBE9C4)", ink: "var(--ed-status-contacted-ink, #C68A12)" },
    qualified: { bg: "var(--ed-status-qualified-bg, #EDE9FE)", ink: "var(--ed-status-qualified-ink, #6D28D9)" },
    converted: { bg: "var(--ed-status-converted-bg, #F5E4C0)", ink: "var(--ed-status-converted-ink, #5C3A0F)" },
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

type PendingNote = { tempId: string; content: string; createdAt: number };

function DetailContent({ leadId, creator }: { leadId: Id<"leads">; creator: any }) {
    const data = useQuery(api.leads.getDetailForMobileCRM, { id: leadId });
    const updateStatus = useMutation(api.leads.updateStatus);
    // Spec contract: api.leadNotes.add({ leadId, content }) — creatorId is
    // derived server-side from the Clerk identity.
    const addNote = useMutation(api.leadNotes.add);

    const [noteDraft, setNoteDraft] = useState("");
    const [posting, setPosting] = useState(false);
    // Optimistic notes — appended locally on submit so the UI updates
    // instantly. Cleared as soon as the mutation resolves; the real note
    // arrives via the reactive Convex query.
    const [pendingNotes, setPendingNotes] = useState<PendingNote[]>([]);

    // If the lead is an Outscraper prospect (no submissionId), render the
    // prospect-specific layout via api.outscraper.getProspect — that query
    // returns the business fields off the lead row + claim metadata.
    const isProspect =
        data && (data as any).lead?.source === "outscraper" && !(data as any).business;
    const prospectData = useQuery(
        api.outscraper.getProspect,
        isProspect ? { leadId } : "skip",
    );

    if (data === undefined) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
            </div>
        );
    }
    if (isProspect) {
        if (prospectData === undefined) {
            return (
                <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
                </div>
            );
        }
        if (prospectData === null) {
            return <NotFound />;
        }
        return <ProspectDetail data={prospectData as any} creator={creator} />;
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
        if (!trimmed) return;
        // Optimistic — append locally, clear the input, then send.
        const tempId = `pending-${Date.now()}-${Math.random()}`;
        const optimistic: PendingNote = { tempId, content: trimmed, createdAt: Date.now() };
        setPendingNotes((prev) => [optimistic, ...prev]);
        setNoteDraft("");
        setPosting(true);
        try {
            await addNote({ leadId, content: trimmed });
            // Real note will arrive via reactive query; drop the optimistic.
            setPendingNotes((prev) => prev.filter((n) => n.tempId !== tempId));
        } catch (e: any) {
            // Rollback — remove optimistic and put the draft back so the user
            // can retry.
            setPendingNotes((prev) => prev.filter((n) => n.tempId !== tempId));
            setNoteDraft(trimmed);
            toast.error(e?.message ?? "Failed to post note");
        } finally {
            setPosting(false);
        }
    };

    return (
        <div
            className="min-h-screen pb-24"
            style={{ background: "var(--ed-paper)", color: "var(--ed-ink)", fontFamily: "var(--ed-sans)" }}
        >
            <div className="max-w-5xl mx-auto px-4 pt-6 sm:pt-8 sm:px-6 space-y-5">
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

                {/* Two-column layout below the title — left content rail
                    + sticky right rail. Single-column on mobile/tablet. */}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
                    <div className="space-y-5 min-w-0">

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

                {/* Lead contact (the customer who inquired) — with primary
                    Call + Email action buttons per spec. */}
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
                        {(lead.phone || lead.email) && (
                            <div className="text-[12px] space-y-1" style={{ color: "var(--ed-ink-2)" }}>
                                {lead.phone && (
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-3.5 h-3.5" style={{ color: "var(--ed-ink-3)" }} />
                                        <span>{lead.phone}</span>
                                    </div>
                                )}
                                {lead.email && (
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-3.5 h-3.5" style={{ color: "var(--ed-ink-3)" }} />
                                        <span className="truncate">{lead.email}</span>
                                    </div>
                                )}
                            </div>
                        )}
                        {/* Primary action buttons — Call (emerald) + Email (ink-blue) */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            {lead.phone ? (
                                <a
                                    href={`tel:${lead.phone.replace(/[^0-9+]/g, "")}`}
                                    className="inline-flex items-center justify-center gap-2 text-[13px] font-semibold px-3 py-2.5 rounded-xl transition-opacity hover:opacity-95"
                                    style={{
                                        background: "var(--ed-accent-solid, #E4B05E)",
                                        color: "#fff",
                                    }}
                                >
                                    <Phone className="w-4 h-4" /> Call
                                </a>
                            ) : <span />}
                            {lead.email ? (
                                <a
                                    href={`mailto:${lead.email}`}
                                    className="inline-flex items-center justify-center gap-2 text-[13px] font-semibold px-3 py-2.5 rounded-xl transition-opacity hover:opacity-95"
                                    style={{
                                        background: "var(--ed-ink)",
                                        color: "var(--ed-paper-3)",
                                    }}
                                >
                                    <Mail className="w-4 h-4" /> Email
                                </a>
                            ) : <span />}
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
                                className="inline-flex items-center gap-1.5 text-[12px] truncate max-w-full"
                                style={{ color: "var(--ed-accent)" }}
                            >
                                <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate">{business.websiteUrl}</span>
                            </a>
                        )}

                        {/* Primary action buttons — Directions (always when address) +
                            View Website (active when live, ghost "not live yet" otherwise) */}
                        <div className="grid grid-cols-2 gap-2 pt-2">
                            {business.address ? (
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                        [business.address, business.city, business.province]
                                            .filter(Boolean)
                                            .join(", "),
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2 text-[13px] font-semibold px-3 py-2.5 rounded-xl transition-colors hover:bg-white"
                                    style={{
                                        background: "var(--ed-paper-2)",
                                        color: "var(--ed-ink)",
                                        border: "1px solid var(--ed-rule)",
                                    }}
                                >
                                    <MapPin className="w-4 h-4" /> Directions
                                </a>
                            ) : <span />}
                            {business.websiteUrl ? (
                                <a
                                    href={business.websiteUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2 text-[13px] font-semibold px-3 py-2.5 rounded-xl transition-colors"
                                    style={{
                                        background: "transparent",
                                        color: "var(--ed-accent)",
                                        border: "1px solid var(--ed-accent)",
                                    }}
                                >
                                    <Globe className="w-4 h-4" /> View website
                                </a>
                            ) : (
                                <span
                                    className="inline-flex items-center justify-center gap-2 text-[12px] font-medium px-3 py-2.5 rounded-xl"
                                    style={{
                                        background: "transparent",
                                        color: "var(--ed-ink-3)",
                                        border: "1px dashed var(--ed-rule-strong, #B7AC95)",
                                    }}
                                    title="The submission hasn't been deployed yet."
                                >
                                    <Globe className="w-4 h-4" /> Website not live yet
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Interviewed by — full roster of every creator who's
                    interviewed this business. Spec calls this out explicitly:
                    "this is what surfaces the 'this business has been
                    interviewed 3 times — it's hot' pattern. Don't omit it." */}
                {interviewers && (
                    <div
                        className="rounded-2xl p-4 space-y-3"
                        style={{ background: "var(--ed-paper-3)", border: "1px solid var(--ed-rule)" }}
                    >
                        <div className="flex items-center justify-between">
                            <div
                                className="text-[10px]"
                                style={{
                                    fontFamily: "var(--ed-mono)",
                                    letterSpacing: "0.14em",
                                    textTransform: "uppercase",
                                    color: "var(--ed-ink-3)",
                                }}
                            >
                                Interviewed by
                            </div>
                            {interviewers.length > 0 && (
                                <span
                                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                    style={{
                                        background: "var(--ed-paper-2)",
                                        color: "var(--ed-ink-2)",
                                        fontFamily: "var(--ed-mono)",
                                    }}
                                >
                                    {interviewers.length} {interviewers.length === 1 ? "creator" : "creators"}
                                </span>
                            )}
                        </div>
                        {interviewers.length === 0 ? (
                            <p
                                className="text-[13px] italic py-2"
                                style={{
                                    fontFamily: "var(--ed-serif)",
                                    color: "var(--ed-ink-3)",
                                }}
                            >
                                No interview history found for this business.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {interviewers.map((i: any) => {
                                    const rejected = i.submissionStatus === "rejected";
                                    const rowBg = i.isMine
                                        ? "var(--ed-accent-bg, #F5E4C0)"
                                        : "var(--ed-paper-2)";
                                    const opacity = rejected && !i.isMine ? 0.6 : 1;
                                    return (
                                        <li
                                            key={i.submissionId}
                                            className="flex items-center justify-between gap-3 text-[13px] px-3 py-2.5 rounded-xl"
                                            style={{
                                                background: rowBg,
                                                borderLeft: i.isMine ? "3px solid var(--ed-accent)" : "3px solid transparent",
                                                opacity,
                                            }}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                {i.creatorProfileImage ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={i.creatorProfileImage}
                                                        alt=""
                                                        className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                                                    />
                                                ) : (
                                                    <div
                                                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] flex-shrink-0"
                                                        style={{
                                                            background: i.isMine
                                                                ? "var(--ed-accent-solid, #E4B05E)"
                                                                : "var(--ed-ink-3)",
                                                            color: "#fff",
                                                            fontFamily: "var(--ed-serif)",
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        {(i.creatorName ?? "?").slice(0, 1).toUpperCase()}
                                                    </div>
                                                )}
                                                <span className="truncate" style={{ color: "var(--ed-ink)" }}>
                                                    {i.creatorName}
                                                </span>
                                                {i.isMine && (
                                                    <span
                                                        className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                                                        style={{
                                                            background: "var(--ed-accent-solid, #E4B05E)",
                                                            color: "#fff",
                                                            fontFamily: "var(--ed-mono)",
                                                            letterSpacing: "0.1em",
                                                            textTransform: "uppercase",
                                                        }}
                                                    >
                                                        You
                                                    </span>
                                                )}
                                            </div>
                                            <div
                                                className="text-right flex-shrink-0 text-[10px]"
                                                style={{
                                                    fontFamily: "var(--ed-mono)",
                                                    letterSpacing: "0.04em",
                                                }}
                                            >
                                                <div style={{ color: "var(--ed-ink-3)" }}>
                                                    {timeAgo(i.interviewedAt)}
                                                </div>
                                                <div
                                                    style={{
                                                        color: rejected ? "var(--ed-danger)" : "var(--ed-ink-2)",
                                                        textTransform: "uppercase",
                                                    }}
                                                >
                                                    {i.submissionStatus}
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
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
                        Notes · {(notes?.length ?? 0) + pendingNotes.length}
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
                    {(pendingNotes.length > 0 || (notes && notes.length > 0)) ? (
                        <ul className="space-y-3 pt-2" style={{ borderTop: "1px solid var(--ed-rule)" }}>
                            {pendingNotes.map((n) => (
                                <li key={n.tempId} className="text-[14px]" style={{ opacity: 0.6 }}>
                                    <div
                                        className="text-[10px] mb-1 inline-flex items-center gap-1"
                                        style={{
                                            fontFamily: "var(--ed-mono)",
                                            color: "var(--ed-ink-3)",
                                            letterSpacing: "0.04em",
                                        }}
                                    >
                                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> posting…
                                    </div>
                                    <p style={{ color: "var(--ed-ink)", whiteSpace: "pre-wrap" }}>{n.content}</p>
                                </li>
                            ))}
                            {(notes ?? []).map((n: any) => (
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
                    {/* Right rail — sticky on desktop, stacked under main column on mobile/tablet */}
                    <RightRail lead={lead} business={business} leadId={leadId} />
                </div>
            </div>
        </div>
    );
}

function RightRail({
    lead, business, leadId,
}: {
    lead: any;
    business: any;
    leadId: Id<"leads">;
}) {
    const [copiedId, setCopiedId] = useState(false);
    const directionsHref = business?.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              [business.address, business.city, business.province].filter(Boolean).join(", "),
          )}`
        : null;

    const handleCopyId = async () => {
        try {
            await navigator.clipboard.writeText(String(lead._id));
            setCopiedId(true);
            setTimeout(() => setCopiedId(false), 1500);
        } catch {
            // Older browsers — silently ignore.
        }
    };

    return (
        <aside className="lg:sticky lg:top-6 lg:self-start space-y-4">
            {/* Quick contact */}
            {(lead.phone || lead.email) && (
                <div
                    className="rounded-2xl p-4 space-y-2.5"
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
                        Quick contact
                    </div>
                    {lead.phone && (
                        <a
                            href={`tel:${lead.phone.replace(/[^0-9+]/g, "")}`}
                            className="flex items-center gap-2 text-[13px] px-3 py-2 rounded-lg transition-colors hover:bg-white"
                            style={{
                                background: "var(--ed-paper-2)",
                                color: "var(--ed-ink)",
                                border: "1px solid var(--ed-rule)",
                            }}
                        >
                            <Phone className="w-3.5 h-3.5" style={{ color: "var(--ed-accent)" }} />
                            <span className="truncate">{lead.phone}</span>
                        </a>
                    )}
                    {lead.email && (
                        <a
                            href={`mailto:${lead.email}`}
                            className="flex items-center gap-2 text-[13px] px-3 py-2 rounded-lg transition-colors hover:bg-white"
                            style={{
                                background: "var(--ed-paper-2)",
                                color: "var(--ed-ink)",
                                border: "1px solid var(--ed-rule)",
                            }}
                        >
                            <Mail className="w-3.5 h-3.5" style={{ color: "var(--ed-accent)" }} />
                            <span className="truncate">{lead.email}</span>
                        </a>
                    )}
                </div>
            )}

            {/* Quick actions — sticky duplicate of Directions + Website */}
            {(directionsHref || business) && (
                <div
                    className="rounded-2xl p-4 space-y-2.5"
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
                        Quick actions
                    </div>
                    {directionsHref && (
                        <a
                            href={directionsHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-[13px] font-semibold px-3 py-2.5 rounded-xl transition-colors hover:bg-white"
                            style={{
                                background: "var(--ed-paper-2)",
                                color: "var(--ed-ink)",
                                border: "1px solid var(--ed-rule)",
                            }}
                        >
                            <MapPin className="w-4 h-4" /> Directions
                        </a>
                    )}
                    {business?.websiteUrl ? (
                        <a
                            href={business.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-[13px] font-semibold px-3 py-2.5 rounded-xl"
                            style={{
                                background: "transparent",
                                color: "var(--ed-accent)",
                                border: "1px solid var(--ed-accent)",
                            }}
                        >
                            <Globe className="w-4 h-4" /> View website
                        </a>
                    ) : (
                        <span
                            className="flex items-center gap-2 text-[12px] font-medium px-3 py-2.5 rounded-xl"
                            style={{
                                background: "transparent",
                                color: "var(--ed-ink-3)",
                                border: "1px dashed var(--ed-rule-strong, #B7AC95)",
                            }}
                            title="The submission hasn't been deployed yet."
                        >
                            <Globe className="w-4 h-4" /> Website not live yet
                        </span>
                    )}
                </div>
            )}

            {/* Lead metadata */}
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
                    Metadata
                </div>
                <MetaRow label="Created" value={new Date(lead.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} />
                <MetaRow label="Source" value={lead.source} mono />
                <div>
                    <div
                        className="text-[10px] mb-1"
                        style={{
                            fontFamily: "var(--ed-mono)",
                            color: "var(--ed-ink-3)",
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                        }}
                    >
                        Lead ID
                    </div>
                    <button
                        type="button"
                        onClick={handleCopyId}
                        className="flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded-md w-full text-left transition-colors hover:bg-white"
                        style={{
                            background: "var(--ed-paper-2)",
                            color: "var(--ed-ink-2)",
                            border: "1px solid var(--ed-rule)",
                            fontFamily: "var(--ed-mono)",
                        }}
                        title="Copy lead ID"
                    >
                        {copiedId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span className="truncate">{String(lead._id)}</span>
                    </button>
                </div>
            </div>

            {/* Submission link */}
            {business?.submissionId && (
                <Link
                    href={`/submissions/${business.submissionId}`}
                    className="flex items-center justify-between gap-2 rounded-2xl p-4 text-[13px] transition-colors hover:bg-white"
                    style={{
                        background: "var(--ed-paper-3)",
                        color: "var(--ed-ink)",
                        border: "1px solid var(--ed-rule)",
                    }}
                >
                    <span>View submission</span>
                    <ExternalLink className="w-4 h-4" style={{ color: "var(--ed-ink-3)" }} />
                </Link>
            )}
        </aside>
    );
}

function NotFound() {
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

function ProspectDetail({ data, creator }: { data: any; creator: any }) {
    const { lead, claimedBy, notes } = data;
    const router = useRouter();
    const claim = useMutation(api.outscraper.claimProspect);
    const release = useMutation(api.outscraper.releaseProspect);
    const addNote = useMutation(api.leadNotes.add);
    const [noteDraft, setNoteDraft] = useState("");
    const [posting, setPosting] = useState(false);
    const [busy, setBusy] = useState(false);
    const [pendingNotes, setPendingNotes] = useState<PendingNote[]>([]);

    const claimedByMe = claimedBy?.isMine;
    const claimedByOther = claimedBy && !claimedBy.isMine;

    const directionsHref =
        lead.businessLatitude != null && lead.businessLongitude != null
            ? `https://www.google.com/maps/search/?api=1&query=${lead.businessLatitude},${lead.businessLongitude}`
            : lead.businessAddress
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.businessAddress)}`
                : null;

    const startInterviewHref =
        `/submit/info?prospectLeadId=${encodeURIComponent(String(lead._id))}` +
        (lead.businessName ? `&businessName=${encodeURIComponent(lead.businessName)}` : "") +
        (lead.phone ? `&phone=${encodeURIComponent(lead.phone)}` : "") +
        (lead.businessAddress ? `&address=${encodeURIComponent(lead.businessAddress)}` : "") +
        (lead.businessCity ? `&city=${encodeURIComponent(lead.businessCity)}` : "") +
        (lead.businessCategory ? `&category=${encodeURIComponent(lead.businessCategory)}` : "");

    const onClaim = async (confirmOverride = false) => {
        if (busy) return;
        if (claimedByOther && !confirmOverride) {
            const ok = window.confirm(
                `${claimedBy.displayName} claimed this ${formatRelative(lead.claimedAt)}. You can still go ahead, but you might bump into them at the door. Continue anyway?`,
            );
            if (!ok) return;
        }
        setBusy(true);
        try {
            await claim({ leadId: lead._id });
        } catch (err: any) {
            toast.error(err?.message ?? "Couldn't claim.");
        } finally {
            setBusy(false);
        }
    };
    const onRelease = async () => {
        if (busy) return;
        setBusy(true);
        try {
            await release({ leadId: lead._id });
        } catch (err: any) {
            toast.error(err?.message ?? "Couldn't release.");
        } finally {
            setBusy(false);
        }
    };
    const onPostNote = async () => {
        const trimmed = noteDraft.trim();
        if (!trimmed) return;
        const tempId = `pending-${Date.now()}-${Math.random()}`;
        const optimistic: PendingNote = { tempId, content: trimmed, createdAt: Date.now() };
        setPendingNotes((prev) => [optimistic, ...prev]);
        setNoteDraft("");
        setPosting(true);
        try {
            await addNote({ leadId: lead._id, content: trimmed });
            setPendingNotes((prev) => prev.filter((n) => n.tempId !== tempId));
        } catch (err: any) {
            setPendingNotes((prev) => prev.filter((n) => n.tempId !== tempId));
            setNoteDraft(trimmed);
            toast.error(err?.message ?? "Couldn't post note.");
        } finally {
            setPosting(false);
        }
    };

    return (
        <div
            className="min-h-screen pb-24"
            style={{ background: "var(--ed-paper)", color: "var(--ed-ink)", fontFamily: "var(--ed-sans)" }}
        >
            <div className="max-w-5xl mx-auto px-4 pt-6 sm:pt-8 sm:px-6 space-y-5">
                <div className="flex items-center gap-3">
                    <Link
                        href="/leads?tab=prospects"
                        className="w-9 h-9 rounded-full inline-flex items-center justify-center"
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
                        <span>03 / To Interview</span>
                        <span>·</span>
                        <span style={{ color: "var(--ed-accent)" }}>Prospect</span>
                    </div>
                </div>

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
                        {lead.businessName ?? "(unnamed business)"}
                    </h1>
                    <p className="text-[14px] mt-2" style={{ color: "var(--ed-ink-2)" }}>
                        {[lead.businessCategory, lead.businessCity].filter(Boolean).join(" · ") || "—"}
                    </p>
                    {lead.businessRating != null && (
                        <div className="flex items-center gap-1.5 mt-2 text-[13px]" style={{ color: "var(--ed-ink)" }}>
                            <Star className="w-3.5 h-3.5 fill-current" style={{ color: "var(--ed-warn)" }} />
                            <span>{lead.businessRating.toFixed(1)}</span>
                            {lead.businessReviewCount ? (
                                <span style={{ color: "var(--ed-ink-3)" }}>
                                    ({lead.businessReviewCount.toLocaleString()} reviews)
                                </span>
                            ) : null}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
                    {/* Left rail */}
                    <div className="space-y-5 min-w-0">
                        {/* Address card */}
                        {(lead.businessAddress || directionsHref) && (
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
                                    Where to find it
                                </div>
                                {lead.businessAddress && (
                                    <div className="flex items-start gap-2 text-[14px]" style={{ color: "var(--ed-ink)" }}>
                                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--ed-accent)" }} />
                                        <span>{lead.businessAddress}</span>
                                    </div>
                                )}
                                {directionsHref && (
                                    <a
                                        href={directionsHref}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-3 py-2 rounded-xl"
                                        style={{
                                            background: "var(--ed-paper-2)",
                                            color: "var(--ed-ink)",
                                            border: "1px solid var(--ed-rule)",
                                        }}
                                    >
                                        <MapPin className="w-4 h-4" /> Open in Maps
                                    </a>
                                )}
                            </div>
                        )}

                        {/* Contact card */}
                        {(lead.phone || lead.businessWebsite) && (
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
                                    Contact
                                </div>
                                {lead.phone && (
                                    <a
                                        href={`tel:${lead.phone.replace(/[^0-9+]/g, "")}`}
                                        className="flex items-center gap-2 text-[14px] px-3 py-2 rounded-lg"
                                        style={{
                                            background: "var(--ed-paper-2)",
                                            color: "var(--ed-ink)",
                                            border: "1px solid var(--ed-rule)",
                                        }}
                                    >
                                        <Phone className="w-4 h-4" style={{ color: "var(--ed-accent)" }} />
                                        <span>{lead.phone}</span>
                                    </a>
                                )}
                                {lead.businessWebsite && (
                                    <a
                                        href={lead.businessWebsite}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-[13px]"
                                        style={{ color: "var(--ed-accent)" }}
                                    >
                                        <Globe className="w-3.5 h-3.5" />
                                        <span className="truncate">{lead.businessWebsite}</span>
                                    </a>
                                )}
                            </div>
                        )}

                        {/* Claim state banner */}
                        {claimedByMe && (
                            <div
                                className="rounded-2xl p-4 flex items-center gap-3"
                                style={{
                                    background: "var(--ed-accent-bg, #F5E4C0)",
                                    border: "1px solid var(--ed-accent)",
                                }}
                            >
                                <UserCheck className="w-5 h-5 flex-shrink-0" style={{ color: "var(--ed-accent-ink, #5C3A0F)" }} />
                                <div>
                                    <div className="text-[14px] font-semibold" style={{ color: "var(--ed-accent-ink, #5C3A0F)" }}>
                                        You claimed this {formatRelative(lead.claimedAt)}.
                                    </div>
                                    <div className="text-[12px]" style={{ color: "var(--ed-ink-2)" }}>
                                        Heads up — claims expire after 24h if you don&apos;t submit an interview.
                                    </div>
                                </div>
                            </div>
                        )}
                        {claimedByOther && (
                            <div
                                className="rounded-2xl p-4 flex items-center gap-3"
                                style={{
                                    background: "var(--ed-status-contacted-bg, #FBE9C4)",
                                    border: "1px solid var(--ed-rule)",
                                }}
                            >
                                <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--ed-warn)" }} />
                                <div>
                                    <div className="text-[14px] font-semibold" style={{ color: "var(--ed-ink)" }}>
                                        Claimed by {claimedBy.displayName} · {formatRelative(lead.claimedAt)}
                                    </div>
                                    <div className="text-[12px]" style={{ color: "var(--ed-ink-2)" }}>
                                        Heads up — claims are coordination signals, not locks. You can still take it.
                                    </div>
                                </div>
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
                                Notes · {(notes?.length ?? 0) + pendingNotes.length}
                            </div>
                            <div className="space-y-2">
                                <textarea
                                    value={noteDraft}
                                    onChange={(e) => setNoteDraft(e.target.value)}
                                    placeholder="Leave a field note for the team…"
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
                                        onClick={onPostNote}
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
                            {(pendingNotes.length > 0 || (notes && notes.length > 0)) ? (
                                <ul className="space-y-3 pt-2" style={{ borderTop: "1px solid var(--ed-rule)" }}>
                                    {pendingNotes.map((n) => (
                                        <li key={n.tempId} className="text-[14px]" style={{ opacity: 0.6 }}>
                                            <div
                                                className="text-[10px] mb-1 inline-flex items-center gap-1"
                                                style={{
                                                    fontFamily: "var(--ed-mono)",
                                                    color: "var(--ed-ink-3)",
                                                    letterSpacing: "0.04em",
                                                }}
                                            >
                                                <Loader2 className="w-2.5 h-2.5 animate-spin" /> posting…
                                            </div>
                                            <p style={{ color: "var(--ed-ink)", whiteSpace: "pre-wrap" }}>{n.content}</p>
                                        </li>
                                    ))}
                                    {(notes ?? []).map((n: any) => (
                                        <li key={n._id} className="text-[14px]">
                                            <div
                                                className="text-[10px] mb-1"
                                                style={{
                                                    fontFamily: "var(--ed-mono)",
                                                    color: "var(--ed-ink-3)",
                                                    letterSpacing: "0.04em",
                                                }}
                                            >
                                                {formatRelative(n.createdAt)}
                                            </div>
                                            <p style={{ color: "var(--ed-ink)", whiteSpace: "pre-wrap" }}>{n.content}</p>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-[12px] italic" style={{ color: "var(--ed-ink-3)" }}>
                                    No notes yet. Be the first to add one — leave a tip for the team.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right rail — sticky quick actions */}
                    <aside className="lg:sticky lg:top-6 lg:self-start space-y-4">
                        <div
                            className="rounded-2xl p-4 space-y-2.5"
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
                                Quick actions
                            </div>
                            {claimedByMe ? (
                                <>
                                    <Link
                                        href={startInterviewHref}
                                        className="w-full inline-flex items-center justify-center gap-2 text-[14px] font-semibold px-3 py-2.5 rounded-xl"
                                        style={{ background: "var(--ed-accent-solid, #E4B05E)", color: "#fff" }}
                                    >
                                        Start interview <ArrowRight className="w-4 h-4" />
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={onRelease}
                                        disabled={busy}
                                        className="w-full inline-flex items-center justify-center gap-2 text-[13px] px-3 py-2 rounded-xl disabled:opacity-50"
                                        style={{
                                            background: "transparent",
                                            color: "var(--ed-ink-2)",
                                            border: "1px solid var(--ed-rule)",
                                        }}
                                    >
                                        <XIcon className="w-3.5 h-3.5" /> Release this
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => onClaim()}
                                    disabled={busy}
                                    className="w-full inline-flex items-center justify-center gap-2 text-[14px] font-semibold px-3 py-2.5 rounded-xl disabled:opacity-50"
                                    style={{ background: "var(--ed-ink)", color: "var(--ed-paper-3)" }}
                                >
                                    <Hand className="w-4 h-4" /> I&apos;ll interview this
                                </button>
                            )}
                            {directionsHref && (
                                <a
                                    href={directionsHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full inline-flex items-center justify-center gap-2 text-[13px] font-semibold px-3 py-2 rounded-xl"
                                    style={{
                                        background: "var(--ed-paper-2)",
                                        color: "var(--ed-ink)",
                                        border: "1px solid var(--ed-rule)",
                                    }}
                                >
                                    <MapPin className="w-4 h-4" /> Open in Maps
                                </a>
                            )}
                        </div>

                        {/* Metadata */}
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
                                Metadata
                            </div>
                            <MetaRow
                                label="Scraped"
                                value={lead.scrapedAt ? new Date(lead.scrapedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                            />
                            <MetaRow label="Source" value="outscraper" mono />
                            {lead.businessGooglePlaceId && (
                                <MetaRow label="Google Place ID" value={lead.businessGooglePlaceId} mono />
                            )}
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}

function formatRelative(ts: number | null | undefined): string {
    if (!ts) return "—";
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60_000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div>
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
            <div
                className="text-[13px]"
                style={{
                    color: "var(--ed-ink)",
                    fontFamily: mono ? "var(--ed-mono)" : "var(--ed-sans)",
                }}
            >
                {value}
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
