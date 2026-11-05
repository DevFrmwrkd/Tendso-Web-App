import type { KnowledgeAudience, KnowledgeVisibility, KnowledgeWorkspace } from '../../packages/shared/knowledge';

/** Editorial content reviewed against the implemented flow, never inferred from mock screens. */
export type KnowledgeGuide = {
    slug: string;
    title: string;
    summary: string;
    paragraphs: string[];
    keywords: string[];
    audiences: KnowledgeAudience[];
    visibility: KnowledgeVisibility;
    workspace: KnowledgeWorkspace;
    categorySlug: string;
    categoryTitle: string;
};
