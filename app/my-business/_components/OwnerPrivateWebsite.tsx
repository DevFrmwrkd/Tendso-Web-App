'use client';

import { useEffect, useRef, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Button, Field, Input } from '@/components/r1';
import { SiteOverview, SiteOverviewLoading } from './OwnerHome';
import type { OwnerSite } from './ownerSite';
import { OwnerPaymentSimulator } from './OwnerPaymentSimulator';

const peso = (amount: number) => `₱${amount.toLocaleString('en-PH')}`;

/** The same owner-gated private preview and checkout contract as the app. */
export function OwnerWebsiteOverview({ site }: { site: OwnerSite }) {
    const { userId } = useAuth();
    const summary = useQuery(api.ownerApp.getSubmission, { submissionId: site.submissionId });
    if (summary === undefined) return <SiteOverviewLoading />;
    return <div className="flex flex-col gap-6">
        {summary.publishPolicy !== 'pay_then_publish' ? <SiteOverview site={site} />
            : <PrivateWebsite key={`${userId ?? ''}:${site.submissionId}`} id={site.submissionId} />}
        <OwnerPaymentSimulator submissionId={site.submissionId} />
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
    return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="t-card overflow-hidden" aria-label="Your website preview">
            <div className="border-b border-r1-line px-5 py-4">
                <h2 className="t-h2">{summary.businessName}</h2>
                <p className="t-meta">{live ? 'Your website is live.' : 'Private preview · Your website becomes public after approval and full payment.'}</p>
            </div>
            {preview.ready ? <iframe title={`${summary.businessName} website preview`} sandbox="allow-scripts"
                src={preview.inlineHtml ? undefined : preview.htmlUrl ?? undefined} srcDoc={preview.inlineHtml ?? undefined}
                className="h-[640px] w-full border-0 bg-white" />
                : <p className="p-6">{summary.phase === 'draft' ? 'Continue setting up this business in the Tendso app.' : 'We’re preparing your private website preview.'}</p>}
        </section>
        <aside className="flex flex-col gap-5">
            <section className="t-card flex flex-col gap-4 p-5">
                <h2 className="t-h2">{live ? 'Your website' : needsApproval ? 'Check it first' : 'Pay once to publish'}</h2>
                {payment.billable ? <><p className="text-3xl font-semibold">{peso(payment.paidInFull ? payment.total : payment.balanceDue)}</p>
                    <p className="t-meta">{payment.paidInFull ? 'Paid in full' : payment.amountPaid > 0 ? `${peso(payment.amountPaid)} already paid · remaining balance above` : 'One payment for your website. Custom domains are priced separately.'}</p></> : null}
                {changing ? <p role="status">We’re working on your requested changes. Check the updated preview before paying.</p>
                    : needsApproval ? <Button variant="primary" disabled={busy || !preview.ready} onClick={() => void run(async () => {
                        await approve({ submissionId: id });
                        if (mounted.current) setNotice('Preview approved. Choose how to pay below.');
                    })}>Looks good</Button>
                        : billable ? <>
                            {payment.billable && payment.xenditEnabled ? <Button variant="primary" disabled={busy} onClick={() => void run(() => pay('xendit'))}>Pay with GCash, Maya or card</Button> : null}
                            <Button disabled={busy} onClick={() => void run(() => pay('wise'))}>Pay by bank transfer</Button>
                        </> : <p role="status">{!payment.billable ? 'No payment is required for this website.' : live ? 'Your website is paid and online.' : 'Payment received. We’re publishing your website.'}</p>}
                {live && summary.publishedUrl ? <a className="t-link" href={summary.publishedUrl} target="_blank" rel="noopener noreferrer">Open your website</a> : null}
                {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
                {notice ? <p className="t-meta" role="status">{notice}</p> : null}
            </section>
            {!live && preview.ready ? <section className="t-card flex flex-col gap-3 p-5">
                <h2 className="t-h2">Need a change?</h2>
                <Field label="What should we change?"><Input value={changes} onChange={event => setChanges(event.target.value)} maxLength={1000} disabled={busy || changing} /></Field>
                <Button disabled={busy || changing || !changes.trim()} onClick={() => void run(async () => {
                    await requestChange({ submissionId: id, text: changes.trim() });
                    if (mounted.current) { setChanges(''); setNotice('Your change request was sent.'); }
                })}>Send change request</Button>
            </section> : null}
        </aside>
    </div>;
}
