import { redirectKeepingQuery, type PageSearchParams } from "@/components/landing/legacyRedirect";

// /for-field-agents is merged into /for-creators (Round 1, board: ForCreators):
// same audience, one pitch. What it had that the board has a place for went
// with it: the sign-up ("Start as a creator"), the creator Discord invite, the
// "is this legit" answer and the steps, plus the 10-minute call at
// /field-agent/book. Its title and canonical moved to /for-creators' metadata;
// its peso earnings did not (the creator pages no longer quote them).
//
// The route is kept as a permanent redirect, query string and all, because
// links to it exist in video descriptions, Discord posts and messages.
export default async function ForFieldAgentsRedirect({ searchParams }: { searchParams: PageSearchParams }) {
    return redirectKeepingQuery("/for-creators", searchParams);
}
