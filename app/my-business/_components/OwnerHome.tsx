"use client";

import { Copy, ExternalLink, Globe, Lock } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import LiveSitePreview from "@/components/landing/LiveSitePreview";
import {
    Button,
    ButtonLink,
    DefList,
    DefRow,
    Dot,
    EmptyState,
    Fold,
    Icon,
    Loading,
    RowChevron,
    RowLink,
    RowMain,
    ShowAllList,
    Skeleton,
    SkeletonCard,
    Status,
    submissionStatus,
} from "@/components/r1";

import { hostOf, ownerSiteStatus, ownerStage, type OwnerSite } from "./ownerSite";

/*
 * The owner's My website screen (board OwnerHome), shared by /my-business and
 * /my-business/[submissionId] so the two can never drift apart.
 *
 * READ-ONLY BY DESIGN: there is no owner editor (see the note at the top of
 * app/my-business/[submissionId]/page.tsx). A change is REQUESTED through
 * Help and Tendso makes it.
 *
 * What the board draws and these pages leave out, because no owner-gated
 * query returns it: the live-since and paid dates, the amount due and the
 * "Pay ₱999" / "receipt" links to /pay/<token>, business type and city, the
 * template, the own-domain row, the submitted date, the payment reference,
 * the free-edits end date, and the whole "Your creator" card (no creator
 * name reaches the owner, owner-intake sites have no creator, and messaging a
 * creator was never a feature).
 */

/** The site, its state and the one way to ask for a change: the board's full card. */
export function SiteOverview({ site }: { site: OwnerSite }) {
    const url = site.publishedUrl;
    const host = url ? hostOf(url) : null;

    const copyAddress = async () => {
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            toast.success("Address copied — paste it anywhere to share your site");
        } catch {
            toast.error("Couldn't copy the address. Select it and copy it instead.");
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <section className="t-card overflow-hidden" aria-label="Your website">
                <StateBand status={site.status} live={!!url} />

                <div className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                    <div className="border-b border-r1-line bg-r1-fill-2 p-4 sm:p-6 lg:border-b-0 lg:border-r">
                        {url && host ? (
                            // The board draws a screenshot because its canvas cannot load a
                            // live page. This is the live page itself, so it can never be a
                            // version behind what visitors see.
                            <div className="overflow-hidden rounded-r1 border border-r1-line bg-r1-paper">
                                <div className="flex h-8 items-center gap-2 border-b border-r1-line-3 px-3 text-xs text-r1-ink-3">
                                    <Icon icon={Lock} size={12} />
                                    <span className="truncate">{host}</span>
                                </div>
                                <LiveSitePreview url={url} name={site.businessName} />
                            </div>
                        ) : (
                            <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-r1 border border-r1-line bg-r1-paper text-r1-ink-4">
                                <Icon icon={Globe} size={18} />
                                <span className="t-meta">Not live yet</span>
                            </div>
                        )}
                    </div>

                    <div className="flex min-w-0 flex-col gap-5 p-5 sm:p-8">
                        <h2 className="text-2xl font-semibold leading-8 tracking-[-0.01em] text-r1-ink [overflow-wrap:anywhere]">{site.businessName}</h2>
                        {url && host && (
                            <>
                                <p className="flex items-center gap-2 text-sm leading-5 text-r1-ink-2">
                                    <Icon icon={Globe} className="shrink-0 text-r1-ink-3" />
                                    <span className="min-w-0 break-all">{host}</span>
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <ButtonLink href={url} target="_blank" rel="noopener noreferrer">
                                        <Icon icon={ExternalLink} />
                                        Open site
                                    </ButtonLink>
                                    <Button variant="ghost" onClick={copyAddress}>
                                        <Icon icon={Copy} />
                                        Copy address
                                    </Button>
                                </div>
                            </>
                        )}
                        <Fold title="Site details">
                            <DefList>
                                <DefRow term="Web address">{host ?? "Not live yet"}</DefRow>
                                {/*
                                 * The board says "Enquiries from your site". leadCount counts every
                                 * leads row on the submission, and every submission gets one at
                                 * submit time (the owner's own details, or the prospect it was
                                 * converted from), so it is not an enquiry count. It keeps the old
                                 * page's word until the backend counts enquiries alone.
                                 */}
                                <DefRow term="Leads">
                                    <span className="t-num">{site.leadCount}</span>
                                </DefRow>
                            </DefList>
                        </Fold>
                    </div>
                </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
                <EditsCard />
            </div>
        </div>
    );
}

/**
 * The line across the top of the card: is it live, and is anything owed. Due
 * gets the screen's one gold surface. The board's "Pay ₱999" button is not
 * here: nothing an owner may read returns their pay link, so the meta line
 * points at the email that carries it.
 */
function StateBand({ status, live }: { status: string; live: boolean }) {
    const stage = ownerStage(status);
    if (stage === "due") {
        return (
            <div className="flex flex-col gap-1 border-b border-r1-gold-line bg-r1-gold-bg px-5 py-4 sm:px-6 sm:py-5">
                <p className="flex gap-2.5 text-base font-medium leading-6 text-r1-ink">
                    <Dot tone="attn" className="mt-2" />
                    <span>{live ? "Live · payment due — you pay only because it's live" : "Payment due"}</span>
                </p>
                <p className="t-meta pl-[18px]">
                    One payment, by bank transfer, using the link Tendso emails you.{live && " Nothing was charged before your site went live."}
                </p>
            </div>
        );
    }
    if (stage === "paid") {
        return (
            <div className="flex flex-col gap-1 border-b border-r1-line px-5 py-4 sm:px-6 sm:py-5">
                <p className="flex gap-2.5 text-base font-medium leading-6 text-r1-ink">
                    <Dot tone="done" className="mt-2" />
                    <span>{live ? "Live · paid" : "Paid"}</span>
                </p>
                <p className="t-meta pl-[18px]">Nothing more to pay.{live && " You paid once, after your site went live."}</p>
            </div>
        );
    }
    // Not live or not owed yet (in review, unpublished…): the kit's own word.
    return (
        <div className="border-b border-r1-line px-5 py-4 sm:px-6 sm:py-5">
            <Status {...submissionStatus(status, "owner")} />
        </div>
    );
}

/** The edits policy, stated the same way on every Tendso surface. */
export function EditsCard() {
    return (
        <section className="t-card t-card-pad flex flex-col items-start gap-3" aria-labelledby="ow-change-h">
            <h2 className="t-h2" id="ow-change-h">
                Need a change?
            </h2>
            <p className="t-body">Free edits for your first year. Tell us what to change — new prices, photos, opening hours — and Tendso makes it for you.</p>
            <ButtonLink href="/contact">Request an edit</ButtonLink>
        </section>
    );
}

/** An owner with more than one site: one row each, opening that site's card. */
export function SiteList({ sites }: { sites: OwnerSite[] }) {
    return (
        <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3" aria-labelledby="ow-sites-h">
                <h2 className="t-h2" id="ow-sites-h">
                    Your websites <span className="t-count">{sites.length}</span>
                </h2>
                <ShowAllList
                    items={sites}
                    renderItem={(s) => (
                        <RowLink key={s.submissionId} href={`/my-business/${s.submissionId}`}>
                            <RowMain title={s.businessName} meta={s.publishedUrl ? hostOf(s.publishedUrl) : "Not live yet"} />
                            <Status {...ownerSiteStatus(s.status)} />
                            <RowChevron />
                        </RowLink>
                    )}
                />
            </section>
            <div className="grid gap-6 lg:grid-cols-2">
                <EditsCard />
            </div>
        </div>
    );
}

/** Signed in, but no website is linked to this account. */
export function NoSite() {
    return (
        <section className="t-card" aria-label="No website yet">
            <EmptyState
                className="py-16 sm:py-20"
                icon={<Icon icon={Globe} size={20} />}
                title="No website here yet"
                body="No website is linked to this account. If Tendso built one for your business, contact us and we'll link it for you."
                action={
                    <>
                        <ButtonLink variant="primary" href="/contact">
                            Contact us
                        </ButtonLink>
                        <p className="t-meta">
                            No website yet?{" "}
                            <Link className="t-link" href="/start">
                                Tell us about your business
                            </Link>
                        </p>
                    </>
                }
            />
        </section>
    );
}

/** A site id that is not in this owner's list: not theirs, or nothing built yet. */
export function SiteNotAvailable() {
    return (
        <section className="t-card" aria-label="Website not available">
            <EmptyState
                icon={<Icon icon={Globe} size={20} />}
                title="Website not available"
                body="You don't have access to this website, or it isn't ready yet."
                action={<ButtonLink href="/my-business">Back to My website</ButtonLink>}
            />
        </section>
    );
}

/** The card's shape while the owner and their sites load. */
export function SiteOverviewLoading() {
    return (
        <Loading label="Loading your website">
            <div className="flex flex-col gap-6" aria-hidden="true">
                <div className="t-card overflow-hidden">
                    <div className="flex flex-col gap-2 border-b border-r1-line px-5 py-4 sm:px-6 sm:py-5">
                        <Skeleton width="55%" height={16} />
                        <Skeleton width="40%" height={12} />
                    </div>
                    <div className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                        <div className="border-b border-r1-line bg-r1-fill-2 p-4 sm:p-6 lg:border-b-0 lg:border-r">
                            <Skeleton className="aspect-video w-full" height="auto" />
                        </div>
                        <div className="flex flex-col gap-4 p-5 sm:p-8">
                            <Skeleton width="50%" height={24} />
                            <Skeleton width="70%" height={12} />
                            <div className="flex gap-2">
                                <Skeleton width={112} height={40} />
                                <Skeleton width={140} height={40} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                    <SkeletonCard />
                </div>
            </div>
        </Loading>
    );
}
