import fs from 'fs';
import path from 'path';
import { hasSiteHome, nextStep, phaseLine, resumeStep, startProgress, STEP_ROUTE, todayAction, type OwnerStep } from '../lib/v2/ownerFlow';
import { DESIGNS, SELL_KINDS, designsFor, freeAddress, hostOf, peso, sellKindFromServer, slugGuess } from '../lib/v2/ownerContent';
import { canPayPart, clampDownPayment, maxDownPayment, parsePayChoice, stepDownPayment, suggestedDownPayment } from '../lib/v2/payMath';
import { BUSINESS_TYPES } from '../services/prospectPrefill';
import type { OwnerPhase } from '../lib/v2/ownerTypes';

const APP = path.join(__dirname, '..', 'app');
const REPO = path.join(__dirname, '..', '..', '..');

/** '/(owner)/start/sell' → app/(owner)/start/sell.tsx or …/index.tsx */
function routeFile(route: string): string | null {
  const rel = route.replace(/^\//, '');
  for (const f of [`${rel}.tsx`, `${rel}/index.tsx`]) {
    if (fs.existsSync(path.join(APP, f))) return f;
  }
  return null;
}

describe('owner flow order', () => {
  it('follows the owner board: sell → place → how → talk → photos → design → building → check → pay → live → home', () => {
    const seen: OwnerStep[] = [];
    let s: OwnerStep = 'sell';
    while (s !== 'home' && seen.length < 30) {
      seen.push(s);
      s = nextStep(s);
    }
    expect(seen).toEqual([
      'sell', 'place', 'how', 'talk-intro', 'talk', 'talk-done', 'photos-intro', 'photos', 'photos-done',
      'design', 'building', 'check', 'pay', 'live',
    ]);
    expect(nextStep('change')).toBe('building');
    expect(nextStep('home')).toBe('home');
  });

  it('every step has a screen file', () => {
    Object.values(STEP_ROUTE).forEach((route) => {
      expect(routeFile(route)).not.toBeNull();
    });
  });

  it('shows the three start questions as a 1/3 · 2/3 · 3/3 bar', () => {
    expect(startProgress('sell')).toBeCloseTo(1 / 3);
    expect(startProgress('how')).toBe(1);
    expect(startProgress('design')).toBeUndefined();
  });
});

describe('resume', () => {
  it('starts new owners at the first question', () => {
    expect(resumeStep(null)).toBe('sell');
  });

  it('resumes a draft at the first missing piece', () => {
    expect(resumeStep('draft', null)).toBe('sell');
    const base = { businessName: 'Forge', businessType: 'Barber/Salon', answered: 0, photos: 0 };
    expect(resumeStep('draft', base)).toBe('talk-intro');
    expect(resumeStep('draft', { ...base, answered: 11 })).toBe('photos-intro');
    expect(resumeStep('draft', { ...base, answered: 11, photos: 2 })).toBe('photos-intro');
    expect(resumeStep('draft', { ...base, answered: 11, photos: 3 })).toBe('design');
  });

  it('sends every server phase to the right screen', () => {
    const want: Record<OwnerPhase, OwnerStep> = {
      draft: 'sell',
      building: 'building',
      changes_requested: 'building',
      ready_to_check: 'check',
      awaiting_payment: 'pay',
      publishing: 'live',
      live: 'home',
      offline: 'home',
      in_review: 'home',
      rejected: 'home',
    };
    (Object.keys(want) as OwnerPhase[]).forEach((p) => expect(resumeStep(p)).toBe(want[p]));
  });

  it('gives Today one short action per phase', () => {
    (['draft', 'building', 'ready_to_check', 'awaiting_payment', 'live', null] as (OwnerPhase | null)[]).forEach((p) => {
      const a = todayAction(p);
      expect(a.label.split(' ').length).toBeLessThanOrEqual(4);
      expect(phaseLine(p).length).toBeGreaterThan(0);
    });
    expect(todayAction('ready_to_check').step).toBe('check');
    expect(hasSiteHome('live')).toBe(true);
    expect(hasSiteHome('draft')).toBe(false);
  });
});

describe('owner content', () => {
  it('maps every kind to a backend business type', () => {
    SELL_KINDS.forEach((k) => expect(BUSINESS_TYPES).toContain(k.businessType));
    expect(SELL_KINDS[0].id).toBe('barber'); // crafts first, food never the lead example
    expect(sellKindFromServer('Auto Shop', null).id).toBe('repair');
    expect(sellKindFromServer('Barber/Salon', 'salon').id).toBe('salon');
    expect(sellKindFromServer('???', null).id).toBe('other');
  });

  it('only offers real designs that exist in the web template catalogue and previews', () => {
    const catalog = fs.readFileSync(path.join(REPO, 'components', 'editor', 'templateCatalog.ts'), 'utf8');
    Object.values(DESIGNS).forEach((list) => {
      expect(list.length).toBeGreaterThanOrEqual(3);
      list.forEach((d) => {
        expect(catalog).toContain(`code: "${d.code}"`);
        expect(catalog).toContain(`preview: "${d.preview}"`);
        expect(fs.existsSync(path.join(REPO, 'public', d.preview))).toBe(true);
      });
    });
    expect(designsFor(undefined)).toBe(DESIGNS.other);
  });

  it('formats money and the free address', () => {
    expect(peso(4999)).toBe('₱4,999');
    expect(slugGuess('Héla Hair Studio!')).toBe('helahairstudio');
    expect(slugGuess('')).toBe('myshop');
    expect(freeAddress('forge')).toBe('forge.sites.tendso.com');
    expect(hostOf('https://forge.sites.tendso.com/')).toBe('forge.sites.tendso.com');
    expect(hostOf(null)).toBeNull();
  });
});

describe('down payment maths', () => {
  it('allows ₱500 up to one step under the price', () => {
    expect(maxDownPayment(4999)).toBe(4500);
    expect(canPayPart(4999)).toBe(true);
    expect(canPayPart(999)).toBe(true);
    expect(canPayPart(500)).toBe(false);
    expect(clampDownPayment(100, 4999)).toBe(500);
    expect(clampDownPayment(9999, 4999)).toBe(4500);
    expect(clampDownPayment(1240, 4999)).toBe(1000);
    expect(stepDownPayment(500, -1, 4999)).toBe(500);
    expect(stepDownPayment(500, 1, 4999)).toBe(1000);
    expect(suggestedDownPayment(4999)).toBe(1000);
  });

  it('parses the pay screen params safely', () => {
    expect(parsePayChoice('full', '1', 4999, 0)).toEqual({ kind: 'full', amount: 4999 });
    expect(parsePayChoice('deposit', '1500', 4999, 0)).toEqual({ kind: 'deposit', amount: 1500 });
    expect(parsePayChoice('deposit', 'abc', 4999, 0)).toBeNull();
    expect(parsePayChoice('balance', '0', 4999, 3999)).toEqual({ kind: 'balance', amount: 3999 });
    expect(parsePayChoice('balance', '0', 4999, 0)).toBeNull();
    expect(parsePayChoice('weird', '1', 4999, 0)).toBeNull();
  });
});
