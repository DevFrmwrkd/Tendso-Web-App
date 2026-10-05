"use client";

/**
 * The details drawer on /submissions (board: Submissions, its three drawers).
 *
 * It replaces the old /submissions/[id] page, which now redirects here, so it
 * carries everything that page showed or did: the business and the owner's
 * contact details, the photos, the interview recording and its transcript,
 * the status, the creator's payout, when it was started, the live site, and
 * Continue for a draft. From the board it adds what happens next, the progress
 * so far with dates, and the owner's pay link to copy and send.
 *
 * The submission itself comes from the list's query, so the drawer can only
 * ever show one of the creator's own submissions; anything else is "not
 * found", exactly as the old page answered for someone else's.
 */

import { useQueries, useQuery, type RequestForQueries } from "convex/react";
import { ArrowRight, Banknote, Globe } from "lucide-react";
import Link from "next/link";
import { useMemo, useSyncExternalStore, type ReactNode } from "react";

import {
    Button,
    ButtonLink,
    DefList,
    DefRow,
    Drawer,
    Fold,
    Folds,
    Highlight,
    Icon,
    Loading,
    Skeleton,
    Status,
    cx,
    domainStatus,
    formatMoney,
    submissionStatus,
} from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { domainAddOnFor, isComped } from "@/lib/pricing";

import {
    draftChecklist,
    draftNextStep,
    formatDay,
    formatMoment,
    headShareNote,
    hostOf,
    interviewKind,
    latestSiteUrl,
    metaOf,
    ownerOf,
    photoCount,
    photosText,
    progressSteps,
    shareOf,
    stageOf,
    type Stage,
    type Submission,
} from "../_lib/derive";
import { LinkRow } from "./LinkRow";
import { Interview, PhotoGrid } from "./Media";
import { PanelBoundary } from "./PanelBoundary";
import { SitePreview } from "./SitePreview";
import { Checklist, Steps } from "./Steps";

type PayToken = Doc<"paymentTokens">;

const noSubscribe = () => () => {};

/**
 * This app's own origin. The pay link a creator copies is the page this same
 * app serves at /pay/<token> (proxy.ts keeps it public for the owner), so the
 * origin they are on is one that answers it.
 */
function useOrigin(): string {
    return useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
}

export function SubmissionDrawer({
    open,
    submission,
    onClose,
    now,
}: {
    open: boolean;
    /** Null: the id in the URL is not one of this creator's submissions. */
    submission: Submission | null;
    onClose: () => void;
    now: number;
}) {
    if (!submission) {
        return (
            <Drawer open={open} onClose={onClose} title="Submission not found" footer={<Button onClick={onClose}>Close</Button>}>
                <p className="t-body">{"This submission doesn't exist or you don't have access to it."}</p>
            </Drawer>
        );
    }

    const stage = stageOf(submission.status);
    const share = shareOf(submission);
    const shareNote = headShareNote(stage);

    return (
        <Drawer
            open={open}
            onClose={onClose}
            title={submission.businessName}
            meta={
                <>
                    <span className="block">
                        {[metaOf(submission), `started ${formatDay(submission._creationTime, now)}`].filter(Boolean).join(" · ")}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Status {...submissionStatus(submission.status, "creator")} />
                        {share !== null && shareNote && <span className="t-num">{`${formatMoney(share)} ${shareNote}`}</span>}
                    </span>
                </>
            }
            footer={
                <>
                    <Button onClick={onClose}>Close</Button>
                    {/* As before: the New submission flow picks the draft up again from step 1. */}
                    {stage === "draft" && (
                        <ButtonLink variant="primary" href="/submit/info">
                            Continue
                            <Icon icon={ArrowRight} />
                        </ButtonLink>
                    )}
                </>
            }
        >
            <PanelBoundary key={submission._id} what="These details">
                <DrawerBody s={submission} stage={stage} now={now} />
            </PanelBoundary>
        </Drawer>
    );
}

function DrawerBody({ s, stage, now }: { s: Submission; stage: Stage; now: number }) {
    // The deployed site (publishedUrl, customDomain, publishedAt). A draft has none.
    const website = useQuery(api.generatedWebsites.getBySubmissionId, stage === "draft" ? "skip" : { submissionId: s._id });
    // The owner's pay link and its reference, from the moment it can exist.
    //
    // Read as a value, not a throw (useQueries returns a failure instead of
    // throwing it). paymentTokens.getBySubmissionId has no auth check today and
    // is due to be locked down; if that ever refuses creators, only the pay link,
    // its reference and the paid date drop out and the rest of the drawer stays.
    const wantsToken = stage === "live" || stage === "offline" || stage === "paid";
    const tokenQueries = useMemo(() => {
        const request: RequestForQueries = {};
        if (wantsToken) request.token = { query: api.paymentTokens.getBySubmissionId, args: { submissionId: s._id } };
        return request;
    }, [wantsToken, s._id]);
    const tokenResult = useQueries(tokenQueries).token as PayToken | null | undefined | Error;
    const token = tokenResult instanceof Error ? null : tokenResult;

    return (
        <>
            <NextStep s={s} stage={stage} token={token} now={now} />

            {stage === "draft" ? (
                <section className="flex flex-col gap-3">
                    <h3 className="t-h2">Still to do</h3>
                    <Checklist items={draftChecklist(s)} />
                </section>
            ) : stage !== "other" ? (
                <section className="flex flex-col gap-3">
                    <h3 className="t-h2">Progress</h3>
                    <Steps
                        steps={progressSteps(s, stage, now, {
                            publishedAt: website?.publishedAt,
                            paymentReceivedAt: token?.paymentReceivedAt,
                        })}
                    />
                </section>
            ) : null}

            <SiteSection s={s} stage={stage} website={website} />

            <DetailFolds s={s} stage={stage} token={token} />
        </>
    );
}

// ── What happens next ────────────────────────────────────────────────────

/** The board's "What happens next": gold when the creator can act, a quiet grey box when they wait. */
function NextBox({ label = "What happens next", highlight = false, text, children }: { label?: string; highlight?: boolean; text: ReactNode; children?: ReactNode }) {
    const content = (
        <>
            <p className={cx("t-label", highlight && "t-hl-label")}>{label}</p>
            <p className="t-body text-r1-ink">{text}</p>
            {children}
        </>
    );
    return highlight ? (
        <Highlight className="flex flex-col gap-3 px-5 py-4">{content}</Highlight>
    ) : (
        <div className="flex flex-col gap-2 rounded-r1-card bg-r1-fill-2 px-5 py-4">{content}</div>
    );
}

function SupportLink({ children }: { children: ReactNode }) {
    return (
        <a className="t-link" href={`mailto:${SUPPORT_EMAIL}`}>
            {children}
        </a>
    );
}

function NextStep({ s, stage, token, now }: { s: Submission; stage: Stage; token: PayToken | null | undefined; now: number }) {
    const owner = ownerOf(s);
    const share = shareOf(s);
    const yourShare = share !== null ? `your ${formatMoney(share)}` : "your share";
    const pays = s.amount ? `pays the ${formatMoney(s.amount)}` : "pays";

    switch (stage) {
        case "draft":
            return <NextBox highlight text={draftNextStep(s)} />;
        case "review":
            return <NextBox text="Tendso is reviewing it. You get a notification when it's approved, or if something needs fixing." />;
        case "building":
            return <NextBox text={`It's approved, and Tendso is making the website. Once it's live, ${owner} gets a pay link.`} />;
        case "live":
            return (
                <NextBox highlight text={`When ${owner} ${pays} with the pay link, ${yourShare} moves from pending to your Wallet.`}>
                    <PayLink s={s} token={token} now={now} />
                </NextBox>
            );
        case "offline":
            return (
                <NextBox
                    highlight
                    text={`The site was taken offline${s.unpublishedAt ? ` on ${formatDay(s.unpublishedAt, now)}` : ""} because the owner had not paid. If ${owner} still ${pays} with the pay link, ${yourShare} moves to your Wallet.`}
                >
                    <PayLink s={s} token={token} now={now} />
                </NextBox>
            );
        case "paid":
            return (
                <NextBox
                    text={
                        isComped(s)
                            ? `Nothing — this was a free promo site, so the owner pays nothing and ${yourShare} is already in your Wallet.`
                            : `Nothing — ${owner} paid, and ${yourShare} is in your Wallet.`
                    }
                />
            );
        case "rejected":
            return (
                <NextBox label="What to fix" text={s.rejectionReason?.trim() || "The reviewer did not leave a note."}>
                    <p className="t-meta">
                        Fix it and submit it again. Not sure what to change? Email <SupportLink>{SUPPORT_EMAIL}</SupportLink>.
                    </p>
                </NextBox>
            );
        default:
            return null;
    }
}

/**
 * The owner's pay link, to copy and send (the token the payment email
 * carries; /pay/<token> is the page the owner pays on). Shown while it can
 * still be paid; an expired or cancelled link says so instead.
 */
function PayLink({ s, token, now }: { s: Submission; token: PayToken | null | undefined; now: number }) {
    const origin = useOrigin();
    if (token === undefined) {
        return (
            <Loading label="Loading the pay link">
                <Skeleton height={40} />
            </Loading>
        );
    }
    if (token === null) return <p className="t-meta">The pay link shows here once Tendso sends it to the owner.</p>;
    if (token.status === "pending" && token.expiresAt >= now) {
        const url = `${origin}/pay/${token.token}`;
        return (
            <LinkRow
                icon={Banknote}
                text={hostOf(url)}
                value={url}
                copyLabel="Copy pay link"
                copiedMessage={`Pay link copied — send it to ${ownerOf(s)}`}
            />
        );
    }
    if (token.status === "pending" || token.status === "expired") {
        return (
            <p className="t-meta">
                The pay link expired on {formatDay(token.expiresAt, now)}. Ask <SupportLink>Tendso support</SupportLink> for a new one.
            </p>
        );
    }
    if (token.status === "cancelled") {
        return (
            <p className="t-meta">
                The pay link was cancelled. Ask <SupportLink>Tendso support</SupportLink> for a new one.
            </p>
        );
    }
    // Paid: the payment is being recorded and the drawer moves to Paid on its own.
    return null;
}

// ── The site ─────────────────────────────────────────────────────────────

function SiteSection({
    s,
    stage,
    website,
}: {
    s: Submission;
    stage: Stage;
    website: { customDomain?: string; publishedUrl?: string } | null | undefined;
}) {
    if (stage === "draft") return null;
    if (website === undefined) {
        // Only hold room where a site is expected; the URL is not known until the row loads.
        if (stage !== "live" && stage !== "paid" && stage !== "offline") return null;
        return (
            <Loading label="Loading the site" className="flex flex-col gap-3">
                <Skeleton width={72} height={16} />
                <Skeleton height={40} />
            </Loading>
        );
    }
    const url = latestSiteUrl(s, website);
    if (!url) return null;
    return (
        <section className="flex flex-col gap-3">
            <h3 className="t-h2">{stage === "live" || stage === "paid" ? "Live site" : "Website"}</h3>
            <SitePreview url={url} name={s.businessName} />
            <LinkRow icon={Globe} href={url} text={hostOf(url)} value={url} copyLabel="Copy link" copiedMessage="Site link copied" />
        </section>
    );
}

// ── Details, photos, interview (folds, closed) ───────────────────────────

function FoldTitle({ label, count }: { label: string; count?: number }) {
    return (
        <span className="flex items-center gap-2">
            {label}
            {count != null && <span className="t-count">{count}</span>}
        </span>
    );
}

function PriceText({ s, share }: { s: Submission; share: number | null }) {
    if (isComped(s)) return <>{share !== null ? `Free (promo) — you still earn ${formatMoney(share)}` : "Free (promo)"}</>;
    if (!s.amount) return <>Not set</>;
    // The domain is a registrar pass-through on top of the website price (lib/pricing).
    const domainAddOn = s.submissionType === "with_custom_domain" ? domainAddOnFor("with_custom_domain", s.domainCostPHP) : 0;
    return (
        <span className="flex flex-col items-end">
            <span className="t-num">{`${formatMoney(s.amount)}, paid once by the owner`}</span>
            {domainAddOn > 0 && <span className="t-meta t-num">{`Includes ${formatMoney(domainAddOn)} for the domain`}</span>}
        </span>
    );
}

function DetailFolds({ s, stage, token }: { s: Submission; stage: Stage; token: PayToken | null | undefined }) {
    const photos = photoCount(s);
    const kind = interviewKind(s);
    const share = shareOf(s);
    const reference = token?.referenceCode ?? s.paymentReference;

    return (
        <Folds>
            <Fold title="Details">
                <DefList>
                    <DefRow term="Owner">{s.ownerName || "Not given"}</DefRow>
                    <DefRow term="Owner phone">{s.ownerPhone || "Not given"}</DefRow>
                    <DefRow term="Owner email">{s.ownerEmail || "None"}</DefRow>
                    <DefRow term="Address">{s.address || "Not given"}</DefRow>
                    <DefRow term="City">{s.city || "Not given"}</DefRow>
                    <DefRow term="Photos">{photosText(photos)}</DefRow>
                    <DefRow term="Interview">{kind ? `${kind === "video" ? "Video" : "Audio"} recording` : "Not recorded yet"}</DefRow>
                    {kind && <DefRow term="Transcript">{s.transcript ? "Ready" : "Not ready yet"}</DefRow>}
                    {stage !== "draft" && (
                        <DefRow term="Price">
                            <PriceText s={s} share={share} />
                        </DefRow>
                    )}
                    {stage !== "draft" && stage !== "rejected" && share !== null && (
                        <DefRow term="Your share">
                            <span className="t-num">{formatMoney(share)}</span>
                        </DefRow>
                    )}
                    {s.requestedDomain && (
                        <DefRow term="Custom domain">
                            <span className="flex flex-col items-end gap-1">
                                <span>{s.requestedDomain}</span>
                                {s.domainStatus && s.domainStatus !== "not_requested" && <Status {...domainStatus(s.domainStatus)} />}
                            </span>
                        </DefRow>
                    )}
                    {reference && (
                        <DefRow term="Payment reference">
                            <span className="t-mono">{reference}</span>
                        </DefRow>
                    )}
                    {s.prospectLeadId && (
                        <DefRow term="Found through">
                            <Link className="t-link" href={`/leads/${s.prospectLeadId}`}>
                                Your leads
                            </Link>
                        </DefRow>
                    )}
                    <DefRow term="Started">{formatMoment(s._creationTime)}</DefRow>
                </DefList>
            </Fold>
            {photos > 0 && (
                <Fold title={<FoldTitle label="Photos" count={photos} />}>
                    <PhotoGrid photos={s.photos ?? []} />
                </Fold>
            )}
            {(kind || s.transcript) && (
                <Fold title="Interview">
                    <Interview s={s} />
                </Fold>
            )}
        </Folds>
    );
}
