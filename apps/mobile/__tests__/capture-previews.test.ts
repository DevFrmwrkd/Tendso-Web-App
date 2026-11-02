import fs from 'node:fs';
import path from 'node:path';
import { capturePreviewHtml } from '../services/capturePreviews';
import { CAPTURE_PREVIEW_CATALOG } from '../services/generated/capturePreviewCatalog';

const root = path.resolve(__dirname, '../../..');

it('keeps the native and board catalogs aligned with three real designs per category', () => {
  const publicCatalog = JSON.parse(fs.readFileSync(path.join(root, 'public/capture-previews/catalog.json'), 'utf8'));
  expect(publicCatalog.designs).toEqual(CAPTURE_PREVIEW_CATALOG);
  expect(CAPTURE_PREVIEW_CATALOG).toHaveLength(18);
  for (const category of ['barber', 'salon', 'repair', 'craft', 'food', 'other']) {
    expect(CAPTURE_PREVIEW_CATALOG.filter(design => design.category === category)).toHaveLength(3);
  }
  const metadata = fs.readFileSync(path.join(root, 'apps/mobile/services/generated/capturePreviewCatalog.ts'), 'utf8');
  expect(metadata.length).toBeLessThan(10000);
  expect(metadata).not.toContain('data:image');
});

it.each(CAPTURE_PREVIEW_CATALOG)('carries the actual $code example and its generated photos without a hosted document', design => {
  const html = capturePreviewHtml(design.code);
  expect(html).not.toBeNull();
  expect(/^<!doctype html>/i.test(html!)).toBe(true);
  expect(html).toContain(`data-page="${design.code.split(':')[1]}"`);
  expect(html).toContain(design.businessName);
  expect(html).toContain('data:image/webp;base64,');
  expect(html).not.toContain('/capture-previews/photos/');
  expect(html).not.toContain('asset:');
  expect(/(?:src|href)=["']\/_astro\//.test(html!)).toBe(false);
  const publicHtml = fs.readFileSync(path.join(root, 'public', design.preview), 'utf8');
  expect(publicHtml).toContain(design.businessName);
  expect(publicHtml).toContain('data-astro-cid-');
});

it('stores each generated photo once in the native module', () => {
  const generated = fs.readFileSync(path.join(root, 'apps/mobile/generated/capturePreviews.ts'), 'utf8');
  expect(generated.match(/data:image\/webp;base64,/g)).toHaveLength(10);
});

it.each(['barbershop:BP', 'florist:BR', 'generic:B', 'F', 'barbershop:f', ' barbershop:F ', '__proto__', 'constructor', '', null, undefined, {}])(
  'leaves unsupported/saved %s designs on their existing hosted fallback', code => {
    expect(capturePreviewHtml(code)).toBeNull();
  },
);
