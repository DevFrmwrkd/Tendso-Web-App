import { redirect } from "next/navigation";

// The Custom domain screen is now the "Custom domain" fold in the Details panel
// of the review workspace (board Review), with everything it showed and did:
// the Hostinger card, the setup state, checking and buying a domain. The route
// stays as a redirect because links to it exist: convex/domains.ts puts this
// address in the "Domain purchase refused — needs a human" admin notification.
export default async function CustomDomainRedirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    redirect(`/admin/submissions/${encodeURIComponent(id)}?fold=domain`);
}
