import fs from 'node:fs';
import path from 'node:path';
import { capturePreviewHtml } from '../services/capturePreviews';
import { CAPTURE_PREVIEW_CATALOG, LEGACY_CAPTURE_PREVIEW_CATALOG } from '../services/generated/capturePreviewCatalog';

const root = path.resolve(__dirname, '../../..');

it('keeps the approved native and board catalogs aligned with exactly three designs for all eight types', () => {
  const approved = JSON.parse(fs.readFileSync(path.join(root, 'public/capture-redesign/catalog.json'), 'utf8'));
  const legacy = JSON.parse(fs.readFileSync(path.join(root, 'public/capture-previews/catalog.json'), 'utf8'));
  expect(approved.designs).toEqual(CAPTURE_PREVIEW_CATALOG);
  expect(legacy.designs).toEqual(LEGACY_CAPTURE_PREVIEW_CATALOG);
  expect(CAPTURE_PREVIEW_CATALOG).toHaveLength(24);
  expect(LEGACY_CAPTURE_PREVIEW_CATALOG).toHaveLength(21);
  for (const category of ['barber', 'repair', 'spa', 'food', 'clinic', 'law', 'craft', 'other']) {
    expect(CAPTURE_PREVIEW_CATALOG.filter(design => design.category === category)).toHaveLength(3);
  }
  const metadata = fs.readFileSync(path.join(root, 'apps/mobile/services/generated/capturePreviewCatalog.ts'), 'utf8');
  expect(metadata.length).toBeLessThan(24000);
  expect(metadata).not.toContain('data:image');
});

it.each(CAPTURE_PREVIEW_CATALOG)('carries the approved $code website with its generated photos while offline', design => {
  const html = capturePreviewHtml(design.code);
  expect(html).not.toBeNull();
  expect(/^<!doctype html>/i.test(html!)).toBe(true);
  expect(html).toContain(`data-capture-layout="${design.style}"`);
  expect(html).toContain(design.businessName);
  expect(html).toContain('data:image/webp;base64,');
  expect(html).not.toContain('/capture-previews/photos/');
  expect(html).toContain('@font-face');
  expect(html).not.toContain('/capture-previews/fonts/');
  expect(html).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/);
  expect(html).not.toContain('asset:');
  expect(/(?:src|href)=["']\/_astro\//.test(html!)).toBe(false);
  const publicHtml = fs.readFileSync(path.join(root, 'public', design.preview), 'utf8');
  expect(publicHtml).toContain(design.businessName);
  expect(publicHtml).toContain(`data-capture-layout="${design.style}"`);
});

it.each(LEGACY_CAPTURE_PREVIEW_CATALOG)('preserves previously bundled $code examples and labels without requiring a connection', design => {
  const html = capturePreviewHtml(design.code);
  expect(html).toContain(design.businessName);
  expect(html).toContain(`data-page="${design.code.split(':')[1]}"`);
  expect(html).toContain('data:image/webp;base64,');
  expect(html).not.toContain('/capture-previews/photos/');
  expect(fs.existsSync(path.join(root, 'public', design.preview))).toBe(true);
});

it('stores fourteen shared generated photos once for all approved and legacy examples', () => {
  const generated = fs.readFileSync(path.join(root, 'apps/mobile/generated/capturePreviews.ts'), 'utf8');
  expect(generated.match(/data:image\/webp;base64,/g)).toHaveLength(14);
});

it.each(['barbershop:BP', 'florist:BR', 'F', 'CA', 'business:ca', ' business:CA ', 'barbershop:f', ' barbershop:F ', '__proto__', 'constructor', '', null, undefined, {}])(
  'leaves unsupported/saved %s designs on their existing hosted fallback', code => {
    expect(capturePreviewHtml(code)).toBeNull();
  },
);

it('keeps law and clinic examples appropriate instead of falling back to barber or general-shop samples', () => {
  for (const design of CAPTURE_PREVIEW_CATALOG.filter(design => ['law', 'clinic'].includes(design.category))) {
    const html = capturePreviewHtml(design.code)!;
    expect(html).toContain(design.category === 'law' ? 'Narra Legal Office' : 'Mabuti Family Clinic');
    expect(html).toContain(design.category === 'law' ? 'Consultation appointments' : 'Consultation');
    expect(html).toContain('Fictional');
    expect(html).not.toMatch(/Kanto Cuts|Haircut &amp; finish|Garden tidy-up|Wash House/);
  }
});
