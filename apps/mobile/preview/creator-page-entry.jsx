/* Web-only build entry. Native code imports the generated HTML string, never this module. */
import React, { Component, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { V2Root } from '../../../components/v2/V2Root';
import { ShopLinkView } from '../../../components/v2/creators/ShopLinkContent';
import { AFFILIATE_MESSAGE_MAX_LENGTH, affiliatePhotoError, getAffiliateSocialLinks } from '../../../lib/affiliates';
import { WEBSITE_PRICE, clampSellPrice } from '../../../packages/shared/pricing';
import { PreviewStoreLinksProvider, normalizePreviewStoreLinks } from './store-links';

const VERSION = 1;
const root = createRoot(document.getElementById('creator-page-root'));
let revision = 0;

function notify(type, requestId, message) {
  const event = { type, version: VERSION };
  if (requestId !== undefined) event.requestId = requestId;
  if (message) event.message = message;
  window.ReactNativeWebView?.postMessage(JSON.stringify(event));
}

function text(value, limit, fallback = '') {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string' || value.length > limit) throw new Error('Invalid preview text.');
  return value.trim();
}

/** Only explicitly public page fields enter the document. Pricing is derived, never trusted. */
function normalizePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
      || !payload.card || typeof payload.card !== 'object' || Array.isArray(payload.card)) {
    throw new Error('Invalid preview payload.');
  }
  const input = payload.card;
  if (typeof input.price !== 'number' || !Number.isFinite(input.price)) throw new Error('Invalid preview price.');
  const price = clampSellPrice(input.price);
  const saving = Math.max(0, WEBSITE_PRICE - price);
  const photo = text(input.photo, 2048);
  const message = text(input.message, AFFILIATE_MESSAGE_MAX_LENGTH);
  const handle = text(input.handle, 30);
  const requestId = payload.requestId === undefined ? undefined : text(payload.requestId, 100);
  return {
    requestId,
    storeLinks: normalizePreviewStoreLinks(payload.storeLinks),
    card: {
      handle: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle) ? handle : '',
      name: text(input.name, 200, 'Tendso creator') || 'Tendso creator',
      photo: photo && !affiliatePhotoError(photo) ? photo : null,
      code: text(input.code, 100) || null,
      listPrice: WEBSITE_PRICE,
      price,
      saving,
      percentOff: saving > 0 ? Math.round((saving / WEBSITE_PRICE) * 100) : 0,
      ...(message ? { message } : {}),
      socialLinks: getAffiliateSocialLinks(input.socialLinks && typeof input.socialLinks === 'object'
        && !Array.isArray(input.socialLinks) ? input.socialLinks : {}),
    },
  };
}

class PreviewBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { notify('creator-preview-error', this.props.requestId, 'The page preview could not be displayed.'); }
  render() {
    return this.state.failed ? <p role="alert">The page preview could not be displayed.</p> : this.props.children;
  }
}

function PreviewDocument({ card, storeLinks, requestId, currentRevision }) {
  useEffect(() => {
    let active = true;
    Promise.resolve(document.fonts?.ready).then(() => {
      if (active && revision === currentRevision) notify('creator-preview-rendered', requestId);
    });
    return () => { active = false; };
  }, [requestId, currentRevision]);
  return <PreviewStoreLinksProvider value={storeLinks}>
    <V2Root className="cr ag cp cp-solo"><ShopLinkView card={card} /></V2Root>
  </PreviewStoreLinksProvider>;
}

function block(event) { event.preventDefault(); event.stopImmediatePropagation(); }
document.addEventListener('submit', block, true);
document.addEventListener('auxclick', block, true);
document.addEventListener('click', event => {
  const control = event.target?.closest?.('a,button,input,select,textarea,[role="button"]');
  if (!control) return;
  const href = control.tagName === 'A' ? control.getAttribute('href') : null;
  block(event);
  if (href?.startsWith('#')) {
    try { document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({ behavior: 'auto' }); }
    catch { /* A malformed anchor stays inert. */ }
  }
}, true);
window.open = () => null;
if (window.HTMLFormElement) {
  HTMLFormElement.prototype.submit = function () {};
  HTMLFormElement.prototype.requestSubmit = function () {};
}

window.__tendsoCreatorPreview = Object.freeze({
  version: VERSION,
  render(payload) {
    const currentRevision = ++revision;
    try {
      const normalized = normalizePayload(payload);
      root.render(<PreviewBoundary key={currentRevision} requestId={normalized.requestId}>
        <PreviewDocument {...normalized} currentRevision={currentRevision} />
      </PreviewBoundary>);
      window.scrollTo(0, 0);
      return true;
    } catch {
      root.render(null);
      const requestId = typeof payload?.requestId === 'string' && payload.requestId.length <= 100 ? payload.requestId : undefined;
      notify('creator-preview-error', requestId, 'Check your page details and try again.');
      return false;
    }
  },
});
notify('creator-preview-ready');
