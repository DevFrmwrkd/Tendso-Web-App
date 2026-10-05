import { redirect } from "next/navigation";

// The Rejected Creators view now lives inside /admin/creators as its
// "Rejected" tab (Round 1, board Creators: "they are tabs now").
// This route is kept as a redirect for existing bookmarks.
export default function RejectedCreatorsRedirect() {
    redirect("/admin/creators?view=rejected");
}
