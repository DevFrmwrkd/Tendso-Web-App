import {
    CAMPAIGN_TTL_MS, clearCampaign, intakeCampaignForPage, readAffiliate, readCampaign,
    rememberAffiliate, rememberCampaign, rememberGiveaway, requestFullPriceIntake,
} from '@/lib/campaign';
import { emptyDraft, readSubmitted, rememberSubmitted, resolveIntakeDraft } from '@/app/start/draft';
import { quoteForReceipt } from '@/app/start/quote';

const NOW = 1_800_000_000_000;
const AFFILIATE_KEY = 'tendso:affiliate:v1';

describe('affiliate and campaign attribution', () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    let local: Map<string, string>;
    let session: Map<string, string>;
    let location: { search: string };
    const storage = (values: Map<string, string>) => ({
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
    });

    beforeEach(() => {
        local = new Map(); session = new Map(); location = { search: '' };
        Object.defineProperty(globalThis, 'window', { configurable: true, value: {
            location, localStorage: storage(local), sessionStorage: storage(session),
        } });
        jest.spyOn(Date, 'now').mockReturnValue(NOW);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
        else Reflect.deleteProperty(globalThis, 'window');
    });

    it('lets the latest OTR or affiliate entrance win, including a later affiliate', () => {
        rememberAffiliate('first-affiliate');
        rememberCampaign('otr', 'episode');
        expect(readAffiliate()).toBeNull();
        expect(intakeCampaignForPage()).toEqual({ giveaway: false, campaign: 'otr', source: 'episode' });
        rememberAffiliate('second-affiliate');
        expect(readCampaign()).toBeNull();
        expect(intakeCampaignForPage()).toEqual({ giveaway: false, campaign: null, source: null, affiliateHandle: 'second-affiliate' });
    });

    it.each(['unknown', 'suspended-affiliate', '', 'UPPERCASE', 'x'.repeat(31)])(
        'retains the %p handle instead of reviving an older discount', (handle) => {
            rememberCampaign('otr', 'poster');
            rememberAffiliate(handle);
            expect(readCampaign()).toBeNull();
            expect(readAffiliate()).toEqual({ handle, expiresAt: NOW + CAMPAIGN_TTL_MS });
            expect(intakeCampaignForPage().affiliateHandle).toBe(handle);
        },
    );

    it('uses a new explicit URL ahead of memory, and keeps affiliate precedence for combined paid hints', () => {
        rememberAffiliate('previous');
        location.search = '?code=OTR30&src=Video!';
        expect(intakeCampaignForPage()).toEqual({ giveaway: false, campaign: 'otr', source: 'video' });
        location.search = '?affiliate=alex-shop&campaign=otr';
        expect(intakeCampaignForPage()).toEqual({ giveaway: false, campaign: null, source: null, affiliateHandle: 'alex-shop' });
        location.search = '';
        expect(intakeCampaignForPage().affiliateHandle).toBe('alex-shop');
    });

    it('retains affiliate attribution for 30 days and drops it exactly at expiry', () => {
        rememberAffiliate('alex');
        jest.spyOn(Date, 'now').mockReturnValue(NOW + CAMPAIGN_TTL_MS - 1);
        expect(intakeCampaignForPage().affiliateHandle).toBe('alex');
        jest.spyOn(Date, 'now').mockReturnValue(NOW + CAMPAIGN_TTL_MS);
        expect(intakeCampaignForPage()).toEqual({ giveaway: false, campaign: null, source: null });
        expect(local.has(AFFILIATE_KEY)).toBe(false);
    });

    it('preserves separate giveaway and full-price choices, which replace affiliate attribution', () => {
        rememberAffiliate('alex');
        rememberGiveaway('poster');
        expect(readAffiliate()).toBeNull();
        expect(intakeCampaignForPage()).toEqual({ giveaway: true, campaign: null, source: 'poster' });
        rememberAffiliate('alex');
        requestFullPriceIntake();
        expect(local.size).toBe(0);
        expect(intakeCampaignForPage()).toEqual({ giveaway: false, campaign: null, source: null, fullPrice: true });
        rememberAffiliate('new-affiliate');
        expect(intakeCampaignForPage().affiliateHandle).toBe('new-affiliate');
    });

    it('keeps an explicitly requested giveaway separate even when an affiliate is also present', () => {
        rememberAffiliate('previous');
        location.search = '?campaign=giveaway&affiliate=alex&src=poster';
        expect(intakeCampaignForPage()).toEqual({ giveaway: true, campaign: null, source: 'poster' });
        expect(readAffiliate()).toBeNull();
    });

    it('clears all paid attribution when explicitly clearing an offer or receiving an unsupported campaign', () => {
        rememberAffiliate('alex');
        clearCampaign();
        expect(readAffiliate()).toBeNull();
        rememberAffiliate('alex');
        location.search = '?campaign=unsupported';
        expect(intakeCampaignForPage()).toEqual({ giveaway: false, campaign: null, source: null });
        expect(readAffiliate()).toBeNull();
    });

    it('uses explicit links when local storage is unavailable', () => {
        Object.defineProperty(window, 'localStorage', { get: () => { throw new Error('Blocked'); } });
        location.search = '?affiliate=alex';
        expect(intakeCampaignForPage()).toEqual({ giveaway: false, campaign: null, source: null, affiliateHandle: 'alex' });
        location.search = '?campaign=otr&src=poster';
        expect(intakeCampaignForPage()).toEqual({ giveaway: false, campaign: 'otr', source: 'poster' });
        expect(() => rememberAffiliate('alex')).not.toThrow();
    });

    it('still remembers an offer when only session storage is unavailable', () => {
        Object.defineProperty(window, 'sessionStorage', { get: () => { throw new Error('Blocked'); } });
        rememberAffiliate('alex');
        expect(readAffiliate()?.handle).toBe('alex');
        rememberCampaign('otr');
        expect(readCampaign()?.campaign).toBe('otr');
    });

    it.each(['invalid JSON', '{}', '{"handle":42,"expiresAt":1900000000000}', '{"handle":"alex","expiresAt":null}'])(
        'ignores malformed browser memory: %s', (raw) => {
            local.set(AFFILIATE_KEY, raw);
            expect(readAffiliate()).toBeNull();
            expect(() => intakeCampaignForPage()).not.toThrow();
        },
    );

    it.each(['?affiliate=alex', '?campaign=otr'])('keeps owner data but replaces stale giveaway draft attribution after %s', (search) => {
        const saved = { ...emptyDraft(), step: 5, giveawayApplication: true, giveawaySource: 'old-poster' };
        saved.basics.businessName = 'Aling Nena';
        saved.photos[0] = 'https://example.com/photo.jpg';
        location.search = search;
        const resumed = resolveIntakeDraft(saved, intakeCampaignForPage(), true);
        expect(resumed.giveawayApplication).toBe(false);
        expect(resumed.giveawaySource).toBeNull();
        expect(resumed.step).toBe(4);
        expect(resumed.basics.businessName).toBe('Aling Nena');
        expect(resumed.photos).toEqual(saved.photos);
    });

    it('still resumes an in-progress giveaway after an untagged return, even when the offer has closed', () => {
        const saved = { ...emptyDraft(), step: 2, giveawayApplication: true, giveawaySource: 'poster' };
        expect(resolveIntakeDraft(saved, intakeCampaignForPage(), false)).toMatchObject({ giveawayApplication: true, giveawaySource: 'poster' });
    });

    it('restores frozen affiliate receipt figures without depending on current attribution', () => {
        rememberSubmitted({
            email: 'owner@example.com', amount: 1499, businessName: 'Corner Shop', city: 'Quezon City',
            campaign: null, customDomain: true, websitePrice: 999, websiteListPrice: 4999,
        });
        rememberCampaign('otr');
        const receipt = readSubmitted();
        expect(receipt).toMatchObject({ amount: 1499, websitePrice: 999, websiteListPrice: 4999 });
        expect(readSubmitted()).toBe(receipt);
        expect(quoteForReceipt(receipt!)).toMatchObject({ total: 1499, sellPrice: 999, addOn: 500, code: null });
    });
});
