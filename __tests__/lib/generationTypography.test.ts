import { transformToAstroData } from '@/lib/astro-builder';
import { generationFontDefaults } from '@/lib/generationTypography';
import { resolveBusiness } from '../../astro-site-template/src/components/capture-redesign/business';

const content = {
    business_name: 'Fictional QA Studio', business_type: 'Law Office', tagline: 'A clear next step.',
    location: { lat: 14.65, lng: 121.04 },
};

async function generatedBusiness(heroStyle: string, explicit: { fontPairing?: string; fontPairingId?: string } = {}) {
    return resolveBusiness(await transformToAstroData(content as any, {
        ...generationFontDefaults(heroStyle, explicit), ...explicit, heroStyle,
    }, []));
}

describe('generation typography through the real Astro transform', () => {
    it('retains the approved native typefaces when a new capture chooses a business design', async () => {
        const business = await generatedBusiness('business:CP');
        expect(business.hasFontOverride).toBe(false);
        expect(business.overrideFontHref).toBeNull();
        expect(business.overrideCss).toBe('');
    });

    it('preserves the existing modern default for legacy generation', async () => {
        const business = await generatedBusiness('barbershop:F');
        expect(business.hasFontOverride).toBe(true);
        expect(business.overrideFontHref).toContain('Space+Grotesk');
    });

    it.each(['fontPairing', 'fontPairingId'] as const)('honors an explicit %s without the other alias masking it', async (key) => {
        const business = await generatedBusiness('business:CP', { [key]: 'classic' });
        expect(business.hasFontOverride).toBe(true);
        expect(business.overrideFontHref).toContain('Playfair+Display');
        expect(business.overrideFontHref).not.toContain('Space+Grotesk');
    });

    it.each(['fontPairing', 'fontPairingId'] as const)('keeps explicit auto in %s', async (key) => {
        expect((await generatedBusiness('business:CP', { [key]: 'auto' })).hasFontOverride).toBe(false);
    });

    it('retains precedence when both saved aliases are present', async () => {
        const business = await generatedBusiness('business:CP', { fontPairing: 'modern', fontPairingId: 'classic' });
        expect(business.overrideFontHref).toContain('Playfair+Display');
    });
});
