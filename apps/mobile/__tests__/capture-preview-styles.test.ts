import fs from 'node:fs';
import path from 'node:path';
import { capturePreviewCss } from '../services/capturePreviewStyles';

const root = path.resolve(__dirname, '../../..');
const normalized = (value: string) => value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, '');

/** Compare whole media blocks, including their breakpoints and selector grouping. */
function mediaBlocks(css: string): string[] {
  const value = normalized(css);
  const blocks: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    if (value[index] === '{') depth++;
    if (value[index] === '}' && --depth === 0) {
      blocks.push(value.slice(start, index + 1));
      start = index + 1;
    }
  }
  expect(depth).toBe(0);
  expect(start).toBe(value.length);
  return blocks;
}

it.each([
  ['barbershop:I', 'i', 'templates/Barbershop/forge-minimal.html'],
  ['salonspa:L', 'l', 'templates/SalonSpa/02-Botanica.html'],
  ['salonspa:N', 'n', 'templates/SalonSpa/04-Vogue.html'],
  ['generic:C', 'c', 'templates/Generic Landing Pages for Local business/03 Cedar & Stone.html'],
])('ships the exact source/public phone CSS for %s', (code, letter, source) => {
  const blocks = mediaBlocks(capturePreviewCss(code));
  expect(blocks.length).toBeGreaterThan(0);
  for (const file of [source, `public/template-previews/${letter}.html`]) {
    const html = normalized(fs.readFileSync(path.join(root, file), 'utf8'));
    for (const block of blocks) {
      expect(block.startsWith('@media(max-width:')).toBe(true);
      expect(html).toContain(block);
    }
  }
});

it.each([
  'barbershop:F', 'barbershop:BP', 'salonspa:AN', 'generic:A',
  'I', 'barbershop:i', ' barbershop:I ', 'unknown:C',
  '__proto__', 'constructor', 'toString', '', null, undefined, 42, {}, [],
])('does not guess sample CSS for unsupported code %s', code => {
  expect(capturePreviewCss(code)).toBe('');
});
