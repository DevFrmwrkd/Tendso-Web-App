import { redirect } from "next/navigation"

// /admin/withdrawals was the first list of creator withdrawals. Its contents
// have lived on /admin/payouts since withdrawals went instant, and in Round 1
// the Payouts screen holds them all: the list (filter chips), each
// withdrawal's details (the right drawer) and the money summary. The route is
// kept as a redirect because links to it are out there (bookmarks, notes,
// AdminLayout still lights Payouts for it), and any query parameters ride
// along, so a ?open=<id> still opens that withdrawal.
//
// It lands on the All filter, not on Payouts' own default (Failed when
// anything has failed): this page listed every withdrawal, settled or not.
export default async function WithdrawalsRedirect({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(await searchParams)) {
        if (value === undefined) continue
        for (const v of Array.isArray(value) ? value : [value]) query.append(key, v)
    }
    if (!query.has("status")) query.set("status", "all")
    redirect(`/admin/payouts?${query.toString()}`)
}
