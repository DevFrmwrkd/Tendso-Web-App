import { redirectKeepingQuery, type PageSearchParams } from "@/components/landing/legacyRedirect";

// /creators was an older copy of the creator pitch; /for-creators is that page
// (Round 1, board: ForCreators). The route is kept as a permanent redirect,
// query string and all, because links to it exist in emails, the mobile app and
// search results.
export default async function CreatorsRedirect({ searchParams }: { searchParams: PageSearchParams }) {
    return redirectKeepingQuery("/for-creators", searchParams);
}
