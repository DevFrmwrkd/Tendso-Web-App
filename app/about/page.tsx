import { redirectKeepingQuery, type PageSearchParams } from "@/components/landing/legacyRedirect";

// /about is merged into the landing (Round 1, board: Landing). What it said that
// still holds lives there now: how a business gets a website is the landing's
// "How it works" (/#how), the phone number is in the questions and the footer,
// and the operator line (VONAS, OPC) is in the footer. Its creator half quoted
// peso earnings the creator pages no longer state; /for-creators is that pitch.
//
// The route is kept as a permanent redirect, query string and all, because links
// to it exist in emails, posts and search results.
export default async function AboutRedirect({ searchParams }: { searchParams: PageSearchParams }) {
    return redirectKeepingQuery("/", searchParams);
}
