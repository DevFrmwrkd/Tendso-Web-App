"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { OwnerPageHeader, OwnerShell } from "@/components/shells/OwnerShell";
import { api } from "@/convex/_generated/api";
import { useOwnerWebScope } from "@/hooks/useOwnerWebScope";
import { SiteOverviewLoading } from "../_components/OwnerHome";
import { OwnerSectionBoundary } from "../_components/OwnerSectionBoundary";
import { OwnerTodayView } from "./_components/OwnerToday";

export default function OwnerTodayPage() {
    return <OwnerShell><OwnerSectionBoundary label="Today"><OwnerToday /></OwnerSectionBoundary></OwnerShell>;
}

function OwnerToday() {
    const scope = useOwnerWebScope();
    return <OwnerTodayContent key={scope.scopeKey} scope={scope} />;
}

function OwnerTodayContent({ scope }: { scope: ReturnType<typeof useOwnerWebScope> }) {
    const router = useRouter();
    const [now, setNow] = useState(Date.now);
    const visits = useQuery(api.visitRequests.listMine, scope.ready && scope.userId ? { clerkId: scope.userId } : "skip");
    const inbox = useQuery(api.ownerInbox.list, scope.ready && scope.userId ? { clerkId: scope.userId } : "skip");
    useEffect(() => {
        if (!scope.loading && !scope.isSignedIn) router.replace(`/my-business/sign-in?returnTo=${encodeURIComponent('/my-business/today')}`);
    }, [scope.loading, scope.isSignedIn, router]);
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(timer);
    }, []);
    if (scope.error) return <><OwnerPageHeader title="Today" subtitle="Your businesses, visits and updates in one place." /><p role="alert">{scope.error}</p></>;
    if (!scope.ready) return <><OwnerPageHeader title="Today" subtitle="Your businesses, visits and updates in one place." /><SiteOverviewLoading /></>;
    const ownedVisits = visits && visits.actorClerkId === scope.userId && visits.ownerId === scope.owner?._id
        ? visits.requests.filter(visit => visit.actorClerkId === scope.userId && visit.ownerId === scope.owner?._id) : undefined;
    const ownedInbox = inbox && inbox.actorClerkId === scope.userId && inbox.ownerId === scope.owner?._id ? inbox
        : undefined;
    return <OwnerTodayView name={scope.owner?.name} sites={scope.sites ?? []} visits={ownedVisits} inbox={ownedInbox} now={now} />;
}
