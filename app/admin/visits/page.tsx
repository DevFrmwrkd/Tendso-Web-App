'use client';

import { Suspense } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useConvexAuth } from 'convex/react';
import { useSearchParams } from 'next/navigation';
import { EmptyState, Loading, PageHeader, SkeletonRows } from '@/components/r1';
import { useAdminAuth } from '@/hooks/useAdmin';
import AdminLayout from '../components/AdminLayout';
import PanelBoundary from '../_components/PanelBoundary';
import { VisitRequestsQueue } from './_components/VisitRequestsQueue';

export default function AdminVisitsPage() {
    return <Suspense fallback={<AdminLayout><VisitsHeader /><VisitRequestsLoading /></AdminLayout>}><VisitRequestsGate /></Suspense>;
}

function VisitRequestsGate() {
    const { isAdmin, loading } = useAdminAuth();
    const { userId, sessionId } = useAuth();
    const convex = useConvexAuth();
    const params = useSearchParams();
    const waiting = loading || convex.isLoading || (isAdmin && (!userId || !sessionId));
    return <AdminLayout>
        <VisitsHeader />
        {waiting ? <VisitRequestsLoading /> : !isAdmin || !convex.isAuthenticated || !userId || !sessionId
            ? <EmptyState title="Admin access required" body="Visit requests and owner contact details are available to admins only." />
            : <PanelBoundary key={`${userId}:${sessionId}`} what="Visit requests">
                <VisitRequestsQueue key={`${userId}:${sessionId}`} actor={userId} initialOpen={params.get('open')} />
            </PanelBoundary>}
    </AdminLayout>;
}

function VisitsHeader() {
    return <PageHeader title="Visit requests" sub="Assign shop visits, confirm the agent’s response and keep the owner updated." />;
}
export function VisitRequestsLoading() {
    return <Loading label="Loading visit requests"><SkeletonRows count={5} /></Loading>;
}
