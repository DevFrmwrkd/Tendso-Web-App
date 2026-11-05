/** Shared authoring labels and legacy defaults; authorization stays on the server. */
export const KNOWLEDGE_AUDIENCES = ['everyone', 'owner', 'affiliate', 'field_agent', 'admin'] as const;
export const KNOWLEDGE_VISIBILITIES = ['public', 'authenticated', 'internal'] as const;
export type KnowledgeAudience = typeof KNOWLEDGE_AUDIENCES[number];
export type KnowledgeVisibility = typeof KNOWLEDGE_VISIBILITIES[number];
export type KnowledgeWorkspace = 'help' | 'wiki';
export type KnowledgeAccess = { audiences: KnowledgeAudience[]; visibility: KnowledgeVisibility };
export type KnowledgeAccessRecord = {
    workspace: KnowledgeWorkspace;
    audiences?: KnowledgeAudience[];
    visibility?: KnowledgeVisibility;
};

export function knowledgeAccessDefaults(workspace: KnowledgeWorkspace): KnowledgeAccess {
    return workspace === 'wiki'
        ? { audiences: ['field_agent', 'admin'], visibility: 'internal' }
        : { audiences: ['everyone'], visibility: 'public' };
}

export function resolveKnowledgeAccess(record: KnowledgeAccessRecord): KnowledgeAccess {
    const defaults = knowledgeAccessDefaults(record.workspace);
    return {
        audiences: record.audiences?.length ? [...record.audiences] : defaults.audiences,
        visibility: record.visibility ?? defaults.visibility,
    };
}

/** A mixed Everyone + role selection has the same meaning as Everyone alone. */
export function normalizeKnowledgeAudiences(audiences: readonly KnowledgeAudience[]): KnowledgeAudience[] {
    if (!audiences.length) throw new Error('Choose at least one knowledge audience.');
    return audiences.includes('everyone') ? ['everyone'] : [...new Set(audiences)];
}
