import {
    CAMPAIGN_TTL_MS,
    discountCampaignForPage,
    readCampaign,
    rememberCampaign,
} from '@/lib/campaign';
import { WEBSITE_PRICE } from '@/lib/pricing';
import { quoteFor } from '@/app/start/quote';

const STORAGE_KEY = 'tendso:campaign:v1';
const NOW = 1_800_000_000_000;

describe('browser discount memory', () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    let entries: Map<string, string>;
    let location: { search: string };

    beforeEach(() => {
        entries = new Map();
        location = { search: '' };
        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: {
                location,
                localStorage: {
                    getItem: (key: string) => entries.get(key) ?? null,
                    setItem: (key: string, value: string) => entries.set(key, value),
                    removeItem: (key: string) => entries.delete(key),
                },
            },
        });
        jest.spyOn(Date, 'now').mockReturnValue(NOW);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
        else Reflect.deleteProperty(globalThis, 'window');
    });

    it('remembers a valid discount and keeps its source and lifetime', () => {
        rememberCampaign(' OTR30 ', ' Poster! ');
        expect(readCampaign()).toEqual({ campaign: 'otr', source: 'poster', expiresAt: NOW + CAMPAIGN_TTL_MS });
        expect(discountCampaignForPage()).toEqual({ campaign: 'otr', source: 'poster' });
        expect(quoteFor(discountCampaignForPage().campaign, false).total).toBe(3499);
    });

    it('clears a previous discount instead of remembering a giveaway as one', () => {
        rememberCampaign('otr');
        rememberCampaign('giveaway', 'poster');
        expect(readCampaign()).toBeNull();
        expect(entries.has(STORAGE_KEY)).toBe(false);
        expect(quoteFor(discountCampaignForPage().campaign, false).total).toBe(WEBSITE_PRICE);
    });

    it.each(['giveaway', ' GIVEAWAY ', 'unknown'])('ignores a legacy remembered %s and charges full price', (campaign) => {
        entries.set(STORAGE_KEY, JSON.stringify({ campaign, source: 'poster', expiresAt: NOW + CAMPAIGN_TTL_MS }));
        const discount = discountCampaignForPage();
        expect(discount.campaign).toBeNull();
        expect(entries.has(STORAGE_KEY)).toBe(false);
        expect(quoteFor(discount.campaign, false)).toMatchObject({ total: WEBSITE_PRICE, discounted: false });
    });

    it.each(['?campaign=giveaway&src=poster', '?code=GIVEAWAY&src=poster'])('a %s link replaces a previously remembered OTR discount', (search) => {
        rememberCampaign('otr', 'video');
        location.search = search;
        const discount = discountCampaignForPage();
        expect(discount).toEqual({ campaign: null, source: 'poster' });
        expect(readCampaign()).toBeNull();
        expect(quoteFor(discount.campaign, false).total).toBe(WEBSITE_PRICE);
    });

    it('uses a fresh valid code and source from the URL', () => {
        location.search = '?code=OTR30&src=shop';
        expect(discountCampaignForPage()).toEqual({ campaign: 'otr', source: 'shop' });
        expect(readCampaign()?.campaign).toBe('otr');
    });

    it('stops using a discount at its expiry', () => {
        entries.set(STORAGE_KEY, JSON.stringify({ campaign: 'otr', source: null, expiresAt: NOW }));
        expect(discountCampaignForPage().campaign).toBeNull();
        expect(entries.has(STORAGE_KEY)).toBe(false);
    });
});
