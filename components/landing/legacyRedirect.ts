import { permanentRedirect } from "next/navigation";

/** A page's search params, as Next 16 hands them to a server page. */
export type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Send a retired public page to the page that replaced it, permanently (308),
 * with its query string intact.
 *
 * The query matters: links to these pages carry campaign tags (?src=…) in
 * video descriptions, posts and emails, and a redirect that dropped them would
 * lose the attribution on the way. The #fragment never reaches the server; the
 * browser keeps it across the redirect on its own.
 *
 * The old routes stay (and stay public in proxy.ts) because links to them
 * exist in emails, the mobile app and search results.
 */
export async function redirectKeepingQuery(to: string, searchParams: PageSearchParams): Promise<never> {
    const params = await searchParams;
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) value.forEach((v) => query.append(key, v));
        else if (value !== undefined) query.append(key, value);
    }
    const qs = query.toString();
    permanentRedirect(qs ? `${to}?${qs}` : to);
}
