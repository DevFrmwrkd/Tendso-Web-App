import { redirect } from "next/navigation";

// The submission detail page now lives in the details drawer on /submissions
// (Round 1, board Submissions: "Becomes the right drawer on Submissions").
// This route is kept as a redirect because links to it are out there: the
// creator dashboard, the notifications page and a lead's page link here, and
// so may emails and the mobile app. Any other query parameters ride along.
export default async function SubmissionDetailRedirect({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const { id } = await params;
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) {
        if (key === "open" || value === undefined) continue;
        for (const v of Array.isArray(value) ? value : [value]) query.append(key, v);
    }
    query.set("open", id);
    redirect(`/submissions?${query.toString()}`);
}
