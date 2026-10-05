"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { FunnelFallback, FunnelFrame } from "@/app/training/_funnel/FunnelFrame";
import { api } from "@/convex/_generated/api";

import { QuizStep } from "./_components/QuizStep";

/** Certification quiz (board Certification, stage 3). The guards are the old page's, unchanged. */
export default function CertificationQuizPage() {
    const router = useRouter();
    const { user, isLoaded } = useUser();
    const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip");

    useEffect(() => {
        if (isLoaded && !user) router.push("/login");
    }, [isLoaded, user, router]);

    // Redirect admins to admin dashboard — they don't need certification
    useEffect(() => {
        if (creator && creator.role === "admin") router.push("/admin");
    }, [creator, router]);

    if (!isLoaded || creator === undefined) return <FunnelFallback view={3} />;

    return (
        <FunnelFrame view={3} creator={creator}>
            <QuizStep creatorId={creator?._id} />
        </FunnelFrame>
    );
}
