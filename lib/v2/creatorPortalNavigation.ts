export const CREATOR_PORTAL_HREF = "/v2/creators/portal";
export const CREATOR_PAGE_EDITOR_HREF = `${CREATOR_PORTAL_HREF}/my-page`;

/** One navigation order for every authenticated creator portal page. */
export const CREATOR_PORTAL_NAV = [
    { id: "home", label: "Home", anchor: "top" },
    { id: "links", label: "Links", anchor: "pt-links" },
    { id: "agents", label: "Agents", anchor: "pt-agents" },
    { id: "shops", label: "Shops", anchor: "pt-shops" },
    { id: "payouts", label: "Payouts", anchor: "pt-pay" },
    { id: "my-page", label: "My page", anchor: null },
] as const;
