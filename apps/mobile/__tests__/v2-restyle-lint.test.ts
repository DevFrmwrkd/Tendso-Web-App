/**
 * Rule #1 + design v2 guard for the restyled field-agent / creator / shared screens.
 *
 * Scans the source of every screen and component that has been moved to design v2 and fails on:
 *  - text under 16px (`fontSize: 14`, `text-xs`, `text-sm`, `text-[13px]`)
 *  - the old Editorial Paper fonts (serif, mono) and italics
 *  - the old gold palette hexes
 *  - stale copy ("Unlock higher pricing", "Launch price", "48-72 hours")
 *
 * Files that other streams own (root layout, capture flow, owner screens, admin) or that are
 * artwork rendered to an image (certificate, A4 poster) are listed in EXEMPT.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

const EXEMPT = [
  'app/_layout.tsx',
  'app/index.tsx',
  'app/+not-found.tsx',
  'app/v2-kit.tsx',
  'app/(app)/_layout.tsx',
  'app/(app)/onboarding.tsx', // orphan screen, nothing navigates to it
  'app/(app)/dashboard.tsx',
  'components/CertificateCard.tsx', // artwork captured as an image
  'components/TikTokLogo.tsx',
  'components/affiliate/ShareTools.tsx', // QR + A4 poster artwork captured as an image
  'components/ui/primitives.tsx', // legacy primitives, still used by the capture flow and admin
];
const EXEMPT_DIRS = ['app/(app)/submit/', 'app/(app)/admin/', 'components/admin/', 'components/v2/'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('._')) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|ts)$/.test(name)) out.push(full);
  }
  return out;
}

const files = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'components'))]
  .map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
  .filter((f) => !EXEMPT.includes(f) && !EXEMPT_DIRS.some((d) => f.startsWith(d)));

type Rule = { name: string; test: (src: string) => string[] };

const rules: Rule[] = [
  {
    name: 'font size under 16',
    test: (src) => {
      const hits: string[] = [];
      for (const m of src.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)/g)) if (Number(m[1]) < 16) hits.push(m[0]);
      for (const m of src.matchAll(/\btext-(?:xs|sm)\b/g)) hits.push(m[0]);
      for (const m of src.matchAll(/\btext-\[(\d+(?:\.\d+)?)px\]/g)) if (Number(m[1]) < 16) hits.push(m[0]);
      return hits;
    },
  },
  {
    name: 'old fonts or italics',
    test: (src) =>
      [...src.matchAll(/fonts\.(?:serif|serifIt|mono|monoMed|wordmark|wordmarkMed)\b|InstrumentSerif|JetBrainsMono|fontStyle:\s*['"]italic['"]/g)].map((m) => m[0]),
  },
  {
    name: 'old gold palette',
    test: (src) => [...src.matchAll(/#(?:C89548|E4B05E|F5E4C0|D9A84E|5C3A0F|F8F5EE|EFEBE0|FCFAF5)\b/gi)].map((m) => m[0]),
  },
  {
    name: 'stale copy',
    test: (src) => [...src.matchAll(/Unlock higher pricing|Launch price|48\s*[-–]\s*72\s*h/gi)].map((m) => m[0]),
  },
];

describe('design v2 restyle guard', () => {
  it('scans some files', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const rule of rules) {
    it(`no ${rule.name} in restyled screens`, () => {
      const failures: Record<string, string[]> = {};
      for (const f of files) {
        const hits = rule.test(fs.readFileSync(path.join(ROOT, f), 'utf8'));
        if (hits.length) failures[f] = hits.slice(0, 6);
      }
      expect(failures).toEqual({});
    });
  }
});
