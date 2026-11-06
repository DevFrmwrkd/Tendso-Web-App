"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, Check, CircleHelp, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { OnboardingLoading, OnboardingShell } from "@/components/field-agent-onboarding/OnboardingShell";
import { Button } from "@/components/v2/Button";
import { api } from "@/convex/_generated/api";
import { isCreatorAccount } from "@/lib/accounts";
import { SUPPORT_EMAIL } from "@/lib/contact";

import { RejectedProfileForm } from "./_components/RejectedProfileForm";
import styles from "./_components/ProfileReview.module.css";

/** Rejection is a profile correction, not a request to repeat a passed quiz. */
export default function VerificationRejectedPage() {
    const { user, isLoaded, isSignedIn } = useUser();
    const router = useRouter();
    const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip");
    const requestRecertification = useMutation(api.creators.requestRecertification);
    const [editing, setEditing] = useState(false);
    const [finishing, setFinishing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const finishingRef = useRef(false);
    const currentCreator = useRef(creator);
    currentCreator.current = creator;

    useEffect(() => {
        if (isLoaded && !isSignedIn) router.replace("/login");
    }, [isLoaded, isSignedIn, router]);

    useEffect(() => {
        if (!creator) return;
        if (creator.role === "affiliate") router.replace("/affiliates/dashboard");
        else if (creator.role === "staff") router.replace("/admin");
        else if (creator.role === "admin" || creator.certifiedAt) router.replace("/dashboard");
        else if (!creator.rejectedAt) router.replace(creator.quizPassedAt ? "/pending" : "/training");
    }, [creator, router]);

    const rejected = !!creator && isCreatorAccount(creator) && !!creator.rejectedAt && !creator.certifiedAt;
    if (!isLoaded || !isSignedIn || !creator || !rejected) return <OnboardingLoading stage="changes" creator={creator} />;

    const passed = !!creator.quizPassedAt;
    const reviewedOn = new Date(creator.rejectedAt!).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
    const fullName = [creator.firstName, creator.lastName].filter(Boolean).join(" ") || "Name not added";

    // Only legacy rejected accounts without a saved pass use the old reset.
    const finishCertification = async () => {
        if (creator.quizPassedAt || finishingRef.current) return;
        const accountId = creator._id;
        finishingRef.current = true;
        setFinishing(true);
        setError(null);
        try {
            await requestRecertification({ id: accountId });
            if (currentCreator.current?._id === accountId && !currentCreator.current?.certifiedAt) router.replace("/training");
        } catch (err) {
            if (currentCreator.current?._id === accountId) setError(err instanceof Error ? err.message : "Could not continue. Please try again.");
        } finally {
            finishingRef.current = false;
            setFinishing(false);
        }
    };

    return (
        <OnboardingShell
            stage="changes"
            creator={creator}
            title="Your profile needs an update"
            description="Review the team's feedback and correct your details so we can take another look."
        >
            <section className={styles.notice} aria-labelledby="review-feedback-title">
                <span className={styles.warningIcon}><TriangleAlert size={24} aria-hidden="true" /></span>
                <div>
                    <span className={styles.eyebrow}>Action needed</span>
                    <h2 id="review-feedback-title">What needs fixing</h2>
                    <p className={styles.reason}>{creator.rejectionReason?.trim() || "We couldn't verify your profile yet. Check your name, mobile number and photo, then send your profile for another review."}</p>
                    <small>Reviewed {reviewedOn}</small>
                </div>
            </section>

            <div className={styles.savedQuiz}>
                <span className={passed ? styles.checkIcon : styles.unfinishedIcon}>{passed ? <Check size={20} aria-hidden="true" /> : <CircleHelp size={20} aria-hidden="true" />}</span>
                <div><h2>Certification quiz</h2><p>{passed ? "Passed. You don't need to take it again." : "Complete the lessons and quiz before requesting another review."}</p></div>
            </div>

            {passed && editing ? (
                <RejectedProfileForm
                    key={creator._id}
                    creator={creator}
                    onCancel={() => setEditing(false)}
                    onSubmitted={() => router.replace("/pending")}
                />
            ) : (
                <section className={styles.card} aria-labelledby="profile-details-title">
                    <div className={styles.cardHead}><div><h2 id="profile-details-title">Your profile</h2><p>These are the details the team checks.</p></div></div>
                    <dl className={styles.details}>
                        <div><dt>Full name</dt><dd>{fullName}</dd></div>
                        <div><dt>Mobile</dt><dd>{creator.phone || "Not added"}</dd></div>
                        <div><dt>Email</dt><dd>{creator.email}</dd></div>
                    </dl>
                    <div className={styles.actions}>
                        {passed ? <Button onClick={() => setEditing(true)}>Fix and resend <ArrowRight size={17} aria-hidden="true" /></Button> : <>
                            <Button href="/edit-profile" variant="ghost">Edit profile</Button>
                            <Button onClick={finishCertification} disabled={finishing} aria-busy={finishing}>{finishing ? "Opening certification…" : "Finish certification"}<ArrowRight size={17} aria-hidden="true" /></Button>
                        </>}
                    </div>
                    {error && <p className={styles.error} role="alert">{error}</p>}
                </section>
            )}

            <p className={styles.support}>Need help with the feedback? <a href={`mailto:${SUPPORT_EMAIL}`}>Ask the Tendso team <ArrowRight size={14} aria-hidden="true" /></a></p>
        </OnboardingShell>
    );
}
