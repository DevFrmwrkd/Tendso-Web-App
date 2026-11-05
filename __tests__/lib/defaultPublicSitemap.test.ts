import sitemap from '@/app/sitemap';
import { fetchQuery } from 'convex/nextjs';
import { loadFeaturedSites } from '@/components/landing/loadFeaturedSites';

jest.mock('convex/nextjs', () => ({ fetchQuery: jest.fn() }));
jest.mock('@/convex/_generated/api', () => ({ api: { knowledge: { listPublishedHelpSlugs: 'published-articles' } } }));
jest.mock('@/components/landing/loadFeaturedSites', () => ({ loadFeaturedSites: jest.fn() }));
jest.mock('@/lib/seo', () => ({ SITE_URL: 'https://tendso.com' }));

beforeEach(() => {
    jest.mocked(fetchQuery).mockResolvedValue([]);
    jest.mocked(loadFeaturedSites).mockResolvedValue([]);
});

it('lists the redesigned default pages without duplicate review URLs or private workspaces', async () => {
    const entries = await sitemap();
    expect(entries.map(entry => new URL(entry.url).pathname)).toEqual([
        '/', '/for-business', '/examples', '/for-field-agents', '/affiliates',
        '/about', '/help', '/privacy-policy', '/terms-of-service',
    ]);
    expect(entries.every(entry => !/\/v2(?:\/|$)|\/dashboard|\/pay\/|\/start|\/knowledge$/.test(entry.url))).toBe(true);
});

it('retains published article URLs and verified hosted sites alongside the new defaults', async () => {
    jest.mocked(fetchQuery).mockResolvedValue([{ slug: 'how-to-take-photos', updatedAt: 1700000000000 }]);
    jest.mocked(loadFeaturedSites).mockResolvedValue([
        { url: 'https://sample-shop.sites.tendso.com/' },
        { url: 'https://sample-shop.sites.tendso.com/' },
        { url: 'https://unrelated.example.com/' },
    ] as Awaited<ReturnType<typeof loadFeaturedSites>>);
    const urls = (await sitemap()).map(entry => entry.url);
    expect(urls).toContain('https://tendso.com/knowledge/how-to-take-photos');
    expect(urls.filter(url => url === 'https://sample-shop.sites.tendso.com/')).toHaveLength(1);
    expect(urls).not.toContain('https://unrelated.example.com/');
});

it('keeps the default public pages crawlable when the article service is unavailable', async () => {
    jest.mocked(fetchQuery).mockRejectedValue(new Error('temporarily unavailable'));
    expect((await sitemap()).map(entry => entry.url)).toContain('https://tendso.com/help');
});
