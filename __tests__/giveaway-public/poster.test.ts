import { DEFAULT_POSTER_TARGET, posterTarget } from '@/lib/poster';

describe('printed poster QR destination', () => {
    it.each([null, undefined, '', 42, 'javascript:alert(1)', '//stranger.example', '/\\stranger.example', '/poster'])('keeps a usable default for invalid configuration %s', (value) => {
        expect(posterTarget(value)).toBe(DEFAULT_POSTER_TARGET);
    });
    it('accepts an updated internal destination with poster attribution', () => {
        expect(posterTarget('/otr?src=poster')).toBe('/otr?src=poster');
        expect(posterTarget(' /100-pages-giveaway?src=poster ')).toBe('/100-pages-giveaway?src=poster');
    });
    it('supports an operator-controlled HTTPS destination after the giveaway', () => {
        expect(posterTarget('https://tendso.com/knowledge?src=poster')).toBe('https://tendso.com/knowledge?src=poster');
    });
});
