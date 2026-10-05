import { redirect } from "next/navigation";

// The creator detail page now lives in the details drawer on /admin/creators
// (Round 1, board Creators: "Becomes the right drawer on Creators"). Its
// figures, details, role, pricing, payout, submission history, Suspend and
// Delete all moved there. The route is kept as a redirect because links to
// it are out there (bookmarks, notes, other admin screens), and any other
// query parameters ride along.
export default async function CreatorDetailRedirect({
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
    redirect(`/admin/creators?${query.toString()}`);
}
