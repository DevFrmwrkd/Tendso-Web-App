import { redirect } from "next/navigation";

// Edit profile is now a drawer on Account (board Account). The route is kept
// as a redirect because the mobile app, old emails and bookmarks still link
// here; they land on Account with the drawer already open.
export default function EditProfileRedirect() {
    redirect("/profile?edit=profile");
}
