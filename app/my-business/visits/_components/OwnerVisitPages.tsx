'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ConfirmDialog, Loading } from '@/components/r1';
import { OwnerPageHeader, OwnerShell } from '@/components/shells/OwnerShell';
import { useOwnerWebScope } from '@/hooks/useOwnerWebScope';
import { OwnerSectionBoundary } from '../../_components/OwnerSectionBoundary';
import { OwnerVisitDetailsView, OwnerVisitsView } from './OwnerVisits';
import { useVisitOperation } from './useVisitOperation';
import { visitIsOpen, type OwnerVisit } from './visitPresentation';
import styles from './OwnerVisits.module.css';

type Scope = ReturnType<typeof useOwnerWebScope>;
export function OwnerVisitAccessState({ scope, label = 'visit requests', returnTo = '/my-business/visits' }: { scope: Scope; label?: string; returnTo?: string }) {
    if (scope.loading) return <Loading label={`Loading ${label}`}><p>Loading {label}…</p></Loading>;
    return <section className={styles.empty}><h2>{scope.error ? 'Could not load your account' : 'Business owner account required'}</h2><p role={scope.error ? 'alert' : undefined}>{scope.error ?? 'Sign in with the verified email linked to your businesses to manage shop visits.'}</p><Link className={styles.secondary} href={`/my-business/sign-in?returnTo=${encodeURIComponent(returnTo)}`}>Sign in</Link></section>;
}

export function OwnerVisitsPage() {
    return <OwnerShell><OwnerPageHeader title="Shop visits" subtitle="Request help and keep track of your field agent’s visit." />
        <OwnerSectionBoundary label="Visit requests"><LiveVisitList /></OwnerSectionBoundary></OwnerShell>;
}
function LiveVisitList() {
    const scope = useOwnerWebScope();
    const data = useQuery(api.visitRequests.listMine, scope.ready && scope.userId ? { clerkId: scope.userId } : 'skip');
    if (!scope.ready) return <OwnerVisitAccessState scope={scope} />;
    if (data === undefined) return <Loading label="Loading visit requests"><p>Loading visit requests…</p></Loading>;
    if (!data || data.actorClerkId !== scope.userId || data.ownerId !== scope.owner?._id) return <p className={styles.error}>Visit requests are unavailable for this account. Reopen your business workspace and try again.</p>;
    const requests = data.requests.filter(request => request.actorClerkId === scope.userId && request.ownerId === scope.owner?._id);
    return <OwnerVisitsView requests={requests} />;
}

export function OwnerVisitDetailsPage({ visitId }: { visitId: string }) {
    return <OwnerShell><OwnerPageHeader title="Your shop visit" subtitle="See the proposed time, field agent and latest status." back backHref="/my-business/visits" backLabel="All visit requests" />
        <OwnerSectionBoundary label="Visit details"><LiveVisitDetails visitId={visitId} /></OwnerSectionBoundary></OwnerShell>;
}
function LiveVisitDetails({ visitId }: { visitId: string }) {
    const scope = useOwnerWebScope();
    return <ScopedVisitDetails key={`${scope.scopeKey}:${visitId}`} scope={scope} visitId={visitId} />;
}
function ScopedVisitDetails({ scope, visitId }: { scope: Scope; visitId: string }) {
    const request = useQuery(api.visitRequests.getMine, scope.ready && scope.userId && visitId ? { id: visitId as Id<'ownerVisitRequests'>, clerkId: scope.userId } : 'skip');
    const cancelVisit = useMutation(api.visitRequests.cancel);
    const operation = useVisitOperation(scope.isCurrent);
    const [confirmation, setConfirmation] = useState<{ id: string; revision: number } | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const ownRequest = request?.actorClerkId === scope.userId && request?.ownerId === scope.owner?._id && request?._id === visitId ? request : null;
    const latest = useRef(ownRequest);
    useLayoutEffect(() => { latest.current = ownRequest; }, [ownRequest]);
    const beginCancel = () => {
        const value = latest.current;
        if (!operation.current() || !operation.online || operation.busy || !value || !visitIsOpen(value)) return;
        operation.setError(null); setNotice(null); setConfirmation({ id: value._id, revision: value.revision });
    };
    const confirmCancel = () => {
        const value = latest.current;
        if (!operation.current() || !confirmation || !value || operation.busy) return;
        if (!operation.online) { operation.setError('Reconnect to cancel your visit.'); return; }
        if (value._id !== confirmation.id || value.revision !== confirmation.revision || !visitIsOpen(value)) {
            setConfirmation(null); operation.setError('This visit changed. Check its latest details before cancelling.'); return;
        }
        void operation.run(async () => {
            const result = await cancelVisit({ id: value._id, expectedRevision: confirmation.revision, clerkId: scope.userId ?? undefined });
            if (result.actorClerkId !== scope.userId || result.ownerId !== scope.owner?._id || result._id !== value._id) throw new Error('Your account changed. Open your visit requests again.');
            return result;
        }, () => { setConfirmation(null); setNotice('Your visit was cancelled.'); });
    };
    if (!scope.ready) return <OwnerVisitAccessState scope={scope} label="visit details" returnTo={`/my-business/visits/${encodeURIComponent(visitId)}`} />;
    if (request === undefined) return <Loading label="Loading visit details"><p>Loading visit details…</p></Loading>;
    if (!ownRequest) return <section className={styles.empty}><h2>Visit request not available</h2><p>It may not be linked to this owner account.</p><Link className={styles.secondary} href="/my-business/visits">Back to shop visits</Link></section>;
    return <>
        <OwnerVisitDetailsView request={ownRequest as OwnerVisit} onCancel={beginCancel} busy={operation.busy} disabled={!operation.online} error={operation.error} notice={notice} />
        {!operation.online ? <p className={styles.notice}>Reconnect to manage your visit.</p> : null}
        <ConfirmDialog open={confirmation !== null} title="Cancel this visit?" confirmLabel="Cancel visit" cancelLabel="Keep visit" busy={operation.busy}
            onCancel={() => { if (!operation.busy) setConfirmation(null); }} onConfirm={confirmCancel}>
            <p>The team and assigned field agent will be told. Your business and website stay unchanged.</p>
            {!operation.online ? <p role="alert" className={styles.notice}>Reconnect to cancel your visit.</p> : null}
            {operation.error ? <p role="alert" className={styles.error}>{operation.error}</p> : null}
        </ConfirmDialog>
    </>;
}
