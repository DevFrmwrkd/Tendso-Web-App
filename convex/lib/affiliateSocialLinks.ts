import { v } from 'convex/values';

/** Explicit public page links; application-only creatorSocials are separate. */
export const affiliateSocialLinksValidator = v.object({
    messenger: v.optional(v.string()),
    facebook: v.optional(v.string()),
    instagram: v.optional(v.string()),
    tiktok: v.optional(v.string()),
    youtube: v.optional(v.string()),
});
