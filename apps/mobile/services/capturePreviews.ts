import { CAPTURE_PREVIEW_ASSETS, CAPTURE_PREVIEW_DOCUMENTS } from '../generated/capturePreviews';

/**
 * A real Astro sample with its generated photos carried in the native bundle.
 * Saved canonical designs outside this catalog keep using their hosted preview.
 */
export function capturePreviewHtml(code: unknown): string | null {
  if (typeof code !== 'string' || !Object.prototype.hasOwnProperty.call(CAPTURE_PREVIEW_DOCUMENTS, code)) return null;
  return CAPTURE_PREVIEW_DOCUMENTS[code].replace(/\/capture-previews\/(?:photos|fonts)\/[a-z0-9-]+\.(?:webp|jpe?g|png|woff2)/g,
    url => CAPTURE_PREVIEW_ASSETS[url] ?? url);
}
