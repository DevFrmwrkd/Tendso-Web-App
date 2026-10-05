"use client";

/**
 * The lead drawer (board: Leads, "Lead drawer"). It is what /leads/[leadId]
 * used to be: that page now redirects to /leads?lead=<id>, and everything it
 * showed and did lives here.
 *
 * One id, two layouts, as before. Both kinds of lead live in the `leads` table:
 *  - an interviewed lead (a customer inquiry from a business's site, or a
 *    prospect that has been interviewed): api.leads.getDetailForMobileCRM gives
 *    the lead, its submitter, the business behind it, the admin-curated card,
 *    every creator who interviewed the business, and the notes. The status can
 *    be changed by the lead's own creator or an admin (api.leads.updateStatus).
 *  - an Outscraper prospect not interviewed yet (source "outscraper" and no
 *    submission): its fields live on the lead row, so it is read with
 *    api.outscraper.getProspect, which adds the claim. It can be claimed,
 *    released, and turned into a submission (the interview flow, prefilled).
 * Both take notes (api.leadNotes.add).
 */
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ArrowRight, Check, Copy, ExternalLink, Globe, Mail, Phone } from "lucide-react";
import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
    Avatar,
    Button,
    ButtonLink,
    Dot,
    Drawer,
    EmptyState,
    Fold,
    Folds,
    Icon,
    Loading,
    Row,
    RowMain,
    Select,
    ShowAllList,
    Skeleton,
    SkeletonText,
    Status,
    leadStatus,
    submissionStatus,
} from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { looksLikeConvexId } from "@/lib/prospectPrefill";

import { LeadNotes } from "./LeadNotes";
import {
    LEAD_STATUSES,
    businessDirectionsHref,
    categoryKey,
    distanceTo,
    errorMessage,
    formatDate,
    formatKm,
    isLeadStatus,
    leadDirectionsHref,
    prospectDirectionsHref,
    startInterviewHref,
    telHref,
    timeAgo,
    type FeedLead,
    type LatLng,
    type LeadDetail,
    type ProspectDetail,
} from "./leadUtils";

/** What the list already knows about the lead, shown while the drawer loads. */
export type DrawerHint = { name: string; meta?: string; row?: FeedLead };

const OUTSCRAPER_SOURCE = "Find a local business (Google Maps search)";

export function LeadDrawer({
    leadId,
    onClose,
    me,
    isAdmin,
    hint,
    pos,
}: {
    /** The ?lead= value; null keeps the drawer closed. */
    leadId: string | null;
    onClose: () => void;
    me: { id: string; name: string };
    isAdmin: boolean;
    hint: DrawerHint | null;
    pos: LatLng | null;
}) {
    // Convex ids are 32-char base32. A place_id ("ChIJ…", which the discover
    // map's in-memory pins use as their id) is not, and would throw at the
    // v.id('leads') validator. Shape-check first and say "not found" instead.
    const validId = leadId !== null && looksLikeConvexId(leadId);
    const id = validId ? (leadId as Id<"leads">) : null;
    // Both reads need Convex to hold the Clerk token: before it does, the
    // detail answers null ("not found") and getProspect throws. A deep link
    // opens the drawer at once, so wait for it.
    const { isAuthenticated } = useConvexAuth();
    const data = useQuery(api.leads.getDetailForMobileCRM, id && isAuthenticated ? { id } : "skip");
    // An Outscraper prospect has no submission (business) behind it yet; its
    // business fields and claim come from api.outscraper.getProspect.
    const isProspect = !!data && data.lead.source === "outscraper" && !data.business;
    const prospect = useQuery(api.outscraper.getProspect, id && isProspect ? { leadId: id } : "skip");

    const claim = useMutation(api.outscraper.claimProspect);
    const release = useMutation(api.outscraper.releaseProspect);
    const updateStatus = useMutation(api.leads.updateStatus);

    const [busy, setBusy] = useState(false);
    // Per-lead UI state is stored with the lead it belongs to, so opening
    // another lead starts clean.
    const [warnFor, setWarnFor] = useState<string | null>(null);
    const [statusDraft, setStatusDraft] = useState<{ id: string; value: string } | null>(null);

    let title: ReactNode = hint?.name ?? "Lead";
    let meta: ReactNode = hint?.meta;
    let body: ReactNode = null;
    let footer: ReactNode = undefined;

    if (leadId === null) {
        // Closed.
    } else if (!validId || data === null || (isProspect && prospect === null)) {
        title = "Lead not found";
        meta = undefined;
        body = (
            <EmptyState
                title="Lead not found"
                body="It may have been deleted, or you don't have access to it."
                action={<Button onClick={onClose}>Back to leads</Button>}
            />
        );
    } else if (data === undefined || (isProspect && prospect === undefined)) {
        body = <DrawerSkeleton />;
    } else if (isProspect && prospect) {
        const p = prospect.lead;
        const claimedBy = prospect.claimedBy;
        const mine = !!claimedBy?.isMine;
        const other = !!claimedBy && !claimedBy.isMine;
        const warn = other && warnFor === p._id;
        const directions = prospectDirectionsHref(p);

        const doClaim = async () => {
            if (busy) return;
            setBusy(true);
            try {
                await claim({ leadId: p._id });
                setWarnFor(null);
            } catch (err) {
                toast.error(errorMessage(err, "Couldn't claim."));
            } finally {
                setBusy(false);
            }
        };
        // Somebody else's claim used to stop here at a native confirm(). A
        // claim is a heads-up, not a lock, so the drawer now says who and when,
        // inline, and "Interview it anyway" goes ahead.
        const onClaim = () => {
            if (other) setWarnFor(p._id);
            else void doClaim();
        };
        const onRelease = async () => {
            if (busy) return;
            setBusy(true);
            try {
                await release({ leadId: p._id });
            } catch (err) {
                toast.error(errorMessage(err, "Couldn't release."));
            } finally {
                setBusy(false);
            }
        };

        title = p.businessName ?? "(unnamed business)";
        meta = [p.businessCategory ? categoryKey(p.businessCategory) : null, p.businessCity].filter(Boolean).join(" · ") || undefined;
        body = (
            <ProspectBody
                prospect={prospect}
                me={me}
                km={distanceTo(pos, p.businessLatitude, p.businessLongitude)}
                warn={warn}
                busy={busy}
                onClaimAnyway={() => void doClaim()}
                onPickAnother={onClose}
            />
        );
        footer = (
            <>
                {mine && !p.submissionId && (
                    <Button variant="ghost" className="mr-auto" onClick={onRelease} disabled={busy}>
                        Release
                    </Button>
                )}
                {directions && (
                    <ButtonLink href={directions} target="_blank" rel="noopener noreferrer">
                        <Icon icon={ExternalLink} />
                        Directions
                    </ButtonLink>
                )}
                {p.submissionId ? (
                    // Already interviewed. Guards a bookmarked or stale prospect
                    // link. This rarely renders: once submit patches the lead,
                    // `isProspect` goes false and the drawer self-heals into the
                    // interviewed-lead layout, so it only covers the reactivity gap.
                    <ButtonLink variant="primary" href={`/submissions/${p.submissionId}`}>
                        Already interviewed
                        <Icon icon={ArrowRight} />
                    </ButtonLink>
                ) : mine ? (
                    <ButtonLink variant="primary" href={startInterviewHref(p)}>
                        Start submission
                        <Icon icon={ArrowRight} />
                    </ButtonLink>
                ) : warn ? null : (
                    <Button variant="primary" onClick={onClaim} disabled={busy} aria-busy={busy}>
                        I&apos;ll interview this
                    </Button>
                )}
            </>
        );
    } else {
        const d = data;
        const { lead, business } = d;
        const canChangeStatus = d.isMine || isAdmin;
        // The list row, when the drawer was opened from it: the business's pin
        // and place_id for leads with no submission address to route to.
        const row = hint?.row && hint.row._id === lead._id ? hint.row : undefined;
        const directions = (business ? businessDirectionsHref(business) : null) ?? (row ? leadDirectionsHref(row) : null);

        const changeStatus = async (next: string) => {
            if (!isLeadStatus(next) || busy) return;
            setStatusDraft({ id: lead._id, value: next });
            setBusy(true);
            try {
                await updateStatus({ id: lead._id, status: next });
            } catch (err) {
                toast.error(errorMessage(err, "Failed to update status"));
            } finally {
                setBusy(false);
                setStatusDraft(null);
            }
        };

        title = business?.businessName ?? lead.name ?? "(unnamed)";
        meta = business ? [business.businessType, business.city].filter(Boolean).join(" · ") || undefined : undefined;
        body = (
            <InterviewedBody
                detail={d}
                me={me}
                canChangeStatus={canChangeStatus}
                statusValue={statusDraft?.id === lead._id ? statusDraft.value : lead.status}
                onStatus={(s) => void changeStatus(s)}
                busy={busy}
            />
        );
        const primary = lead.phone ? (
            <ButtonLink variant="primary" href={telHref(lead.phone)}>
                <Icon icon={Phone} />
                Call
            </ButtonLink>
        ) : lead.email ? (
            <ButtonLink variant="primary" href={`mailto:${lead.email}`}>
                <Icon icon={Mail} />
                Email
            </ButtonLink>
        ) : null;
        footer =
            directions || primary ? (
                <>
                    {directions && (
                        <ButtonLink href={directions} target="_blank" rel="noopener noreferrer">
                            <Icon icon={ExternalLink} />
                            Directions
                        </ButtonLink>
                    )}
                    {primary}
                </>
            ) : undefined;
    }

    return (
        <Drawer open={leadId !== null} onClose={onClose} title={title} meta={meta} footer={footer} closeLabel="Close lead details">
            {body}
        </Drawer>
    );
}

// ── Prospect ───────────────────────────────────────────────────────────────

function ProspectBody({
    prospect,
    me,
    km,
    warn,
    busy,
    onClaimAnyway,
    onPickAnother,
}: {
    prospect: ProspectDetail;
    me: { id: string; name: string };
    km: number | null;
    warn: boolean;
    busy: boolean;
    onClaimAnyway: () => void;
    onPickAnother: () => void;
}) {
    const { lead: p, claimedBy, notes } = prospect;
    const when = timeAgo(p.claimedAt);
    const authors = new Map<string, string>();
    if (claimedBy) authors.set(claimedBy.creatorId, claimedBy.displayName);

    return (
        <>
            {claimedBy?.isMine && (
                <ClaimNote
                    icon={
                        <span className="flex size-5 flex-none items-center justify-center rounded-full bg-r1-ink text-r1-paper">
                            <Icon icon={Check} size={12} />
                        </span>
                    }
                    title={`You claimed this${when ? ` ${when}` : ""}`}
                    body="Claims expire after 24 hours if you do not submit an interview. Start the submission when you are at the shop."
                />
            )}
            {claimedBy && !claimedBy.isMine && !warn && (
                <ClaimNote
                    icon={<Dot tone="progress" className="mt-[5px]" />}
                    title={`Claimed by ${claimedBy.displayName}${when ? ` · ${when}` : ""}`}
                    body="A claim is a heads-up, not a lock. You can still take it."
                />
            )}
            {claimedBy && !claimedBy.isMine && warn && (
                <ClaimWarning who={claimedBy.displayName} when={when} busy={busy} onAnyway={onClaimAnyway} onPickAnother={onPickAnother} />
            )}

            <section aria-label="Business facts">
                <Facts>
                    <Fact term="Status">
                        <Status {...leadStatus(p.status)} />
                    </Fact>
                    {p.businessRating != null && (
                        <Fact term="Rating">
                            <span className="t-num">
                                {p.businessRating.toFixed(1)}
                                {p.businessReviewCount ? ` from ${p.businessReviewCount.toLocaleString("en-US")} Google reviews` : ""}
                            </span>
                        </Fact>
                    )}
                    {km != null && (
                        <Fact term="Distance">
                            <span className="t-num">{formatKm(km)} from you</span>
                        </Fact>
                    )}
                    <Fact term="Address">{p.businessAddress ?? "No address on Google Maps"}</Fact>
                    <Fact term="Phone">
                        {p.phone ? (
                            <a className="t-link t-num" href={telHref(p.phone)}>
                                {p.phone}
                            </a>
                        ) : (
                            "No phone on Google Maps"
                        )}
                    </Fact>
                    {p.businessWebsite && (
                        <Fact term="Website">
                            <a className="t-link" href={p.businessWebsite} target="_blank" rel="noopener noreferrer">
                                {p.businessWebsite}
                            </a>
                        </Fact>
                    )}
                </Facts>
            </section>

            <LeadNotes key={p._id} leadId={p._id} notes={notes} me={me} authors={authors} />

            <Folds>
                <Fold title="Where this lead came from">
                    <Facts>
                        <Fact term="Source">{OUTSCRAPER_SOURCE}</Fact>
                        <Fact term="Found">{p.scrapedAt ? formatDate(p.scrapedAt) : "—"}</Fact>
                        {p.businessGooglePlaceId && (
                            <Fact term="Google place ID">
                                <span className="t-mono text-r1-ink-2">{p.businessGooglePlaceId}</span>
                            </Fact>
                        )}
                    </Facts>
                </Fold>
            </Folds>
        </>
    );
}

function ClaimNote({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
    return (
        <div className="flex items-start gap-3 rounded-r1-card border border-r1-line bg-r1-fill-2 p-4">
            {icon}
            <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-[14px] font-medium leading-5 text-r1-ink">{title}</p>
                <p className="t-meta">{body}</p>
            </div>
        </div>
    );
}

/** Replaces the old native confirm() before claiming a shop someone else claimed. */
function ClaimWarning({
    who,
    when,
    busy,
    onAnyway,
    onPickAnother,
}: {
    who: string;
    when: string;
    busy: boolean;
    onAnyway: () => void;
    onPickAnother: () => void;
}) {
    const anywayRef = useRef<HTMLButtonElement>(null);
    // The button that asked for this has left the drawer foot; focus moves to
    // the choice it now has to make.
    useEffect(() => {
        anywayRef.current?.focus();
    }, []);
    return (
        <div role="alert" className="flex items-start gap-3 rounded-r1-card border border-r1-line-2 bg-r1-paper p-4">
            <Dot tone="attn" className="mt-[5px]" />
            <div className="flex min-w-0 flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                    <p className="text-[14px] font-medium leading-5 text-r1-ink">
                        {who} already claimed this{when ? ` ${when}` : ""}
                    </p>
                    <p className="t-body">You can still go, but you might meet them at the door. Leave a note below first, or pick another shop.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button ref={anywayRef} size="sm" onClick={onAnyway} disabled={busy} aria-busy={busy}>
                        Interview it anyway
                    </Button>
                    <Button size="sm" variant="ghost" onClick={onPickAnother}>
                        Pick another shop
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ── Interviewed lead ───────────────────────────────────────────────────────

function InterviewedBody({
    detail,
    me,
    canChangeStatus,
    statusValue,
    onStatus,
    busy,
}: {
    detail: LeadDetail;
    me: { id: string; name: string };
    canChangeStatus: boolean;
    statusValue: string;
    onStatus: (status: string) => void;
    busy: boolean;
}) {
    const { lead, submittedBy, isMine, business, adminContent, interviewers, notes } = detail;
    const authors = new Map<string, string>();
    if (submittedBy) authors.set(submittedBy.creatorId, submittedBy.displayName);
    for (const i of interviewers) authors.set(i.creatorId, i.creatorName);
    // A status outside the five (the column is a free string) is shown, not offered.
    const statusOptions: string[] = isLeadStatus(lead.status) ? [...LEAD_STATUSES] : [lead.status, ...LEAD_STATUSES];

    return (
        <>
            <Facts>
                <Fact term="Status">
                    {canChangeStatus ? (
                        <Select aria-label="Lead status" value={statusValue} onChange={(e) => onStatus(e.target.value)} disabled={busy}>
                            {statusOptions.map((s) => (
                                <option key={s} value={s} disabled={!isLeadStatus(s)}>
                                    {leadStatus(s).word}
                                </option>
                            ))}
                        </Select>
                    ) : (
                        <Status {...leadStatus(lead.status)} />
                    )}
                </Fact>
                {submittedBy && (
                    <Fact term="Submitted by">
                        {isMine ? "You" : submittedBy.displayName} · {timeAgo(lead._creationTime)}
                    </Fact>
                )}
            </Facts>

            {adminContent.hasEnrichedContent && <CuratedCard content={adminContent} />}

            {(lead.name || lead.phone || lead.email) && <InquirySection lead={lead} />}

            {business && <BusinessSection business={business} />}

            <InterviewersSection interviewers={interviewers} />

            <LeadNotes key={lead._id} leadId={lead._id} notes={notes} me={me} authors={authors} />

            <Folds>
                <Fold title="Where this lead came from">
                    <Facts>
                        <Fact term="Created">{formatDate(lead.createdAt)}</Fact>
                        <Fact term="Source">{lead.source === "outscraper" ? OUTSCRAPER_SOURCE : <span className="t-mono">{lead.source}</span>}</Fact>
                        <Fact term="Lead ID">
                            <CopyId value={String(lead._id)} />
                        </Fact>
                    </Facts>
                </Fold>
            </Folds>
        </>
    );
}

/** The admin-curated social card (description, image, link), when an admin wrote one. */
function CuratedCard({ content }: { content: LeadDetail["adminContent"] }) {
    return (
        <section className="t-card overflow-hidden" aria-label="Curated by the Tendso team">
            {content.previewImageUrl && (
                // Admin uploads are served from R2, outside next/image's hosts.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={content.previewImageUrl} alt="" loading="lazy" className="block max-h-[280px] w-full border-b border-r1-line object-cover" />
            )}
            <div className="flex flex-col gap-2 p-4">
                <span className="t-label">Curated by the Tendso team</span>
                {content.description && <p className="t-body whitespace-pre-wrap">{content.description}</p>}
                {content.externalPreviewUrl && (
                    <a
                        className="t-link inline-flex items-start gap-1.5 text-[13px] [overflow-wrap:anywhere]"
                        href={content.externalPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <Icon icon={ExternalLink} className="mt-0.5 flex-none" />
                        {content.externalPreviewUrl}
                    </a>
                )}
            </div>
        </section>
    );
}

/** The customer who asked about the business. Call is the drawer's primary action; Email sits here when both exist. */
function InquirySection({ lead }: { lead: LeadDetail["lead"] }) {
    const headingId = useId();
    return (
        <section className="flex flex-col gap-3" aria-labelledby={headingId}>
            <h3 id={headingId} className="t-h2">
                Customer inquiry
            </h3>
            <Facts>
                {lead.name && <Fact term="Name">{lead.name}</Fact>}
                {lead.phone && (
                    <Fact term="Phone">
                        <a className="t-link t-num" href={telHref(lead.phone)}>
                            {lead.phone}
                        </a>
                    </Fact>
                )}
                {lead.email && (
                    <Fact term="Email">
                        <a className="t-link" href={`mailto:${lead.email}`}>
                            {lead.email}
                        </a>
                    </Fact>
                )}
            </Facts>
            {!lead.phone && !lead.email && <p className="t-meta">No phone or email on file.</p>}
            {lead.phone && lead.email && (
                <div>
                    <ButtonLink size="sm" href={`mailto:${lead.email}`}>
                        <Icon icon={Mail} />
                        Email
                    </ButtonLink>
                </div>
            )}
        </section>
    );
}

function BusinessSection({ business }: { business: NonNullable<LeadDetail["business"]> }) {
    const headingId = useId();
    const location = [business.barangay, business.city, business.province].filter(Boolean).join(", ");
    return (
        <section className="flex flex-col gap-3" aria-labelledby={headingId}>
            <h3 id={headingId} className="t-h2">
                Business
            </h3>
            {business.businessDescription && <p className="t-body whitespace-pre-wrap">{business.businessDescription}</p>}
            <Facts>
                {business.ownerName && <Fact term="Owner">{business.ownerName}</Fact>}
                {business.ownerPhone && (
                    <Fact term="Phone">
                        <a className="t-link t-num" href={telHref(business.ownerPhone)}>
                            {business.ownerPhone}
                        </a>
                    </Fact>
                )}
                {business.address && <Fact term="Address">{business.address}</Fact>}
                {location && <Fact term="Location">{location}</Fact>}
                <Fact term="Website">
                    {business.websiteUrl ? (
                        <a className="t-link" href={business.websiteUrl} target="_blank" rel="noopener noreferrer">
                            {business.websiteUrl}
                        </a>
                    ) : (
                        <span className="text-r1-ink-3">Not live yet. The site has not been published.</span>
                    )}
                </Fact>
            </Facts>
            <div className="flex flex-wrap gap-2">
                {business.websiteUrl && (
                    <ButtonLink size="sm" href={business.websiteUrl} target="_blank" rel="noopener noreferrer">
                        <Icon icon={Globe} />
                        View website
                    </ButtonLink>
                )}
                <ButtonLink size="sm" href={`/submissions/${business.submissionId}`}>
                    View submission
                    <Icon icon={ArrowRight} />
                </ButtonLink>
            </div>
        </section>
    );
}

/**
 * Every creator who interviewed this business (matched by the owner's phone).
 * The spec calls it out: this roster is what surfaces "this business has been
 * interviewed 3 times, it's hot". Don't omit it.
 */
function InterviewersSection({ interviewers }: { interviewers: LeadDetail["interviewers"] }) {
    const headingId = useId();
    return (
        <section className="flex flex-col gap-3" aria-labelledby={headingId}>
            <h3 id={headingId} className="t-h2 flex items-baseline gap-1.5">
                Interviewed by <span className="t-count">{interviewers.length}</span>
            </h3>
            {interviewers.length === 0 ? (
                <p className="t-meta">No interview history found for this business.</p>
            ) : (
                <ShowAllList
                    items={interviewers}
                    initial={3}
                    renderItem={(i) => (
                        <Row key={i.submissionId}>
                            <Avatar name={i.creatorName} />
                            <RowMain title={i.isMine ? `${i.creatorName} (you)` : i.creatorName} meta={timeAgo(i.interviewedAt)} />
                            <Status {...submissionStatus(i.submissionStatus, "creator")} />
                        </Row>
                    )}
                />
            )}
            {interviewers.length >= 3 && <p className="t-meta">A hot lead: 3 or more creators have interviewed this business.</p>}
        </section>
    );
}

function CopyId({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // Older browsers: the id is on screen to copy by hand.
        }
    };
    return (
        <span className="flex items-center gap-2">
            <span className="t-mono min-w-0 text-r1-ink-2">{value}</span>
            <Button variant="ghost" size="sm" icon aria-label={copied ? "Lead ID copied" : "Copy lead ID"} onClick={copy}>
                <Icon icon={copied ? Check : Copy} />
            </Button>
        </span>
    );
}

// ── Shared bits ────────────────────────────────────────────────────────────

/** The drawer's facts: label on the left, value on the right (board: ld-facts). */
function Facts({ children }: { children: ReactNode }) {
    return <dl className="m-0 grid grid-cols-[112px_minmax(0,1fr)] items-baseline gap-x-4 gap-y-3">{children}</dl>;
}

function Fact({ term, children }: { term: ReactNode; children: ReactNode }) {
    return (
        <>
            <dt className="t-label">{term}</dt>
            <dd className="t-body m-0 min-w-0 [overflow-wrap:anywhere]">{children}</dd>
        </>
    );
}

function DrawerSkeleton() {
    return (
        <Loading label="Loading the lead">
            <div className="flex flex-col gap-6">
                <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-x-4 gap-y-3">
                    {["55%", "70%", "40%", "85%", "50%"].map((w, i) => (
                        <Fragment key={i}>
                            <Skeleton width={64} height={12} />
                            <Skeleton width={w} height={14} />
                        </Fragment>
                    ))}
                </div>
                <SkeletonText lines={3} />
            </div>
        </Loading>
    );
}
