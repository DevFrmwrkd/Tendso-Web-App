import { colors, fonts, hit, MIN_FONT_SIZE, type as typeScale } from '../theme/v2';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tailwind = require('../tailwind.config.js');

describe('design v2 tokens', () => {
  it('never defines text under the 16px floor (Rule #1)', () => {
    for (const [name, style] of Object.entries(typeScale)) {
      expect({ name, size: style.fontSize >= MIN_FONT_SIZE }).toEqual({ name, size: true });
    }
  });

  it('uses Onest only', () => {
    for (const family of Object.values(fonts)) expect(family).toMatch(/^Onest_\d{3}/);
    for (const style of Object.values(typeScale)) expect(style.fontFamily).toMatch(/^Onest_/);
  });

  it('keeps primary hit targets at 56pt or more', () => {
    expect(hit.primary).toBeGreaterThanOrEqual(56);
    expect(hit.large).toBeGreaterThanOrEqual(56);
  });

  it('keeps tailwind `v2` colours in sync with theme/v2.ts', () => {
    const v2 = tailwind.theme.extend.colors.v2;
    const camel = (k: string) => k.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
    for (const [key, hex] of Object.entries(v2)) {
      expect({ key, hex }).toEqual({ key, hex: (colors as Record<string, string>)[camel(key)] });
    }
  });

  it('keeps tailwind v2 font sizes at or above the floor', () => {
    for (const [name, [size]] of Object.entries<[string, unknown]>(tailwind.theme.extend.fontSize)) {
      if (name.startsWith('v2-')) expect(parseInt(size, 10)).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
    }
  });

  it('keeps the legacy tailwind keys the existing screens rely on', () => {
    const extend = tailwind.theme.extend;
    expect(extend.colors.paper.DEFAULT).toBe('#F8F5EE');
    expect(extend.colors.emerald[500]).toBe('#E4B05E');
    expect(extend.fontFamily.sans).toEqual(['Onest_400Regular']);
    expect(extend.borderRadius.md).toBe('18px');
  });

  it('only ever uses accent as a fill: onAccent is ink', () => {
    expect(colors.onAccent).toBe(colors.ink);
  });
});
