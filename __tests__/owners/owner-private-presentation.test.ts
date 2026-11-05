import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { act, createElement, type ReactNode } from 'react';
import { getFunctionName } from 'convex/server';
import type { Id } from '../../convex/_generated/dataModel';
import type { OwnerSite } from '../../app/my-business/_components/ownerSite';

const state = vi.hoisted(() => ({
    summary: {} as Record<string, unknown>, preview: {} as Record<string, unknown>, payment: {} as Record<string, unknown>,
    mutate: vi.fn(), checkout: vi.fn(),
}));
// Use the installed matching React / renderer pair, as the simulator tests do.
vi.mock('react', async () => {
    const { createRequire } = await import('node:module');
    return createRequire(import.meta.url)('../../apps/mobile/node_modules/react');
});
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ userId: 'owner-clerk' }) }));
vi.mock('convex/react', () => ({
    useQuery: (reference: Parameters<typeof getFunctionName>[0]) => {
        const name = getFunctionName(reference);
        if (name === 'ownerApp:getSubmission') return state.summary;
        if (name === 'ownerApp:getPreview') return state.preview;
        if (name === 'ownerPayments:getPaymentState') return state.payment;
        throw new Error(`Unexpected query ${name}`);
    },
    useMutation: () => state.mutate, useAction: () => state.checkout,
}));
vi.mock('../../components/r1', async () => {
    const { createElement: element } = await import('react');
    return {
        Button: ({ children, variant: _variant, ...props }: { children: ReactNode; variant?: string }) => element('button', props, children),
        Field: ({ label, children }: { label: string; children: ReactNode }) => element('label', {}, label, children),
        Input: (props: Record<string, unknown>) => element('input', props),
    };
});
vi.mock('../../app/my-business/_components/OwnerHome', async () => {
    const { createElement: element } = await import('react');
    return { SiteOverview: () => element('div', {}, 'Legacy overview'), SiteOverviewLoading: () => element('div', {}, 'Loading preview') };
});
vi.mock('../../app/my-business/_components/OwnerPaymentSimulator', async () => {
    const { createElement: element } = await import('react');
    return { OwnerPaymentSimulator: () => element('div', {}, 'Secondary simulator tools') };
});

import { OwnerWebsiteOverview } from '../../app/my-business/_components/OwnerPrivateWebsite';

type TestNode = { props: { children?: unknown; href?: string; target?: string; rel?: string; title?: string; sandbox?: string; srcDoc?: string; src?: string; disabled?: boolean; className?: string } };
type View = { root: { findAllByType(type: string): TestNode[] }; unmount(): void; toJSON(): unknown };
const renderer = createRequire(import.meta.url)('../../apps/mobile/node_modules/react-test-renderer') as { create(node: ReactNode): View };
const id = 'submission-private' as Id<'submissions'>;
const site = { submissionId: id } as OwnerSite;
let view: View | undefined;
function content(value: unknown): string {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (Array.isArray(value)) return value.map(content).join('');
    if (value && typeof value === 'object' && 'props' in value) return content((value as { props: { children?: unknown } }).props.children);
    return '';
}
const text = () => JSON.stringify(view?.toJSON());
const links = () => view!.root.findAllByType('a');
const websiteLinks = () => links().filter(node => content(node.props.children).startsWith('Open your website'));
const buttons = () => view!.root.findAllByType('button').map(node => content(node.props.children));
async function render() { await act(async () => { view = renderer.create(createElement(OwnerWebsiteOverview, { site })); }); }

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.clearAllMocks();
    state.summary = { submissionId: id, businessName: 'Kanto Cuts', publishPolicy: 'pay_then_publish', phase: 'ready_to_check', openChangeRequests: 0, publishedUrl: null };
    state.preview = { ready: true, inlineHtml: '<html>Saved preview HTML</html>', htmlUrl: null };
    state.payment = { billable: true, total: 4999, amountPaid: 0, balanceDue: 4999, paidInFull: false, needsApproval: true, xenditEnabled: true };
});
afterEach(async () => {
    if (view) await act(async () => view!.unmount()); view = undefined; vi.unstubAllGlobals();
    expect(state.mutate).not.toHaveBeenCalled(); expect(state.checkout).not.toHaveBeenCalled();
});

describe('owner private website presentation', () => {
    it('treats unavailable pricing as unknown rather than free or paid', async () => {
        state.payment = { billable: false }; await render();
        expect(text()).toContain('Payment details are not available yet. Contact the team for help with your order.');
        expect(text()).not.toContain('No payment is required'); expect(text()).not.toContain('Paid in full');
        expect(buttons()).not.toContain('Pay by bank transfer'); expect(buttons()).not.toContain('Looks good ');
        expect(links().some(node => node.props.href === '/contact')).toBe(true);
        const status = view!.root.findAllByType('p').find(node => content(node.props.children).includes('Payment details are not available yet. Contact the team for help'))!;
        expect(status.props.className).toContain('pendingMessage'); expect(status.props.className).not.toContain('paymentState');
    });

    it.each([
        ['offline', 'Offline', 'Your website is offline.'],
        ['rejected', 'Needs attention', 'Your business needs attention.'],
    ])('shows the canonical %s state even when a payment and old address exist', async (phase, badge, heading) => {
        state.summary = { ...state.summary, phase, publishedUrl: 'https://old.example.com' };
        state.payment = { ...state.payment, amountPaid: 4999, balanceDue: 0, paidInFull: true, needsApproval: false };
        await render();
        expect(text()).toContain(badge); expect(text()).toContain(heading);
        expect(text()).not.toContain('Publication is pending'); expect(text()).not.toContain('Your website is paid and online.');
        expect(websiteLinks()).toHaveLength(0); expect(links().some(node => node.props.href === '/contact')).toBe(true);
    });

    it('labels stored HTML as a preview for a live site and keeps a separately validated public link', async () => {
        state.summary = { ...state.summary, phase: 'live', publishedUrl: 'https://kanto.example.com/shop?visit=1' };
        state.payment = { ...state.payment, amountPaid: 4999, balanceDue: 0, paidInFull: true, needsApproval: false };
        await render();
        expect(text()).toContain('Website preview'); expect(text()).toContain('This is a saved preview and may differ from the current published website.');
        expect(text()).not.toContain('This is your published website.');
        const frame = view!.root.findAllByType('iframe')[0];
        expect(frame.props.srcDoc).toBe('<html>Saved preview HTML</html>'); expect(frame.props.src).toBeUndefined();
        expect(frame.props.sandbox).toBe('allow-scripts');
        expect(websiteLinks()[0].props).toMatchObject({ href: 'https://kanto.example.com/shop?visit=1', target: '_blank', rel: 'noopener noreferrer' });
    });

    it('keeps an owner-gated preview URL inside the sandbox without presenting it as a public address', async () => {
        state.preview = { ready: true, inlineHtml: null, htmlUrl: 'https://preview.example.com/private-signed-html' };
        await render();
        const frame = view!.root.findAllByType('iframe')[0];
        expect(frame.props.src).toBe('https://preview.example.com/private-signed-html'); expect(frame.props.srcDoc).toBeUndefined();
        expect(frame.props.sandbox).toBe('allow-scripts'); expect(websiteLinks()).toHaveLength(0);
    });

    it.each(['javascript:alert(1)', 'http://kanto.example.com', 'https://user:secret@kanto.example.com', '//kanto.example.com', 'not a URL'])
    ('does not turn an unsafe stored address into an Open website link: %s', async publishedUrl => {
        state.summary = { ...state.summary, phase: 'live', publishedUrl }; await render();
        expect(websiteLinks()).toHaveLength(0); expect(links().some(node => node.props.href === publishedUrl)).toBe(false);
    });

    it('keeps paid-but-private distinct from being live', async () => {
        state.summary = { ...state.summary, phase: 'publishing', publishedUrl: 'https://retained.example.com' };
        state.payment = { ...state.payment, amountPaid: 4999, balanceDue: 0, paidInFull: true, needsApproval: false }; await render();
        expect(text()).toContain('Paid in full. Publication is pending.'); expect(text()).toContain('Private preview');
        expect(text()).not.toContain('Your website is online.'); expect(websiteLinks()).toHaveLength(0);
        expect(text()).toContain('Secondary simulator tools');
    });

    it('shows the credited deposit and remaining balance without calling the site paid in full', async () => {
        state.summary.phase = 'awaiting_payment';
        state.payment = { ...state.payment, amountPaid: 1000, balanceDue: 3999, needsApproval: false }; await render();
        expect(view!.root.findAllByType('dd').map(node => content(node.props.children))).toEqual(['₱4,999', '₱1,000', '₱3,999']);
        expect(text()).not.toContain('Paid in full'); expect(buttons()).toContain('Pay by bank transfer ');
    });

    it('keeps change requests ahead of payment and approval actions', async () => {
        state.summary.openChangeRequests = 1; await render();
        expect(text()).toContain('Your changes are in progress.');
        expect(buttons().some(label => label.startsWith('Looks good') || label.startsWith('Pay by bank'))).toBe(false);
    });

    it('clearly explains how to continue a saved draft', async () => {
        state.summary.phase = 'draft'; state.preview.ready = false; await render();
        expect(text()).toContain('Your business is saved as a draft.'); expect(text()).toContain('Continue setup in the Tendso app.');
    });
});
