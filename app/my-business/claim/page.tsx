import { redirect } from "next/navigation";

// /my-business/claim?token=<64hex> was where the "Edit my website" button in
// the payment email landed. That button is gone (lib/email/templates.ts accepts
// editMyWebsiteUrl and ignores it), nothing else links here, and the Round 1
// scope removes the screen: "Unreachable (no email sends the link); remove".
//
// It is kept as a redirect rather than deleted so an old email still in
// someone's inbox lands on the owner's page instead of a 404. The query string
// is dropped on purpose: the token has no use there.
//
// What went with the screen: the browser no longer calls
// businessOwners.getClaimToken or businessOwners.claimWebsite (both stay in
// Convex). claimWebsite was the only thing that created a businessOwners row,
// so new owners can no longer link themselves; app/api/send-website-email still
// mints a claim token with every payment email, which nothing now reads.
export default function ClaimRedirect() {
    redirect("/my-business");
}
