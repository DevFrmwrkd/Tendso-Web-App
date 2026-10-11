import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  useArticles,
  useCanAccessWiki,
  useCategories,
  useFaqs,
  type Article,
  type Category,
  type Faq,
  type Workspace,
} from './api';

type KnowledgeCtx = {
  workspace: Workspace;
  setWorkspace: (w: Workspace) => void;
  canAccessWiki: boolean | undefined;
  categories: Category[];
  articles: Article[];
  faqs: Faq[];
  loading: boolean;
};

const Ctx = createContext<KnowledgeCtx | null>(null);

/**
 * Loads the KB corpus once (categories/articles/faqs) for the active workspace
 * and holds the help/wiki toggle — shared across all KB screens. Mirrors the
 * web KnowledgeApp's single data load; Convex caches so screens reuse it.
 */
export function KnowledgeProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace>('help');
  const canAccessWiki = useCanAccessWiki();
  const categories = useCategories(workspace);
  const articles = useArticles(workspace);
  const faqs = useFaqs(workspace);
  const loading = categories === undefined || articles === undefined || faqs === undefined;

  const value = useMemo<KnowledgeCtx>(
    () => ({
      workspace,
      setWorkspace,
      canAccessWiki,
      categories: categories ?? [],
      articles: articles ?? [],
      faqs: faqs ?? [],
      loading,
    }),
    [workspace, canAccessWiki, categories, articles, faqs, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useKnowledge(): KnowledgeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useKnowledge must be used within KnowledgeProvider');
  return ctx;
}
