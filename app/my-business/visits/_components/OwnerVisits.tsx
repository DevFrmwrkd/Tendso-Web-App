'use client';

import Link from 'next/link';
import { ArrowRight, CalendarClock, Check, MapPin, Phone, Store, UserRound } from 'lucide-react';
import { visitDirectionsHref, visitIsOpen, visitPhoneHref, visitSchedule, visitStatusDescription, visitStatusLabel, type OwnerVisit } from './visitPresentation';
import styles from './OwnerVisits.module.css';

export function OwnerVisitsView({ requests, hrefForVisit, requestHref = '/my-business/visits/new', preview = false }: {
    requests: readonly OwnerVisit[]; hrefForVisit?: (id: string) => string; requestHref?: string; preview?: boolean;
}) {
    const openCount = requests.filter(visitIsOpen).length;
    const canRequest = !preview && openCount < 3;
    return <div className={styles.stack}>
        <section className={styles.intro} aria-label="How shop visits work">
            <span className={styles.icon}><Store size={27} aria-hidden="true" /></span>
            <div><h2>We find a field agent for you</h2><p>They visit your shop, take photos and record your story with you. The visit is confirmed after the assigned field agent accepts the proposed time.</p></div>
            {canRequest ? <Link className={styles.primary} href={requestHref}>Request a visit <ArrowRight size={17} aria-hidden="true" /></Link>
                : <button className={styles.primary} type="button" disabled>Request a visit <ArrowRight size={17} aria-hidden="true" /></button>}
        </section>
        {openCount >= 3 ? <p className={styles.notice}>You have three open visit requests. Finish or cancel one before requesting another.</p> : null}
        {requests.length === 0 ? <section className={styles.empty}><CalendarClock size={35} aria-hidden="true" /><h2>No visit requests yet</h2><p>Your requests, field agent and confirmed visit time will appear here.</p></section>
            : <section className={styles.list} aria-label="Your visit requests">{requests.map(request => {
                const href = hrefForVisit?.(request._id) ?? (!preview ? `/my-business/visits/${request._id}` : null);
                return <article className={styles.card} key={request._id}>
                    <div className={styles.cardTop}><span className={styles.icon}><Store size={22} aria-hidden="true" /></span><VisitStatus request={request} /></div>
                    <h2>{href ? <Link href={href}>{request.shopName}</Link> : request.shopName}</h2>
                    <p className={styles.address}><MapPin size={16} aria-hidden="true" />{request.address}, {request.city}</p>
                    <p className={styles.schedule}><CalendarClock size={17} aria-hidden="true" />{request.scheduledAt ? visitSchedule(request.scheduledAt) : `Preferred: ${request.preferredWhen}`}</p>
                    <p className={styles.muted}>{request.status === 'cancelled' ? 'No visit is scheduled.' : request.assignedAgent ? `${request.assignedAgent.name} · ${request.status === 'assigned' ? 'Awaiting acceptance' : 'Assigned field agent'}` : request.status === 'completed' ? 'This visit is complete.' : 'The team will arrange your field agent.'}</p>
                    {href ? <Link className={styles.cardAction} href={href}>View request <ArrowRight size={17} aria-hidden="true" /></Link> : null}
                </article>;
            })}</section>}
    </div>;
}

function VisitStatus({ request }: { request: OwnerVisit }) {
    return <span className={`${styles.status} ${styles[`status_${request.status}`]}`}>{request.status === 'completed' ? <Check size={13} aria-hidden="true" /> : null}{visitStatusLabel(request.status)}</span>;
}

/** Presentation only. Account/session/revision guards belong to the live wrapper. */
export function OwnerVisitDetailsView({ request, preview = false, onCancel, busy = false, disabled = false, error, notice }: {
    request: OwnerVisit; preview?: boolean; onCancel?: () => void; busy?: boolean; disabled?: boolean; error?: string | null; notice?: string | null;
}) {
    const active = visitIsOpen(request);
    const phone = visitPhoneHref(request.assignedAgent?.phone);
    const directions = visitDirectionsHref(request.coordinates);
    return <div className={styles.stack}>
        <section className={styles.summary} aria-label="Visit status"><VisitStatus request={request} /><h2>{request.shopName}</h2><p>{visitStatusDescription(request.status)}</p></section>
        <div className={styles.detailsGrid}>
            <section className={styles.card}><span className={styles.icon}><CalendarClock size={23} aria-hidden="true" /></span><h2>{request.status === 'confirmed' ? 'Confirmed time' : 'Visit time'}</h2><p className={styles.detailValue}>{visitSchedule(request.scheduledAt)}</p><p className={styles.muted}>Your requested preference: {request.preferredWhen}</p>{request.status === 'assigned' ? <p className={styles.muted}>Waiting for the field agent to accept.</p> : null}</section>
            <section className={styles.card}><span className={styles.icon}><UserRound size={23} aria-hidden="true" /></span><h2>Your field agent</h2>{request.assignedAgent ? <><p className={styles.detailValue}>{request.assignedAgent.name}</p><p className={styles.muted}>{request.status === 'assigned' ? 'Awaiting acceptance' : request.status === 'confirmed' ? 'Visit confirmed' : 'Assigned field agent'}</p>{active && phone ? preview ? <button className={styles.secondary} type="button" disabled><Phone size={17} aria-hidden="true" />Call field agent</button> : <a className={styles.secondary} href={phone}><Phone size={17} aria-hidden="true" />Call field agent</a> : null}</>
                : <p className={styles.muted}>{request.status === 'cancelled' ? 'No field agent is scheduled for this cancelled request.' : request.status === 'completed' ? 'This visit is complete.' : 'The team is finding a field agent for your shop.'}</p>}</section>
            <section className={styles.card}><span className={styles.icon}><MapPin size={23} aria-hidden="true" /></span><h2>Shop location</h2><p className={styles.detailValue}>{request.address}</p><p className={styles.muted}>{request.city}</p>{directions ? preview ? <button className={styles.secondary} type="button" disabled>View directions <ArrowRight size={16} aria-hidden="true" /></button>
                : <a className={styles.secondary} href={directions} target="_blank" rel="noopener noreferrer">View directions <ArrowRight size={16} aria-hidden="true" /></a> : null}</section>
            <section className={styles.card}><h2>Your contact for this visit</h2><p className={styles.detailValue}>{request.ownerName}</p><p>{request.phone}</p>{request.email ? <p className={styles.muted}>{request.email}</p> : null}<p className={styles.muted}>Shared with the Tendso team and your assigned field agent.</p></section>
        </div>
        {request.status === 'cancelled' && request.cancellationReason ? <section className={styles.notice}><h2>Cancellation details</h2><p>{request.cancellationReason}</p></section> : null}
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
        <div className={styles.actions}>{active ? <button type="button" className={styles.danger} disabled={preview || busy || disabled || !onCancel} onClick={preview ? undefined : onCancel}>{busy ? 'Cancelling…' : 'Cancel visit'}</button>
            : preview ? <button type="button" className={styles.primary} disabled>Request another visit</button> : <Link className={styles.primary} href="/my-business/visits/new">Request another visit</Link>}</div>
    </div>;
}
