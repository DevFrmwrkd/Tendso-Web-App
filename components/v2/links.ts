export interface V2Link {
    label: string;
    href: string;
}

/** Footer links from the mock: Help · Contact · Field agents · Privacy · Terms. */
export const V2_FOOTER_LINKS: readonly V2Link[] = [
    { label: "Help", href: "/help-faq" },
    { label: "Contact", href: "/contact" },
    { label: "Field agents", href: "/for-field-agents" },
    { label: "Privacy", href: "/privacy-policy" },
    { label: "Terms", href: "/terms-of-service" },
];

export const V2_NAV_LINKS: readonly V2Link[] = [
    { label: "Field agents", href: "/for-field-agents" },
    { label: "Help", href: "/help-faq" },
    { label: "Contact", href: "/contact" },
];
