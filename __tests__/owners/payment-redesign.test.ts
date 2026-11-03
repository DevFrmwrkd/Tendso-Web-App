import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getFunctionName } from 'convex/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Doc } from '../../convex/_generated/dataModel';
import type { PaymentSubmissionSummary } from '../../convex/paymentTokens';

const state = vi.hoisted(() => ({
    mutation: vi.fn(), action: vi.fn(), push: vi.fn(), refresh: vi.fn(),
    mutations: [] as string[], queries: [] as Array<{ name: string; args: unknown }>,
    routeToken: undefined as unknown, routeSubmission: undefined as unknown, routePublication: undefined as unknown,
}));
vi.mock('convex/react', () => ({
    useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }),
    useMutation: (reference: Parameters<typeof getFunctionName>[0]) => { state.mutations.push(getFunctionName(reference)); return state.mutation; },
    useAction: () => state.action,
    useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
        const name = getFunctionName(reference); state.queries.push({ name, args });
        if (args === 'skip') return undefined;
        if (name === 'paymentTokens:getByToken') return state.routeToken;
        if (name === 'paymentTokens:getSubmissionByToken') return state.routeSubmission;
        if (name === 'paymentTokens:getPublicationByToken') return state.routePublication;
        throw new Error(`Unexpected payment query ${name}`);
    },
}));
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ userId: null, sessionId: null }) }));
vi.mock('next/navigation', () => ({ useParams: () => ({ token: 'a'.repeat(64) }), useRouter: () => ({ push: state.push, refresh: state.refresh }) }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: { children: ReactNode }) => createElement('a', props, children) }));
vi.mock('../../hooks/useOwnerAuth', () => ({ useOwnerAuth: () => ({ isOwner: false }) }));
vi.mock('../../lib/payment/config', () => ({ getPaymentConfig: () => ({ wiseEmail: 'wise-route@example.test' }) }));
vi.mock('../../app/pay/[token]/_components/useNow', () => ({ useNow: () => 1_800_000_000_000 }));
vi.mock('../../components/shells/PaymentShell', () => ({
    PaymentShell: ({ children }: { children: ReactNode }) => createElement('main', {}, children),
    PaymentPageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => createElement('header', {}, createElement('h1', {}, title), createElement('p', {}, subtitle)),
}));
vi.mock('../../components/v2', () => ({ Button: ({ children, href, variant: _variant, ...props }: {
    children: ReactNode; href?: string; variant?: string;
}) => createElement(href ? 'a' : 'button', { href, ...props }, children) }));

import { ExpiredView, NotFoundView, PaidView, PayLoading, PendingView } from '../../app/pay/[token]/_components/PayViews';
import PaymentPage from '../../app/pay/[token]/page';

const now = 1_800_000_000_000;
const id = 'submission-one' as Doc<'submissions'>['_id'];
const rawToken = 'a'.repeat(64);
const token = (overrides: Partial<Doc<'paymentTokens'>> = {}): Doc<'paymentTokens'> => ({
    _id: 'payment-one' as Doc<'paymentTokens'>['_id'], _creationTime: now, submissionId: id,
    token: rawToken, referenceCode: 'ND-RECEIPT-ONE', kind: 'full', amount: 4999, status: 'pending',
    createdAt: now - 86400000, expiresAt: now + 29 * 86400000, ...overrides,
});
const submission = (overrides: Partial<PaymentSubmissionSummary> = {}): PaymentSubmissionSummary => ({
    _id: id, businessName: 'Corner shop', status: 'website_generated', contentSource: 'owner_app',
    amount: 4999, amountPaid: 0, websiteListPrice: 4999, ...overrides,
});
const plain = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').replaceAll('&amp;', '&').trim();
function links(html: string) {
    return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(match => ({
        href: match[1].match(/href="([^"]*)"/)?.[1], text: plain(match[2]), attributes: match[1],
    }));
}
function rows(html: string) {
    return Object.fromEntries([...html.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/g)]
        .map(match => [plain(match[1]), plain(match[2])]));
}
function receiptContent(html: string) {
    const section = html.match(/<section\b[^>]*aria-label="Payment receipt"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    expect(section).toBeDefined(); return plain(section ?? '');
}
const pending = (t = token(), s: PaymentSubmissionSummary | null = submission(), wiseEmail = 'wise@example.test', publishedUrl: string | null = null) =>
    renderToStaticMarkup(createElement(PendingView, { token: t, submission: s, now, wiseEmail, publishedUrl }));
const paid = (t = token({ status: 'paid' }), s: PaymentSubmissionSummary | null = submission({ status: 'completed', amountPaid: 4999, paidInFullAt: now }), publishedUrl: string | null = null) =>
    renderToStaticMarkup(createElement(PaidView, { token: t, submission: s, now, ownerHome: false, publishedUrl }));

beforeEach(() => {
    vi.clearAllMocks(); state.mutations = []; state.queries = [];
    state.routeToken = token(); state.routeSubmission = submission(); state.routePublication = { liveUrl: null };
});
afterEach(() => {
    expect(state.mutation).not.toHaveBeenCalled(); expect(state.action).not.toHaveBeenCalled();
});

describe('redesigned payment presentation', () => {
    it.each([
        ['full', 4999, 0, 'Website payment requested'],
        ['deposit', 500, 0, 'Down payment requested'],
        ['balance', 4499, 500, 'Balance payment requested'],
    ] as const)('uses the %s token amount for the transfer while preserving its order total', (kind, amount, amountPaid, label) => {
        const html = pending(token({ kind, amount }), submission({ amountPaid, ...(amountPaid ? { depositPaidAt: now - 1000 } : {}) }));
        expect(plain(html)).toContain(`${label} ₱${amount.toLocaleString('en-PH')}`);
        expect(rows(html)['Order total']).toBe('₱4,999');
        expect(html).toContain(`${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} PHP`);
        expect(links(html).find(link => link.text === 'Open Wise')?.href).toBe('https://wise.com/send?recipient=wise%40example.test');
        expect(html).not.toContain('Website went live'); expect(html).not.toContain('Pay once to keep it live');
        if (kind === 'deposit') expect(rows(html)['After this payment']).toBe('₱4,499 remaining');
        if (kind === 'balance') expect(rows(html)['Paid so far']).toBe('₱500');
    });

    it('keeps the website discount and domain price on the full order rather than the down payment', () => {
        const html = pending(token({ kind: 'deposit', amount: 500 }), submission({
            amount: 4499, requestedDomain: 'corner.example', domainCostPHP: 700, domainChargedPHP: 1000,
        }));
        expect(rows(html)['Order total']).toBe('₱4,499');
        expect(rows(html)['Website discount']).toBe('30% off ₱4,999');
        expect(rows(html)['After this payment']).toBe('₱3,999 remaining');
        expect(html).not.toContain('90% off'); expect(html).not.toContain('₱-');
        const full = pending(token({ kind: 'full', amount: 4499 }), submission({
            amount: 4499, requestedDomain: 'corner.example', domainCostPHP: 700, domainChargedPHP: 1000,
        }));
        expect(rows(full)['Website']).toBe('₱3,499'); expect(rows(full)['Domain · corner.example']).toBe('₱1,000');
    });

    it.each(['', '   '])('withholds transfer instructions when the Wise recipient is blank (%j)', wiseEmail => {
        const html = pending(token(), submission(), wiseEmail);
        expect(plain(html)).toContain('Payment details aren’t ready.');
        expect(html).not.toContain('Copy all payment details'); expect(html).not.toContain('Copy wise email');
        expect(links(html).some(link => link.href?.startsWith('https://wise.com/send'))).toBe(false);
        expect(links(html).find(link => link.text === 'View business payment')?.href).toBe(`/my-business/${id}`);
    });

    it('withholds an obsolete full-order transfer request after a confirmed deposit', () => {
        const html = pending(token(), submission({ status: 'deposit_paid', amountPaid: 500, depositPaidAt: now - 1000 }));
        expect(plain(html)).toContain('Let’s check your latest balance.');
        expect(plain(html)).toContain('Previous payment request ₱4,999');
        expect(plain(html)).not.toContain('Website payment requested');
        expect(html).not.toContain('Copy all payment details');
        expect(links(html).some(link => link.text === 'Open Wise')).toBe(false);
        expect(rows(html)['Paid so far']).toBe('₱500');
        expect(rows(html)['Current balance']).toBe('₱4,499');
    });

    it.each(['creating', 'uncertain'] as const)('withholds transfer and copy instructions while a hosted checkout is %s', xenditCheckoutState => {
        const html = pending(token({ xenditCheckoutState }));
        expect(plain(html)).toContain('We’re checking an earlier checkout.');
        expect(plain(html)).toContain('An earlier checkout may still be open.');
        expect(html).not.toContain('Copy all payment details'); expect(html).not.toContain('Copy reference code');
        expect(html).not.toContain('Send the exact amount in PHP.');
        expect(links(html).some(link => link.text === 'Open Wise' || link.text === 'Continue checkout')).toBe(false);
    });

    it('continues a current safe hosted checkout instead of offering a second Wise payment', () => {
        const url = 'https://checkout.xendit.co/current-invoice';
        const html = pending(token({ xenditInvoiceId: 'invoice-one', xenditInvoiceUrl: url, xenditExpiresAt: now + 3600000 }));
        expect(plain(html)).toContain('Continue your existing checkout.');
        expect(links(html).find(link => link.text === 'Continue checkout')?.href).toBe(url);
        expect(links(html).some(link => link.text === 'Open Wise')).toBe(false);
        expect(html).not.toContain('Copy all payment details'); expect(html).not.toContain('Copy reference code');
    });

    it('withholds an unsafe hosted checkout URL without falling back to a second Wise transfer', () => {
        for (const url of ['javascript:alert(1)', 'http://checkout.example/', 'https://owner:secret@checkout.example/', '//checkout.example/']) {
            const html = pending(token({ xenditInvoiceId: 'invoice-one', xenditInvoiceUrl: url, xenditExpiresAt: now + 3600000 }));
            expect(links(html).some(link => link.text === 'Continue checkout' || link.text === 'Open Wise')).toBe(false);
            expect(links(html).find(link => link.text === 'View business payment')?.href).toBe(`/my-business/${id}`);
            expect(html).not.toContain('Copy all payment details'); expect(html).not.toContain('owner:secret');
        }
    });

    it('shows a confirmed down-payment receipt separately from the total and remaining balance', () => {
        const html = paid(token({ kind: 'deposit', amount: 500, status: 'paid', provider: 'wise', paymentReceivedAt: now }),
            submission({ status: 'deposit_paid', amountPaid: 500, depositPaidAt: now }));
        expect(plain(html)).toContain('Down payment received.');
        expect(receiptContent(html)).toContain('₱500'); expect(receiptContent(html)).not.toContain('₱4,999');
        expect(rows(html)).toMatchObject({ 'Order total': '₱4,999', 'Paid so far': '₱500', 'Balance due': '₱4,499', 'Payment method': 'Wise transfer' });
        expect(links(html).find(link => link.text === 'View balance payment')?.href).toBe(`/my-business/${id}`);
        expect(html).not.toContain('Your website is live'); expect(html).not.toContain('Paid in full');
    });

    it('keeps the original down-payment amount visible after the order is later paid in full', () => {
        const html = paid(token({ kind: 'deposit', amount: 500, status: 'paid' }));
        expect(plain(html)).toContain('Down payment received.'); expect(receiptContent(html)).toContain('₱500');
        expect(rows(html)['Paid so far']).toBe('₱4,999'); expect(rows(html)['Balance due']).toBe('₱0');
        expect(links(html).some(link => link.text === 'View balance payment')).toBe(false);
    });

    it('distinguishes a final balance receipt from the order’s whole price', () => {
        const html = paid(token({ kind: 'balance', amount: 4499, status: 'paid' }));
        expect(plain(html)).toContain('Balance payment received.');
        expect(receiptContent(html)).toContain('₱4,499'); expect(receiptContent(html)).not.toContain('₱4,999');
        expect(rows(html)['Order total']).toBe('₱4,999'); expect(rows(html)['Balance due']).toBe('₱0');
        expect(html).not.toContain('% off');
    });

    it('uses the recorded received amount, not just the requested amount', () => {
        const html = paid(token({ kind: 'deposit', amount: 500, paidAmount: 900, status: 'paid' }),
            submission({ status: 'deposit_paid', amountPaid: 900, depositPaidAt: now }));
        expect(receiptContent(html)).toContain('₱900'); expect(receiptContent(html)).not.toContain('₱500');
        expect(rows(html)['Paid so far']).toBe('₱900'); expect(rows(html)['Balance due']).toBe('₱4,099');
    });

    it('does not invent a separate receipt for an old unconfirmed link on a settled order', () => {
        const html = paid(token({ status: 'pending', amount: 3499 }));
        expect(plain(html)).toContain('Your payment is recorded.');
        expect(receiptContent(html)).toContain('This older link does not identify a separate confirmed transfer.');
        expect(receiptContent(html)).not.toContain('₱3,499'); expect(rows(html)['Balance due']).toBe('₱0');
    });

    it('describes an unconfirmed covered order without inventing a cash receipt or paid-in-full claim', () => {
        const html = paid(token({ status: 'pending' }), submission({ pricingMode: 'comped', status: 'completed', amountPaid: 0 }));
        expect(plain(html)).toContain('No balance due.'); expect(plain(html)).toContain('This order is covered. No payment is needed.');
        expect(plain(html)).not.toMatch(/paid in full/i);
        expect(receiptContent(html)).toContain('This link does not identify a confirmed cash payment.');
        expect(receiptContent(html)).not.toContain('₱4,999'); expect(rows(html)['Payment method']).toBeUndefined();
        expect(rows(html)['Confirmed on']).toBeUndefined();
        expect(rows(html)['Paid so far']).toBe('₱0'); expect(rows(html)['Balance due']).toBe('₱0');
    });

    it('preserves a genuine historical receipt even when the order is now covered', () => {
        const html = paid(token({ kind: 'deposit', amount: 500, paidAmount: 500, status: 'paid', provider: 'wise', paymentReceivedAt: now }),
            submission({ pricingMode: 'comped', status: 'completed', amountPaid: 0 }));
        expect(plain(html)).toContain('Down payment received.'); expect(receiptContent(html)).toContain('₱500');
        expect(receiptContent(html)).toContain('This is the confirmed payment for this reference.');
        expect(rows(html)['Payment method']).toBe('Wise transfer'); expect(rows(html)['Confirmed on']).toBeDefined();
        expect(plain(html)).toContain('This order is covered. No payment is needed.');
        expect(plain(html)).not.toMatch(/paid in full/i);
    });

    it('lets authoritative publication data override old URLs and takedown timestamps', () => {
        const old = submission({ status: 'completed', amountPaid: 4999, paidInFullAt: now,
            websiteUrl: 'https://stale.example/', unpublishedAt: now - 1000 });
        const unavailable = paid(token({ status: 'paid' }), old, null);
        expect(unavailable).not.toContain('stale.example'); expect(links(unavailable).some(link => link.text === 'Open website')).toBe(false);
        expect(plain(unavailable)).toContain('No public website link yet. Keep this page for payment updates.');
        const published = paid(token({ status: 'paid' }), old, 'https://current.example/');
        expect(links(published).find(link => link.text === 'Open website')).toMatchObject({ href: 'https://current.example/' });
        expect(published).not.toContain('stale.example');
    });

    it('does not render unsafe or credential-bearing URLs as website links', () => {
        for (const url of ['javascript:alert(1)', '//other.example/', 'http://other.example/', 'https://owner:secret@other.example/', 'invalid']) {
            const html = paid(token({ status: 'paid' }), undefined, url);
            expect(links(html).some(link => link.text === 'Open website')).toBe(false);
            expect(html).not.toContain('owner:secret');
        }
    });

    it('keeps expired recovery linked to owner sign-in and the same complete payment URL', () => {
        const html = renderToStaticMarkup(createElement(ExpiredView, { token: token({ status: 'expired' }), submission: submission(), now }));
        expect(links(html).find(link => link.text === 'Pay again')?.href)
            .toBe(`/my-business/sign-in?returnTo=${encodeURIComponent(`/pay/${rawToken}`)}`);
        expect(plain(html)).toContain('keeps any confirmed down payment');
        expect(html).not.toContain('No payment arrived'); expect(html).not.toContain('You still owe');
        expect(state.mutations).toEqual(['ownerPayments:retryExpiredPayment']);
    });

    it('offers safe exits for an unavailable link and an accessible loading state', () => {
        const unavailable = renderToStaticMarkup(createElement(NotFoundView));
        expect(links(unavailable).some(link => link.href === '/contact')).toBe(true);
        expect(plain(unavailable)).toContain('Please do not send money until you have a working link.');
        const loading = renderToStaticMarkup(createElement(PayLoading));
        expect(loading).toContain('role="status"'); expect(loading).toContain('aria-busy="true"');
        expect(loading).not.toContain('Copy all payment details');
    });
});

describe('token → submission → publication route loading', () => {
    it('does not read order/publication details until the public token is resolved', () => {
        state.routeToken = undefined;
        const html = renderToStaticMarkup(createElement(PaymentPage));
        expect(html).toContain('Loading your payment details');
        expect(state.queries).toEqual([
            { name: 'paymentTokens:getByToken', args: { token: rawToken } },
            { name: 'paymentTokens:getSubmissionByToken', args: 'skip' },
            { name: 'paymentTokens:getPublicationByToken', args: 'skip' },
        ]);
    });

    it.each(['submission', 'publication'] as const)('waits for %s before showing transfer instructions or a receipt', unresolved => {
        if (unresolved === 'submission') state.routeSubmission = undefined; else state.routePublication = undefined;
        const html = renderToStaticMarkup(createElement(PaymentPage));
        expect(html).toContain('Loading your payment details');
        expect(html).not.toContain('Copy all payment details'); expect(html).not.toContain('Payment received.');
        expect(state.queries.slice(1)).toEqual([
            { name: 'paymentTokens:getSubmissionByToken', args: { token: rawToken } },
            { name: 'paymentTokens:getPublicationByToken', args: { token: rawToken } },
        ]);
    });

    it('passes the separately loaded authoritative publication to the final receipt', () => {
        state.routeToken = token({ status: 'paid' });
        state.routeSubmission = submission({ status: 'completed', paidInFullAt: now, amountPaid: 4999, websiteUrl: 'https://stale.example/' });
        state.routePublication = { liveUrl: 'https://current.example/' };
        const html = renderToStaticMarkup(createElement(PaymentPage));
        expect(links(html).find(link => link.text === 'Open website')?.href).toBe('https://current.example/');
        expect(html).not.toContain('stale.example'); expect(plain(html)).toContain('Payment received.');
    });

    it('shows an unavailable link without querying or exposing a business when the token is invalid', () => {
        state.routeToken = null;
        const html = renderToStaticMarkup(createElement(PaymentPage));
        expect(plain(html)).toContain('We can’t find this payment link.'); expect(html).not.toContain('Corner shop');
        expect(state.queries.slice(1).every(query => query.args === 'skip')).toBe(true);
    });
});
