"use client";

import { useQuery } from "convex/react";
import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { useId, type ReactNode } from "react";

import {
    ButtonLink,
    Card,
    cx,
    Dot,
    formatMoney,
    Highlight,
    Icon,
    leadStatus,
    Loading,
    PageHeader,
    RowLink,
    ShowAllList,
    Skeleton,
    SkeletonCard,
    SkeletonRows,
    SkeletonText,
    Status,
    type Tone,
} from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

import {
    activityItems,
    owedOf,
    ownerShortName,
    payoutOf,
    pickNextStep,
    pickShop,
    referralStatus,
    shortDate,
    stateLine,
    submissionHref,
    type ActivityItem,
    type FeedLead,
    type NextStep,
} from "../_lib/home";

type Creator = Doc<"creators">;

/**
 * The creator's Home (board Main): "What should I do next?"
 *
 * The state of their sites in one line, the one next step (the screen's one
 * highlight and its one hero figure), a shop to visit and the referral code,
 * and the recent activity. The caller has already
 * checked this is a certified creator; this only reads.
 */
export function CreatorHome({ creator }: { creator: Creator }) {
    const submissions = useQuery(api.submissions.getByCreatorId, { creatorId: creator._id });
    // Team leads feed: the same listForMobileCRM query the /leads page uses, so
    // the shop suggested here is one /leads shows too. Admins never see Home
    // (they are sent to /admin), and never subscribed to it.
    const leadsFeed = useQuery(api.leads.listForMobileCRM, creator.role !== "admin" ? {} : "skip");
    const withdrawals = useQuery(api.withdrawals.getByCreator, { creatorId: creator._id });
    const referrals = useQuery(api.referrals.getStats, creator.referralCode ? { referrerId: creator._id } : "skip");

    const balance = creator.balance ?? 0;
    const earned = creator.totalEarnings ?? 0;

    return (
        <>
            <PageHeader title={`Mabuhay, ${creator.firstName || "Creator"}.`} sub="What should I do next?" />
            {submissions === undefined ? (
                <Loading label="Loading your home" className="flex flex-col gap-6 lg:gap-8">
                    <BodyShapes />
                </Loading>
            ) : (
                <>
                    <StateLine state={stateLine(submissions)} earned={earned} balance={balance} />

                    <section aria-label="Your next steps" className="flex flex-col gap-4">
                        <NextStepHighlight step={pickNextStep(submissions, balance)} />
                        <SideCards
                            shop={leadsFeed === undefined ? undefined : pickShop(leadsFeed.leads, submissions)}
                            code={creator.referralCode ?? null}
                            referrals={referrals}
                        />
                    </section>

                    <RecentActivity items={withdrawals === undefined ? undefined : activityItems(submissions, withdrawals)} />
                </>
            )}
        </>
    );
}

/** Home while the creator row itself is still loading: the header's shape too. */
export function HomeSkeleton() {
    return (
        <Loading label="Loading your home" className="flex flex-col gap-6 lg:gap-8">
            <div className="flex flex-col gap-2" aria-hidden="true">
                <Skeleton width={260} height={36} />
                <Skeleton width={180} height={16} />
            </div>
            <BodyShapes />
        </Loading>
    );
}

/** The state line, the next-step card, the two cards and three activity rows. */
function BodyShapes() {
    return (
        <>
            <Skeleton width="70%" height={14} />
            <div className="flex flex-col gap-4" aria-hidden="true">
                <div className="t-card flex flex-col gap-3 p-5 sm:p-6">
                    <Skeleton width={96} height={12} />
                    <Skeleton width="45%" height={22} />
                    <SkeletonText lines={2} />
                    <Skeleton width={160} height={40} className="mt-2" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
            </div>
            <SkeletonRows count={3} />
        </>
    );
}

const Sep = () => (
    <span aria-hidden="true" className="text-r1-ink-4">
        ·
    </span>
);

/**
 * "1 of your 2 sites is waiting on payment · ₱500 earned so far · ₱0 ready to
 * withdraw · Open wallet". The money half shows once there is money: a new
 * creator is not greeted with zeros. Earned and ready are the wallet's own
 * figures (creators.totalEarnings and creators.balance; a withdrawal leaves
 * the balance the moment it is requested).
 */
function StateLine({ state, earned, balance }: { state: { tone: Tone; text: string } | null; earned: number; balance: number }) {
    const money = earned > 0 || balance > 0;
    if (!state && !money) return null;
    return (
        <p className="t-body flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {state && (
                <>
                    <Dot tone={state.tone} />
                    <span>{state.text}</span>
                </>
            )}
            {money && (
                <>
                    {state && <Sep />}
                    <span className="t-num">{formatMoney(earned)} earned so far</span>
                    <Sep />
                    <span className="t-num">{formatMoney(balance)} ready to withdraw</span>
                    <Link href="/wallet" className="t-link">
                        Open wallet
                    </Link>
                </>
            )}
        </p>
    );
}

type StepView = { title: string; body: string; figure?: { value: string; caption: string }; actions: ReactNode };

/** A button label that is a business name: it truncates instead of pushing the card wider on a phone. */
function OpenSubmission({ s, variant }: { s: Doc<"submissions">; variant: "primary" | "ghost" }) {
    const biz = s.businessName?.trim() || "submission";
    return (
        <ButtonLink variant={variant} href={submissionHref(s._id)} className="max-w-full">
            <span className="min-w-0 truncate">Open {biz}</span>
        </ButtonLink>
    );
}

const SeeLeads = ({ variant = "primary" }: { variant?: "primary" | "ghost" }) => (
    <ButtonLink variant={variant} href="/leads">
        See leads
    </ButtonLink>
);

function stepView(step: NextStep): StepView {
    switch (step.kind) {
        case "payment": {
            const s = step.submission;
            const biz = s.businessName?.trim() || "your site";
            const owner = ownerShortName(s.ownerName);
            const owed = owedOf(s);
            const payout = payoutOf(s);
            const unpaid = `hasn't paid${owed ? ` the ${owed}` : ""} yet.`;
            // The pay link itself is not offered: the only query that returns it
            // (paymentTokens.getBySubmissionId) has no auth check, so the app does
            // not read it from the browser (see components/shells/OwnerShell.tsx).
            // The owner already has it by email; the creator's lever is a reminder.
            const lead = s.sentEmailAt
                ? `${biz} is live and ${owner} got the pay link on ${shortDate(s.sentEmailAt)}, but ${unpaid}`
                : `${biz} is live, but ${owner} ${unpaid}`;
            return {
                title: `Get ${biz} paid`,
                body: `${lead} A reminder from you can help.${payout ? ` Your ${payout} lands in your wallet as soon as the payment is confirmed.` : ""}`,
                figure: payout ? { value: payout, caption: "yours when the owner pays" } : undefined,
                actions: <OpenSubmission s={s} variant="primary" />,
            };
        }
        case "draft": {
            const s = step.submission;
            const biz = s.businessName?.trim();
            return {
                title: biz ? `Finish ${biz}` : "Finish your draft",
                body: `You started ${biz || "a submission"} on ${shortDate(s._creationTime)} but haven't submitted it yet. Pick up where you left off.`,
                actions: (
                    // /submit/info resumes the newest draft, which is the one named here.
                    <ButtonLink variant="primary" href="/submit/info">
                        Continue draft
                    </ButtonLink>
                ),
            };
        }
        case "withdraw":
            return {
                title: "Withdraw your earnings",
                body: "Your earnings are ready. Withdraw them to your Wise account from your Wallet.",
                figure: { value: formatMoney(step.balance), caption: "ready to withdraw" },
                actions: (
                    <ButtonLink variant="primary" href="/wallet">
                        Open wallet
                    </ButtonLink>
                ),
            };
        case "review": {
            const biz = step.submission.businessName?.trim() || "Your submission";
            return {
                title: `${biz} is in review`,
                body: "We'll let you know when it's approved. In the meantime, line up your next shop.",
                actions: (
                    <>
                        <SeeLeads />
                        <OpenSubmission s={step.submission} variant="ghost" />
                    </>
                ),
            };
        }
        case "generated": {
            const biz = step.submission.businessName?.trim() || "Your submission";
            return {
                title: `${biz} was approved`,
                body: "Its website is being set up. We'll let you know when it's live. In the meantime, line up your next shop.",
                actions: (
                    <>
                        <SeeLeads />
                        <OpenSubmission s={step.submission} variant="ghost" />
                    </>
                ),
            };
        }
        case "next":
            return {
                title: "Line up your next shop",
                body: "Nothing is waiting on you right now. Find the next business to interview.",
                actions: <SeeLeads />,
            };
        case "first":
            return {
                title: "Record your first interview",
                body: "Visit a local shop, interview the owner and submit it here.",
                actions: (
                    <>
                        {/* The empty state is the one place a page repeats the sidebar's New submission (ComponentKit). */}
                        <ButtonLink variant="primary" href="/submit/info">
                            <Icon icon={Plus} />
                            New submission
                        </ButtonLink>
                        <SeeLeads variant="ghost" />
                    </>
                ),
            };
    }
}

/**
 * The screen's one highlight. On a desk the hero figure stands to the right
 * of the words; on a phone it sits between the words and the buttons.
 */
function NextStepHighlight({ step }: { step: NextStep }) {
    const { title, body, figure, actions } = stepView(step);
    return (
        <Highlight className={cx("grid gap-5 p-5 sm:p-6 lg:items-center lg:gap-x-12 lg:px-8 lg:py-7", figure && "lg:grid-cols-[minmax(0,1fr)_auto]")}>
            <div className="flex max-w-[640px] flex-col gap-2">
                <span className="t-label t-hl-label">Your next step</span>
                <h2 className="t-h2 text-xl leading-7 lg:text-[22px]">{title}</h2>
                <p className="t-body">{body}</p>
            </div>
            {figure && (
                <div className="flex flex-col gap-1 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:items-end lg:gap-2">
                    <span className="t-hero-fig">{figure.value}</span>
                    <span className="t-meta">{figure.caption}</span>
                </div>
            )}
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </Highlight>
    );
}

/** The two cards under the next step. `shop` undefined = the leads feed is still loading. */
function SideCards({
    shop,
    code,
    referrals,
}: {
    shop: FeedLead | null | undefined;
    code: string | null;
    referrals: { pending: number; qualified: number; paid: number } | undefined;
}) {
    const count = (shop === null ? 0 : 1) + (code ? 1 : 0);
    if (count === 0) return null;
    return (
        <div className={cx("grid gap-4", count > 1 && "sm:grid-cols-2")}>
            {shop === undefined ? <SkeletonCard /> : shop && <ShopCard lead={shop} />}
            {code && <ReferralCard code={code} referrals={referrals} />}
        </div>
    );
}

function CardHead({ label, children }: { label: string; children?: ReactNode }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="t-label">{label}</span>
            {children}
        </div>
    );
}

function ShopCard({ lead }: { lead: FeedLead }) {
    const where = [lead.businessType, lead.businessCity].filter(Boolean).join(" · ");
    return (
        <Card pad className="flex flex-col gap-4">
            <CardHead label="A shop to visit">
                <Status {...leadStatus(lead.status)} />
            </CardHead>
            <div className="flex flex-col gap-1">
                <h2 className="t-h2">{lead.businessName}</h2>
                <p className="t-meta">{where ? `${where} · nobody has interviewed it yet` : "Nobody has interviewed it yet"}</p>
            </div>
            <ButtonLink href="/leads" className="self-start">
                See leads
                <Icon icon={ArrowRight} />
            </ButtonLink>
        </Card>
    );
}

/**
 * The invite code, and how far the people who used it have got. No peso
 * figure: Theo dropped the ₱1,000 referral line from For creators (README,
 * Decisions) and creator screens add no earnings claims. The Referrals screen
 * carries the programme's terms.
 */
function ReferralCard({ code, referrals }: { code: string; referrals: { pending: number; qualified: number; paid: number } | undefined }) {
    const status = referralStatus(referrals);
    return (
        <Card pad className="flex flex-col gap-4">
            <CardHead label="Bring in a creator">{status && <Status {...status} />}</CardHead>
            <div className="flex flex-col gap-1">
                <h2 className="t-h2">
                    Your code is <span className="font-r1-mono">{code}</span>
                </h2>
                <p className="t-meta">Give it to someone who wants to make websites for local shops.</p>
            </div>
            <ButtonLink href="/referrals" className="self-start">
                Share your code
                <Icon icon={ArrowRight} />
            </ButtonLink>
        </Card>
    );
}

/** Submissions and withdrawals, newest first: three rows, then Show all in place. */
function RecentActivity({ items }: { items: ActivityItem[] | undefined }) {
    const id = useId();
    if (items?.length === 0) return null;
    return (
        <section aria-labelledby={id} className="flex flex-col gap-3">
            <h2 className="t-h2" id={id}>
                Recent activity
            </h2>
            {items === undefined ? (
                <Loading label="Loading recent activity">
                    <SkeletonRows count={3} />
                </Loading>
            ) : (
                <ShowAllList items={items} initial={3} renderItem={(item) => <ActivityRow key={item.key} item={item} />} />
            )}
        </section>
    );
}

/** Date | what happened | status on a desk; on a phone the date and status go under the words. */
function ActivityRow({ item }: { item: ActivityItem }) {
    const date = shortDate(item.at);
    return (
        <RowLink href={item.href}>
            <span className="t-meta t-num hidden min-w-14 flex-none whitespace-nowrap sm:block">{date}</span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="t-body">{item.text}</span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:hidden">
                    <span className="t-meta t-num">{date}</span>
                    <Status {...item.status} />
                </span>
            </span>
            <Status {...item.status} className="hidden sm:inline-flex" />
        </RowLink>
    );
}
