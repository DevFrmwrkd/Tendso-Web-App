import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PortalView } from '@/components/v2/creators/PortalView';
import { SAMPLE_PORTAL } from '@/lib/v2/creatorSample';
import type { PortalRecruit, PortalShop, PortalSummary } from '@/lib/v2/creatorTypes';
import { saleStatusLabel } from '@/packages/shared/affiliateSales';

const base: PortalShop = {
    submissionId: 'owned-shop', businessName: 'Sam’s Barbershop', date: Date.UTC(2026, 9, 20), paidAt: null,
    listPrice: 4999, paid: 3499, kept: 1750, status: 'waiting', meta: 'Barber · Manila',
};

function portal(shops: PortalShop[]): PortalSummary {
    return { ...SAMPLE_PORTAL, shops, recruits: [], now: { thisMonth: 0, shopsThisMonth: 0, shops: [] },
        monthly: { thisMonth: 0, activeAgents: 0, agentsInWindow: 0, nextEndDate: null },
        payouts: { ...SAMPLE_PORTAL.payouts, readyToSend: 0, history: [] } };
}

function render(shops: PortalShop[] = [base], sample = false) {
    return renderToStaticMarkup(createElement(PortalView, { data: portal(shops), sample, idPrefix: sample ? 'sample' : 'pt' }));
}

function salesLayouts(html: string) {
    const section = html.match(/<section[^>]*aria-label="Shops that used your code"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    if (!section) throw new Error('Sales section missing');
    const desktop = section.match(/<table class="pt-table pt-sales-table">([\s\S]*?)<\/table>/)?.[1];
    const cardsAt = section.indexOf('<div class="pt-cards">');
    if (!desktop || cardsAt < 0) throw new Error('Desktop or compact sales layout missing');
    return [desktop, section.slice(cardsAt)];
}

describe('shared creator sale workflow labels', () => {
    it.each([
        ['draft', 'Order received'], ['pending', 'In review'], ['approved', 'Approved'], ['processing', 'Building website'],
        ['website_generated', 'Website ready'], ['deployed', 'Awaiting payment'], ['pending_payment', 'Awaiting payment'],
        ['deposit_paid', 'Down payment received'], ['paid', 'Paid'], ['completed', 'Completed'],
        ['rejected', 'Not approved'], ['failed', 'Needs attention'], ['unpublished', 'Unpublished'],
    ])('labels %s as %s', (status, label) => {
        expect(saleStatusLabel(status)).toBe(label);
    });

    it('keeps an unfamiliar workflow readable without claiming payment or credit', () => {
        expect(saleStatusLabel('awaiting_customer_feedback')).toBe('awaiting customer feedback');
        expect(saleStatusLabel('constructor')).toBe('constructor');
    });
});

describe('creator portal sales', () => {
    it('shows workflow, partial payment and actual commission credit in both layouts despite sample metadata', () => {
        const html = render([{ ...base, workflowStatus: 'processing', paymentStatus: 'partially_paid', commissionCredited: false }]);
        for (const layout of salesLayouts(html)) {
            expect(layout).toContain('Barber · Manila');
            expect(layout).toContain('Building website');
            expect(layout).toContain('Down payment received · Balance due');
            expect(layout).toContain('Your commission');
            expect(layout).toContain('Not credited yet');
            expect(layout).toContain('Website price');
            expect(layout).toContain('₱3,499');
            expect(layout).toContain('₱1,750');
            expect(layout).not.toContain('Amount received');
        }
    });

    it.each([
        ['draft', 'Order received'], ['pending', 'In review'], ['approved', 'Approved'],
        ['website_generated', 'Website ready'], ['deployed', 'Awaiting payment'], ['rejected', 'Not approved'], ['failed', 'Needs attention'],
    ])('shows actual %s progress on desktop and compact cards', (workflowStatus, label) => {
        for (const layout of salesLayouts(render([{ ...base, workflowStatus, paymentStatus: 'unpaid' }]))) {
            expect(layout).toContain(label);
            expect(layout).toContain('No payment received');
            expect(layout).toContain('Barber · Manila');
        }
    });

    it.each(['paid', 'completed'])('does not call a legacy %s workflow fully paid when only a deposit was received', workflowStatus => {
        for (const layout of salesLayouts(render([{ ...base, workflowStatus, status: 'paid', paymentStatus: 'partially_paid', commissionCredited: false }]))) {
            expect(layout).toContain('Down payment received');
            expect(layout).toContain('Balance due');
            expect(layout).not.toMatch(/>Paid<|>Completed</);
            expect(layout).not.toContain('pt-st--ok');
            expect(layout).toContain('Not credited yet');
        }
    });

    it('renders commission credit only when the ledger-derived field is known, independently of workflow', () => {
        for (const layout of salesLayouts(render([{ ...base, workflowStatus: 'paid', paymentStatus: 'paid_in_full' }]))) {
            expect(layout).toContain('Paid in full');
            expect(layout).not.toContain('Credited');
            expect(layout).not.toContain('Not credited yet');
        }
        for (const layout of salesLayouts(render([{ ...base, workflowStatus: 'approved', paymentStatus: 'partially_paid', commissionCredited: true }]))) {
            expect(layout).toContain('>Credited<');
            expect(layout).toContain('Approved');
            expect(layout).not.toContain('Not credited yet');
        }
        for (const layout of salesLayouts(render([{ ...base, workflowStatus: 'completed', paymentStatus: 'paid_in_full', commissionCredited: false }]))) {
            expect(layout).toContain('Completed');
            expect(layout).toContain('Not credited yet');
        }
    });

    it('retains coarse status compatibility for older API and sample rows with metadata', () => {
        for (const [status, label] of [['paid', 'Paid'], ['paying', 'Paying'], ['waiting', 'Waiting'], ['not_paid', 'Not paid']] as const) {
            for (const layout of salesLayouts(render([{ ...base, status }]))) {
                expect(layout).toContain(`>${label}<`);
                expect(layout).toContain('Barber · Manila');
                expect(layout).not.toContain('Not credited yet');
            }
        }
    });
});

describe('existing creator page editor entry', () => {
    it('makes the authenticated page editor visible in the links and code area', () => {
        const html = render();
        const links = html.match(/<section[^>]*aria-label="Your links and code"[^>]*>([\s\S]*?)<\/section>/)?.[1];
        expect(links).toMatch(/href="\/affiliates\/dashboard\/my-page">Edit your page<\/a>/);
        expect(links).toContain('Photo, display name, message and social links.');
    });

    it('keeps sample editor actions local without opening a real account editor', () => {
        const html = render([base], true);
        expect(html).toContain('href="#sample-links">Edit your page</a>');
        expect(html).not.toContain('href="/affiliates/dashboard/my-page"');
    });
});

describe('standalone portal phone details', () => {
    it('keeps zero-sale and ended agents discoverable with their actual commission period', () => {
        const baseRecruit: PortalRecruit = {
            creatorId: 'agent-with-sales', name: 'Agent with sales', area: 'Manila', joinedAt: Date.UTC(2026, 9, 22),
            salesThisMonth: 1, overrideThisMonth: 150, overrideTotal: 150, endsAt: Date.UTC(2027, 9, 22), monthsLeft: 12, earning: true,
        };
        const data = { ...portal([]), recruits: [baseRecruit,
            { ...baseRecruit, creatorId: 'quiet-agent', name: 'Agent without sales', salesThisMonth: 0, overrideThisMonth: 0, monthsLeft: 4 },
            { ...baseRecruit, creatorId: 'ended-agent', name: 'Agent whose period ended', salesThisMonth: 0, overrideThisMonth: 0,
                endsAt: Date.UTC(2026, 9, 22), monthsLeft: 0, earning: false },
        ] };
        const html = renderToStaticMarkup(createElement(PortalView, { data, compactIncome: true }));
        const section = html.match(/<section[^>]*aria-label="Your field agents"[^>]*>([\s\S]*?)<\/section>/)?.[1];
        const cards = section?.slice(section.indexOf('<div class="pt-cards">'));
        expect(cards).toContain('Agent with sales');
        expect(cards).toContain('Agent without sales');
        expect(cards).toContain('Agent whose period ended');
        expect(cards).toContain('12 months left');
        expect(cards).toContain('4 months left');
        expect(cards).toContain('Ends 22 Oct 2027');
        expect(cards).toContain('Ended 22 Oct 2026');
        expect(cards).toContain('Period ended');
        expect(cards).not.toContain('more agents with no sale');
    });

    it('retains desktop income rows and exposes the same recent shop earnings in a phone disclosure', () => {
        const data = { ...portal([base]), now: { thisMonth: 1750, shopsThisMonth: 1, shops: [base] } };
        const html = renderToStaticMarkup(createElement(PortalView, { data, compactIncome: true }));
        const income = html.match(/<section[^>]*aria-label="This month&#x27;s income"[^>]*>([\s\S]*?)<\/section>/)?.[1];
        const desktopRows = income?.match(/<div class="pt-income-inline">([\s\S]*?)<\/article>/)?.[1];
        const disclosure = income?.match(/<details class="pt-income-details">([\s\S]*?)<\/details>/)?.[1];
        expect(desktopRows).toContain('Sam’s Barbershop');
        expect(desktopRows).toContain('₱1,750');
        expect(disclosure).toContain('<summary>');
        expect(disclosure).toContain('Recent shop earnings');
        expect(disclosure).toContain('Sam’s Barbershop');
        expect(disclosure).toContain('₱1,750');
        expect(html).toContain('Recent agent sales');

        const sample = renderToStaticMarkup(createElement(PortalView, { data, sample: true }));
        expect(sample).not.toContain('pt-income-details');
        expect(sample).toContain('Sam’s Barbershop');
    });
});
