import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { OwnerSite } from '../../app/my-business/_components/ownerSite';

vi.mock('next/link', () => ({ default: ({ children, ...props }: { children: ReactNode }) => createElement('a', props, children) }));
vi.mock('../../components/r1', () => ({ Loading: ({ children }: { children: ReactNode }) => createElement('div', {}, children) }));
vi.mock('../../components/landing/LiveSitePreview', () => ({ default: () => createElement('div', {}, 'Website preview') }));

import { NoSite, SiteList, SiteOverview } from '../../app/my-business/_components/OwnerHome';

function site(name: string, overrides: Partial<OwnerSite> = {}): OwnerSite {
    return { submissionId: name as OwnerSite['submissionId'], businessName: name, businessType: 'shop',
        contentSource: 'owner_app', publishPolicy: 'pay_then_publish', status: 'draft', phase: 'draft',
        publishedUrl: null, total: 4999, amountPaid: 0, balanceDue: 4999, paidInFull: false,
        openChangeRequests: 0, createdAt: 1_800_000_000_000, ...overrides };
}
function links(html: string) {
    return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(match => ({
        href: match[1].match(/href="([^"]*)"/)?.[1], text: match[2].replace(/<[^>]*>/g, '').trim(), attributes: match[1],
    }));
}

describe('owner business cards and navigation', () => {
    it('renders every owned business instead of hiding the sixth and seventh behind Show all', () => {
        const sites = Array.from({ length: 7 }, (_, index) => site(`Business ${index + 1}`));
        const html = renderToStaticMarkup(createElement(SiteList, { sites }));
        expect(html.match(/<article\b/g)).toHaveLength(7);
        for (const business of sites) expect(html).toContain(business.businessName);
        expect(links(html).filter(link => link.href?.startsWith('/my-business/'))).toHaveLength(14);
        expect(html).not.toContain('Show all');
    });

    it('sends each next action to its workspace and gives live websites a real external target', () => {
        const sites = [site('draft'), site('preview', { phase: 'ready_to_check' }),
            site('balance', { phase: 'awaiting_payment', amountPaid: 500, balanceDue: 4499 }),
            site('live', { phase: 'live', paidInFull: true, amountPaid: 4999, balanceDue: 0, publishedUrl: 'https://corner.example/' })];
        const found = links(renderToStaticMarkup(createElement(SiteList, { sites })));
        expect(found.find(link => link.text === 'Finish setup')?.href).toBe('/my-business/draft');
        expect(found.find(link => link.text === 'Check preview')?.href).toBe('/my-business/preview');
        expect(found.find(link => link.text === 'Pay balance')?.href).toBe('/my-business/balance');
        const live = found.find(link => link.text === 'Open website');
        expect(live?.href).toBe('https://corner.example/'); expect(live?.attributes).toContain('noopener noreferrer');
        expect(found.find(link => link.text === 'View details')?.href).toBe('/my-business/live');
    });

    it('does not expose a retained offline address or an unsafe address as an active site', () => {
        const sites = [site('offline', { phase: 'offline', publishedUrl: 'https://old-offline.example/' }),
            site('unsafe', { phase: 'live', paidInFull: true, balanceDue: 0, publishedUrl: 'javascript:alert(1)' })];
        const html = renderToStaticMarkup(createElement(SiteList, { sites }));
        expect(html).toContain('Offline'); expect(html).not.toContain('old-offline.example');
        expect(html).not.toContain('javascript:'); expect(links(html).some(link => link.text === 'Open website')).toBe(false);
    });

    it('uses a real balance in the overview and keeps the empty-state destinations available', () => {
        const html = renderToStaticMarkup(createElement(SiteOverview, { site: site('legacy-live', {
            phase: 'live', publishPolicy: 'publish_first', amountPaid: 500, balanceDue: 4499, publishedUrl: 'https://corner.example/',
        }) }));
        expect(html).toContain('₱4,499'); expect(html).toContain('remaining');
        expect(html).not.toContain('Enquiries'); expect(html).not.toContain('Free edits for your first year');
        const empty = links(renderToStaticMarkup(createElement(NoSite)));
        expect(empty.some(link => link.href === '/start')).toBe(true);
        expect(empty.some(link => link.href === '/contact')).toBe(true);
    });
});
