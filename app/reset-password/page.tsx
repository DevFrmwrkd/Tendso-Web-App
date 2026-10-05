import { permanentRedirect } from "next/navigation";

/**
 * Password reset lives in /forgot-password: step 1 asks for the email, step 2
 * takes the emailed code and the new password. Nothing can resume step 2 from
 * a link (Clerk emails a code, not a link), so every visit starts at step 1,
 * the page's own first step.
 *
 * This route is kept, not deleted, so an old link to it (an email from before
 * Clerk, a bookmark) still lands on the reset. It used to be a client page
 * that showed "Redirecting…" and replaced itself in the browser; it now
 * answers with a permanent redirect from the server, so nothing renders
 * first, and the query string comes along unchanged.
 */
export default async function ResetPasswordRedirect({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) {
        for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
            query.append(key, v);
        }
    }
    const qs = query.toString();
    permanentRedirect(qs ? `/forgot-password?${qs}` : "/forgot-password");
}
