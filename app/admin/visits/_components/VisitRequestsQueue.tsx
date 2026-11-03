'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import { ArrowUpRight, CalendarClock, Mail, MapPin, Phone, Store, UserRound } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { Button, ConfirmDialog, Drawer, EmptyState, Field, Input, Loading, Select, SkeletonRows, Status, Textarea } from '@/components/r1';
import { canAssignVisit, canCancelVisit, contactEmail, contactPhone, formatVisitTime, parsePhilippineSchedule, philippineInputValue,
    VISIT_FILTERS, visitDirections, visitStatus, type AdminVisit, type VisitAgent, type VisitFilter } from './visitAdmin';
import styles from './VisitRequestsQueue.module.css';

type Assignment = { agentId: VisitAgent['id']; scheduledAt: number; adminNote: string };
type Feedback = { tone: 'success' | 'error'; message: string } | null;
const YEAR = 365 * 24 * 60 * 60 * 1000;

export function VisitRequestsQueue({ actor, initialOpen }: { actor: string; initialOpen: string | null }) {
    const [filter, setFilter] = useState<VisitFilter>('all');
    const [selected, setSelected] = useState<string | null>(initialOpen);
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState<Feedback>(null);
    const data = useQuery(api.visitRequests.listAdmin, { clerkId: actor, ...(filter === 'all' ? {} : { status: filter }) });
    const available = useQuery(api.visitRequests.listAssignableAgents, { clerkId: actor });
    const assign = useMutation(api.visitRequests.assign);
    const cancel = useMutation(api.visitRequests.cancel);
    const requests = data?.actorClerkId === actor ? data.requests.filter(request => request.actorClerkId === actor) : undefined;
    const agents = available?.actorClerkId === actor ? available.agents : undefined;
    const mounted = useRef(true);
    const working = useRef(false);
    const current = useRef({ requests, agents, selected }); current.current = { requests, agents, selected };
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => { setFilter('all'); setSelected(initialOpen); setFeedback(null); }, [initialOpen]);

    const act = async (kind: 'assign' | 'cancel', visit: AdminVisit, value: Assignment | string) => {
        if (working.current || !mounted.current || visit.actorClerkId !== actor) return;
        const latest = current.current.requests?.find(request => request._id === visit._id);
        if (!latest || latest.revision !== visit.revision) {
            setFeedback({ tone: 'error', message: 'This request changed. Review its latest details before trying again.' }); return;
        }
        if (kind === 'assign') {
            const assignment = value as Assignment;
            if (!canAssignVisit(latest) || !current.current.agents?.some(agent => agent.id === assignment.agentId)) {
                setFeedback({ tone: 'error', message: 'Choose a currently available certified field agent.' }); return;
            }
        } else if (!canCancelVisit(latest)) return;
        working.current = true; setBusy(true); setFeedback(null);
        try {
            const result = kind === 'assign' ? await assign({ id: visit._id, ...(value as Assignment), expectedRevision: visit.revision, clerkId: actor })
                : await cancel({ id: visit._id, reason: value as string, expectedRevision: visit.revision, clerkId: actor });
            if (!mounted.current || current.current.selected !== visit._id || result.actorClerkId !== actor || result._id !== visit._id) return;
            const live = current.current.requests?.find(request => request._id === visit._id);
            if (live && live.revision > result.revision) return;
            setFeedback({ tone: 'success', message: kind === 'assign' ? `${visit.shopName} was assigned. The agent must accept before the visit is confirmed.` : `${visit.shopName}’s visit was cancelled.` });
        } catch (cause) {
            if (!mounted.current || current.current.selected !== visit._id) return;
            const live = current.current.requests?.find(request => request._id === visit._id);
            setFeedback({ tone: 'error', message: live && live.revision !== visit.revision
                ? 'This request changed. Review its latest details before trying again.'
                : cause instanceof ConvexError && typeof cause.data === 'string' ? cause.data : cause instanceof Error ? cause.message : 'Could not update this visit. Please try again.' });
        } finally { working.current = false; if (mounted.current) setBusy(false); }
    };

    const visit = requests?.find(request => request._id === selected);
    const feedbackNode = feedback ? <p className={feedback.tone === 'error' ? styles.error : styles.success} role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p> : null;
    return <div className={styles.workspace}>
        <div className={styles.toolbar}>
            <div className={styles.filters} aria-label="Filter visit requests">{VISIT_FILTERS.map(item => <button key={item.value} type="button"
                className={filter === item.value ? styles.filterActive : styles.filter} aria-pressed={filter === item.value} disabled={busy}
                onClick={() => { setFilter(item.value); setSelected(null); setFeedback(null); }}>{item.label}</button>)}</div>
            <p className={styles.timezone}>All times: Philippine time · UTC+8</p>
        </div>
        {!visit ? feedbackNode : null}
        {requests === undefined ? <Loading label="Loading visit requests"><SkeletonRows count={5} /></Loading> : requests.length === 0
            ? <div className="t-card"><EmptyState title="No visits in this view" body="New owner requests and visit updates will appear here." /></div>
            : <><p className={styles.count}>{requests.length} {requests.length === 1 ? 'request' : 'requests'} in this view</p><div className={styles.grid}>{requests.map(request => <VisitCard key={request._id} visit={request} busy={busy}
                onOpen={() => { setSelected(request._id); setFeedback(null); }} />)}</div></>}
        {requests !== undefined && selected && !visit ? <p className={styles.muted} role="status">This visit is not in the current view. Choose All requests to see the latest queue.</p> : null}
        <Drawer open={!!visit} onClose={() => { if (!working.current) setSelected(null); }} title={visit?.shopName ?? 'Visit request'}
            meta="Owner visit request · Philippine time (UTC+8)" closeLabel="Close visit details" bodyClassName={styles.drawerBody}
            footer={<Button disabled={busy} onClick={() => setSelected(null)}>Close details</Button>}>
            {visit ? <>{feedbackNode}<VisitDetails key={`${visit._id}:${visit.revision}`} visit={visit} agents={agents} busy={busy} feedback={feedback}
                onAssign={value => void act('assign', visit, value)} onCancel={reason => void act('cancel', visit, reason)} /></> : null}
        </Drawer>
    </div>;
}

function VisitCard({ visit, busy, onOpen }: { visit: AdminVisit; busy: boolean; onOpen: () => void }) {
    return <article className={styles.card}>
        <div className={styles.cardHead}><span className={styles.shopIcon}><Store size={20} aria-hidden="true" /></span><Status {...visitStatus(visit)} /></div>
        <h2><button type="button" onClick={onOpen} disabled={busy}>{visit.shopName}</button></h2>
        <p className={styles.address}><MapPin size={15} aria-hidden="true" /><span>{visit.address}{visit.city ? `, ${visit.city}` : ''}</span></p>
        <dl className={styles.cardDetails}>
            <div><dt>Owner preference</dt><dd>{visit.preferredWhen}</dd></div>
            <div><dt>Field agent</dt><dd>{visit.assignedAgent?.name ?? 'Not assigned'}</dd></div>
            {visit.scheduledAt ? <div><dt>{visit.status === 'confirmed' || visit.status === 'completed' ? 'Visit time' : 'Proposed time'}</dt><dd>{formatVisitTime(visit.scheduledAt)}</dd></div> : null}
        </dl>
        {visit.declineReason && visit.status === 'requested' ? <p className={styles.declined}>Previous agent declined: {visit.declineReason}</p> : null}
        <div className={styles.cardFoot}><span>Requested {formatVisitTime(visit.createdAt)}</span><Button size="sm" onClick={onOpen} disabled={busy}>View request</Button></div>
    </article>;
}

function VisitDetails({ visit, agents, busy, feedback, onAssign, onCancel }: {
    visit: AdminVisit; agents: VisitAgent[] | undefined; busy: boolean; feedback: Feedback; onAssign: (value: Assignment) => void; onCancel: (reason: string) => void;
}) {
    const [agentId, setAgentId] = useState<string>(visit.assignedAgentId ?? '');
    const [schedule, setSchedule] = useState(() => philippineInputValue(visit.scheduledAt));
    const [note, setNote] = useState(visit.adminNote ?? '');
    const [reason, setReason] = useState('');
    const [cancelling, setCancelling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [openedAt] = useState(() => Date.now());
    const directions = visitDirections(visit);
    const phone = contactPhone(visit.phone);
    const email = contactEmail(visit.email);
    const selectedAgent = agents?.find(agent => agent.id === agentId);
    const submit = () => {
        const timestamp = parsePhilippineSchedule(schedule);
        const now = Date.now();
        if (!selectedAgent) { setError('Choose an active certified field agent.'); return; }
        if (timestamp === null || timestamp <= now || timestamp > now + YEAR) { setError('Choose a valid future visit time within the next 365 days, in Philippine time.'); return; }
        setError(null); onAssign({ agentId: selectedAgent.id, scheduledAt: timestamp, adminNote: note.trim() });
    };
    return <div className={styles.details}>
        <div className={styles.statusLine}><Status {...visitStatus(visit)} /><span>Philippine time · UTC+8</span></div>
        {visit.status === 'assigned' ? <p className={styles.notice}>Waiting for the assigned agent to accept. The proposed time is not confirmed yet.</p> : null}
        <section className={styles.detailSection} aria-label="Shop location"><h3><MapPin size={17} aria-hidden="true" />Shop location</h3><p>{visit.address}{visit.city ? `, ${visit.city}` : ''}</p>
            {directions ? <a className={styles.mapLink} href={directions} target="_blank" rel="noopener noreferrer">Directions to the shop pin <ArrowUpRight size={15} aria-hidden="true" /></a> : <p className={styles.muted}>Map pin not available.</p>}
        </section>
        <section className={styles.detailSection} aria-label="Owner contact"><h3><UserRound size={17} aria-hidden="true" />Owner contact</h3><p>{visit.ownerName}</p><div className={styles.contactLinks}>
            {phone ? <a href={phone}><Phone size={15} aria-hidden="true" />{visit.phone}</a> : <span>{visit.phone}</span>}
            {email ? <a href={email}><Mail size={15} aria-hidden="true" />{visit.email}</a> : <span className={styles.muted}>Email not added</span>}
        </div></section>
        <section className={styles.detailSection}><h3><CalendarClock size={17} aria-hidden="true" />Visit details</h3><dl className={styles.detailList}>
            <div><dt>Owner preference</dt><dd>{visit.preferredWhen}</dd></div>
            <div><dt>Assigned agent</dt><dd>{visit.assignedAgent?.name ?? 'Not assigned'}</dd></div>
            {visit.scheduledAt ? <div><dt>{visit.status === 'confirmed' || visit.status === 'completed' ? 'Visit time' : 'Proposed time'}</dt><dd>{formatVisitTime(visit.scheduledAt)} · Philippine time</dd></div> : null}
            {visit.acceptedAt ? <div><dt>Agent accepted</dt><dd>{formatVisitTime(visit.acceptedAt)}</dd></div> : null}
            {visit.completedAt ? <div><dt>Completed</dt><dd>{formatVisitTime(visit.completedAt)}</dd></div> : null}
            {visit.cancelledAt ? <div><dt>Cancelled</dt><dd>{formatVisitTime(visit.cancelledAt)}</dd></div> : null}
        </dl></section>
        {visit.declineReason ? <section className={styles.reason}><h3>Agent declined</h3><p>{visit.declineReason}</p></section> : null}
        {visit.cancellationReason ? <section className={styles.reason}><h3>Cancellation reason</h3><p>{visit.cancellationReason}</p></section> : null}
        {visit.agentNote ? <section className={styles.detailSection}><h3>Agent note</h3><p>{visit.agentNote}</p></section> : null}
        {canAssignVisit(visit) ? <section className={styles.assignment} aria-label="Assign visit"><h3>{visit.status === 'assigned' ? 'Update the assignment' : 'Assign a field agent'}</h3>
            <p className={styles.muted}>Only active, certified field agents are listed. The agent must accept before this visit is confirmed.</p>
            <Field label="Field agent"><Select value={agentId} onChange={event => setAgentId(event.target.value)} disabled={busy || !agents?.length}>
                <option value="">{agents === undefined ? 'Loading eligible agents…' : 'Choose a field agent'}</option>
                {agents?.map(agent => <option key={agent.id} value={agent.id}>{agent.name} · {agent.email}{agent.workCity ? ` · ${agent.workCity}` : ''}</option>)}
            </Select></Field>
            {agents?.length === 0 ? <p role="status" className={styles.notice}>No active certified field agents are available to assign.</p> : null}
            {visit.assignedAgentId && agents && !agents.some(agent => agent.id === visit.assignedAgentId) ? <p className={styles.notice}>The previous agent is not currently eligible. Choose another agent.</p> : null}
            <Field label="Visit date and time (Philippine time, UTC+8)" help="This is a proposed time until the agent accepts."><Input type="datetime-local" value={schedule}
                min={philippineInputValue(openedAt)} max={philippineInputValue(openedAt + YEAR)} onChange={event => setSchedule(event.target.value)} disabled={busy} /></Field>
            <Field label="Admin note (optional)" help="Visible to the admin team."><Textarea value={note} onChange={event => setNote(event.target.value)} maxLength={1000} rows={3} disabled={busy} /></Field>
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            <Button variant="primary" disabled={busy || !selectedAgent || !schedule} aria-busy={busy} onClick={submit}>{busy ? 'Saving…' : visit.status === 'assigned' ? 'Update assignment' : 'Assign visit'}</Button>
        </section> : visit.adminNote ? <section className={styles.detailSection}><h3>Admin note</h3><p>{visit.adminNote}</p></section> : null}
        {canCancelVisit(visit) ? <div className={styles.cancelArea}><Button variant="danger" disabled={busy} onClick={() => setCancelling(true)}>Cancel visit</Button><p>Cancellation closes this request and updates the owner and any assigned agent.</p></div> : null}
        <ConfirmDialog open={cancelling} onCancel={() => setCancelling(false)} onConfirm={() => onCancel(reason.trim())} title={`Cancel ${visit.shopName}’s visit?`}
            confirmLabel="Cancel this visit" cancelLabel="Keep visit" busy={busy}>
            <p>The owner and any assigned agent will be notified. This request will close.</p>
            <Field label="Cancellation reason (optional)"><Textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} rows={3} disabled={busy} /></Field>
            {feedback?.tone === 'error' ? <p className={styles.error} role="alert">{feedback.message}</p> : null}
        </ConfirmDialog>
    </div>;
}
