export interface V2Link {
    label: string;
    href: string;
}

/**
 * Default public routes for the shared new design. Existing /v2 URLs remain aliases.
 * Change a destination here, nowhere else.
 */
export const V2_ROUTES = {
    home: "/",
    signIn: "/login",
    how: "/#how",
    examples: "/examples",
    business: "/for-business",
    fieldAgents: "/for-field-agents",
    creators: "/affiliates",
    help: "/help",
    contact: "/help#contact",
    hire: "/#hire",
    download: "/#download",
    about: "/about",
    privacy: "/privacy-policy",
    terms: "/terms-of-service",
} as const;

export const V2_NAV_LINKS: readonly V2Link[] = [
    { label: "How it works", href: V2_ROUTES.how },
    { label: "Examples", href: V2_ROUTES.examples },
    { label: "For businesses", href: V2_ROUTES.business },
    { label: "Field agents", href: V2_ROUTES.fieldAgents },
    { label: "Creators", href: V2_ROUTES.creators },
    { label: "Help", href: V2_ROUTES.help },
];

export const V2_FOOTER_LINKS: readonly V2Link[] = [
    { label: "Home", href: V2_ROUTES.home },
    { label: "How it works", href: V2_ROUTES.how },
    { label: "Examples", href: V2_ROUTES.examples },
    { label: "For businesses", href: V2_ROUTES.business },
    { label: "Field agents", href: V2_ROUTES.fieldAgents },
    { label: "Creators", href: V2_ROUTES.creators },
    { label: "Help", href: V2_ROUTES.help },
    { label: "Hire an agent", href: V2_ROUTES.hire },
    { label: "Privacy", href: V2_ROUTES.privacy },
    { label: "Terms", href: V2_ROUTES.terms },
];
