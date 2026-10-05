"use client";

import { useClerk } from "@clerk/nextjs";
import { Check, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, type ReactNode } from "react";

import { Button, Icon, Loading, Logo, PublicPage, Skeleton, SkeletonText, Status, Stepper, cx } from "@/components/r1";

import { railFor, stageOf, stepperIndex, type FunnelView, type Lifecycle, type RailStep } from "./rail";

/*
 * The frame every certification screen wears (board Certification): a
 * funnel, so the header is the wordmark and one quiet exit, Sign out, and
 * nothing else to wander off to. Under it the page title, the one question it
 * answers, "Step N of 5", then the five stages on the left (a stepper above
 * the content on a phone) and the current stage's card.
 *
 * ONE FRAME FOR SIX ROUTES: /onboarding, /training, /training-lessons,
 * /certification-quiz, /pending and /verification-rejected are one flow seen
 * at different moments. Each route keeps its own guards and redirects; only
 * the look is shared.
 */

/** Sign out the way /pending and /verification-rejected always have: Clerk, then /login. */
export function useSignOutToLogin() {
    const { signOut } = useClerk();
    const router = useRouter();
    return () => signOut(() => router.replace("/login"));
}

/**
 * The kit's funnel header (components/r1 FunnelHeader) with Sign out as its
 * exit. FunnelHeader's exit can only be a link and signing out is a Clerk
 * call, so the same markup is drawn here; the side padding follows the
 * 1120px content column, as on the board.
 */
function FunnelTop() {
    const signOut = useSignOutToLogin();
    return (
        <header className="t-pub-head is-funnel lg:px-[max(24px,calc((100%_-_1120px)/2))]">
            <Link href="/" className="flex items-center" aria-label="Tendso home">
                <Logo height={20} priority />
            </Link>
            <Button variant="ghost" onClick={signOut}>
                <Icon icon={LogOut} />
                Sign out
            </Button>
        </header>
    );
}

/** The numbered circle of a stage or a lesson: a check once done. */
export function Marker({ n, kind }: { n: number; kind: RailStep["marker"] }) {
    const look = {
        done: "border-r1-ink bg-r1-ink text-r1-paper",
        now: "border-r1-ink bg-r1-paper text-r1-ink",
        bad: "border-r1-red-dot bg-r1-paper text-r1-red",
        todo: "border-r1-line-2 bg-r1-paper text-r1-ink-3",
    }[kind];
    return (
        <span
            aria-hidden="true"
            className={cx("inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border-[1.5px] text-xs font-semibold tabular-nums", look)}
        >
            {kind === "done" ? <Icon icon={Check} size={14} /> : n}
        </span>
    );
}

function RailHelp({ className }: { className?: string }) {
    return (
        <div className={cx("flex flex-col gap-1 border-t border-r1-line pt-4", className)}>
            <span className="t-meta">Stuck on a step?</span>
            <Link href="/knowledge" className="t-link self-start text-sm">
                Open Help
            </Link>
        </div>
    );
}

export function FunnelFrame({ view, creator, children }: { view: FunnelView; creator?: Lifecycle; children: ReactNode }) {
    const rail = railFor(view, creator);
    return (
        <PublicPage header={<FunnelTop />}>
            <div className="mx-auto flex w-full max-w-[1168px] flex-col gap-6 px-4 pb-16 pt-6 sm:gap-8 sm:px-6 sm:pt-8 lg:pt-10">
                <header className="t-page-head">
                    <div className="t-page-titles">
                        <h1 className="t-h1">Get certified</h1>
                        <p className="t-sub">How do I become a certified creator?</p>
                    </div>
                    <span className="t-meta t-num">Step {stageOf(view)} of 5</span>
                </header>

                {/* Phone and tablet: the stages as a stepper (only the current one keeps its name). */}
                <Stepper steps={rail.map((s) => s.short)} current={stepperIndex(view)} label="Certification steps" className="lg:hidden" />

                <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-16">
                    <div className="flex flex-col gap-6 max-lg:hidden">
                        <nav aria-label="Certification steps">
                            <ol className="flex flex-col gap-1">
                                {rail.map((s, i) => (
                                    <li
                                        key={s.title}
                                        aria-current={s.current ? "step" : undefined}
                                        className={cx("flex min-h-[60px] items-start gap-3 rounded-r1 px-3 py-2.5", s.current && "bg-r1-fill-nav")}
                                    >
                                        <Marker n={i + 1} kind={s.marker} />
                                        <span className="flex min-w-0 flex-col gap-1">
                                            <span className="text-sm font-medium leading-5 text-r1-ink">{s.title}</span>
                                            <span className="t-meta">{s.meta}</span>
                                            <Status tone={s.tone} word={s.word} />
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        </nav>
                        <RailHelp className="px-3" />
                    </div>

                    <div className="flex min-w-0 flex-col gap-6">
                        {children}
                        <RailHelp className="lg:hidden" />
                    </div>
                </div>
            </div>
        </PublicPage>
    );
}

/** A stage's card shape, while its data loads. */
export function StepSkeleton() {
    return (
        <Loading label="Loading your progress">
            <div className="t-card" aria-hidden="true">
                <div className="flex flex-col gap-2.5 border-b border-r1-line p-4 sm:p-6">
                    <Skeleton width="40%" height={16} />
                    <Skeleton width="72%" height={12} />
                </div>
                <div className="p-4 sm:p-6">
                    <SkeletonText lines={4} />
                </div>
            </div>
        </Loading>
    );
}

/** The frame with a loading card: the Suspense fallback, and each page's loading state. */
export function FunnelFallback({ view, creator }: { view: FunnelView; creator?: Lifecycle }) {
    return (
        <FunnelFrame view={view} creator={creator}>
            <StepSkeleton />
        </FunnelFrame>
    );
}

/** A stage's card: a head (status, title, one line), the body, and a foot with the stage's actions. */
export function StepCard({
    title,
    status,
    intro,
    aside,
    children,
    foot,
}: {
    title: ReactNode;
    status?: ReactNode;
    intro?: ReactNode;
    /** Top right of the head ("3 of 5 done"). */
    aside?: ReactNode;
    children?: ReactNode;
    foot?: ReactNode;
}) {
    const id = useId();
    return (
        <section className="t-card" aria-labelledby={id}>
            <div className="flex items-start justify-between gap-4 border-b border-r1-line p-4 sm:p-6">
                <div className="flex min-w-0 max-w-[560px] flex-col gap-1">
                    {status}
                    <h2 className="t-h2" id={id}>
                        {title}
                    </h2>
                    {intro && <p className="t-body">{intro}</p>}
                </div>
                {aside && <div className="flex-none pt-0.5">{aside}</div>}
            </div>
            {children}
            {foot && (
                <div className="flex flex-col gap-3 border-t border-r1-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">{foot}</div>
            )}
        </section>
    );
}

export function StepBody({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cx("flex flex-col gap-5 p-4 sm:p-6", className)}>{children}</div>;
}

/** The foot's actions. On a phone they share the full width. */
export function FootActions({ children }: { children: ReactNode }) {
    return <div className="flex flex-wrap items-center gap-2 max-sm:*:flex-1 sm:justify-end">{children}</div>;
}

/** The quiet grey block the board uses for "Before you film" and similar notes. */
export function NoteBlock({ label, children }: { label?: ReactNode; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1 rounded-r1 bg-r1-fill-2 px-4 py-3">
            {label && <span className="t-label">{label}</span>}
            {children}
        </div>
    );
}
