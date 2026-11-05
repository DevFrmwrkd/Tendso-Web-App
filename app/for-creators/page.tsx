import { redirectKeepingQuery, type PageSearchParams } from "@/components/landing/legacyRedirect";

/** Legacy field-agent recruitment links retain their campaign and referral parameters. */
export default async function Page({ searchParams }: { searchParams: PageSearchParams }) {
    return redirectKeepingQuery("/for-field-agents", searchParams);
}
