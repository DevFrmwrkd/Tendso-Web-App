"use client";

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button, Container } from '@/components/v2';
import { PbPage } from '@/components/v2/pages-b/shared';
import { useKnowledgeSession } from '@/components/v2/chat/useKnowledgeSession';
import { KnowledgeArticle } from './KnowledgeArticle';

/** Private bodies are never embedded in public cached HTML or page metadata. */
export function PrivateKnowledgeArticle({ slug }: { slug: string }) {
    const session = useKnowledgeSession();
    const result = useQuery(api.knowledge.articleForViewer, session.ready ? { slug } : 'skip');
    const paired = session.ready && !!result && result.viewer.clerkId === session.userId
        && result.viewer.audience === session.viewer?.audience && result.viewer.canAccessWiki === session.viewer?.canAccessWiki
        && result.viewer.blocked === session.viewer?.blocked;
    if (paired && result.article) return <KnowledgeArticle key={`${session.key}:${slug}`} article={result.article} wiki={result.article.workspace === 'wiki'} />;
    const loading = !session.ready || !paired;
    return <PbPage><Container className="kh-page kh-state" aria-busy={loading}>
        <p className="pb-label">Tendso help</p><h1>{loading ? 'Opening the article…' : 'This article isn’t available.'}</h1>
        {!loading && <><p className="kh-lead">It may be unpublished, moved, or available to a different account.</p><div className="kh-actions">
            {!session.userId && <Button href={`/login?redirect_url=${encodeURIComponent(`/knowledge/${slug}`)}`}>Sign in</Button>}
            <Button href="/help" variant="ghost">Back to help</Button>
        </div></>}
    </Container></PbPage>;
}
