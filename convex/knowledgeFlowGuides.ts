import { ConvexError, v } from 'convex/values';
import { mutation, query, type QueryCtx, type MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import { requireAdmin } from './lib/auth';
import { resolveKnowledgeAccess, type KnowledgeAccess } from '../packages/shared/knowledge';
import { commonGuides } from './knowledgeContent/common';
import { ownerGuides } from './knowledgeContent/owners';
import { affiliateGuides } from './knowledgeContent/affiliates';
import { fieldAgentGuides } from './knowledgeContent/fieldAgents';
import type { KnowledgeGuide } from './knowledgeContent/types';

/** Curated from implemented app flows. Does not publish captured Discord/AI drafts. */
export const allFlowGuides: KnowledgeGuide[] = [...commonGuides, ...ownerGuides, ...affiliateGuides, ...fieldAgentGuides];
type Context = QueryCtx | MutationCtx;

function stable(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
    return JSON.stringify(value) ?? 'undefined';
}

function certificationMove(guide: KnowledgeGuide, existing?: Doc<'knowledgeArticles'>, category?: Doc<'knowledgeCategories'>): boolean {
    if (!existing || !category) return false;
    const article = resolveKnowledgeAccess(existing), parent = resolveKnowledgeAccess(category);
    return guide.slug === 'certification-quiz' && existing.workspace === 'wiki' && category.workspace === 'wiki'
        && guide.workspace === 'help' && article.audiences.includes('field_agent') && parent.audiences.includes('field_agent')
        && [...article.audiences, ...parent.audiences].every(audience => audience === 'field_agent' || audience === 'admin');
}

function articleAccess(guide: KnowledgeGuide, existing?: Doc<'knowledgeArticles'>, category?: Doc<'knowledgeCategories'>): KnowledgeAccess {
    if (!existing) return { audiences: guide.audiences, visibility: guide.visibility };
    const previous = resolveKnowledgeAccess(existing);
    // The certification guide contains onboarding instructions needed before
    // certification. Its reviewed replacement may move out of the old Wiki gate.
    return certificationMove(guide, existing, category) ? { audiences: guide.audiences, visibility: guide.visibility } : previous;
}

function contentFields(guide: KnowledgeGuide, existing?: Doc<'knowledgeArticles'>, category?: Doc<'knowledgeCategories'>) {
    return {
        title: guide.title, summary: guide.summary,
        body: guide.paragraphs.map(text => ({ t: 'p' as const, text })), keywords: guide.keywords,
        author: 'Tendso team', readMin: Math.max(1, Math.ceil(guide.paragraphs.join(' ').split(/\s+/).length / 220)),
        workspace: guide.workspace, status: 'published' as const, ...articleAccess(guide, existing, category),
    };
}

async function plan(ctx: Context) {
    const rows = await ctx.db.query('knowledgeArticles').collect();
    const categories = await ctx.db.query('knowledgeCategories').collect();
    const faqs = await ctx.db.query('knowledgeFaqs').collect();
    const articles = allFlowGuides.map(guide => {
        const existing = rows.find(row => row.slug === guide.slug);
        const previousCategory = categories.find(row => row._id === existing?.categoryId);
        const fields = contentFields(guide, existing, previousCategory);
        const category = categories.find(row => row.slug === guide.categorySlug);
        const duplicate = rows.filter(row => row.slug === guide.slug).length > 1 || categories.filter(row => row.slug === guide.categorySlug).length > 1;
        const approvedMove = certificationMove(guide, existing, previousCategory);
        const restrictedMove = !!existing && !approvedMove && (existing.workspace !== guide.workspace || !previousCategory
            || previousCategory._id !== category?._id && resolveKnowledgeAccess(previousCategory).visibility !== 'public');
        const blocked = duplicate || restrictedMove || !!existing && (existing.source === 'qa' || existing.status !== 'published')
            || !!category && category.workspace !== guide.workspace;
        const before = existing && Object.fromEntries(Object.keys(fields).map(key => [key, existing[key as keyof typeof existing]]));
        const unchanged = !!existing && stable(before) === stable(fields) && existing.categoryId === category?._id;
        return {
            slug: guide.slug, title: guide.title, categorySlug: guide.categorySlug,
            workspace: fields.workspace, audiences: fields.audiences, visibility: fields.visibility,
            action: blocked ? 'blocked' as const : !existing ? 'create' as const : unchanged ? 'unchanged' as const : 'update' as const,
            updatedAt: existing?.updatedAt ?? null,
        };
    });
    const linkedFaqs = faqs.flatMap(faq => {
        const guide = allFlowGuides.find(item => item.slug === faq.linkArticleSlug);
        return guide && faq.answer !== guide.summary ? [{ id: faq._id, question: faq.question, answer: faq.answer, newAnswer: guide.summary }] : [];
    });
    return { articles, faqs: linkedFaqs };
}

export const preview = query({ args: {}, handler: async ctx => { await requireAdmin(ctx); return plan(ctx); } });

function categoryAccess(guides: KnowledgeGuide[]): KnowledgeAccess {
    const audiences = [...new Set(guides.flatMap(guide => guide.audiences))];
    return { audiences: audiences.includes('everyone') ? ['everyone'] : audiences,
        visibility: guides.some(guide => guide.visibility === 'public') ? 'public'
            : guides.some(guide => guide.visibility === 'authenticated') ? 'authenticated' : 'internal' };
}

export const publish = mutation({
    args: {
        articles: v.array(v.object({ slug: v.string(), updatedAt: v.union(v.number(), v.null()) })),
        faqs: v.array(v.object({ id: v.id('knowledgeFaqs'), answer: v.string() })),
    },
    handler: async (ctx, expected) => {
        await requireAdmin(ctx);
        const current = await plan(ctx);
        if (expected.articles.length !== current.articles.length || new Set(expected.articles.map(row => row.slug)).size !== current.articles.length
            || current.articles.some(row => !expected.articles.some(guard => guard.slug === row.slug && guard.updatedAt === row.updatedAt))) {
            throw new ConvexError('The knowledge articles changed. Refresh the preview before publishing.');
        }
        if (current.articles.some(row => row.action === 'blocked')) throw new ConvexError('A draft, captured answer, duplicate slug or restricted category/collection move needs manual review.');
        if (expected.faqs.length !== current.faqs.length || new Set(expected.faqs.map(row => row.id)).size !== current.faqs.length
            || current.faqs.some(row => !expected.faqs.some(guard => guard.id === row.id && guard.answer === row.answer))) {
            throw new ConvexError('The linked FAQ answers changed. Refresh the preview before publishing.');
        }
        const categories = await ctx.db.query('knowledgeCategories').collect();
        const groups = new Map<string, KnowledgeGuide[]>();
        for (const guide of allFlowGuides) groups.set(guide.categorySlug, [...(groups.get(guide.categorySlug) ?? []), guide]);
        for (const [slug, guides] of groups) {
            if (categories.some(category => category.slug === slug)) continue;
            const id = await ctx.db.insert('knowledgeCategories', { slug, title: guides[0].categoryTitle, description: `Current guidance for ${guides[0].categoryTitle.toLowerCase()}.`,
                icon: 'help', hue: 'blue', workspace: guides[0].workspace, ...categoryAccess(guides) });
            categories.push((await ctx.db.get(id))!);
        }
        let created = 0, updated = 0;
        for (const entry of current.articles) {
            if (entry.action === 'unchanged') continue;
            const guide = allFlowGuides.find(row => row.slug === entry.slug)!;
            const existing = await ctx.db.query('knowledgeArticles').withIndex('by_slug', q => q.eq('slug', guide.slug)).first();
            const category = categories.find(row => row.slug === guide.categorySlug)!;
            const previousCategory = categories.find(row => row._id === existing?.categoryId);
            const fields = { ...contentFields(guide, existing ?? undefined, previousCategory), categoryId: category._id,
                updatedAt: Date.now(), embedding: undefined, embeddingUpdatedAt: undefined };
            const id = existing ? existing._id : await ctx.db.insert('knowledgeArticles', { ...fields, slug: guide.slug, source: 'article', createdAt: Date.now() });
            if (existing) { await ctx.db.patch(existing._id, fields); updated++; } else created++;
            // Index the actual published content for semantic retrieval. Tests
            // leave these scheduled jobs pending; no model is called for QA.
            await ctx.scheduler.runAfter(0, internal.knowledgeAI.generateEmbeddingForArticle, { articleId: id });
        }
        for (const faq of current.faqs) await ctx.db.patch(faq.id, { answer: faq.newAnswer });
        return { created, updated, unchanged: current.articles.filter(row => row.action === 'unchanged').length,
            faqsUpdated: current.faqs.length, total: current.articles.length };
    },
});
