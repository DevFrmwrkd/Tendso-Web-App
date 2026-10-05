import { redirect } from "next/navigation"

// Call stats now live inside /admin/bookings as its Stats tab (board Calls;
// scope: "Call stats, moved elsewhere"). This route is kept as a redirect so
// existing bookmarks and links land on the tab instead of a 404; the sidebar
// still lights Calls for it.
export default function CallStatsRedirect() {
    redirect("/admin/bookings?tab=stats")
}
