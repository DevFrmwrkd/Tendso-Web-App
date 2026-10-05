"use client";

/**
 * /submissions: "Where is each business I submitted?" (Round 1, board
 * Submissions).
 *
 * Every submission the creator has made, newest first, filtered by chips
 * (All, In progress, Paid, Drafts, Rejected), with a details drawer over the
 * list. The drawer replaces the old /submissions/[id] page; that route now
 * redirects to /submissions?open=<id>, so every link to it (the dashboard,
 * the notifications, a lead's page, and any in an old email or the mobile
 * app) still lands on the same submission.
 *
 * THE URL IS THE STATE. `?open=<id>` is the open drawer and `?filter=` the
 * chip, so a deep link, a refresh and Back all show what the URL says. They
 * are written with history.replaceState rather than router.replace: Next keeps
 * useSearchParams in step with the native History API, and it does not ask
 * the server to render the page again, so a row opens its drawer at once
 * instead of after a round trip on mobile data. Replace, not push: a drawer is
 * not a page, and Back should leave Submissions, not step back through every
 * row that was opened.
 *
 * THE FLOATING NEW-SUBMISSION BUTTON IS GONE: the sidebar's New submission
 * (and the phone tab bar's centre button) replaces it. The empty state is the
 * one place this page repeats it.
 *
 * Auth is unchanged: signed out goes to /login, and the page waits for Clerk,
 * the creator row and the list before it shows anything.
 */

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { Inbox, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Button, ButtonLink, Chips, EmptyState, Icon, List, Loading, PageHeader, Skeleton, SkeletonRows } from "@/components/r1";
import { CreatorShell } from "@/components/shells/CreatorShell";
import { api } from "@/convex/_generated/api";

import { SubmissionDrawer } from "./_components/SubmissionDrawer";
import { SubmissionRow, SubmissionTableHead } from "./_components/SubmissionRow";
import { FILTERS, SHARE_PERCENT, filterOf, parseFilter, stageOf, summaryOf, type Filter } from "./_lib/derive";

/** A list page shows a table of about ten rows; Show all opens the rest in place. */
const PAGE_ROWS = 10;

/** A chip with nothing under it: say what would be there, and offer the way back to All. */
const EMPTY_FILTER: Record<Exclude<Filter, "all">, { title: string; body: string }> = {
    progress: {
        title: "Nothing in progress",
        body: "A submission shows up here from the moment you send it until the owner pays.",
    },
    paid: {
        title: "Nothing paid yet",
        body: "When an owner pays, the submission moves here and your share goes to your Wallet. Free promo sites show up here too.",
    },
    drafts: {
        title: "No drafts",
        body: "A submission you start but don't send waits here, so you can finish it later.",
    },
    rejected: {
        title: "Nothing rejected",
        body: "If a reviewer can't use a submission, it shows up here with what to fix, and you get a notification.",
    },
};

export default function SubmissionsPage() {
    return (
        <CreatorShell>
            <PageHeader title="Submissions" sub="Where is each business I submitted?" />
            {/* useSearchParams needs a Suspense boundary, or the production build fails. */}
            <Suspense fallback={<ListSkeleton />}>
                <SubmissionsList />
            </Suspense>
        </CreatorShell>
    );
}

function ListSkeleton() {
    return (
        <Loading label="Loading your submissions" className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
                {[56, 108, 68, 80, 92].map((width, i) => (
                    <Skeleton key={i} width={width} height={32} round />
                ))}
            </div>
            <SkeletonRows count={4} />
        </Loading>
    );
}

function SubmissionsList() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { user, isLoaded, isSignedIn } = useUser();
    // One reading of the clock per visit: "Sep 27" against "Sep 27, 2025", and pay-link expiry.
    const [now] = useState(() => Date.now());
    const [showAll, setShowAll] = useState(false);

    const creator = useQuery(
        api.creators.getByClerkId,
        isLoaded && isSignedIn && user?.id ? { clerkId: user.id } : "skip",
    );

    const submissions = useQuery(
        api.submissions.getByCreatorId,
        creator?._id ? { creatorId: creator._id } : "skip",
    );

    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/login");
        }
    }, [isLoaded, isSignedIn, router]);

    const filter = parseFilter(searchParams.get("filter"));
    const openId = searchParams.get("open") || null;

    /** Set or clear query parameters in place, keeping any others (see the comment at the top). */
    const setParams = (changes: Record<string, string | null>) => {
        const next = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(changes)) {
            if (value === null) next.delete(key);
            else next.set(key, value);
        }
        const query = next.toString();
        window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    };

    // Waiting for Clerk, the creator row and the list. A signed-in person with
    // no creator row gets the empty list rather than a spinner that never
    // ends; New submission sends them on to /onboarding.
    if (!isLoaded || !isSignedIn || creator === undefined || (creator !== null && submissions === undefined)) {
        return <ListSkeleton />;
    }

    const all = submissions ?? [];
    const counts: Record<Filter, number> = { all: all.length, progress: 0, paid: 0, drafts: 0, rejected: 0 };
    for (const s of all) {
        const group = filterOf(stageOf(s.status));
        if (group) counts[group] += 1;
    }
    const rows = filter === "all" ? all : all.filter((s) => filterOf(stageOf(s.status)) === filter);
    const visible = showAll ? rows : rows.slice(0, PAGE_ROWS);
    const summary = summaryOf(all);
    // Looked up in the creator's own list: an id that is not theirs is "not found".
    const opened = openId ? (all.find((s) => s._id === openId) ?? null) : null;

    const changeFilter = (value: Filter) => {
        setShowAll(false);
        setParams({ filter: value === "all" ? null : value });
    };

    return (
        <>
            {all.length === 0 ? (
                <div className="t-card">
                    <EmptyState
                        icon={<Icon icon={Inbox} size={18} />}
                        title="No submissions yet"
                        body={`Visit a shop, record the 30-minute interview and submit it here. You earn ${SHARE_PERCENT}% of the price when the owner pays.`}
                        action={
                            <ButtonLink variant="primary" href="/submit/info">
                                <Icon icon={Plus} />
                                New submission
                            </ButtonLink>
                        }
                    />
                </div>
            ) : (
                <section className="flex flex-col gap-4" aria-label="Your submissions">
                    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                        <Chips
                            label="Filter submissions"
                            options={FILTERS.map((f) => ({ value: f.value, label: f.label, count: counts[f.value] }))}
                            value={filter}
                            onChange={changeFilter}
                        />
                        {summary && <p className="t-meta t-num">{summary}</p>}
                    </div>

                    <div className="t-card overflow-hidden">
                        {rows.length > 0 ? (
                            <>
                                <SubmissionTableHead />
                                <List>
                                    {visible.map((s) => (
                                        <SubmissionRow
                                            key={s._id}
                                            s={s}
                                            now={now}
                                            selected={s._id === openId}
                                            onOpen={() => setParams({ open: s._id })}
                                        />
                                    ))}
                                </List>
                                {rows.length > PAGE_ROWS && (
                                    <button type="button" className="t-showall" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
                                        {showAll ? "Show less" : `Show all ${rows.length}`}
                                    </button>
                                )}
                            </>
                        ) : (
                            filter !== "all" && (
                                <EmptyState
                                    icon={<Icon icon={Inbox} size={18} />}
                                    title={EMPTY_FILTER[filter].title}
                                    body={EMPTY_FILTER[filter].body}
                                    action={<Button onClick={() => changeFilter("all")}>Show all submissions</Button>}
                                />
                            )
                        )}
                    </div>

                    <p className="t-meta">
                        {`You earn ${SHARE_PERCENT}% of each website's price. It moves to your `}
                        <Link className="t-link" href="/wallet">
                            Wallet
                        </Link>
                        {" when the owner pays. Free promo sites still earn your share."}
                    </p>
                </section>
            )}

            <SubmissionDrawer open={openId !== null} submission={opened} onClose={() => setParams({ open: null })} now={now} />
        </>
    );
}
