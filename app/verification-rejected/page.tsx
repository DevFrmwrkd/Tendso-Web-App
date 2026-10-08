"use client";

/**
 * Creator "application not approved" screen — the bounce target when an admin
 * sets rejectedAt. Shows the stored rejectionReason. Minimal by design (the
 * brief scopes resubmission as separate follow-up work); only escape is sign out
 * or contacting support. Auto-routes away if the admin later re-approves/clears.
 *
 * See docs/changes/CREATOR-PENDING-APPROVAL-PAGE.md.
 *
 * Round 1: the rejected state of the certification frame (board
 * Certification, stage 4 "Not approved"). Same guards, same reason.
 */

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { FootActions, FunnelFallback, FunnelFrame, NoteBlock, StepBody, StepCard, useSignOutToLogin } from "@/app/training/_funnel/FunnelFrame";
import { Button, ButtonLink, Icon, Status, creatorStatus } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { isCreatorAccount } from "@/lib/accounts";

export default function VerificationRejectedPage() {
    const { user, isLoaded, isSignedIn } = useUser();
    const router = useRouter();
    const signOut = useSignOutToLogin();

    const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip");

    useEffect(() => {
        if (isLoaded && !isSignedIn) router.replace("/login");
    }, [isLoaded, isSignedIn, router]);

    // If the admin re-approves or clears the rejection, route them onward.
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
            router.replace("/dashboard");
        } else if (!creator.rejectedAt) {
            // Rejection cleared (admin reset) → back to the normal flow.
            router.replace(creator.quizPassedAt ? "/pending" : "/training");
        }
    }, [creator, router]);

    const rejected = !!creator && isCreatorAccount(creator) && !!creator.rejectedAt;

    if (!isLoaded || !isSignedIn || !creator || !rejected) return <FunnelFallback view="rejected" creator={creator} />;

    const firstName = creator.firstName?.trim();
    const reason = creator.rejectionReason;

    return (
        <FunnelFrame view="rejected" creator={creator}>
            <StepCard
                status={<Status {...creatorStatus(creator, "creator")} />}
                title="Application not approved"
                intro={`${firstName ? `${firstName}, we` : "We"} weren't able to approve your creator account this time.`}
                foot={
                    <>
                        <Button variant="ghost" onClick={signOut} className="self-start">
                            Sign out
                        </Button>
                        <FootActions>
                            <ButtonLink variant="primary" href="/contact">
                                Contact support
                                <Icon icon={ArrowRight} />
                            </ButtonLink>
                        </FootActions>
                    </>
                }
            >
                <StepBody>
                    {reason && (
                        <NoteBlock label="Reason from the Tendso team">
                            <p className="t-body">{reason}</p>
                        </NoteBlock>
                    )}
                    <p className="t-body">
                        Think this is a mistake? Contact us and we&apos;ll take another look. You can also email{" "}
                        <a className="t-link font-medium" href={`mailto:${SUPPORT_EMAIL}`}>
                            {SUPPORT_EMAIL}
                        </a>
                        .
                    </p>
                </StepBody>
            </StepCard>
        </FunnelFrame>
    );
}
