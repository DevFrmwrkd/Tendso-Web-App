import { permanentRedirect } from "next/navigation";

// /contact is now the "Ask a person" card on the Help Center home
// (app/knowledge/_components/ContactCard.tsx): Round 1 keeps every way to
// reach a person in one place. The card carries what this page offered: the
// support inbox as a mailto link, the phone, and the note that press and
// partnerships use the same inbox.
//
// The route stays as a permanent redirect because links to it are out there:
// customer emails (lib/email/templates.ts), the owner portal, the start flow's
// thank-you page, the site footers, and the terms of service tell owners to
// use "the Contact page". The query string comes along so campaign tags
// (?src=…) survive the hop.
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
    permanentRedirect(`/knowledge${query ? `?${query}` : ""}#contact`);
}
