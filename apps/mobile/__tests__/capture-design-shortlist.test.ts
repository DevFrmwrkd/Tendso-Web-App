import { captureDesignByCode, normalizeCaptureBusinessType } from '../../../lib/captureDesign';
import { DESIGNS, type SellKindId } from '../lib/v2/ownerContent';
import { captureDesign, captureDesignChoices, captureDesignMatchesBusinessType } from '../services/captureDesign';

const codesFor = (businessType?: string | null, selectedCode?: string | null) =>
  captureDesignChoices(businessType, selectedCode).map(design => design.code);
const groups: [string, string, string[]][] = [
  ['Barber/Salon', 'barber', ['business:CA', 'business:CB', 'business:CC']],
  ['Auto Shop', 'repair', ['business:CD', 'business:CE', 'business:CF']],
  ['Spa/Massage', 'spa', ['business:CG', 'business:CH', 'business:CI']],
  ['Restaurant', 'food', ['business:CJ', 'business:CK', 'business:CL']],
  ['Clinic', 'clinic', ['business:CM', 'business:CN', 'business:CO']],
  ['Law Office', 'law', ['business:CP', 'business:CQ', 'business:CR']],
  ['Craft/Producer', 'craft', ['business:CS', 'business:CT', 'business:CU']],
  ['Other', 'other', ['business:CV', 'business:CW', 'business:CX']],
];

describe('approved field-agent designs', () => {
  it.each(groups)('offers exactly three approved designs for %s', (businessType, category, expected) => {
    const choices = captureDesignChoices(businessType);
    expect(choices.map(design => design.code)).toEqual(expected);
    expect(choices.map(design => design.name)).toEqual(['Editorial', 'Immersive', 'Studio']);
    expect(choices.map(design => design.preview)).toEqual(['editorial', 'immersive', 'studio']
      .map(style => `/capture-redesign/${category}-${style}.html`));
    for (const design of choices) {
      expect(captureDesignByCode(design.code)).toBeDefined();
      expect(captureDesignMatchesBusinessType(businessType, design.code)).toBe(true);
      expect(captureDesign(design.code)).toEqual(design);
    }
  });

  it('gives Clinic its own three designs instead of general shop examples', () => {
    expect(codesFor('Clinic')).toEqual(['business:CM', 'business:CN', 'business:CO']);
    expect(codesFor('Clinic')).not.toEqual(codesFor('Other'));
  });

  it.each([undefined, null, '', 'Unknown shop type'])('uses the general-business designs for %s', businessType => {
    expect(codesFor(businessType)).toEqual(['business:CV', 'business:CW', 'business:CX']);
  });

  it.each([
    ['Food', 'Restaurant'], ['Sari-Sari Store', 'Other'], ['Clinic / Dental', 'Clinic'],
    ['  Law Office  ', 'Law Office'], ['Personal injury attorney', 'Law Office'],
    ['Hair salon', 'Barber/Salon'], ['Massage', 'Spa/Massage'], ['Auto repair', 'Auto Shop'],
    ['Furniture producer', 'Craft/Producer'],
  ])('uses the same approved designs for legacy category %s and %s', (alias, canonical) => {
    expect(normalizeCaptureBusinessType(alias)).toBe(canonical);
    expect(codesFor(alias)).toEqual(codesFor(canonical));
    for (const code of codesFor(canonical)) expect(captureDesignMatchesBusinessType(alias, code)).toBe(true);
  });

  it('keeps cross-trade rejection strict after normalizing legacy categories', () => {
    expect(captureDesignMatchesBusinessType('Personal injury attorney', 'business:CA')).toBe(false);
    expect(captureDesignMatchesBusinessType('Hair salon', 'business:CP')).toBe(false);
    expect(captureDesignMatchesBusinessType('Food', 'business:CA')).toBe(false);
    expect(captureDesignMatchesBusinessType('Clinic / Dental', 'business:CA')).toBe(false);
    expect(normalizeCaptureBusinessType({ category: 'Law Office' })).toBe('Other');
  });

  it('never retains an approved design from another business type', () => {
    for (const [type, , ownCodes] of groups) for (const [otherType, , otherCodes] of groups) {
      if (type === otherType) continue;
      for (const code of otherCodes) {
        expect(captureDesignMatchesBusinessType(type, code)).toBe(false);
        expect(codesFor(type, code)).toEqual(ownCodes);
      }
    }
  });

  it('keeps a saved approved design in its curated order without duplicating it', () => {
    for (const [type, , expected] of groups) for (const code of expected) expect(codesFor(type, code)).toEqual(expected);
  });

  it('preserves same-category legacy choices and their original sample names/paths', () => {
    expect(codesFor('Auto Shop', 'autoshop:T')).toEqual(['autoshop:T', 'business:CD', 'business:CE', 'business:CF']);
    expect(codesFor('Restaurant', 'filipino:BC')).toEqual(['filipino:BC', 'business:CJ', 'business:CK', 'business:CL']);
    expect(captureDesignChoices('Barber/Salon', ' barbershop:BP ')[0]).toEqual({
      code: 'barbershop:BP', name: 'Glacier', preview: '/template-previews/bp.html',
    });
    expect(captureDesign('barbershop:F')).toEqual({ code: 'barbershop:F', name: 'Forge', preview: '/capture-previews/f.html' });
    expect(captureDesign('generic:E')).toEqual({ code: 'generic:E', name: 'Clearview', preview: '/capture-previews/e.html' });
    expect(captureDesignByCode('generic:E')?.label).toBe('Wash House');
    expect(codesFor('Law Office', 'generic:E')[0]).toBe('generic:E');
    expect(codesFor('Clinic', 'generic:C')[0]).toBe('generic:C');
    expect(codesFor('Clinic', 'medical:AQ')[0]).toBe('medical:AQ');
    expect(codesFor('Spa/Massage', 'salonspa:N')[0]).toBe('salonspa:N');
    expect(codesFor('Barber/Salon', 'salonspa:N')[0]).toBe('salonspa:N');
  });

  it.each([
    ['Law Office', 'barbershop:F'], ['Law Office', 'salonspa:N'], ['Law Office', 'generic:A'],
    ['Other', 'generic:B'], ['Other', 'generic:D'], ['Other', 'generic:E'],
    ['Restaurant', 'autoshop:AF'], ['Craft/Producer', 'foodcraft:AL'],
    ['Spa/Massage', 'barbershop:I'], ['Barber/Salon', 'florist:BR'],
  ])('does not retain %s’s incompatible legacy design %s', (type, code) => {
    expect(captureDesignMatchesBusinessType(type, code)).toBe(false);
    expect(codesFor(type, code)).not.toContain(code);
    expect(captureDesign(code)).not.toBeNull();
  });

  it.each(['CA', 'business:missing', 'BUSINESS:CA', 'business:ca', '', null, undefined])(
    'ignores invalid saved code %s without guessing it', selectedCode => {
      expect(codesFor('Auto Shop', selectedCode)).toEqual(['business:CD', 'business:CE', 'business:CF']);
      expect(captureDesign(selectedCode)).toBeNull();
    },
  );

  it('does not mutate the owner catalog or its current choice order', () => {
    const before = Object.fromEntries(Object.entries(DESIGNS).map(([kind, choices]) => [kind, choices.map(choice => choice.code)]));
    for (const [type] of groups) captureDesignChoices(type, 'generic:A');
    for (const kind of Object.keys(DESIGNS) as SellKindId[]) expect(DESIGNS[kind].map(choice => choice.code)).toEqual(before[kind]);
  });
});
