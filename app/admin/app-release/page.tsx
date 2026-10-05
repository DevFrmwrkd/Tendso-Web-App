import { redirect } from "next/navigation"

// App release is now the App links tab of Site settings (Round 1, board
// SiteSettings; scope: "App release, moved elsewhere"). Everything it did
// moved there unchanged: the Google Play and App Store links (the
// `play_store_url` / `app_store_url` settings) and the one-time clean-up of
// the old APK left in R2 from before the store listings. This route is kept
// as a redirect so bookmarks and old links land on the tab instead of a 404;
// the sidebar still lights Site settings for it.
export default function AppReleaseRedirect() {
    redirect("/admin/featured-sites?tab=app")
}
