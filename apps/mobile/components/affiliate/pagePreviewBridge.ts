import type { CreatorCard } from '../../../../lib/v2/creatorTypes';
import type { StoreLinks } from '../../../../lib/v2/appLinks';

export const CREATOR_PREVIEW_ORIGIN = 'https://creator-preview.tendso.invalid/';
export type PublicPreviewSnapshot = { card: CreatorCard; storeLinks: StoreLinks };

/** A static, bundled document can only remain on itself. It never visits a referral route. */
export function isCreatorPreviewNavigationAllowed(uri: string): boolean {
  if (uri === 'about:blank' || uri.startsWith('about:blank#')) return true;
  try {
    const url = new URL(uri);
    return url.origin === CREATOR_PREVIEW_ORIGIN.slice(0, -1) && url.pathname === '/' && !url.search && !url.username && !url.password;
  } catch { return false; }
}

export function creatorPreviewRenderScript(snapshot: PublicPreviewSnapshot, requestId: string): string {
  const json = JSON.stringify({ ...snapshot, requestId }).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `window.__tendsoCreatorPreview && window.__tendsoCreatorPreview.render(${json}); true;`;
}
