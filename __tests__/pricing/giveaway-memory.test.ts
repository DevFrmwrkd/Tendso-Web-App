import { clearCampaign, intakeCampaignForPage, readCampaign, rememberCampaign, rememberGiveaway, requestFullPriceIntake } from '@/lib/campaign';
import { campaignSellPrice, WEBSITE_PRICE } from '@/lib/pricing';

describe('giveaway application memory', () => {
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
    });
    afterEach(() => {
        jest.restoreAllMocks();
        if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
        else Reflect.deleteProperty(globalThis, 'window');
    });

    it('keeps giveaway attribution separate from discounts and replaces a previous offer', () => {
        rememberCampaign('otr', 'video');
        rememberGiveaway(' Poster! ');
        expect(readCampaign()).toBeNull();
        expect(intakeCampaignForPage()).toEqual({ giveaway: true, campaign: null, source: 'poster' });
        expect(campaignSellPrice('giveaway')).toBe(WEBSITE_PRICE);
    });

    it('uses the source from a fresh video or poster link', () => {
        rememberGiveaway('video');
        location.search = '?campaign=giveaway&src=poster';
        expect(intakeCampaignForPage()).toEqual({ giveaway: true, campaign: null, source: 'poster' });
        location.search = '';
        expect(intakeCampaignForPage().source).toBe('poster');
    });

    it('the closed-page paid CTA clears all offers and retains the explicit full-price choice', () => {
        rememberGiveaway('poster');
        requestFullPriceIntake();
        expect(local.size).toBe(0);
        expect(intakeCampaignForPage()).toEqual({ giveaway: false, campaign: null, source: null, fullPrice: true });
        expect(intakeCampaignForPage().fullPrice).toBe(true);
    });

    it('an explicit fresh offer overrides the previous paid choice', () => {
        requestFullPriceIntake();
        location.search = '?campaign=giveaway&src=video';
        expect(intakeCampaignForPage()).toEqual({ giveaway: true, campaign: null, source: 'video' });
        location.search = '?code=OTR30&src=episode';
        expect(intakeCampaignForPage()).toEqual({ giveaway: false, campaign: 'otr', source: 'episode' });
        location.search = '';
        expect(intakeCampaignForPage()).toEqual({ giveaway: false, campaign: 'otr', source: 'episode' });
    });

    it('clearing a closed giveaway does not itself change an in-progress draft to a paid order', () => {
        rememberGiveaway('poster');
        clearCampaign();
        expect(intakeCampaignForPage()).toEqual({ giveaway: false, campaign: null, source: null });
    });

    it('forgets expired giveaway attribution without introducing a discount', () => {
        jest.spyOn(Date, 'now').mockReturnValue(100);
        rememberGiveaway('video');
        jest.spyOn(Date, 'now').mockReturnValue(100 + 31 * 24 * 60 * 60 * 1000);
        expect(intakeCampaignForPage()).toEqual({ giveaway: false, campaign: null, source: null });
        expect(local.size).toBe(0);
    });
});
