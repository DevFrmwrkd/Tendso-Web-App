import { useClerk, useUser } from '@clerk/nextjs';
import { useConvexAuth, useQuery } from 'convex/react';
import { getFunctionName } from 'convex/server';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PortalUtilities } from '@/components/v2/creators/PortalUtilities';
import { PortalView } from '@/components/v2/creators/PortalView';
import type { Doc } from '@/convex/_generated/dataModel';
import { SAMPLE_PORTAL } from '@/lib/v2/creatorSample';
import type { PortalSummary } from '@/lib/v2/creatorTypes';

const PAYOUTS = '/v2/creators/portal/payouts';

jest.mock('@clerk/nextjs', () => ({ useClerk: jest.fn(), useUser: jest.fn() }));
jest.mock('convex/react', () => ({ useConvexAuth: jest.fn(), useQuery: jest.fn() }));
jest.mock('@/convex/_generated/api', () => ({ api: jest.requireActual('convex/server').anyApi }));
jest.mock('next/dynamic', () => () => () => null);
jest.mock('@/components/v2/creators/PortalFrame.module.css', () => ({}));

const account: Doc<'creators'> = {
    _id: 'own-affiliate' as Doc<'creators'>['_id'], _creationTime: 1,
    clerkId: 'current-user', email: 'affiliate@example.com', role: 'affiliate', status: 'active', balance: 0,
};
const state = {
    user: { id: 'current-user' } as { id: string } | null,
    loaded: true,
    signedIn: true,
    convex: { isLoading: false, isAuthenticated: true, isRefreshing: false },
    session: { clerkId: 'current-user', creator: { ...account } } as { clerkId: string; creator: Doc<'creators'> | null } | undefined,
    unread: 3,
};

beforeEach(() => {
    jest.clearAllMocks();
    state.user = { id: 'current-user' };
    state.loaded = true;
    state.signedIn = true;
    state.convex = { isLoading: false, isAuthenticated: true, isRefreshing: false };
    state.session = { clerkId: 'current-user', creator: { ...account } };
    state.unread = 3;
    jest.mocked(useUser).mockImplementation(() => ({ user: state.user, isLoaded: state.loaded, isSignedIn: state.signedIn } as unknown as ReturnType<typeof useUser>));
    jest.mocked(useClerk).mockReturnValue({ signOut: jest.fn() } as unknown as ReturnType<typeof useClerk>);
    jest.mocked(useConvexAuth).mockImplementation(() => state.convex);
    (useQuery as jest.Mock).mockImplementation((reference, args) => {
        if (args === 'skip') return undefined;
        switch (getFunctionName(reference)) {
            case 'adminAccess:me': return state.session;
            case 'notifications:getUnreadCount': return state.unread;
            default: throw new Error(`Unexpected portal utility query: ${getFunctionName(reference)}`);
        }
    });
});

function portalMarkup({ balance = 0, status = 'active', sample = false }: {
    balance?: number;
    status?: 'active' | 'suspended';
    sample?: boolean;
} = {}): string {
    const data: PortalSummary = {
        ...SAMPLE_PORTAL,
        creator: { ...SAMPLE_PORTAL.creator, status },
        payouts: { ...SAMPLE_PORTAL.payouts, readyToSend: balance },
    };
    return renderToStaticMarkup(createElement(PortalView, { data, sample }));
}

function payoutSection(options: Parameters<typeof portalMarkup>[0] = {}): string {
    const html = portalMarkup(options);
    const section = html.match(/<section\b[^>]*aria-label="Payouts"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    if (!section) throw new Error('Payouts section missing');
    return section;
}

describe('creator portal payout access', () => {
    it('keeps Wise setup reachable before the first credited commission', () => {
        const html = payoutSection();
        expect(html).toContain(`href="${PAYOUTS}"`);
        expect(html).not.toContain('/affiliates/dashboard/wallet');
        expect(html).not.toMatch(/<a\b[^>]*>\s*Send [\s\S]*?to Wise\s*<\/a>/);
    });

    it('sends an active creator to the canonical payout screen without changing money behavior', () => {
        const html = payoutSection({ balance: 1750 });
        expect(html).toMatch(new RegExp(`<a\\b[^>]*href="${PAYOUTS}"[^>]*>\\s*Send ₱1,750 to Wise\\s*<\\/a>`));
        expect(html).not.toContain('/affiliates/dashboard/wallet');
    });

    it('does not offer a send action while suspended, even with a positive available balance', () => {
        const html = payoutSection({ balance: 1750, status: 'suspended' });
        expect(html).toContain('paused');
        expect(html).toContain(`href="${PAYOUTS}"`);
        expect(html).not.toMatch(/<a\b[^>]*>\s*Send [\s\S]*?to Wise\s*<\/a>/);
    });

    it('keeps sample payouts local and cannot open the signed-in account wallet', () => {
        const html = payoutSection({ balance: 1750, sample: true });
        expect(html).toContain('aria-disabled="true"');
        expect(html).not.toContain(`href="${PAYOUTS}"`);
        expect(html).not.toContain('/affiliates/dashboard/wallet');
    });
});

describe('creator portal sharing restrictions', () => {
    it.each([
        { status: 'suspended' as const, sample: false },
        { status: 'active' as const, sample: true },
    ])('disables shop, agent and code actions for $status, sample=$sample', options => {
        const html = portalMarkup(options);
        for (const label of ['Shop link actions', 'Agent link actions', 'Discount code actions']) {
            const group = html.match(new RegExp(`<div\\b[^>]*aria-label="${label}"[^>]*>([\\s\\S]*?)<\\/div>`))?.[1];
            expect(group).toBeDefined();
            const buttons = group!.match(/<button\b[^>]*>/g) ?? [];
            expect(buttons).toHaveLength(label === 'Discount code actions' ? 1 : 2);
            expect(buttons.every(button => button.includes('disabled=""'))).toBe(true);
        }
    });

    it('keeps those same copy and share actions available to an active live creator', () => {
        const html = portalMarkup();
        for (const label of ['Shop link actions', 'Agent link actions', 'Discount code actions']) {
            const group = html.match(new RegExp(`<div\\b[^>]*aria-label="${label}"[^>]*>([\\s\\S]*?)<\\/div>`))?.[1];
            expect(group).toBeDefined();
            expect(group).not.toContain('disabled=""');
        }
    });
});

describe('live creator portal notification and sign-out tools', () => {
    it('uses only the verified own account for unread count and updates the accessible count', () => {
        const first = renderToStaticMarkup(createElement(PortalUtilities));
        expect(first).toContain('aria-label="Notifications, 3 unread"');
        expect(first).toContain('Sign out');
        expect(jest.mocked(useQuery).mock.calls.map(([reference, args]) => [getFunctionName(reference), args])).toEqual([
            ['adminAccess:me', {}], ['notifications:getUnreadCount', { creatorId: account._id }],
        ]);
        state.unread = 0;
        const caughtUp = renderToStaticMarkup(createElement(PortalUtilities));
        expect(caughtUp).toContain('aria-label="Notifications"');
        expect(caughtUp).not.toContain('3 unread');
    });

    it('allows a verified suspended account to read notifications and sign out', () => {
        state.session!.creator!.status = 'suspended';
        const html = renderToStaticMarkup(createElement(PortalUtilities));
        expect(html).toContain('Notifications');
        expect(html).toContain('Sign out');
        expect(jest.mocked(useQuery).mock.calls[1][1]).toEqual({ creatorId: account._id });
    });

    it.each(['loading', 'signed out', 'Convex loading', 'unauthenticated', 'previous session', 'previous creator', 'wrong role', 'pending', 'deleted', 'missing account'] as const)(
        'does not mount tools or read another account notification count for %s', condition => {
            if (condition === 'loading') state.loaded = false;
            if (condition === 'signed out') { state.signedIn = false; state.user = null; }
            if (condition === 'Convex loading') state.convex.isLoading = true;
            if (condition === 'unauthenticated') state.convex.isAuthenticated = false;
            if (condition === 'previous session') state.session!.clerkId = 'previous-user';
            if (condition === 'previous creator') state.session!.creator!.clerkId = 'previous-user';
            if (condition === 'wrong role') state.session!.creator!.role = 'creator';
            if (condition === 'pending') state.session!.creator!.status = 'pending';
            if (condition === 'deleted') state.session!.creator!.isDeleted = true;
            if (condition === 'missing account') state.session!.creator = null;
            expect(renderToStaticMarkup(createElement(PortalUtilities))).toBe('');
            expect(jest.mocked(useQuery).mock.calls[1][1]).toBe('skip');
            if (['loading', 'signed out', 'Convex loading', 'unauthenticated'].includes(condition)) {
                expect(jest.mocked(useQuery).mock.calls[0][1]).toBe('skip');
            }
        },
    );
});
