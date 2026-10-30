import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getFunctionName } from 'convex/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Doc } from '../../convex/_generated/dataModel';

const state = vi.hoisted(() => ({
    authenticated: false,
    createPayToken: vi.fn(),
    push: vi.fn(),
    mutations: [] as string[],
    actions: new Map<string, () => void>(),
}));
vi.mock('convex/react', () => ({
    useConvexAuth: () => ({ isAuthenticated: state.authenticated, isLoading: false }),
    useConvex: () => ({ query: vi.fn() }),
    useMutation: (reference: Parameters<typeof getFunctionName>[0]) => { state.mutations.push(getFunctionName(reference)); return state.createPayToken; },
    useAction: () => vi.fn(),
    useQuery: () => undefined,
}));
vi.mock('@clerk/nextjs', () => ({ SignInButton: ({ children, forceRedirectUrl }: { children: ReactNode; forceRedirectUrl: string }) => createElement('div', { 'data-sign-in-return': forceRedirectUrl }, children) }));
vi.mock('next/navigation', () => ({ useParams: () => ({}), useRouter: () => ({ push: state.push }) }));
vi.mock('next/link', () => ({ default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => createElement('a', { href, ...rest }, children) }));
vi.mock('../../hooks/useOwnerAuth', () => ({ useOwnerAuth: () => ({ isOwner: false }) }));
vi.mock('../../components/landing/LiveSitePreview', () => ({ default: () => createElement('div', {}, 'Site preview') }));
vi.mock('../../components/v2', () => ({
    Button: ({ children, href, onClick, disabled }: { children: ReactNode; href?: string; onClick?: () => void; disabled?: boolean }) => {
        if (typeof children === 'string' && onClick) state.actions.set(children, onClick);
        return createElement(href ? 'a' : 'button', { href, disabled }, children);
    },
}));
vi.mock('../../components/v2/pages-b/shared', () => ({
    CheckIcon: () => null, PlusIcon: () => null, PbBrand: () => null, copyWithToast: vi.fn(), usePbToast: () => ({ node: null, show: vi.fn() }),
}));
import { PayView } from '../../components/v2/pages-b/PayPage';

const now = 1_800_000_000_000;
const submission = (overrides: Partial<Doc<'submissions'>> = {}): Doc<'submissions'> => ({
    _id: 'submission1' as Doc<'submissions'>['_id'], _creationTime: now, creatorId: 'creator1' as Doc<'creators'>['_id'],
    businessName: 'Corner shop', businessType: 'shop', ownerName: 'Owner', ownerPhone: '09171234567', address: '1 Main St', city: 'Manila',
    contentSource: 'owner_app', status: 'deposit_paid', amount: 4999, amountPaid: 500, depositPaidAt: now, websiteListPrice: 4999, ...overrides,
});
const token = (overrides: Partial<Doc<'paymentTokens'>> = {}): Doc<'paymentTokens'> => ({
    _id: 'token1' as Doc<'paymentTokens'>['_id'], _creationTime: now, submissionId: 'submission1' as Doc<'submissions'>['_id'],
    token: 'receipt-token', referenceCode: 'ND-TEST-TEST', kind: 'deposit', amount: 500, status: 'paid', createdAt: now, expiresAt: now + 86400000, ...overrides,
});
const render = (t = token(), s: Doc<'submissions'> | null = submission()) => renderToStaticMarkup(createElement(PayView, { loading: false, token: t, submission: s, now, wiseEmail: 'wise@example.com', ownerHome: false }));

beforeEach(() => {
    state.authenticated = false; state.actions.clear(); state.mutations = [];
    vi.clearAllMocks(); state.createPayToken.mockResolvedValue({ token: 'balance-token' });
});

describe('payment receipts and installments', () => {
    it('shows a down payment, the real order total and remaining balance without inventing a discount or publication', () => {
        const html = render();
        expect(html).toContain('Down payment received.');
        expect(html).toContain('₱500'); expect(html).toContain('₱4,999'); expect(html).toContain('₱4,499');
        expect(html).toContain('Order total'); expect(html).toContain('Paid so far'); expect(html).toContain('Balance due');
        expect(html).not.toContain('90% off'); expect(html).not.toContain('Paid once.'); expect(html).not.toContain('Your site is live.');
        expect(html).toContain('Not public yet'); expect(html).not.toContain('Private until you pay');
        expect(html).toContain('Sign in to pay the balance'); expect(html).toContain('data-sign-in-return="/v2/pay/receipt-token"');
    });

    it('opens a server-authorized balance token without passing a browser amount', async () => {
        state.authenticated = true;
        render();
        state.actions.get('Pay ₱4,499 balance')!();
        await vi.waitFor(() => expect(state.push).toHaveBeenCalledWith('/v2/pay/balance-token'));
        expect(state.createPayToken).toHaveBeenCalledExactlyOnceWith({ submissionId: 'submission1', kind: 'balance' });
        expect(state.mutations).toContain('ownerPayments:createPayToken');
    });

    it('keeps an old deposit receipt accurate after the balance is paid', () => {
        const html = render(token(), submission({ status: 'completed', amountPaid: 4999, paidInFullAt: now + 1 }));
        expect(html).toContain('Down payment received.'); expect(html).toContain('Paid in full.');
        expect(html).toContain('<dt>Balance due</dt><dd>₱0</dd>'); expect(html).not.toContain('Sign in to pay the balance');
    });

    it('shows a balance receipt as the final installment, without treating it as a discount', () => {
        const html = render(token({ kind: 'balance', amount: 4499 }), submission({ status: 'completed', amountPaid: 4999, paidInFullAt: now + 1 }));
        expect(html).toContain('Balance payment received.'); expect(html).toContain('₱4,499');
        expect(html).toContain('<dt>Balance due</dt><dd>₱0</dd>'); expect(html).not.toContain('% off');
        expect(html).not.toContain('Your site is live.');
    });

    it('shows a real creator discount on the order rather than on a down payment', () => {
        const discounted = submission({ amount: 3499 });
        const html = render(token(), discounted);
        expect(html).toContain('30% off ₱4,999'); expect(html).toContain('₱2,999'); expect(html).not.toContain('90% off');
        const full = render(token({ kind: 'full', amount: 3499 }), submission({ amount: 3499, amountPaid: 3499, paidInFullAt: now + 1, status: 'completed' }));
        expect(full).toContain('Website, paid once'); expect(full).toContain('₱3,499'); expect(full).toContain('30% off ₱4,999');
    });

    it('keeps the whole received amount visible when a discounted website includes a custom domain', () => {
        const html = render(token({ kind: 'full', amount: 3999 }), submission({
            amount: 3999, amountPaid: 3999, paidInFullAt: now + 1, status: 'completed',
            requestedDomain: 'shop.com', domainCostPHP: 720, domainChargedPHP: 500,
        }));
        expect(html).toContain('<dt>Full payment received</dt><dd>₱3,999</dd>');
        expect(html).toContain('<dt>Website</dt><dd>₱3,499</dd>');
        expect(html).toContain('30% off ₱4,999'); expect(html).toContain('shop.com');
    });

    it('does not strike through pending installments; full payments retain their creator discount', () => {
        const pending = render(token({ status: 'pending' }), submission({ depositPaidAt: undefined, amountPaid: 0, status: 'pending_payment' }));
        expect(pending).not.toContain('pb-py-was'); expect(pending).not.toContain('90% off');
        const full = render(token({ kind: 'full', amount: 3499, status: 'pending' }), submission({ amount: 3499, depositPaidAt: undefined, amountPaid: 0, status: 'pending_payment' }));
        expect(full).toContain('pb-py-was'); expect(full).toContain('₱4,999'); expect(full).toContain('₱3,499');
    });

    it('shows a live URL only when the submission is still published, including legacy full-payment tokens', () => {
        const full = token({ kind: undefined, amount: 4999 });
        const paid = submission({ status: 'completed', amountPaid: undefined, depositPaidAt: undefined, websiteUrl: 'https://shop.tendso.com' });
        expect(render(full, paid)).toContain('Paid in full. Your website is live.');
        const offline = render(full, { ...paid, status: 'unpublished', unpublishedAt: now });
        expect(offline).not.toContain('Live at'); expect(offline).not.toContain('Your website is live.');
        expect(offline).toContain('Not public yet');
        expect(render(full, { ...paid, websiteUrl: undefined })).not.toContain('Your website is live.');
    });

    it('uses current publication data over a stale submission URL or takedown timestamp', () => {
        const t = token({ kind: 'full', amount: 4999 });
        const s = submission({ status: 'completed', paidInFullAt: now, websiteUrl: 'https://old.tendso.com', unpublishedAt: now - 1 });
        const renderPublished = (publishedUrl: string | null) => renderToStaticMarkup(createElement(PayView, { loading: false, token: t, submission: s, publishedUrl, now, wiseEmail: 'wise@example.com', ownerHome: false }));
        const live = renderPublished('https://new.tendso.com');
        expect(live).toContain('Your website is live.'); expect(live).toContain('https://new.tendso.com'); expect(live).not.toContain('https://old.tendso.com');
        const offline = renderPublished(null);
        expect(offline).not.toContain('Your website is live.'); expect(offline).not.toContain('Live at');
    });
});
