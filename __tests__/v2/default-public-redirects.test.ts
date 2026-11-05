import LegacyCreators from '@/app/creators/page';
import LegacyForCreators from '@/app/for-creators/page';
import LegacyFaq from '@/app/help-faq/page';

const mockRedirect = jest.fn((to: string): never => { throw new Error(to); });
jest.mock('next/navigation', () => ({ permanentRedirect: (to: string) => mockRedirect(to) }));
beforeEach(() => mockRedirect.mockClear());

describe('default public route compatibility', () => {
    it.each([
        ['creators', LegacyCreators],
        ['for-creators', LegacyForCreators],
    ] as const)('keeps referral and repeated campaign parameters on the legacy %s page', async (_name, Page) => {
        const searchParams = Promise.resolve({ ref: 'MIKA30', src: ['video', 'poster'], utm_campaign: 'owner growth', ignored: undefined });
        await expect(Page({ searchParams })).rejects.toThrow('/for-field-agents?ref=MIKA30&src=video&src=poster&utm_campaign=owner+growth');
        expect(mockRedirect).toHaveBeenCalledTimes(1);
    });

    it.each([LegacyCreators, LegacyForCreators])('does not append an empty query or follow a supplied redirect destination', async Page => {
        await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow('/for-field-agents');
        expect(mockRedirect).toHaveBeenLastCalledWith('/for-field-agents');
        await expect(Page({ searchParams: Promise.resolve({ redirect_url: 'https://example.invalid' }) })).rejects.toThrow('/for-field-agents?redirect_url=https%3A%2F%2Fexample.invalid');
        expect(mockRedirect).toHaveBeenLastCalledWith('/for-field-agents?redirect_url=https%3A%2F%2Fexample.invalid');
    });

    it('opens the redesigned help answers while retaining old FAQ campaign parameters', async () => {
        await expect(LegacyFaq({ searchParams: Promise.resolve({ src: ['poster', 'video'], ref: 'MIKA30' }) })).rejects.toThrow('/help?src=poster&src=video&ref=MIKA30#answers');
        expect(mockRedirect).toHaveBeenLastCalledWith('/help?src=poster&src=video&ref=MIKA30#answers');
    });

    it('keeps the FAQ answers fragment when there is no query', async () => {
        await expect(LegacyFaq({ searchParams: Promise.resolve({}) })).rejects.toThrow('/help#answers');
        expect(mockRedirect).toHaveBeenLastCalledWith('/help#answers');
    });
});
