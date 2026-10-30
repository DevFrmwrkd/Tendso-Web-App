import { boldOfferPosterScene, createAffiliatePoster, POSTER_PAGE } from '@/lib/affiliatePoster';
import { BASE_PRICE, CREATOR_CODE_DISCOUNT, CREATOR_CODE_PRICE, PRICE_CEILING, WEBSITE_PRICE, formatPHP } from '@/packages/shared/pricing';

const saved = {
    handle: 'ana-local', displayName: '  Ana’s saved page  ', photo: ' https://photos.example.com/saved.jpg ',
    price: 2661, referralCode: '  LEGACY27  ',
};
const textIn = (scene: ReturnType<typeof boldOfferPosterScene>) => scene.flatMap(node => node.kind === 'text' ? [node.text] : []);

describe('saved affiliate poster data', () => {
    it('keeps the real referral code independent of the handle and uses the personal shop URL', () => {
        const model = createAffiliatePoster(saved);
        expect(model.name).toBe('Ana’s saved page');
        expect(model.photo).toBe('https://photos.example.com/saved.jpg');
        expect(model.code).toBe('LEGACY27');
        expect(model.url).toBe('https://tendso.com/v2/a/ana-local');
        const qr = boldOfferPosterScene(model).filter(node => node.kind === 'qr');
        expect(qr).toHaveLength(1);
        expect(qr[0]).toMatchObject({ value: model.url });
        expect(model.url).not.toContain('/earn');
        expect(model.url).not.toContain('localhost');
    });

    it.each([undefined, BASE_PRICE - 1, BASE_PRICE, 2661.6, WEBSITE_PRICE, PRICE_CEILING + 100, NaN, Infinity])(
        'uses the fixed code offer instead of a legacy saved price of %s', desired => {
            const model = createAffiliatePoster({ ...saved, price: desired });
            expect(model.price).toBe(CREATOR_CODE_PRICE);
            expect(model.priceLabel).toBe(formatPHP(CREATOR_CODE_PRICE));
            expect(model.listPriceLabel).toBe(formatPHP(WEBSITE_PRICE));
            expect(model.saving).toBe(1500);
            expect(model.hasDiscount).toBe(true);
            expect(model.price).toBe(Math.round(WEBSITE_PRICE * (1 - CREATOR_CODE_DISCOUNT)));
            expect(textIn(boldOfferPosterScene(model))).toContain('₱3,499');
            expect(textIn(boldOfferPosterScene(model))).toContain('Save ₱1,500');
        },
    );

    it.each(['', ' ', undefined])('does not invent a missing creator code from the page handle (%s)', referralCode => {
        const model = createAffiliatePoster({ ...saved, referralCode });
        expect(model.code).toBeNull();
        const words = textIn(boldOfferPosterScene(model)).join(' ');
        expect(words).not.toContain('CREATOR CODE');
        expect(words).not.toContain('Enter this code before you pay');
        expect(words).not.toContain('MIKA30');
        expect(model.url).toBe('https://tendso.com/v2/a/ana-local');
    });

    it.each(['http://photos.example.com/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'file:///private/photo.jpg', 'https://user:password@photos.example.com/a.jpg'])('omits unsafe photo sources: %s', photo => {
        const model = createAffiliatePoster({ ...saved, photo });
        expect(model.photo).toBeNull();
        expect(boldOfferPosterScene(model).some(node => node.kind === 'image' && node.id === 'photo')).toBe(false);
    });

    it('only passes public print fields into the artwork', () => {
        const source = { ...saved, email: 'private-email@example.com', clerkId: 'private-clerk',
            wiseEmail: 'private-payout@example.com', balance: 7654321, rejectionReason: 'private-review-note' };
        const json = JSON.stringify({ model: createAffiliatePoster(source), scene: boldOfferPosterScene(createAffiliatePoster(source)) });
        for (const privateValue of [source.email, source.clerkId, source.wiseEmail, String(source.balance), source.rejectionReason]) {
            expect(json).not.toContain(privateValue);
        }
        expect(json).not.toContain('Design draft');
        expect(json).not.toContain('Mika Santos');
        expect(json).not.toContain('MIKA30');
    });
});

describe('Bold offer print content', () => {
    it('shows the saved offer and the approved scan and payment instructions', () => {
        const model = createAffiliatePoster(saved);
        const words = textIn(boldOfferPosterScene(model)).join(' ');
        expect(words).toContain(model.name);
        expect(words).toContain(model.priceLabel);
        expect(words).toContain(model.code!);
        expect(words).toContain('Pay once, own it.');
        expect(words).toContain('See it first. Pay to publish.');
        expect(words).toContain('website offer.');
        expect(words).not.toContain('Scan to order');
    });

    it('keeps the fixed discount even when an older account saved the full website price', () => {
        const model = createAffiliatePoster({ ...saved, price: WEBSITE_PRICE });
        const words = textIn(boldOfferPosterScene(model));
        expect(words.filter(value => value === model.priceLabel)).toHaveLength(1);
        expect(words).toContain('₱4,999');
        expect(words).toContain('Save ₱1,500');
        expect(model.priceLabel).toBe('₱3,499');
    });

    it('uses an A4 page and a 300 dpi export rather than capturing the phone thumbnail', () => {
        expect(POSTER_PAGE.width / POSTER_PAGE.height).toBeCloseTo(210 / 297, 3);
        expect(POSTER_PAGE.exportWidth).toBe(2480);
        expect(POSTER_PAGE.exportHeight).toBe(3508);
    });

    it('keeps long saved names and historical codes complete without running into the next text block', () => {
        const displayName = '珍'.repeat(100);
        const referralCode = 'HISTORICALCODE'.repeat(4);
        const scene = boldOfferPosterScene(createAffiliatePoster({ ...saved, displayName, referralCode }));
        const text = scene.filter(node => node.kind === 'text');
        const code = text.filter(node => node.id.startsWith('creator-code-'));
        const byline = text.filter(node => node.id.startsWith('byline-'));
        expect(code.map(node => node.text).join('')).toBe(referralCode);
        expect(byline.map(node => node.text).join('')).toBe(`Shared by ${displayName}`);
        const instruction = text.find(node => node.id === 'code-instruction-first')!;
        const pageLink = text.find(node => node.id === 'page-link')!;
        expect(Math.max(...code.map(node => node.y + node.fontSize * .3))).toBeLessThan(instruction.y - instruction.fontSize * .97);
        expect(Math.max(...byline.map(node => node.y + node.fontSize * .3))).toBeLessThan(pageLink.y - pageLink.fontSize * .97);
        expect(code.every(node => node.fontSize >= 8)).toBe(true);
        expect(byline.every(node => node.fontSize >= 8)).toBe(true);
    });
});
