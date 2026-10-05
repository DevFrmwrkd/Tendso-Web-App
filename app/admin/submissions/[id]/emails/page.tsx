import { redirect } from "next/navigation";

// The "Emails sent to client" screen is now the "Emails sent" fold in the
// Details panel of the review workspace (board Review), with its preview and
// send-again actions. The route stays as a redirect so bookmarks and older
// links still land on the right submission with that fold open.
export default async function EmailsSentRedirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    redirect(`/admin/submissions/${encodeURIComponent(id)}?fold=emails`);
}
