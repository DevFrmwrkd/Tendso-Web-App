"use client";

import { SignIn, SignOutButton, useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Component, type ReactNode } from "react";

import { Button, ButtonLink } from "@/components/r1/Button";
import { Loading, SkeletonRows } from "@/components/r1/Skeleton";
import { api } from "@/convex/_generated/api";

import { ReviewBoard } from "./ReviewBoard";

function ReviewSession() {
    const { isLoaded, isSignedIn, user } = useUser();
    const { isAuthenticated, isLoading } = useConvexAuth();
    const session = useQuery(
        api.giveaway.reviewerSession,
        isAuthenticated ? {} : "skip",
    );
    const canReview = Boolean(
        isSignedIn &&
        isAuthenticated &&
        session?.clerkId === user?.id &&
        session?.canReview,
    );
    const queue = useQuery(api.giveaway.reviewQueue, canReview ? {} : "skip");
    const approve = useMutation(api.giveaway.approveApplication);
    const reject = useMutation(api.giveaway.rejectApplication);

    if (
        !isLoaded ||
        (isSignedIn && (isLoading || !isAuthenticated || session === undefined))
    ) {
        return (
            <Loading label="Checking review access…">
                <SkeletonRows count={3} />
            </Loading>
        );
    }
    if (!isSignedIn) {
        return (
            <section className="mx-auto flex max-w-md flex-col items-center gap-5 py-10">
                <div className="text-center">
                    <h1 className="t-h1">Giveaway review</h1>
                    <p className="t-body mt-2">
                        Sign in with your designated Off the Record reviewer
                        account.
                    </p>
                </div>
                <SignIn
                    routing="hash"
                    forceRedirectUrl="/otr/review"
                    signUpForceRedirectUrl="/otr/review"
                />
            </section>
        );
    }
    if (!canReview) {
        return (
            <section className="t-card mx-auto my-10 max-w-lg space-y-4 p-6">
                <h1 className="t-h1">Reviewer access required</h1>
                <p className="t-body">
                    This account is not assigned to review the Off the Record
                    giveaway. Ask the campaign coordinator to add your reviewer
                    account.
                </p>
                <SignOutButton redirectUrl="/otr/review">
                    <Button>Use a different account</Button>
                </SignOutButton>
            </section>
        );
    }
    if (!queue)
        return (
            <Loading label="Loading giveaway applications…">
                <SkeletonRows count={3} />
            </Loading>
        );
    return (
        <ReviewBoard
            queue={queue}
            onApprove={async (submissionId) => {
                await approve({ submissionId });
            }}
            onReject={async (submissionId, reason) => {
                await reject({ submissionId, reason });
            }}
        />
    );
}

class ReviewBoundary extends Component<
    { children: ReactNode },
    { failed: boolean }
> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    render() {
        if (this.state.failed) {
            return (
                <section
                    className="t-card mx-auto my-10 max-w-lg space-y-4 p-6"
                    role="alert"
                >
                    <h1 className="t-h2">The review queue is unavailable</h1>
                    <p className="t-body">
                        Your access may have changed, or the connection was
                        interrupted. Reload to check again.
                    </p>
                    <Button onClick={() => window.location.reload()}>
                        Reload review page
                    </Button>
                </section>
            );
        }
        return this.props.children;
    }
}

export default function GiveawayReview() {
    return (
        <div className="r1 min-h-dvh">
            <header className="border-b border-[var(--r1-line)] bg-white">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                        {/* The OTR mark is a supplied campaign asset, paired with its readable name. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/otr-mark.png"
                            alt=""
                            className="h-10 w-10 object-contain"
                            width={40}
                            height={40}
                        />
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-wider">
                                Off the Record
                            </p>
                            <p className="t-meta">
                                100 website giveaway · Review
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ButtonLink
                            href="/100-pages-giveaway"
                            size="sm"
                            variant="ghost"
                        >
                            Campaign page
                        </ButtonLink>
                        <SignedInExit />
                    </div>
                </div>
            </header>
            <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
                <ReviewBoundary>
                    <ReviewSession />
                </ReviewBoundary>
            </main>
        </div>
    );
}

function SignedInExit() {
    const { isSignedIn } = useUser();
    return isSignedIn ? (
        <SignOutButton redirectUrl="/otr/review">
            <Button variant="ghost" size="sm">
                Sign out
            </Button>
        </SignOutButton>
    ) : null;
}
