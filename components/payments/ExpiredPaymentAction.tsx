'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useConvexAuth, useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { useRouter } from 'next/navigation';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { Button, ButtonLink } from '@/components/r1';
import { Button as V2Button } from '@/components/v2';
import { ownerReturnPath } from '@/lib/ownerReturnPath';

type Props = {
    token: Doc<'paymentTokens'>;
    total?: number;
    version?: 'r1' | 'v2';
};

/** Renew only after identity and server-side payer access have been checked. */
export function ExpiredPaymentAction(props: Props) {
    const { userId, sessionId } = useAuth();
    return <RetryPayment key={`${userId ?? 'guest'}:${sessionId ?? ''}:${props.token.token}`} {...props} />;
}

function RetryPayment({ token, total, version = 'r1' }: Props) {
    const router = useRouter();
    const { isAuthenticated, isLoading } = useConvexAuth();
    const retry = useMutation(api.ownerPayments.retryExpiredPayment);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [paid, setPaid] = useState(false);
    const [processing, setProcessing] = useState(false);
    const working = useRef(false);
    const mounted = useRef(true);
    const latest = useRef({ isAuthenticated, isLoading, total });
    latest.current = { isAuthenticated, isLoading, total };
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const paymentPath = `${version === 'v2' ? '/v2' : ''}/pay/${encodeURIComponent(token.token)}`;
    const signInHref = `/my-business/sign-in?returnTo=${encodeURIComponent(ownerReturnPath(paymentPath))}`;
    const again = async () => {
        if (!isAuthenticated || isLoading || working.current || paid) return;
        working.current = true; setBusy(true); setMessage(null);
        try {
            const result = await retry({ token: token.token, expectedSubmissionId: token.submissionId, expectedTotal: total });
            if (!mounted.current || !latest.current.isAuthenticated || latest.current.isLoading) return;
            if (latest.current.total !== total) {
                setMessage('The price changed. Check the latest total and try again.');
                return;
            }
            if (result.status === 'ready') {
                router.push(`${version === 'v2' ? '/v2' : ''}/pay/${encodeURIComponent(result.token)}`);
            } else if (result.status === 'needs_approval') {
                router.push(`/my-business/${encodeURIComponent(result.submissionId)}`);
            } else if (result.status === 'paid') {
                setPaid(true);
                setMessage('This payment is already recorded. Your receipt will update here.');
                router.refresh();
            } else {
                setProcessing(true);
                setMessage('An earlier checkout may still be open. Check its status before starting another payment.');
            }
        } catch (cause) {
            if (mounted.current) setMessage(cause instanceof ConvexError && typeof cause.data === 'string'
                ? cause.data : cause instanceof Error ? cause.message : 'We could not reopen checkout. Please try again.');
        } finally {
            working.current = false;
            if (mounted.current) setBusy(false);
        }
    };
    const title = busy ? 'Opening checkout…' : processing ? 'Check again' : 'Pay again';
    return <div className="flex flex-col gap-3">
        {isAuthenticated ? version === 'v2'
            ? <V2Button variant="dark" disabled={busy || paid || isLoading} aria-busy={busy} onClick={() => void again()}>{title}</V2Button>
            : <Button variant="primary" disabled={busy || paid || isLoading} aria-busy={busy} onClick={() => void again()}>{title}</Button>
            : version === 'v2'
                ? <V2Button variant="dark" href={signInHref} aria-disabled={isLoading} onClick={event => { if (isLoading) event.preventDefault(); }}>Pay again</V2Button>
                : <ButtonLink variant="primary" href={signInHref} aria-disabled={isLoading} onClick={event => { if (isLoading) event.preventDefault(); }}>Pay again</ButtonLink>}
        {!isAuthenticated ? <p className="text-sm leading-6 text-neutral-600">Sign in with the owner’s email, then tap Pay again to open a fresh checkout.</p> : null}
        {message ? <p className="text-sm leading-6 text-neutral-600" role="status">{message}</p> : null}
    </div>;
}
