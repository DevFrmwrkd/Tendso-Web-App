import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Doc } from '../../convex/_generated/dataModel';
import type { PaymentSubmissionSummary } from '../../convex/paymentTokens';

const state = vi.hoisted(() => ({ checkout: vi.fn(), actions: new Map<string, () => void>() }));
vi.mock('convex/react', () => ({ useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }), useConvex: () => ({ query: vi.fn() }), useMutation: () => vi.fn(), useAction: () => vi.fn(), useQuery: () => undefined }));
vi.mock('@clerk/nextjs', () => ({ SignInButton: ({ children }: { children: ReactNode }) => createElement('div', {}, children) }));
vi.mock('next/navigation', () => ({ useParams: () => ({}), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => createElement('a', { href }, children) }));
vi.mock('../../hooks/useOwnerAuth', () => ({ useOwnerAuth: () => ({ isOwner: false }) }));
vi.mock('../../components/landing/LiveSitePreview', () => ({ default: () => null }));
vi.mock('../../components/v2', () => ({ Button: ({ children, href }: { children: ReactNode; href?: string }) => createElement(href ? 'a' : 'button', { href }, children) }));
vi.mock('../../components/v2/pages-b/shared', () => ({ CheckIcon: () => null, PlusIcon: () => null, PbBrand: () => null, copyWithToast: vi.fn(), usePbToast: () => ({ node: null, show: vi.fn() }) }));
vi.mock('../../components/v2/pages-b/xendit', () => ({ XENDIT_ENABLED: true, useXenditCheckout: () => state.checkout, xenditErrorMessage: () => 'Checkout unavailable' }));

import { PayView } from '../../components/v2/pages-b/PayPage';
const now = 1_800_000_000_000;
const submissionId = 'submission1' as Doc<'submissions'>['_id'];
const token = (patch: Partial<Doc<'paymentTokens'>> = {}): Doc<'paymentTokens'> => ({ _id: 'token1' as Doc<'paymentTokens'>['_id'], _creationTime: now, submissionId,
    token: 'test-payment-token', referenceCode: 'ND-TEST-TEST', kind: 'full', amount: 4999, status: 'pending', createdAt: now, expiresAt: now + 86400000, ...patch });
const submission = (patch: Partial<PaymentSubmissionSummary> = {}): PaymentSubmissionSummary => ({ _id: submissionId, businessName: 'Test shop', status: 'pending_payment', amount: 4999,
    amountPaid: 0, contentSource: 'owner_app', websiteListPrice: 4999, ...patch });
const render = (t = token(), s = submission()) => renderToStaticMarkup(createElement(PayView, { loading: false, token: t, submission: s, now, wiseEmail: '', ownerHome: false, publishedUrl: null }));
beforeEach(() => { vi.clearAllMocks(); state.actions.clear(); });

function hasEnabledMethod(html: string, method: string) {
    return new RegExp('<button[^>]*(?<!disabled="")>' + method + '</button>').test(html) && !new RegExp('<button[^>]*disabled[^>]*>' + method + '</button>').test(html);
}
describe('card and e-wallet checkout without a Wise recipient', () => {
    it('shows the real payment amount and enabled methods without inventing transfer details', () => {
        const html = render();
        expect(html).toContain('₱4,999'); expect(html).toContain('Order total');
        for (const method of ['GCash', 'Maya', 'Card']) expect(hasEnabledMethod(html, method)).toBe(true);
        expect(html).not.toContain('https://wise.com/send'); expect(html).not.toContain('Wise email');
        expect(html).not.toContain('Copy all details'); expect(html).not.toContain('Copy code');
        expect(html).not.toContain('support@negosyo.digital'); expect(state.checkout).not.toHaveBeenCalled();
    });
    it('keeps the current balance and installment amount distinct', () => {
        const html = render(token({ kind: 'deposit', amount: 500 }));
        expect(html).toContain('Down payment'); expect(html).toContain('₱500'); expect(html).toContain('₱4,999'); expect(html).toContain('₱4,499 remaining');
    });
    it.each(['creating', 'uncertain'] as const)('does not offer another provider checkout while an earlier one is %s', xenditCheckoutState => {
        const html = render(token({ xenditCheckoutState }));
        expect(html).toContain('We’re checking an earlier checkout.'); expect(html).not.toContain('>GCash</button>'); expect(state.checkout).not.toHaveBeenCalled();
    });
    it('continues an existing current checkout instead of offering a second one', () => {
        const html = render(token({ xenditInvoiceId: 'invoice1', xenditInvoiceUrl: 'https://checkout.xendit.co/current', xenditExpiresAt: now + 10000 }));
        expect(html).toContain('Continue checkout'); expect(html).toContain('href="https://checkout.xendit.co/current"'); expect(html).not.toContain('>GCash</button>');
    });
    it('withholds a stale full-order request after a confirmed deposit', () => {
        const html = render(token(), submission({ status: 'deposit_paid', amountPaid: 500, depositPaidAt: now }));
        expect(html).toContain('Let’s check your latest balance.'); expect(html).not.toContain('>GCash</button>');
    });
    it('does not offer payment methods for an order covered by a grant', () => {
        const html = render(token(), submission({ pricingMode: 'comped', status: 'completed' }));
        expect(html).toContain('No payment is needed.'); expect(html).not.toContain('>GCash</button>'); expect(state.checkout).not.toHaveBeenCalled();
    });
});
