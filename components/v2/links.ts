export interface V2Link {
    label: string;
    href: string;
}

/**
 * The /v2 site map: ONE nav and ONE footer for every /v2 page (landing, the
 * business/examples/field-agents/about/legal pages, help/start/pay, creators).
 * Change a destination here, nowhere else.
 */
export const V2_ROUTES = {
    home: "/v2",
    how: "/v2#how",
    examples: "/v2/examples",
    business: "/v2/business",
    fieldAgents: "/v2/field-agents",
    creators: "/v2/creators",
    help: "/v2/help",
    contact: "/v2/help#contact",
    hire: "/v2#hire",
    download: "/v2#download",
    about: "/v2/about",
    privacy: "/v2/privacy",
    terms: "/v2/terms",
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
