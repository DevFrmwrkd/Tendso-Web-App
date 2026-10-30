export const CREATOR_PORTAL_HREF = "/v2/creators/portal";
export const CREATOR_PAGE_EDITOR_HREF = `${CREATOR_PORTAL_HREF}/my-page`;
export const CREATOR_ACCOUNT_HREF = `${CREATOR_PORTAL_HREF}/account`;
export const CREATOR_PAYOUTS_HREF = `${CREATOR_PORTAL_HREF}/payouts`;

export type CreatorPortalPage = "home" | "my-page" | "account" | "payouts";

/** One navigation order for every authenticated creator portal page. */
export const CREATOR_PORTAL_NAV = [
    { id: "home", label: "Home", anchor: "top" },
    { id: "links", label: "Links", anchor: "pt-links" },
    { id: "agents", label: "Agents", anchor: "pt-agents" },
    { id: "shops", label: "Shops", anchor: "pt-shops" },
    { id: "payouts", label: "Payouts", anchor: "pt-pay" },
    { id: "my-page", label: "My page", anchor: null },
] as const;

export function creatorPortalNavHref(id: (typeof CREATOR_PORTAL_NAV)[number]["id"], sample = false): string {
    const item = CREATOR_PORTAL_NAV.find(entry => entry.id === id)!;
    if (sample) return `#${item.anchor ?? "pt-links"}`;
    if (id === "payouts") return CREATOR_PAYOUTS_HREF;
    return item.anchor ? `${CREATOR_PORTAL_HREF}#${item.anchor}` : CREATOR_PAGE_EDITOR_HREF;
}
