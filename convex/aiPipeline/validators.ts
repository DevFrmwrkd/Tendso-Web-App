import { v } from 'convex/values';

/** The four build steps (lib/aiPipeline/stateMachine.ts STEPS), as a Convex validator. */
export const stepValidator = v.union(
    v.literal('reading_interview'),
    v.literal('writing_pages'),
    v.literal('polishing_photos'),
    v.literal('building_site'),
);
