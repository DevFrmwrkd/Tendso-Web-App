import {
    emptyDraft, loadDraft, readSubmitted, rememberSubmitted, resolveGiveawayDraft, saveDraft,
} from '@/app/start/draft';

const values = new Map<string, string>();
const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
};

describe('/start giveaway draft', () => {
    beforeEach(() => {
        values.clear();
        Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage, sessionStorage: storage } });
    });
    afterAll(() => { Reflect.deleteProperty(globalThis, 'window'); });

    it('restores an old ordinary draft on its original confirmation step', () => {
        const legacy = { ...emptyDraft(), step: 4 } as Record<string, unknown>;
        delete legacy.giveawayApplication;
        delete legacy.giveawaySource;
        delete legacy.giveawayPosterPhoto;
        storage.setItem('tendso:start:draft:v1', JSON.stringify(legacy));
        expect(loadDraft()).toMatchObject({ step: 4, giveawayApplication: false, giveawaySource: null, giveawayPosterPhoto: null });
    });

    it('stores a giveaway review draft, source and poster separately from every site photo role', () => {
        const draft = { ...emptyDraft(), step: 5, giveawayApplication: true, giveawaySource: 'poster', giveawayPosterPhoto: 'https://r2.test/poster.jpg', photos: { 0: 'https://r2.test/front.jpg', 2: 'https://r2.test/interior.jpg' } };
        saveDraft(draft);
        const restored = loadDraft();
        expect(restored).toMatchObject({ step: 5, giveawayApplication: true, giveawaySource: 'poster', giveawayPosterPhoto: draft.giveawayPosterPhoto });
        expect(restored.photos).toEqual(draft.photos);
        expect(Object.values(restored.photos)).not.toContain(restored.giveawayPosterPhoto);
    });

    it('starts a fresh closed giveaway entrance at full price without enabling a domain', () => {
        const draft = resolveGiveawayDraft(emptyDraft(), true, 'video', false);
        expect(draft).toMatchObject({ giveawayApplication: false, giveawaySource: null, wantsCustomDomain: false });
    });

    it('does not treat an untouched remembered giveaway draft as an application after closure', () => {
        const draft = { ...emptyDraft(), giveawayApplication: true, giveawaySource: 'poster' };
        expect(resolveGiveawayDraft(draft, true, 'video', false)).toMatchObject({
            giveawayApplication: false, giveawaySource: null, step: 1,
        });
    });

    it('retains an in-progress giveaway and every saved field after closure so a refusal cannot silently charge the owner', () => {
        const draft = { ...emptyDraft(), step: 5, giveawayApplication: true, giveawaySource: 'poster', giveawayPosterPhoto: 'https://r2.test/poster.jpg', photos: { 0: 'https://r2.test/front.jpg' }, answers: { what_you_sell: 'Our business story' } };
        draft.basics.businessName = 'Corner Shop';
        expect(resolveGiveawayDraft(draft, false, null, false)).toEqual(draft);
    });

    it('lets an explicit paid CTA preserve the form data while opting out of a saved giveaway', () => {
        const draft = { ...emptyDraft(), step: 5, giveawayApplication: true, giveawayPosterPhoto: 'https://r2.test/poster.jpg', wantsCustomDomain: true };
        draft.basics.businessName = 'Corner Shop';
        const paid = resolveGiveawayDraft(draft, false, null, false, true);
        expect(paid).toMatchObject({ step: 4, giveawayApplication: false, giveawaySource: null, wantsCustomDomain: false, giveawayPosterPhoto: draft.giveawayPosterPhoto });
        expect(paid.basics).toEqual(draft.basics);
    });

    it('adds the poster step to an existing ordinary review draft when the giveaway is open', () => {
        const draft = { ...emptyDraft(), step: 4, wantsCustomDomain: true, requestedDomain: 'shop.com' };
        expect(resolveGiveawayDraft(draft, true, 'video', true)).toMatchObject({ step: 4, giveawayApplication: true, giveawaySource: 'video', wantsCustomDomain: false });
    });

    it('uses a new placement for a resumed application without replacing its poster or website photos', () => {
        const draft = { ...emptyDraft(), step: 5, giveawayApplication: true, giveawaySource: 'video', giveawayPosterPhoto: 'https://r2.test/poster.jpg', photos: { 1: 'https://r2.test/inside.jpg' } };
        const resumed = resolveGiveawayDraft(draft, true, 'poster', true);
        expect(resumed.giveawaySource).toBe('poster');
        expect(resumed.giveawayPosterPhoto).toBe(draft.giveawayPosterPhoto);
        expect(resumed.photos).toEqual(draft.photos);
    });

    it('drops malformed giveaway fields and clamps the restored cursor to the ordinary form', () => {
        storage.setItem('tendso:start:draft:v1', JSON.stringify({
            ...emptyDraft(), step: 5, giveawayApplication: 'true', giveawaySource: { placement: 'poster' }, giveawayPosterPhoto: 42,
        }));
        expect(loadDraft()).toMatchObject({
            step: 4, giveawayApplication: false, giveawaySource: null, giveawayPosterPhoto: null,
        });
    });

    it('keeps a successful giveaway receipt distinct from an ordinary zero-price or legacy receipt', () => {
        rememberSubmitted({ email: 'owner@shop.ph', amount: 0, businessName: 'Shop', city: 'Manila', campaign: null, customDomain: false, giveawayApplication: true });
        expect(readSubmitted()).toMatchObject({ amount: 0, giveawayApplication: true });
        storage.setItem('tendso:start:receipt:v1', JSON.stringify({ email: 'old@shop.ph', amount: 4999 }));
        expect(readSubmitted()).toMatchObject({ amount: 4999, giveawayApplication: false });
    });
});
