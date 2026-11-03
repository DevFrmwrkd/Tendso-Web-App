'use client';

import { useEffect, useRef, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { AlertCircle, ArrowDown, ArrowUpRight, Check, Clock, Globe, Lock, MessageSquare, ShieldCheck } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Button, Field, Input } from '@/components/r1';
import { SiteOverview, SiteOverviewLoading } from './OwnerHome';
import type { OwnerSite } from './ownerSite';
import { OwnerPaymentSimulator } from './OwnerPaymentSimulator';
import styles from './OwnerPrivateWebsite.module.css';

const peso = (amount: number) => `₱${amount.toLocaleString('en-PH')}`;
function publicAddress(value: string | null | undefined): string | null {
    if (!value) return null;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch { return null; }
}

/** The same owner-gated private preview and checkout contract as the app. */
export function OwnerWebsiteOverview({ site }: { site: OwnerSite }) {
    const { userId } = useAuth();
    const summary = useQuery(api.ownerApp.getSubmission, { submissionId: site.submissionId });
    if (summary === undefined) return <SiteOverviewLoading />;
    if (summary.status === 'draft' && summary.contentSource === 'owner_app') return <section className={styles.paymentCard}>
        <h2>Your business setup is saved.</h2><p>Continue with the same photos, interview answers and selected design on mobile or web.</p>
        <Link className="t-btn t-btn-primary" href={`/my-business/drafts/${site.submissionId}`}>Continue setup <ArrowUpRight size={17} aria-hidden="true" /></Link>
    </section>;
    return <div className={styles.root}>
        {summary.publishPolicy !== 'pay_then_publish' ? <SiteOverview site={site} />
            : <PrivateWebsite key={`${userId ?? ''}:${site.submissionId}`} id={site.submissionId} />}
        <div className={styles.testTools} aria-label="Secondary test tools">
            <OwnerPaymentSimulator submissionId={site.submissionId} />
        </div>
    </div>;
}

function PrivateWebsite({ id }: { id: Id<'submissions'> }) {
    const summary = useQuery(api.ownerApp.getSubmission, { submissionId: id });
    const preview = useQuery(api.ownerApp.getPreview, { submissionId: id });
    const payment = useQuery(api.ownerPayments.getPaymentState, { submissionId: id });
    const approve = useMutation(api.ownerApp.approvePreview);
    const requestChange = useMutation(api.ownerApp.requestChange);
    const createToken = useMutation(api.ownerPayments.createPayToken);
    const checkout = useAction(api.xendit.createCheckout);
    const [changes, setChanges] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const mounted = useRef(true);
    const working = useRef(false);
    const latest = useRef({ payment, summary }); latest.current = { payment, summary };
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const run = async (action: () => Promise<unknown>) => {
        if (working.current) return;
        working.current = true; setBusy(true); setError(null); setNotice(null);
        try { await action(); }
        catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Please try again.'); }
        finally { working.current = false; if (mounted.current) setBusy(false); }
    };
    const pay = async (method: 'wise' | 'xendit') => {
        const state = latest.current.payment;
        if (!state?.billable || state.paidInFull || state.needsApproval || latest.current.summary?.openChangeRequests) return;
        const kind = state.canPayBalance ? 'balance' : 'full';
        const token = await createToken({ submissionId: id, kind, expectedTotal: state.total });
        if (!mounted.current) return;
        const checkQuote = () => {
            const current = latest.current.payment;
            if (!current?.billable || current.paidInFull || current.needsApproval || current.total !== state.total
                || current.balanceDue !== state.balanceDue || latest.current.summary?.openChangeRequests) {
                throw new Error('The payment details changed. Check the latest preview and amount.');
            }
        };
        checkQuote();
        if (method === 'xendit') {
            const result = await checkout({ token: token.token,
                successRedirectUrl: `${window.location.origin}/my-business/${id}`,
                failureRedirectUrl: `${window.location.origin}/my-business/${id}` });
            if (!mounted.current) return;
            checkQuote();
            if (result.enabled) {
                const url = new URL(result.checkoutUrl);
                if (url.protocol !== 'https:' || url.username || url.password) throw new Error('The checkout link is unavailable.');
                window.location.assign(url.href); return;
            }
        }
        window.location.assign(`/pay/${encodeURIComponent(token.token)}`);
    };
    if (!summary || !preview || !payment) return <SiteOverviewLoading />;
    const live = summary.phase === 'live';
    const billable = payment.billable && !payment.paidInFull;
    const needsApproval = payment.billable && payment.needsApproval;
    const changing = summary.openChangeRequests > 0;
    const paidInFull = payment.billable && payment.paidInFull;
    const offline = summary.phase === 'offline';
    const rejected = summary.phase === 'rejected';
    const attention = offline || rejected;
    const publishedUrl = live ? publicAddress(summary.publishedUrl) : null;
    const statusLabel = offline ? 'Offline' : rejected ? 'Needs attention' : summary.phase === 'draft' ? 'Draft' : live ? 'Live'
        : changing ? 'Changes requested' : preview.ready ? 'Private preview' : 'In progress';
    const headline = offline ? 'Your website is offline.' : rejected ? 'Your business needs attention.'
        : live ? 'Your website is online.' : summary.phase === 'draft' ? 'Your business is saved as a draft.' : changing ? 'Your changes are in progress.'
        : !preview.ready ? 'Your website is taking shape.' : needsApproval ? 'Take a look before you pay.'
            : paidInFull ? 'Paid in full. Publication is pending.' : 'Your preview is ready.';
    const description = offline ? 'Your public website is currently offline. Contact the team to check the next steps.'
        : rejected ? 'This business needs attention before we can continue. Contact the team to check what needs updating.'
            : live ? publishedUrl ? 'Your website is online. Open the public website below to see the current published version.'
                : 'Your website is online. Its public address is not available here yet.'
                : summary.phase === 'draft' ? 'Continue setup in the Tendso app. Your details are saved, and your preview will appear here after setup.'
        : changing ? 'We’re working on your requested changes. Check the updated preview before paying.'
            : !preview.ready ? 'Your preview will appear here when it’s ready to review.'
                : paidInFull ? 'Your payment is complete. This preview stays private until your website is published.'
                    : needsApproval ? 'Check your photos, details and wording. Approve the preview when it feels right.'
                        : !payment.billable ? 'Payment details are not available yet. Contact the team if you need help with your order.'
                            : 'Complete your payment to move your approved website toward publication.';
    const nextStepId = `owner-next-step-${id}`;

    return <div className={styles.detail}>
        <section className={styles.statusSummary} aria-label="Website status">
            <span className={`${styles.summaryIcon} ${live ? styles.summaryIconLive : attention ? styles.summaryIconAttention : ''}`} aria-hidden="true">
                {attention ? <AlertCircle size={24} /> : live ? <Globe size={24} /> : changing ? <Clock size={24} /> : <Lock size={24} />}
            </span>
            <div className={styles.summaryContent}>
                <span className={`${styles.badge} ${live ? styles.badgeLive : attention ? styles.badgeAttention : ''}`}>{statusLabel}</span>
                <h2>{headline}</h2>
                <p>{description}</p>
            </div>
            <a className={styles.summaryAction} href={`#${nextStepId}`}>
                {live ? 'Website details' : needsApproval ? 'Review & approve' : billable ? 'Payment options' : 'Next step'}
                <ArrowDown size={17} aria-hidden="true" />
            </a>
        </section>

        <div className={styles.workspace}>
            <section className={styles.previewCard} aria-label="Your website preview">
                <div className={styles.previewHeading}>
                    <div><p className={styles.eyebrow}>Your website</p><h3>{summary.businessName}</h3></div>
                    <span className={styles.previewLabel}>{live ? <Globe size={15} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}
                        {live ? 'Website preview' : attention ? 'Saved preview' : 'Private preview'}</span>
                </div>
                <div className={styles.previewStage}>
                    <div className={styles.browserFrame}>
                        <div className={styles.browserChrome}>
                            <span className={styles.browserDots} aria-hidden="true"><i /><i /><i /></span>
                            <span className={styles.browserAddress}>
                                {live ? <Globe size={12} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
                                <span>{live || attention ? 'Saved website preview' : 'Your private website preview'}</span>
                            </span>
                            <span className={styles.browserBalance} aria-hidden="true" />
                        </div>
                        <div className={styles.previewViewport}>
                            {preview.ready ? <iframe title={`${summary.businessName} website preview`} sandbox="allow-scripts"
                                src={preview.inlineHtml ? undefined : preview.htmlUrl ?? undefined} srcDoc={preview.inlineHtml ?? undefined}
                                className={styles.previewIframe} />
                                : <div className={styles.emptyPreview}>
                                    <span className={styles.emptyIcon} aria-hidden="true"><Globe size={28} /></span>
                                    <h4>{attention ? 'Preview unavailable' : summary.phase === 'draft' ? 'Let’s bring your business online.' : 'A little work, behind the scenes.'}</h4>
                                    <p>{attention ? 'Contact the team for help with this business.' : summary.phase === 'draft' ? 'Continue setting up this business in the Tendso app.' : 'We’re preparing your private website preview.'}</p>
                                </div>}
                        </div>
                    </div>
                </div>
                <div className={styles.previewFootnote}>
                    {live ? <Globe size={16} aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}
                    <p>{live ? 'This is a saved preview and may differ from the current published website.'
                        : offline ? 'Saved preview. Your public website is currently offline.'
                            : rejected ? 'Saved preview. This business needs attention before we can continue.'
                                : payment.billable ? 'Not public yet. Your website needs approval and full payment before publication.'
                        : 'Not public yet. This preview stays private until your website is published.'}
                        {preview.ready ? ' Scroll inside the preview to explore it.' : ''}</p>
                </div>
            </section>

            <aside className={styles.sidebar} id={nextStepId}>
                <section className={styles.paymentCard} aria-label="Website payment details">
                    <div className={styles.cardHeading}>
                        <span className={styles.cardIcon} aria-hidden="true">{paidInFull ? <Check size={20} /> : <ShieldCheck size={20} />}</span>
                        <div><p className={styles.eyebrow}>{paidInFull ? 'Payment complete' : 'Your next step'}</p>
                            <h3>{attention ? 'Payment details' : live ? 'Your website' : needsApproval ? 'Check it first' : !payment.billable ? 'Website details'
                                : payment.amountPaid > 0 && !payment.paidInFull ? 'Pay the balance' : 'Pay once to publish'}</h3></div>
                    </div>
                    {payment.billable ? <>
                        <div className={styles.amountSummary}>
                            <span>{paidInFull ? 'Website total' : payment.amountPaid > 0 ? 'Remaining balance' : 'Website total'}</span>
                            <strong>{peso(paidInFull ? payment.total : payment.balanceDue)}</strong>
                            {paidInFull ? <span className={styles.paidLabel}><Check size={15} aria-hidden="true" /> Paid in full</span>
                                : <p>One price for your website. Custom domains are priced separately.</p>}
                        </div>
                        <dl className={styles.breakdown}>
                            <div><dt>Website total</dt><dd>{peso(payment.total)}</dd></div>
                            <div><dt>Already paid</dt><dd>{peso(payment.amountPaid)}</dd></div>
                            <div className={styles.balanceLine}><dt>Balance remaining</dt><dd>{peso(paidInFull ? 0 : payment.balanceDue)}</dd></div>
                        </dl>
                    </> : null}
                    <div className={styles.actions}>
                        {changing ? <p className={styles.pendingMessage} role="status"><Clock size={18} aria-hidden="true" /><span>We’re working on your requested changes. Check the updated preview before paying.</span></p>
                            : needsApproval ? <>
                                <p className={styles.bodyCopy}>Happy with your preview? Approve it first, then choose how to pay.</p>
                                <Button className={styles.actionButton} variant="primary" disabled={busy || !preview.ready} onClick={() => void run(async () => {
                                    await approve({ submissionId: id });
                                    if (mounted.current) setNotice('Preview approved. Choose how to pay below.');
                                })}>Looks good <Check size={17} aria-hidden="true" /></Button>
                            </> : billable ? <>
                                {payment.billable && payment.xenditEnabled ? <Button className={styles.actionButton} variant="primary" disabled={busy} onClick={() => void run(() => pay('xendit'))}>Pay with GCash, Maya or card</Button> : null}
                                <Button className={styles.actionButton} disabled={busy} onClick={() => void run(() => pay('wise'))}>Pay by bank transfer <ArrowUpRight size={16} aria-hidden="true" /></Button>
                            </> : <p className={!payment.billable ? styles.pendingMessage : styles.paymentState} role="status">
                                {!payment.billable ? <Clock size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
                                <span>{!payment.billable ? 'Payment details are not available yet. Contact the team for help with your order.'
                                    : offline ? 'Your website is paid in full. It is currently offline.'
                                        : rejected ? 'Your payment is recorded. This business still needs attention.'
                                            : live ? 'Your website is paid and online.' : 'Payment received. Publication is still pending.'}</span></p>}
                        {publishedUrl ? <a className={styles.openWebsite} href={publishedUrl} target="_blank" rel="noopener noreferrer">Open your website <ArrowUpRight size={17} aria-hidden="true" /></a> : null}
                        {attention || !payment.billable ? <a className={styles.supportLink} href="/contact">Contact the team <ArrowUpRight size={16} aria-hidden="true" /></a> : null}
                        {error ? <p className={styles.error} role="alert">{error}</p> : null}
                        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
                    </div>
                    {!live && !attention ? <p className={styles.paymentFootnote}><Lock size={14} aria-hidden="true" /> Your preview stays private until it is published.</p> : null}
                </section>
                {preview.ready ? <section className={styles.changeCard}>
                    <div className={styles.cardHeading}><span className={styles.cardIcon} aria-hidden="true"><MessageSquare size={20} /></span>
                        <div><p className={styles.eyebrow}>Make it yours</p><h3>Need a change?</h3></div></div>
                    <p className={styles.bodyCopy}>Tell us what you’d like to update. The Tendso team makes the change for you.</p>
                    <Field label="What should we change?" className={styles.changeField}><Input className={styles.changeInput} value={changes}
                        placeholder="For example, update my opening hours…" onChange={event => setChanges(event.target.value)} maxLength={1000} disabled={busy || changing} /></Field>
                    <Button className={styles.actionButton} disabled={busy || changing || !changes.trim()} onClick={() => void run(async () => {
                        await requestChange({ submissionId: id, text: changes.trim() });
                        if (mounted.current) { setChanges(''); setNotice('Your change request was sent.'); }
                    })}>Send change request <ArrowUpRight size={16} aria-hidden="true" /></Button>
                    {changing ? <p className={styles.bodyCopy}>Your request is with the team. You can send another after these changes are complete.</p> : null}
                </section> : null}
            </aside>
        </div>
    </div>;
}
