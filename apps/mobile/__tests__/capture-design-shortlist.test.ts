import { captureDesignByCode } from '../../../lib/captureDesign';
import { DESIGNS, type SellKindId } from '../lib/v2/ownerContent';
import { captureDesign, captureDesignChoices } from '../services/captureDesign';

const codesFor = (businessType?: string | null, selectedCode?: string | null) =>
  captureDesignChoices(businessType, selectedCode).map(design => design.code);

describe('field-agent design shortlist', () => {
  it.each<[string, string[]]>([
    ['Barber/Salon', ['barbershop:F', 'barbershop:I', 'barbershop:J', 'salonspa:L', 'salonspa:N', 'salonspa:K']],
    ['Spa/Massage', ['salonspa:L', 'salonspa:N', 'salonspa:K']],
    ['Auto Shop', ['autoshop:AF', 'autoshop:P', 'autoshop:AP']],
    ['Craft/Producer', ['woodworks:BV', 'woodworks:BW', 'florist:BS']],
    ['Restaurant', ['foodcraft:AL', 'foodcraft:BL', 'restaurant:U']],
    ['Other', ['generic:C', 'services:AS', 'generic:A']],
  ])('offers the curated designs for %s with canonical preview data', (businessType, expected) => {
    const choices = captureDesignChoices(businessType);
    expect(choices.map(design => design.code)).toEqual(expected);
    for (const design of choices) {
      const canonical = captureDesignByCode(design.code);
      expect(canonical).toBeDefined();
      expect(design).toEqual({ code: canonical!.code, name: canonical!.label,
        preview: `/capture-previews/${canonical!.code.split(':')[1].toLowerCase()}.html` });
    }
  });

  it.each([undefined, null, '', 'Clinic', 'Law Office', 'Unknown shop type'])(
    'keeps the existing fallback for %s business types', businessType => {
      expect(codesFor(businessType)).toEqual(['generic:C', 'services:AS', 'generic:A']);
    },
  );

  it('retains a saved canonical design outside the shortlist, including another category', () => {
    expect(codesFor('Auto Shop', 'autoshop:T')).toEqual(['autoshop:T', 'autoshop:AF', 'autoshop:P', 'autoshop:AP']);
    expect(codesFor('Restaurant', 'filipino:BC')).toEqual(['filipino:BC', 'foodcraft:AL', 'foodcraft:BL', 'restaurant:U']);
    expect(captureDesignChoices('Barber/Salon', ' florist:BR ')[0]).toEqual({
      code: 'florist:BR', name: 'Bloom', preview: '/template-previews/br.html',
    });
    expect(captureDesign('florist:BR')).not.toBeNull();
  });

  it('keeps a saved suggested design in its curated order without duplicating it', () => {
    expect(codesFor('Barber/Salon', 'salonspa:N')).toEqual([
      'barbershop:F', 'barbershop:I', 'barbershop:J', 'salonspa:L', 'salonspa:N', 'salonspa:K',
    ]);
    expect(codesFor('Auto Shop', ' autoshop:AF ')).toEqual(['autoshop:AF', 'autoshop:P', 'autoshop:AP']);
  });

  it.each(['AF', 'autoshop:missing', 'AUTOSHOP:AF', '', null, undefined])(
    'ignores an invalid saved code %s instead of upgrading or guessing it', selectedCode => {
      expect(codesFor('Auto Shop', selectedCode)).toEqual(['autoshop:AF', 'autoshop:P', 'autoshop:AP']);
      expect(captureDesign(selectedCode)).toBeNull();
    },
  );

  it('does not remove choices from the owner catalog or mutate its order', () => {
    const ownerCodes = Object.fromEntries(Object.entries(DESIGNS).map(([kind, designs]) =>
      [kind, designs.map(design => design.code)]));
    for (const businessType of ['Barber/Salon', 'Auto Shop', 'Craft/Producer', 'Restaurant', 'Other']) {
      captureDesignChoices(businessType, 'generic:A');
    }
    for (const kind of Object.keys(DESIGNS) as SellKindId[]) {
      expect(DESIGNS[kind].map(design => design.code)).toEqual(ownerCodes[kind]);
      expect(DESIGNS[kind]).toHaveLength(5);
    }
    expect(DESIGNS.barber.some(design => design.code === 'barbershop:BP')).toBe(true);
    expect(DESIGNS.salon.some(design => design.code === 'salonspa:AN')).toBe(true);
    expect(DESIGNS.repair.some(design => design.code === 'autoshop:AP')).toBe(true);
  });
});
