import { redirect } from "next/navigation";

// The Rejected Creators view now lives inside /admin/creators as a tab.
// This route is kept as a redirect for existing bookmarks.
export default function RejectedCreatorsRedirect() {
    redirect("/admin/creators?view=rejected");
}
