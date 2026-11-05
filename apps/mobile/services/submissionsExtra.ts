/** Mobile aliases for submission functions in the canonical backend. */
import { api } from '@tendso/convex-client';

/**
 * Delete a DRAFT submission. Server-side this refuses anything that isn't a
 * draft, so it can't destroy submitted work.
 *
 * Used when a creator abandons an in-progress draft to interview a different
 * business. Deleting rather than overwriting is deliberate: `submissions.update`
 * sets `prospectLeadId` once and never re-points it, so reusing a draft that was
 * already linked to business A would file business B's interview against A.
 */
export const removeSubmission = api.submissions.remove;
