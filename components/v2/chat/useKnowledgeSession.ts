"use client";

import { useAuth } from '@clerk/nextjs';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

/** A role claim from the UI never selects content. Pair server reads with the actor. */
export function useKnowledgeSession() {
    const { userId, sessionId, isLoaded } = useAuth();
    const { isLoading, isAuthenticated } = useConvexAuth();
    const canQuery = isLoaded && !isLoading && (userId ? isAuthenticated : !isAuthenticated);
    const viewer = useQuery(api.knowledge.viewerContext, canQuery ? {} : 'skip');
    const ready = canQuery && !!viewer && viewer.clerkId === (userId ?? null);
    const audience = ready ? viewer.audience : 'everyone';
    const key = `${userId ?? 'public'}:${sessionId ?? 'none'}:${ready ? `${audience}:${viewer.canAccessWiki}:${viewer.blocked}` : 'loading'}`;
    const suggestions = audience === 'affiliate'
        ? ['How do creator codes work?', 'How much do I earn?', 'How much can I withdraw?']
        : audience === 'field_agent'
            ? ['How much do I keep per site?', 'How do I resend a rejected shop?', 'How do referrals work?']
            : audience === 'owner'
                ? ['What is my website status?', 'How do I request a change?', 'How do I pay?']
                : audience === 'admin'
                    ? ['How do I review a submission?', 'How are payments verified?', 'How do I manage knowledge access?']
                    : ['How much does it cost?', 'How fast is my site ready?', 'When do I pay?'];
    const intro = audience === 'everyone' ? 'Ask in your own words. Answers come from our shared Help articles.'
        : `Help for your ${audience === 'affiliate' ? 'creator' : audience.replace('_', ' ')} account, using permitted articles and current account records.`;
    return { ready, key, viewer: ready ? viewer : undefined, userId: userId ?? null, suggestions, intro };
}
