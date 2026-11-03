import { permanentRedirect } from "next/navigation";

// Contact links open the redesigned Help page's contact section. Retain
// campaign parameters from emails, posters and shared links.
export default async function ContactRedirect({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const sp = await searchParams;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
        if (v === undefined) continue;
        for (const one of Array.isArray(v) ? v : [v]) qs.append(k, one);
    }
    const query = qs.toString();
    permanentRedirect(`/help${query ? `?${query}` : ""}#contact`);
}
