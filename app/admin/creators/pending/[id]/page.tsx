import { redirect } from "next/navigation";

// The pending creator overview now lives in the details drawer on the
// Waiting for approval tab of /admin/creators (Round 1, board Creators:
// "Becomes the right drawer on the Waiting tab"), with Approve and Reject in
// its foot. The route is kept as a redirect because it is linked from
// outside the app: every #pending-approvals message the Discord bot posts
// carries /admin/creators/pending/<id> (convex/approvals.ts). `view=pending`
// is the tab value the older /admin/pending-approvals redirect already uses.
export default async function PendingCreatorRedirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const query = new URLSearchParams({ view: "pending", open: id });
    redirect(`/admin/creators?${query.toString()}`);
}
