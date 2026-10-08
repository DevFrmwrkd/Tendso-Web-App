"use client";

/**
 * Creator "application under review" gate — web equivalent of mobile's
 * /pending-review. A creator who passed the onboarding quiz (quizPassedAt set)
 * but isn't approved yet (certifiedAt unset) lands here. The ONLY escape is
 * sign out; an admin approving/rejecting auto-routes them off this page in
 * real time via the Convex live query (no refresh).
 *
 * See docs/changes/CREATOR-PENDING-APPROVAL-PAGE.md.
 * Routes are flat on web (/pending, /dashboard, /verification-rejected) — the
 * brief's /creator/* prefix does not apply here.
 *
 * Round 1 (board Certification, stages 4 and 5): the same gate in the
 * certification frame. One thing changed on purpose: when the approval lands
 * WHILE this page is open, it shows stage 5 (the certificate, Download, "Go to
 * Home") instead of jumping to /dashboard. That is "the end of Certification"
 * on the board. Arriving here already approved still goes straight to
 * /dashboard, and a rejection still routes away at once.
 */

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { ArrowRight, CircleHelp, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { FootActions, FunnelFallback, FunnelFrame, NoteBlock, StepBody, StepCard, useSignOutToLogin } from "@/app/training/_funnel/FunnelFrame";
import { Certificate, certificateName, issuedOn, useCertificateDownload } from "@/components/certificate";
import { Button, ButtonLink, Dot, Icon, Status, creatorStatus, type Tone } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { isCreatorAccount } from "@/lib/accounts";

export default function PendingPage() {
    const { user, isLoaded, isSignedIn } = useUser();
    const router = useRouter();

    const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip");

    const pending = !!creator && isCreatorAccount(creator) && !!creator.quizPassedAt && !creator.certifiedAt && !creator.rejectedAt;

    // Remember that this visit saw the wait, so an approval that arrives while
    // the page is open shows the certificate instead of leaving. (Adjusted
    // while rendering, so the redirect below already knows on the same pass.)
    const [sawWaiting, setSawWaiting] = useState(false);
    if (pending && !sawWaiting) setSawWaiting(true);
    const approvedHere = sawWaiting && !!creator?.certifiedAt && isCreatorAccount(creator);

    // Not signed in → login.
    useEffect(() => {
        if (isLoaded && !isSignedIn) router.replace("/login");
    }, [isLoaded, isSignedIn, router]);

    // Live auto-route the moment an admin acts (Convex live query fires ~1s).
    useEffect(() => {
        if (creator === undefined || creator === null) return;
        if (creator.role === "affiliate") {
            router.replace("/affiliates/dashboard");
            return;
        }
        if (creator.role === "staff") {
            router.replace("/admin");
            return;
        }
        if (creator.role === "admin" || creator.certifiedAt) {
            if (approvedHere) return; // approved while watching: stage 5 below
            router.replace("/dashboard");
        } else if (creator.rejectedAt) {
            router.replace("/verification-rejected");
        } else if (!creator.quizPassedAt) {
            // Hasn't passed the quiz — they don't belong on the pending gate.
            router.replace("/training");
        }
    }, [creator, router, approvedHere]);

    const certifiedAt = creator?.certifiedAt;
    if (approvedHere && creator && certifiedAt) {
        return (
            <FunnelFrame view={5} creator={creator}>
                <ApprovedStep creator={creator} certifiedAt={certifiedAt} />
            </FunnelFrame>
        );
    }

    // Loading, or a redirect condition is resolving.
    if (!isLoaded || !isSignedIn || !creator || !pending) return <FunnelFallback view={4} creator={creator} />;

    return (
        <FunnelFrame view={4} creator={creator}>
            <WaitingStep creator={creator} />
        </FunnelFrame>
    );
}

function TimelineRow({ tone, state, title, meta }: { tone: Tone; state: string; title: string; meta?: string }) {
    return (
        <li className="flex items-start gap-3 border-b border-r1-line-3 py-3 last:border-b-0">
            <span className="flex h-5 w-4 flex-none items-center justify-center">
                <Dot tone={tone} />
            </span>
            <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium leading-5 text-r1-ink">
                    {title}
                    <span className="sr-only"> ({state})</span>
                </span>
                {meta && <span className="t-meta">{meta}</span>}
            </span>
        </li>
    );
}

function WaitingStep({ creator }: { creator: Doc<"creators"> }) {
    const signOut = useSignOutToLogin();
    const firstName = creator.firstName?.trim();
    const passedOn = creator.quizPassedAt
        ? new Date(creator.quizPassedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
        : undefined;

    return (
        <StepCard
            status={<Status {...creatorStatus(creator, "creator")} />}
            title="We're reviewing your application"
            intro={`${firstName ? `Hi ${firstName}, you` : "You"} passed the quiz. Someone from the Tendso team checks every new creator before they can submit businesses.`}
            foot={
                <>
                    <span className="t-meta">Questions while you wait?</span>
                    <FootActions>
                        <Button variant="ghost" onClick={signOut}>
                            Sign out
                        </Button>
                        <ButtonLink href="/knowledge">
                            <Icon icon={CircleHelp} />
                            Open Help
                        </ButtonLink>
                    </FootActions>
                </>
            }
        >
            <StepBody>
                <ol className="flex flex-col">
                    <TimelineRow tone="done" state="done" title="Quiz passed" meta={passedOn} />
                    <TimelineRow tone="progress" state="in progress" title="Tendso reviews your account" meta="Usually within 24 hours" />
                    <TimelineRow tone="off" state="next" title="Account activated" meta="Then you can visit shops and submit them." />
                </ol>
                <NoteBlock>
                    <span className="text-sm font-medium leading-5 text-r1-ink">We&apos;ll email you the moment you&apos;re approved.</span>
                    <p className="t-meta">You can close this tab. There is nothing else to do until then.</p>
                </NoteBlock>
            </StepBody>
        </StepCard>
    );
}

/** Stage 5: the end of Certification. The one certificate (components/certificate), in place. */
function ApprovedStep({ creator, certifiedAt }: { creator: Doc<"creators">; certifiedAt: number }) {
    const { ref, download, busy } = useCertificateDownload(creator.firstName);
    return (
        <StepCard
            status={<Status {...creatorStatus(creator, "creator")} />}
            title="You're a certified creator"
            intro="The Tendso team approved your account. You can now visit shops and submit them."
            foot={
                <>
                    <Button variant="ghost" onClick={download} disabled={busy} aria-busy={busy} className="self-start">
                        <Icon icon={Download} />
                        {busy ? "Saving…" : "Download certificate"}
                    </Button>
                    <FootActions>
                        <ButtonLink variant="primary" href="/dashboard">
                            Go to Home
                            <Icon icon={ArrowRight} />
                        </ButtonLink>
                    </FootActions>
                </>
            }
        >
            <div className="p-4 sm:px-6 sm:py-8">
                <Certificate
                    ref={ref}
                    name={certificateName(creator.firstName, creator.lastName)}
                    issued={issuedOn(certifiedAt)}
                    className="mx-auto w-full max-w-[520px]"
                />
            </div>
        </StepCard>
    );
}
