"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { Copy, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import {
    Avatar,
    Button,
    EmptyState,
    Fold,
    Highlight,
    Icon,
    Loading,
    PageHeader,
    Skeleton,
    SkeletonCard,
    SkeletonRows,
    Status,
    TableHead,
    cx,
    formatMoney,
    type StatusWord,
} from "@/components/r1";
import { CreatorShell } from "@/components/shells/CreatorShell";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { REFERRAL_BONUS } from "@/lib/pricing";

import { EnterCodeDialog } from "./_components/EnterCodeDialog";
import { bonusNote, referralStatus, shortDate, shortName, type Referral } from "./_lib/referrals";

/**
 * Referrals (board: Referrals). One question: who have I brought in, and what
 * did it earn?
 *
 * The code first, as the one highlighted card, with the rule it pays under.
 * Then the total it has earned, the people who joined with it, how it works in
 * a closed fold, and at the very bottom the way in for a creator who was
 * invited themselves (moved here from Profile).
 *
 * THE BONUS IS STATED ONCE, FROM lib/pricing, as the old page stated it: on a
 * referred creator's first PAID site (convex/payments.ts pays REFERRAL_BONUS
 * exactly then, never on a free promo site). Per person the page shows only
 * what the referrals row records; it adds no new peso promise.
 *
 * NO INVITE LINK. The board's primary action is "Copy invite link"
 * (/for-creators?ref=CODE), but nothing on the web reads ?ref=, so that link
 * would credit no one. Onboarding takes a code typed by hand (and passes it to
 * creators.create), so the code is what credits a referrer: copying the code is
 * the one action until the link is wired end to end.
 */

const TITLE = "Referrals";
const SUB = "Who have I brought in, and what did it earn?";
/** People shown before "Show all". */
const CAP = 5;

export default function ReferralsPage() {
    const router = useRouter();
    const { user, isLoaded, isSignedIn } = useUser();

    const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip");

    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/login");
        }
    }, [isLoaded, isSignedIn, router]);

    useEffect(() => {
        if (isLoaded && isSignedIn && creator === null) {
            router.push("/onboarding");
        }
    }, [isLoaded, isSignedIn, creator, router]);

    // Still loading, signed out, or on the way to onboarding: the page's own
    // shape stays on screen until the redirect or the data arrives.
    if (!isLoaded || !isSignedIn || creator === undefined || creator === null) {
        return (
            <CreatorShell>
                <PageHeader title={TITLE} sub={SUB} />
                <ReferralsSkeleton />
            </CreatorShell>
        );
    }

    return <Referrals creator={creator} />;
}

function Referrals({ creator }: { creator: Doc<"creators"> }) {
    const referrals = useQuery(api.referrals.getByReferrer, { referrerId: creator._id });
    const stats = useQuery(api.referrals.getStats, { referrerId: creator._id });
    const [codeOpen, setCodeOpen] = useState(false);
    const listTitleId = useId();

    const code = creator.referralCode || "";
    // The earnings card is cut while nobody has joined with the code: it would
    // only ever read ₱0 (ComponentKit, Cards).
    const showEarned = stats === undefined || stats.total > 0;

    return (
        <CreatorShell>
            <PageHeader title={TITLE} sub={SUB} />

            <section
                aria-label="Your invite code and referral earnings"
                className={cx("grid gap-6", showEarned && "md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]")}
            >
                <CodeCard code={code} />
                {stats === undefined ? <SkeletonCard /> : stats.total > 0 ? <EarnedCard pending={stats.pending} earned={stats.totalEarned} /> : null}
            </section>

            <section aria-labelledby={listTitleId} className="flex flex-col gap-3">
                <div className="flex items-baseline gap-2">
                    <h2 id={listTitleId} className="t-h2">
                        People you invited
                    </h2>
                    {referrals && referrals.length > 0 && <span className="t-count">{referrals.length}</span>}
                </div>
                <InvitedList referrals={referrals} />
            </section>

            <Fold title="How referrals work">
                <ol className="m-0 grid list-none gap-6 p-0 pb-2 sm:grid-cols-3">
                    <Step n={1} title="Share your code" body="Send it to someone who wants to earn by making websites for local shops." />
                    <Step
                        n={2}
                        title="They join and get certified"
                        body={`They sign up, add ${code || "your code"} on their Referrals page, and get certified.`}
                    />
                    <Step
                        n={3}
                        title="Their first site gets paid"
                        body={`When the owner pays for their first website, ${formatMoney(REFERRAL_BONUS)} lands in your Wallet.`}
                    />
                </ol>
            </Fold>

            {/* Offered only while no code has been applied, exactly as Profile did. */}
            {creator.referredByCode ? (
                <p className="t-meta flex min-h-10 items-center">
                    <span>
                        You joined with code <span className="t-mono text-r1-ink">{creator.referredByCode}</span>.
                    </span>
                </p>
            ) : (
                <p className="t-meta flex flex-wrap items-center gap-1">
                    Were you invited?
                    <button
                        type="button"
                        className="t-link inline-flex h-10 cursor-pointer items-center border-0 bg-transparent px-1 text-[13px] font-medium"
                        onClick={() => setCodeOpen(true)}
                    >
                        Enter a code
                    </button>
                </p>
            )}

            <EnterCodeDialog open={codeOpen} onClose={() => setCodeOpen(false)} creatorId={creator._id} ownCode={code} />
        </CreatorShell>
    );
}

/** The one highlighted card: the code, the one action, and the rule it pays under. */
function CodeCard({ code }: { code: string }) {
    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(code);
            toast.success("Code copied");
        } catch {
            // No clipboard here (an old browser, or a page not on https). The
            // code itself is selectable, so it can still be copied by hand.
            toast.error("Couldn't copy it. Select the code and copy it yourself.");
        }
    };

    return (
        <Highlight className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
                <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="t-label">Your invite code</span>
                    {code ? (
                        <span className="select-all font-r1-mono text-[28px] font-medium leading-9 tracking-[0.04em] text-r1-ink wrap-anywhere">
                            {code}
                        </span>
                    ) : (
                        <span className="t-body">You don&apos;t have an invite code yet.</span>
                    )}
                </div>
                {code && (
                    <Button variant="primary" className="w-full flex-none sm:w-auto" onClick={copyCode}>
                        <Icon icon={Copy} />
                        Copy code
                    </Button>
                )}
            </div>
            <div className="flex flex-col gap-1 border-t border-r1-gold-line pt-4">
                <p className="t-body max-w-[62ch] text-r1-ink">
                    You get {formatMoney(REFERRAL_BONUS)} when a creator who joins with your code has their first website paid for by its owner.
                </p>
                <p className="t-meta">Once per creator. Free promo sites don&apos;t count.</p>
            </div>
        </Highlight>
    );
}

/** One number (what referrals have paid) and one status (who is still on the way). */
function EarnedCard({ pending, earned }: { pending: number; earned: number }) {
    const status: StatusWord =
        pending > 0 ? { tone: "progress", word: `${pending} creator${pending === 1 ? "" : "s"} on the way` } : { tone: "off", word: "Nothing waiting" };
    return (
        <div className="t-card flex flex-col gap-3 p-5 sm:p-6">
            <span className="t-label">Earned from referrals</span>
            <span className="t-figure">{formatMoney(earned)}</span>
            <Status {...status} />
            <p className="t-meta mt-auto">
                Bonuses go straight to your{" "}
                <Link href="/wallet" className="t-link">
                    Wallet
                </Link>
                .
            </p>
        </div>
    );
}

/**
 * The people who joined with the code, newest first. A table on a wide desk;
 * below that each person stacks (name and bonus on top, the date, status and
 * when the bonus comes underneath), so nothing scrolls sideways.
 */
function InvitedList({ referrals }: { referrals: Referral[] | undefined }) {
    const [expanded, setExpanded] = useState(false);

    if (referrals === undefined) {
        return (
            <Loading label="Loading the people you invited">
                <SkeletonRows count={2} avatar />
            </Loading>
        );
    }

    if (referrals.length === 0) {
        return (
            <div className="t-card">
                <EmptyState
                    icon={<Icon icon={UserPlus} size={18} />}
                    title="No one yet"
                    body="Share your code with someone who wants to make websites for local shops. When they add it, they show up here."
                />
            </div>
        );
    }

    const visible = expanded ? referrals : referrals.slice(0, CAP);

    return (
        <div className="t-card overflow-hidden">
            <TableHead className="hidden xl:flex">
                <span className="min-w-0 flex-1">Creator</span>
                <span className="w-[140px] flex-none">Joined</span>
                <span className="w-[180px] flex-none">Status</span>
                <span className="w-[260px] flex-none text-right">Your bonus</span>
            </TableHead>
            <div className="t-list">
                {visible.map((r) => (
                    <InvitedRow key={r._id} referral={r} />
                ))}
            </div>
            {referrals.length > CAP && (
                <button type="button" className="t-showall" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
                    {expanded ? "Show less" : `Show all ${referrals.length}`}
                </button>
            )}
        </div>
    );
}

function InvitedRow({ referral }: { referral: Referral }) {
    const name = shortName(referral.referredName);
    const joined = shortDate(referral.createdAt);
    const status = referralStatus(referral.status);
    const note = bonusNote(referral);

    return (
        <div className="t-row items-start xl:items-center">
            <span className="flex min-w-0 flex-1 items-start gap-3 xl:items-center">
                <Avatar name={name} />
                <span className="flex min-w-0 flex-col">
                    <span className="t-row-title">{name}</span>
                    <span className="t-meta">
                        <span className="xl:hidden">Joined {joined} · </span>Used your code
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 xl:hidden">
                        <Status {...status} />
                        {note && <span className="t-meta">{note}</span>}
                    </span>
                </span>
            </span>
            <span className="t-body t-num hidden w-[140px] flex-none xl:block">{joined}</span>
            <span className="hidden w-[180px] flex-none xl:block">
                <Status {...status} />
            </span>
            <span className="flex flex-none flex-col items-end xl:w-[260px]">
                <span className="t-body t-num text-r1-ink">{formatMoney(referral.bonusAmount ?? 0)}</span>
                {note && <span className="t-meta hidden xl:block">{note}</span>}
            </span>
        </div>
    );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
    return (
        <li className="flex items-start gap-3">
            <span className="t-num inline-flex h-7 w-7 flex-none items-center justify-center rounded-full border border-r1-line-2 text-[13px] font-semibold text-r1-ink">
                {n}
            </span>
            <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold leading-5 text-r1-ink">{title}</h3>
                <p className="t-meta">{body}</p>
            </div>
        </li>
    );
}

/** The page's shape while the creator row loads: the code card, the earnings card, two people. */
function ReferralsSkeleton() {
    return (
        <Loading label="Loading your referrals" className="flex flex-col gap-6">
            <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" aria-hidden="true">
                <div className="t-card flex flex-col gap-4 p-5 sm:p-6">
                    <Skeleton width={110} height={12} />
                    <Skeleton width={200} height={32} />
                    <Skeleton width="80%" height={14} />
                </div>
                <SkeletonCard />
            </div>
            <SkeletonRows count={2} avatar />
        </Loading>
    );
}
