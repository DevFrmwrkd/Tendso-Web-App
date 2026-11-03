import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getFunctionName } from 'convex/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Doc } from '../../convex/_generated/dataModel';
import { checkoutExpiryAt, payView } from '../../app/pay/[token]/_components/payState';
import { ownerReturnPath } from '../../lib/ownerReturnPath';

const state = vi.hoisted(() => ({
    authenticated: false, authLoading: false, retry: vi.fn(), push: vi.fn(), refresh: vi.fn(),
    actions: new Map<string, (event?: unknown) => void>(), mutations: [] as string[],
}));
vi.mock('convex/react', () => ({
    useConvexAuth: () => ({ isAuthenticated: state.authenticated, isLoading: state.authLoading }),
    useConvex: () => ({ query: vi.fn() }),
    useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
        const name = getFunctionName(reference); state.mutations.push(name);
        return name === 'ownerPayments:retryExpiredPayment' ? state.retry : vi.fn();
    },
    useAction: () => vi.fn(), useQuery: () => undefined,
}));
vi.mock('@clerk/nextjs', () => ({
    useAuth: () => ({ userId: state.authenticated ? 'owner1' : null, sessionId: state.authenticated ? 'session1' : null }),
    SignInButton: ({ children }: { children: ReactNode }) => createElement('div', {}, children),
}));
vi.mock('next/navigation', () => ({ useParams: () => ({}), useRouter: () => ({ push: state.push, refresh: state.refresh }) }));
vi.mock('next/link', () => ({ default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => createElement('a', { href, ...rest }, children) }));
vi.mock('../../hooks/useOwnerAuth', () => ({ useOwnerAuth: () => ({ isOwner: false }) }));
vi.mock('../../components/landing/LiveSitePreview', () => ({ default: () => createElement('div', {}, 'Site preview') }));
vi.mock('../../components/r1', async () => {
    const actual = await vi.importActual<typeof import('../../components/r1')>('../../components/r1');
    const capture = ({ children, href, onClick, variant: _variant, ...rest }: { children: ReactNode; href?: string; onClick?: (event?: unknown) => void; variant?: string }) => {
        if (typeof children === 'string' && onClick) state.actions.set(children, onClick);
        return createElement(href ? 'a' : 'button', { href, onClick, ...rest }, children);
    };
    return { ...actual, Button: capture, ButtonLink: capture };
});
vi.mock('../../components/v2', () => ({
    Button: ({ children, href, onClick, variant: _variant, ...rest }: { children: ReactNode; href?: string; onClick?: (event?: unknown) => void; variant?: string }) => {
        if (typeof children === 'string' && onClick) state.actions.set(children, onClick);
        return createElement(href ? 'a' : 'button', { href, onClick, ...rest }, children);
    },
}));
vi.mock('../../components/v2/pages-b/shared', () => ({
    CheckIcon: () => null, PlusIcon: () => null, PbBrand: () => null, copyWithToast: vi.fn(), usePbToast: () => ({ node: null, show: vi.fn() }),
}));

import { ExpiredView } from '../../app/pay/[token]/_components/PayViews';
import { PayView } from '../../components/v2/pages-b/PayPage';

const now = 1_800_000_000_000;
const oldToken = 'a'.repeat(64); const freshToken = 'b'.repeat(64);
const submissionId = 'submission1' as Doc<'submissions'>['_id'];
const token = (overrides: Partial<Doc<'paymentTokens'>> = {}): Doc<'paymentTokens'> => ({
    _id: 'token1' as Doc<'paymentTokens'>['_id'], _creationTime: now, submissionId,
    token: oldToken, referenceCode: 'ND-TEST-TEST', kind: 'full', amount: 4999, status: 'pending',
    createdAt: now - 35 * 86400000, expiresAt: now - 86400000, ...overrides,
});
const submission = (overrides: Partial<Doc<'submissions'>> = {}): Doc<'submissions'> => ({
    _id: submissionId, _creationTime: now, creatorId: 'creator1' as Doc<'creators'>['_id'],
    businessName: 'Corner shop', businessType: 'shop', ownerName: 'Owner', ownerPhone: '', address: 'Sample', city: 'Manila',
    contentSource: 'owner_app', status: 'deposit_paid', amount: 4999, amountPaid: 500, depositPaidAt: now - 1000, ...overrides,
});
function render(version: 'r1' | 'v2', t = token(), s = submission()) {
    return renderToStaticMarkup(version === 'r1'
        ? createElement(ExpiredView, { token: t, submission: s, now })
        : createElement(PayView, { loading: false, token: t, submission: s, now, wiseEmail: 'wise@example.test', ownerHome: false }));
}
beforeEach(() => {
    vi.clearAllMocks(); state.authenticated = false; state.authLoading = false; state.actions.clear(); state.mutations = [];
    state.retry.mockResolvedValue({ status: 'ready', submissionId, token: freshToken, kind: 'balance', amount: 4499, referenceCode: 'ND-NEW-NEW', expiresAt: now + 86400000 });
});

describe.each(['r1', 'v2'] as const)('%s expired-payment page', version => {
    it('offers owner sign-in and a safe return to this payment page without unauthenticated renewal', () => {
        const html = render(version);
        const path = `${version === 'v2' ? '/v2' : ''}/pay/${oldToken}`;
        expect(html).toContain(`href="/my-business/sign-in?returnTo=${encodeURIComponent(path)}"`);
        expect(html).toContain('Pay again'); expect(html).toContain('confirmed down payment');
        expect(html).not.toContain('Ask for a new link'); expect(html).not.toContain('No payment arrived');
        expect(html).not.toContain('You still owe'); expect(html).not.toContain('Website went live');
        expect(state.retry).not.toHaveBeenCalled();
    });

    it('opens the server-issued current-balance checkout instead of reusing the expired full-order amount', async () => {
        state.authenticated = true; render(version);
        state.actions.get('Pay again')!();
        await vi.waitFor(() => expect(state.push).toHaveBeenCalledWith(`${version === 'v2' ? '/v2' : ''}/pay/${freshToken}`));
        expect(state.retry).toHaveBeenCalledExactlyOnceWith({ token: oldToken, expectedSubmissionId: submissionId, expectedTotal: 4999 });
        expect(state.mutations).toContain('ownerPayments:retryExpiredPayment');
    });

    it('returns an owner who needs to approve the latest private preview to their website', async () => {
        state.authenticated = true; state.retry.mockResolvedValueOnce({ status: 'needs_approval', submissionId });
        render(version); state.actions.get('Pay again')!();
        await vi.waitFor(() => expect(state.push).toHaveBeenCalledWith(`/my-business/${submissionId}`));
    });

    it('keeps an existing payment or open checkout from opening another payment request', async () => {
        state.authenticated = true; state.retry.mockResolvedValueOnce({ status: 'processing', submissionId });
        render(version); state.actions.get('Pay again')!();
        await vi.waitFor(() => expect(state.retry).toHaveBeenCalledTimes(1));
        await Promise.resolve(); expect(state.push).not.toHaveBeenCalled();
    });

    it('refreshes the receipt when the server finds payment already complete', async () => {
        state.authenticated = true; state.retry.mockResolvedValueOnce({ status: 'paid', submissionId });
        render(version); state.actions.get('Pay again')!();
        await vi.waitFor(() => expect(state.refresh).toHaveBeenCalledTimes(1));
        expect(state.push).not.toHaveBeenCalled();
    });

    it('deduplicates rapid Pay again taps while renewal is pending', async () => {
        state.authenticated = true;
        let finish!: (value: unknown) => void;
        state.retry.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
        render(version); const press = state.actions.get('Pay again')!; press(); press();
        expect(state.retry).toHaveBeenCalledTimes(1);
        finish({ status: 'ready', submissionId, token: freshToken });
        await vi.waitFor(() => expect(state.push).toHaveBeenCalledTimes(1));
    });
});

describe('hosted checkout expiry and settled receipts', () => {
    const unexpiredToken = { status: 'pending', expiresAt: now + 29 * 86400000, xenditInvoiceId: 'invoice1', xenditExpiresAt: now - 1 };
    it('shows Pay again when a 24-hour provider checkout expires before its 30-day token', () => {
        expect(payView(unexpiredToken, { status: 'website_generated' }, now)).toBe('expired');
        expect(checkoutExpiryAt(unexpiredToken)).toBe(now - 1);
    });
    it('requires both invoice identity and a finite provider expiry', () => {
        expect(payView({ ...unexpiredToken, xenditInvoiceId: undefined }, null, now)).toBe('pending');
        expect(payView({ ...unexpiredToken, xenditExpiresAt: Number.NaN }, null, now)).toBe('pending');
        expect(payView({ ...unexpiredToken, xenditExpiresAt: Number.POSITIVE_INFINITY }, null, now)).toBe('pending');
        expect(payView({ ...unexpiredToken, xenditExpiresAt: now + 1 }, null, now)).toBe('pending');
    });
    it('keeps paid receipt and cancellation precedence over provider expiry', () => {
        expect(payView({ ...unexpiredToken, status: 'paid' }, { status: 'deposit_paid' }, now)).toBe('paid');
        expect(payView(unexpiredToken, { status: 'completed' }, now)).toBe('paid');
        expect(payView(unexpiredToken, { status: 'deployed', paidInFullAt: now - 100 }, now)).toBe('paid');
        expect(payView({ ...unexpiredToken, status: 'cancelled' }, { status: 'website_generated' }, now)).toBe('notfound');
        expect(payView(unexpiredToken, { status: 'deposit_paid', depositPaidAt: now - 100 }, now)).toBe('expired');
        expect(payView(unexpiredToken, { status: 'completed', pricingMode: 'comped' }, now)).toBe('expired');
    });
    it('limits sign-in returns to complete payment URLs and owner paths', () => {
        expect(ownerReturnPath(`/pay/${oldToken}`)).toBe(`/pay/${oldToken}`);
        expect(ownerReturnPath(`/v2/pay/${oldToken}`)).toBe(`/v2/pay/${oldToken}`);
        for (const path of [`/pay/${oldToken}?next=https://other.test`, '/pay/short', `//other.test/pay/${oldToken}`, '/my-business/sign-in'])
            expect(ownerReturnPath(path)).toBe('/my-business');
    });
});
