'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import type { FunctionArgs } from 'convex/server';
import { ArrowRight, CalendarClock, MapPin } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { Field, Input } from '@/components/r1';
import { OwnerPageHeader, OwnerShell } from '@/components/shells/OwnerShell';
import { useOwnerWebScope } from '@/hooks/useOwnerWebScope';
import { OwnerSectionBoundary } from '../../_components/OwnerSectionBoundary';
import type { OwnerSite } from '../../_components/ownerSite';
import { OwnerVisitAccessState } from './OwnerVisitPages';
import { useVisitOperation } from './useVisitOperation';
import { selectedVisitBusiness, validVisitPin, visitDraftErrors, VISIT_PREFERENCES, type VisitDraft } from './visitPresentation';
import styles from './OwnerVisits.module.css';

const MapPicker = dynamic(() => import('@/app/start/MapPicker'), { ssr: false, loading: () => <p role="status">Opening the map…</p> });
type Scope = ReturnType<typeof useOwnerWebScope>;

export function OwnerVisitRequestPage({ submissionId }: { submissionId?: string }) {
    return <OwnerShell><OwnerPageHeader title="Request a shop visit" subtitle="Tell us where to visit. The team arranges a field agent and a proposed time." back backHref="/my-business/visits" backLabel="All visit requests" />
        <OwnerSectionBoundary label="Visit request form"><RequestContainer submissionId={submissionId} /></OwnerSectionBoundary></OwnerShell>;
}
function RequestContainer({ submissionId }: { submissionId?: string }) {
    const scope = useOwnerWebScope();
    if (!scope.ready) return <OwnerVisitAccessState scope={scope} label="your business details" returnTo={`/my-business/visits/new${submissionId ? `?submissionId=${encodeURIComponent(submissionId)}` : ''}`} />;
    const selectedSite = selectedVisitBusiness(scope.sites, submissionId);
    if (submissionId && !selectedSite) return <section className={styles.empty}><h2>Business not available</h2><p>This business is not linked to your owner account.</p><Link className={styles.secondary} href="/my-business/visits/new">Request a visit for a new shop</Link></section>;
    return <VisitRequestForm key={`${scope.scopeKey}:${submissionId ?? 'new-shop'}`} scope={scope} selectedSite={selectedSite} />;
}

function VisitRequestForm({ scope, selectedSite }: { scope: Scope; selectedSite: OwnerSite | null }) {
    const router = useRouter();
    const createRequest = useMutation(api.visitRequests.create);
    const operation = useVisitOperation(scope.isCurrent);
    const submittedRequest = useRef<FunctionArgs<typeof api.visitRequests.create> | null>(null);
    const [payloadLocked, setPayloadLocked] = useState(false);
    const [draft, setDraft] = useState<VisitDraft>(() => ({ shopName: selectedSite?.businessName ?? '', address: '', city: '', phone: scope.owner?.phone ?? '', coordinates: null, preferredWhen: 'Today' }));
    const [attempted, setAttempted] = useState(false);
    const errors = visitDraftErrors(draft);
    const valid = Object.keys(errors).length === 0;
    const fieldsLocked = operation.busy || payloadLocked;
    const update = <K extends keyof VisitDraft>(key: K, value: VisitDraft[K]) => { if (!submittedRequest.current && !operation.busy && operation.current()) setDraft(before => ({ ...before, [key]: value })); };
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!operation.current() || !operation.online || operation.busy || !scope.ready || !scope.userId || !scope.owner) return;
        setAttempted(true);
        if (!valid || !validVisitPin(draft.coordinates)) return;
        const owner = scope.owner, userId = scope.userId, coordinates = { ...draft.coordinates };
        void operation.run(async () => {
            // A lost response may already have created the visit. Retry its exact payload and key.
            if (!submittedRequest.current) {
                submittedRequest.current = { requestKey: crypto.randomUUID(), clerkId: userId,
                    ...(selectedSite ? { submissionId: selectedSite.submissionId } : {}), shopName: draft.shopName.trim(),
                    ownerName: owner.name?.trim() || 'Shop owner', phone: draft.phone.trim(), email: owner.email,
                    address: draft.address.trim(), city: draft.city.trim(), coordinates, preferredWhen: draft.preferredWhen };
                setPayloadLocked(true);
            }
            const result = await createRequest(submittedRequest.current);
            if (result.actorClerkId !== userId || result.ownerId !== owner._id) throw new Error('Your account changed. Open your visit requests again.');
            return result;
        }, result => router.replace(`/my-business/visits/${encodeURIComponent(result._id)}`));
    };
    return <form className={styles.form} onSubmit={submit} noValidate aria-label="Request a shop visit">
        {selectedSite ? <p className={styles.notice}>For this business: <strong>{selectedSite.businessName}</strong></p> : null}
        <div className={styles.fields}>
            <Field label="Shop name" required className={styles.full} error={attempted || draft.shopName ? errors.shopName : undefined} help="The name of the shop you want us to visit.">
                <Input value={draft.shopName} onChange={event => update('shopName', event.target.value)} maxLength={120} placeholder="Name of the shop to visit" autoComplete="organization" disabled={fieldsLocked} />
            </Field>
            <Field label="Shop address" required className={styles.full} error={attempted || draft.address ? errors.address : undefined} help="Street, building or a nearby landmark.">
                <Input value={draft.address} onChange={event => update('address', event.target.value)} maxLength={300} autoComplete="street-address" disabled={fieldsLocked} />
            </Field>
            <Field label="City or municipality" required error={attempted || draft.city ? errors.city : undefined}>
                <Input value={draft.city} onChange={event => update('city', event.target.value)} maxLength={120} autoComplete="address-level2" disabled={fieldsLocked} />
            </Field>
            <Field label="Your mobile number" required error={attempted || draft.phone ? errors.phone : undefined} help="A Philippine mobile number, for example 0917 123 4567.">
                <Input type="tel" value={draft.phone} onChange={event => update('phone', event.target.value)} maxLength={40} autoComplete="tel" disabled={fieldsLocked} />
            </Field>
        </div>
        <section className={styles.map} aria-label="Shop map pin">
            <h2><MapPin size={20} aria-hidden="true" /> Pin the shop on the map</h2>
            <p>Required so your field agent can find you. Search the address, zoom in and confirm your shop’s entrance.</p>
            <MapPicker value={draft.coordinates} onChange={coordinates => update('coordinates', coordinates)} address={[draft.address, draft.city, 'Philippines'].filter(Boolean).join(', ')} disabled={fieldsLocked || !operation.online} requiredPin />
            {attempted || draft.coordinates ? errors.coordinates ? <p role="alert" className={styles.error}>{errors.coordinates}</p> : <p>Shop pin added.</p> : null}
        </section>
        <fieldset className={styles.preferences} disabled={fieldsLocked}><legend>When works for you?</legend>
            {VISIT_PREFERENCES.map(preference => <label key={preference} className={styles.preference}><input type="radio" name="preferredWhen" value={preference} checked={draft.preferredWhen === preference} onChange={() => update('preferredWhen', preference)} /><CalendarClock size={18} aria-hidden="true" />{preference}</label>)}
        </fieldset>
        <div className={styles.notice}><strong>A request, then a confirmation</strong><p>Your preferred day is not a booking. The visit is confirmed after an assigned field agent accepts the proposed time.</p></div>
        <div className={styles.contact}><h2>Your contact for this visit</h2><p>{scope.owner?.name?.trim() || 'Shop owner'}</p><p>{scope.owner?.email}</p><p>Your address and contact details are shared with the Tendso team and the assigned field agent.</p></div>
        {operation.error ? <p role="alert" className={styles.error}>{operation.error}</p> : null}
        {payloadLocked ? <div className={styles.notice} role="status"><strong>Retry keeps the same details</strong><p>These details are locked for this attempt. Retrying sends the same request again to avoid duplicates. Check your visit requests before starting a different request.</p><Link className={styles.secondary} href="/my-business/visits">Check visit requests</Link></div> : null}
        {!operation.online ? <p className={styles.notice}>Reconnect to send your visit request.</p> : null}
        <div className={styles.actions}><button className={styles.primary} type="submit" disabled={operation.busy || !operation.online || !valid} aria-busy={operation.busy}>{operation.busy ? 'Sending request…' : payloadLocked ? 'Retry same request' : 'Send request'}<ArrowRight size={17} aria-hidden="true" /></button></div>
    </form>;
}
