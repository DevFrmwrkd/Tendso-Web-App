import { redirect } from "next/navigation";

// Change password is now a drawer on Account (board Account). The route is
// kept as a redirect because the mobile app, old emails and bookmarks still
// link here; they land on Account with the drawer already open.
export default function ChangePasswordRedirect() {
    redirect("/profile?edit=password");
}
