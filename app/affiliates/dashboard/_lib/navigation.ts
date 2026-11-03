export const AFFILIATE_SECTIONS = ["home", "my-page", "sales", "wallet", "referrals", "account"] as const;
export type AffiliateSection = typeof AFFILIATE_SECTIONS[number];

export function affiliateSection(value: unknown): AffiliateSection {
    return AFFILIATE_SECTIONS.find((section) => section === value) ?? "home";
}

export function affiliateHref(section: AffiliateSection, preview = false): string {
    if (preview) return section === "home" ? "/admin/preview/affiliate" : `/admin/preview/affiliate?section=${section}`;
    if (section === "sales") return "/affiliates/dashboard#pt-shops";
    if (section === "referrals") return "/affiliates/dashboard#pt-agents";
    if (section === "wallet") return "/affiliates/dashboard/payouts";
    return section === "home" ? "/affiliates/dashboard" : `/affiliates/dashboard/${section}`;
}
