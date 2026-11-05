import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import type { Doc } from '../../convex/_generated/dataModel';
import type { PaymentSubmissionSummary } from '../../convex/paymentTokens';

const state = vi.hoisted(() => ({ checkout: vi.fn(), responses: new Map<string, unknown>(), queries: [] as { name: string; args: unknown }[] }));
vi.mock('convex/react', () => ({ useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }), useConvex: () => ({ query: vi.fn() }), useMutation: () => vi.fn(), useAction: () => vi.fn(), useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(reference);
    state.queries.push({ name, args });
    return state.responses.get(name);
} }));
vi.mock('@clerk/nextjs', () => ({ SignInButton: ({ children }: { children: ReactNode }) => createElement('div', {}, children) }));
vi.mock('next/navigation', () => ({ useParams: () => ({ token: 'test-payment-token' }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => createElement('a', { href }, children) }));
vi.mock('../../hooks/useOwnerAuth', () => ({ useOwnerAuth: () => ({ isOwner: false }) }));
vi.mock('../../components/landing/LiveSitePreview', () => ({ default: () => null }));
vi.mock('../../components/v2', () => ({ Button: ({ children, href }: { children: ReactNode; href?: string }) => createElement(href ? 'a' : 'button', { href }, children) }));
vi.mock('../../components/v2/pages-b/shared', () => ({ CheckIcon: () => null, PlusIcon: () => null, PbBrand: () => null, copyWithToast: vi.fn(), usePbToast: () => ({ node: null, show: vi.fn() }) }));
vi.mock('../../components/v2/pages-b/xendit', () => ({ useXenditCheckout: () => state.checkout, xenditErrorMessage: () => 'Checkout unavailable' }));
vi.mock('../../app/pay/[token]/_components/useNow', () => ({ useNow: () => 1_800_000_000_000 }));

import { PayPage, PayView } from '../../components/v2/pages-b/PayPage';
const now = 1_800_000_000_000;
const submissionId = 'submission1' as Doc<'submissions'>['_id'];
const token = (patch: Partial<Doc<'paymentTokens'>> = {}): Doc<'paymentTokens'> => ({ _id: 'token1' as Doc<'paymentTokens'>['_id'], _creationTime: now, submissionId,
    token: 'test-payment-token', referenceCode: 'ND-TEST-TEST', kind: 'full', amount: 4999, status: 'pending', createdAt: now, expiresAt: now + 86400000, ...patch });
const submission = (patch: Partial<PaymentSubmissionSummary> = {}): PaymentSubmissionSummary => ({ _id: submissionId, businessName: 'Test shop', status: 'pending_payment', amount: 4999,
    amountPaid: 0, contentSource: 'owner_app', websiteListPrice: 4999, ...patch });
const render = (t = token(), s = submission(), xenditEnabled = true, wiseEmail = '') => renderToStaticMarkup(createElement(PayView, { loading: false, token: t, submission: s, now, wiseEmail, ownerHome: false, publishedUrl: null, xenditEnabled }));
beforeEach(() => { vi.clearAllMocks(); state.responses.clear(); state.queries.length = 0; });

function hasEnabledMethod(html: string, method: string) {
    return new RegExp('<button[^>]*(?<!disabled="")>' + method + '</button>').test(html) && !new RegExp('<button[^>]*disabled[^>]*>' + method + '</button>').test(html);
}
describe('card and e-wallet checkout without a Wise recipient', () => {
    it('defaults to unavailable until the runtime capability is explicitly enabled', () => {
        const html = renderToStaticMarkup(createElement(PayView, { loading: false, token: token(), submission: submission(), now, wiseEmail: 'recipient@example.test', ownerHome: false, publishedUrl: null }));
        expect(html).toContain('Coming soon');
        for (const method of ['GCash', 'Maya', 'Card']) expect(hasEnabledMethod(html, method)).toBe(false);
        expect(state.checkout).not.toHaveBeenCalled();
    });
    it('disables, enables and disables methods from runtime props without reloading the module', () => {
        for (const enabled of [false, true, false, true]) {
            const html = render(token(), submission(), enabled, 'recipient@example.test');
            for (const method of ['GCash', 'Maya', 'Card']) expect(hasEnabledMethod(html, method)).toBe(enabled);
            expect(html.includes('Coming soon')).toBe(!enabled);
        }
        expect(state.checkout).not.toHaveBeenCalled();
    });
    it('wires the public PayPage to the live capability query and its refreshed result', () => {
        state.responses.set('paymentTokens:getByToken', token());
        state.responses.set('paymentTokens:getSubmissionByToken', submission());
        state.responses.set('paymentTokens:getPublicationByToken', { liveUrl: null });
        // Loading capability must not expose a working checkout button.
        const waiting = renderToStaticMarkup(createElement(PayPage));
        for (const method of ['GCash', 'Maya', 'Card']) expect(hasEnabledMethod(waiting, method)).toBe(false);
        expect(state.queries).toContainEqual({ name: 'ownerPayments:getCheckoutAvailability', args: {} });
        expect(state.queries).toContainEqual({ name: 'paymentTokens:getByToken', args: { token: 'test-payment-token' } });
        for (const enabled of [false, true, false, true]) {
            state.responses.set('ownerPayments:getCheckoutAvailability', { xenditEnabled: enabled });
            const html = renderToStaticMarkup(createElement(PayPage));
            for (const method of ['GCash', 'Maya', 'Card']) expect(hasEnabledMethod(html, method)).toBe(enabled);
        }
        expect(state.checkout).not.toHaveBeenCalled();
    });
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
