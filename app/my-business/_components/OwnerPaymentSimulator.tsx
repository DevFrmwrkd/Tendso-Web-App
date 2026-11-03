'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import { ConvexError } from 'convex/values';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Button, ConfirmDialog, Dialog, Field, Input } from '@/components/r1';

type Snapshot = NonNullable<FunctionReturnType<typeof api.paymentSimulator.get>>;
type Action = FunctionArgs<typeof api.paymentSimulator.run>['action'];
const peso = (amount: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(amount);
const paymentLabels = { unpaid: 'Unpaid', deposit_paid: 'Down payment recorded', paid: 'Paid in full' } as const;

/** Eligibility and every command are authorized by the server, never a URL flag. */
export function OwnerPaymentSimulator({ submissionId }: { submissionId: Id<'submissions'> }) {
    const { userId, sessionId } = useAuth();
    const { isAuthenticated, isLoading } = useConvexAuth();
    if (process.env.NEXT_PUBLIC_CONVEX_URL !== 'https://diligent-ibex-454.convex.cloud'
        || !userId || !sessionId || isLoading || !isAuthenticated) return null;
    return <ScopedSimulator key={`${userId}:${sessionId}:${submissionId}`} submissionId={submissionId} actor={userId} />;
}

function ScopedSimulator({ submissionId, actor }: { submissionId: Id<'submissions'>; actor: string }) {
    const snapshot = useQuery(api.paymentSimulator.get, { submissionId });
    const execute = useMutation(api.paymentSimulator.run);
    const [open, setOpen] = useState(false);
    const [confirmReset, setConfirmReset] = useState(false);
    const [amount, setAmount] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const mounted = useRef(true);
    const working = useRef(false);
    const current = useRef(snapshot); current.current = snapshot;
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

    const eligible = (value: typeof snapshot): value is Snapshot => !!value
        && value.simulationOnly === true && value.withdrawable === false
        && value.actorClerkId === actor && value.submissionId === submissionId;
    const run = async (action: Action, testAmount?: number) => {
        const state = current.current;
        if (working.current || !mounted.current || !eligible(state)) return;
        if (state.priceChanged && action !== 'reset') return;
        working.current = true; setBusy(true); setError(null); setNotice(null);
        try {
            const result = await execute({ submissionId, action, requestId: `web_${crypto.randomUUID()}`,
                expectedRevision: state.revision, expectedTotal: state.total,
                ...(testAmount === undefined ? {} : { amount: testAmount }) });
            if (!mounted.current || !eligible(current.current) || !eligible(result)) return;
            if (result.revision < current.current.revision || current.current.total !== state.total || result.total !== state.total) return;
            setNotice(result.events[0]?.message ?? 'Test step completed.');
            if (action === 'reset') { setAmount(''); setConfirmReset(false); }
        } catch (cause) {
            if (mounted.current && eligible(current.current) && current.current.total === state.total && current.current.revision <= state.revision)
                setError(cause instanceof ConvexError && typeof cause.data === 'string' ? cause.data
                : cause instanceof Error ? cause.message : 'The test step failed. Try again.');
        } finally {
            working.current = false;
            if (mounted.current) setBusy(false);
        }
    };
    if (!eligible(snapshot)) return null;

    const state = snapshot;
    const pendingReview = state.pendingReview !== null;
    const available = !busy && !state.priceChanged && state.requestStatus === 'open' && !pendingReview && state.balanceDue > 0;
    const depositAmount = amount.trim() ? Number(amount) : state.minDeposit;
    const validDeposit = Number.isSafeInteger(depositAmount) && depositAmount >= state.minDeposit && depositAmount < state.balanceDue;
    const close = () => { if (!working.current) { setOpen(false); setConfirmReset(false); } };

    return <section className="t-card border border-amber-300 bg-amber-50 p-5" aria-label="Test payment tools">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
                <span className="mb-2 inline-block rounded-full bg-amber-200 px-2.5 py-1 text-xs font-semibold">TEST ONLY</span>
                <h2 className="t-h2">Try a test payment</h2>
                <p className="t-meta mt-1">Practice with this business. Your real balance and website status stay unchanged.</p>
            </div>
            <Button onClick={() => { setError(null); setNotice(null); setOpen(true); }}>Open payment simulator</Button>
        </div>
        <Dialog open={open} onClose={close} title="Test payment simulator" className="!my-4"
            footer={<Button onClick={close} disabled={busy}>Close simulator</Button>}>
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
                <strong>Test only — no real money.</strong>
                <p>No payouts, publication, domain changes or emails. These simulated receipts never change your real business or payment records.</p>
            </div>
            <div>
                <p className="font-semibold break-words">{state.businessName}</p>
                <p className="t-meta break-all">Test reference {state.referenceCode} · Attempt {state.attempt}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 rounded-xl bg-neutral-50 p-4 text-sm">
                <div><dt className="t-meta">Test price</dt><dd className="font-semibold">{peso(state.total)}</dd></div>
                <div><dt className="t-meta">Simulated paid</dt><dd className="font-semibold">{peso(state.amountPaid)}</dd></div>
                <div><dt className="t-meta">Simulated balance</dt><dd className="font-semibold">{peso(state.balanceDue)}</dd></div>
                <div><dt className="t-meta">Simulated status</dt><dd className="font-semibold">{paymentLabels[state.paymentStatus]}</dd></div>
            </dl>
            {state.priceChanged ? <p role="alert" className="rounded-xl bg-amber-100 p-3 text-sm">The business price changed. Reset this test to use the latest price.</p> : null}
            {state.requestStatus === 'expired' ? <section className="rounded-xl border border-amber-300 p-4">
                <h3 className="font-semibold">Test checkout expired</h3>
                <p className="t-meta mb-3">Pay again opens a fresh simulated attempt. Any confirmed test down payment is kept.</p>
                <Button variant="primary" disabled={busy || state.priceChanged} onClick={() => void run('renew')}>Pay again (test)</Button>
            </section> : null}
            {state.paymentStatus !== 'paid' && state.requestStatus !== 'expired' ? <section className="flex flex-col gap-3 border-t border-r1-line pt-4">
                <h3 className="font-semibold">1. Record a test payment</h3>
                {state.paymentStatus === 'unpaid' ? <>
                    <Button disabled={!available} onClick={() => void run('full')}>Simulate full payment</Button>
                    <Field label="Test down payment (PHP)" help={`Minimum ${peso(state.minDeposit)}. The rest stays as a simulated balance.`}>
                        <Input type="number" inputMode="numeric" min={state.minDeposit} step="1" placeholder={String(state.minDeposit)} value={amount}
                            onChange={event => setAmount(event.target.value)} disabled={!available} />
                    </Field>
                    <Button disabled={!available || !validDeposit} onClick={() => void run('deposit', depositAmount)}>Simulate down payment</Button>
                </> : <Button variant="primary" disabled={!available} onClick={() => void run('balance')}>Simulate remaining balance</Button>}
            </section> : null}
            <section className="flex flex-col gap-3 border-t border-r1-line pt-4">
                <h3 className="font-semibold">2. Try receipt review</h3>
                {pendingReview ? <>
                    <p className="t-meta">Unmatched test receipt: {peso(state.pendingReview!.amount)}. It has not been credited.</p>
                    <Button disabled={busy || state.priceChanged} onClick={() => void run('approve_review')}>Confirm test receipt</Button>
                </> : <>
                    <p className="t-meta">Send a simulated receipt for the remaining balance with a missing reference, then confirm it in this test.</p>
                    <Button disabled={!available} onClick={() => void run('unmatched', state.balanceDue)}>Simulate unmatched receipt</Button>
                </>}
            </section>
            <section className="flex flex-col gap-3 border-t border-r1-line pt-4">
                <h3 className="font-semibold">3. Check recovery and duplicates</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                    <Button disabled={!available} onClick={() => void run('expire')}>Expire test checkout</Button>
                    <Button disabled={busy || state.priceChanged || !state.lastReceiptId} onClick={() => void run('duplicate')}>Replay last test receipt</Button>
                </div>
                <p className="t-meta">Replaying a confirmed receipt must add no extra credit.</p>
            </section>
            {busy ? <p role="status" className="t-meta">Applying test step…</p> : null}
            {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
            {notice ? <p role="status" className="rounded-lg bg-neutral-100 p-3 text-sm">{notice}</p> : null}
            <section className="border-t border-r1-line pt-4" aria-label="Simulation history">
                <h3 className="mb-3 font-semibold">Test history</h3>
                {state.events.length ? <ol className="flex flex-col gap-3 text-sm">{state.events.map(event => <li key={event.id} className="rounded-xl bg-neutral-50 p-3">
                    <p className="font-medium">{event.message}</p>
                    <p className="t-meta">{event.amount === null ? '' : `${peso(event.amount)} · `}{new Date(event.createdAt).toLocaleString('en-PH')}</p>
                </li>)}</ol> : <p className="t-meta">No test payments yet.</p>}
                <Button className="mt-4" variant="ghost" disabled={busy || !state.canReset} onClick={() => setConfirmReset(true)}>Reset test</Button>
            </section>
        </Dialog>
        <ConfirmDialog open={open && confirmReset} onCancel={() => setConfirmReset(false)} onConfirm={() => void run('reset')}
            title="Reset this test history?" confirmLabel="Reset simulated payments" cancelLabel="Keep testing" busy={busy}>
            Clears this business’s simulated payments and test history. Real payments and business status stay unchanged.
        </ConfirmDialog>
    </section>;
}
