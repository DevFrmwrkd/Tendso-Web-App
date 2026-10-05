import { redirect } from "next/navigation";

/**
 * /leads/[leadId] moved: the lead and prospect detail is now the right drawer
 * on /leads (Round 1, board Leads), opened by ?lead=<id>. Everything this page
 * showed and did (contact, business, interviewers, curated card, notes, status,
 * claim and release, start the interview) is in that drawer.
 *
 * The route stays as a redirect because links to it are out there: the map
 * pages (/leads/discover, /leads/live) and the interview form link here, and so
 * may bookmarks, emails and the mobile app. Other query parameters come along.
 *
 * The id goes through untouched. It is a `leads` id (an interviewed lead and an
 * Outscraper prospect both live in that table), or, from the discover map's
 * in-memory pins, sometimes a Google place_id; the drawer shape-checks it and
 * says "Lead not found" for anything that is not a Convex id, as this page did.
 */
export default async function LeadDetailMoved({
    params,
    searchParams,
}: {
    params: Promise<{ leadId: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [{ leadId }, query] = await Promise.all([params, searchParams]);
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (key === "lead" || value === undefined) continue;
        for (const v of Array.isArray(value) ? value : [value]) next.append(key, v);
    }
    next.set("lead", leadId);
    redirect(`/leads?${next.toString()}`);
}
