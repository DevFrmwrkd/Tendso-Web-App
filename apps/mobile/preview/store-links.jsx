import React, { createContext, useContext } from 'react';
import { RELEASED_STORE_LINKS, safeStoreUrl } from '../../../lib/v2/appLinks';

const PreviewStoreLinks = createContext(RELEASED_STORE_LINKS);
export const PreviewStoreLinksProvider = PreviewStoreLinks.Provider;

export function normalizePreviewStoreLinks(input) {
  return {
    appStore: safeStoreUrl(input?.appStore, RELEASED_STORE_LINKS.appStore),
    googlePlay: safeStoreUrl(input?.googlePlay, RELEASED_STORE_LINKS.googlePlay),
  };
}

/** Build-time replacement for creatorData: no Clerk, Convex, attribution, or environment reads. */
export function useStoreLinks() { return useContext(PreviewStoreLinks); }
