import { redirect } from "next/navigation";

// The Pending Approval queue now lives inside /admin/creators as its
// "Waiting for approval" tab (Round 1, board Creators: "they are tabs now").
// This route is kept as a redirect so existing bookmarks and the mobile-side
// notification deeplinks (which never targeted it — mobile uses the Convex
// functions directly) continue to land somewhere sensible.
export default function PendingApprovalsRedirect() {
    redirect("/admin/creators?view=pending");
}
