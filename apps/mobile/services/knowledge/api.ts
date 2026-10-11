/**
 * Knowledge Base API layer.
 *
 * The KB backend (tables + queries + the Gemini RAG action) deploys from the
 * repository root. Mobile uses its canonical generated function references.
 *
 * Deployed functions used (all public / help-workspace is anonymous-safe):
 *   knowledge:canAccessWiki      (query)
 *   knowledge:listCategories     (query)  { workspace }
 *   knowledge:listArticles       (query)  { workspace }
 *   knowledge:listFaqs           (query)  { workspace }
 *   knowledge:recordFeedback     (mutation) { slug, helpful }
 *   knowledgeAI:ask              (action) { query, workspace, source?, history? }
 */
import { api } from '@tendso/convex-client';
import { useAction, useMutation, useQuery } from 'convex/react';

export type Workspace = 'help' | 'wiki';

// Article body — discriminated union on `t` (mirrors web schema kbBlock).
export type Block =
  | { t: 'p'; text: string }
  | { t: 'h2'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'ol'; items: string[] }
  | { t: 'callout'; kind: string; text: string }
  | { t: 'code'; lang: string; text: string }
  | { t: 'quote'; text: string; who: string }
  | { t: 'image'; caption: string };

export type Category = {
  _id: string;
  _creationTime: number;
  slug: string;
  title: string;
  description: string;
  icon: string;
  hue: string;
  workspace: Workspace;
  order?: number;
};

export type Article = {
  _id: string;
  _creationTime: number;
  slug: string;
  title: string;
  summary: string;
  categoryId: string;
  workspace: Workspace;
  body: Block[];
  keywords: string[];
  author: string;
  readMin: number;
  popular?: boolean;
  status: 'published' | 'draft';
  source?: string;
  createdAt: number;
  updatedAt: number;
  helpfulYes?: number;
  helpfulNo?: number;
};

export type Faq = {
  _id: string;
  _creationTime: number;
  workspace: Workspace;
  question: string;
  answer: string;
  linkArticleSlug?: string;
  order?: number;
};

export type AskResult = {
  answer: string;
  sources: { slug: string; title: string }[];
  grounded: boolean;
  escalated: boolean;
};

export type ChatTurn = { role: 'user' | 'assistant'; text: string };

// ── Canonical generated function references ──────────────────────────────────
const fn = {
  canAccessWiki: api.knowledge.canAccessWiki,
  listCategories: api.knowledge.listCategories,
  listArticles: api.knowledge.listArticles,
  listFaqs: api.knowledge.listFaqs,
  recordFeedback: api.knowledge.recordFeedback,
  ask: api.knowledgeAI.ask,
};

export function useCanAccessWiki(): boolean | undefined {
  return useQuery(fn.canAccessWiki, {}) as boolean | undefined;
}

export function useCategories(workspace: Workspace): Category[] | undefined {
  return useQuery(fn.listCategories, { workspace }) as Category[] | undefined;
}

export function useArticles(workspace: Workspace): Article[] | undefined {
  return useQuery(fn.listArticles, { workspace }) as Article[] | undefined;
}

export function useFaqs(workspace: Workspace): Faq[] | undefined {
  return useQuery(fn.listFaqs, { workspace }) as Faq[] | undefined;
}

export function useRecordFeedback() {
  const m = useMutation(fn.recordFeedback);
  return (args: { slug: string; helpful: boolean }) => m(args);
}

export function useAsk() {
  const a = useAction(fn.ask);
  return (args: {
    query: string;
    workspace: Workspace;
    source?: 'web' | 'chatbot' | 'discord';
    history?: ChatTurn[];
  }): Promise<AskResult> => a(args) as Promise<AskResult>;
}
