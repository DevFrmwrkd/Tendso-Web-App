/**
 * SEO / GEO helpers — canonical URLs + Schema.org JSON-LD builders.
 *
 * Pure data builders (no React) so they're usable in metadata, route handlers,
 * and server components alike. Render the output with <JsonLd> (see jsonLd.tsx)
 * or a native <script type="application/ld+json">.
 *
 * CANONICAL DOMAIN: tendso.com (platform migrated 2026-06). The plan doc assumed
 * tendso.app — that's wrong; every @id/canonical here uses tendso.com.
 * Override with NEXT_PUBLIC_SITE_URL only if it's a real https origin (the dev
 * default localhost:3000 is ignored for canonical/schema, which must be absolute
 * production URLs).
 */

const ENV_URL = process.env.NEXT_PUBLIC_SITE_URL;
export const SITE_URL =
    ENV_URL && ENV_URL.startsWith('https://') ? ENV_URL.replace(/\/$/, '') : 'https://tendso.com';

export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/** Absolute URL for a path (leading slash optional). */
export function abs(path: string): string {
    if (path.startsWith('http')) return path;
    return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Platform Organization + WebSite @graph. Injected once in the root layout so
 * every page carries the entity. Leave a Wikidata sameAs slot for later (P2).
 */
export function organizationGraph() {
    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Organization',
                '@id': ORG_ID,
                name: 'Tendso',
                url: SITE_URL,
                logo: { '@type': 'ImageObject', url: abs('/tendso-icon.png'), width: 512, height: 512 },
                description:
                    'Tendso helps Filipino local businesses get online fast. A creator visits, asks a few questions, photographs the shop, and a website goes live in 48 hours.',
                slogan: "The Thinking Ends Here. So the work doesn't.",
                areaServed: { '@type': 'Country', name: 'Philippines' },
                knowsAbout: [
                    'local business websites',
                    'Philippine SME digitization',
                    'field agent networks',
                    'web publishing',
                ],
                // sameAs left intentionally minimal — only add profiles that
                // actually resolve + are consistent (an unresolving sameAs is an
                // entity-confusion signal). Wikidata QID added later (P2).
                sameAs: [] as string[],
                contactPoint: {
                    '@type': 'ContactPoint',
                    contactType: 'customer support',
                    availableLanguage: ['English', 'Filipino'],
                },
            },
            {
                '@type': 'WebSite',
                '@id': WEBSITE_ID,
                url: SITE_URL,
                name: 'Tendso',
                publisher: { '@id': ORG_ID },
                inLanguage: 'en-PH',
                potentialAction: {
                    '@type': 'SearchAction',
                    target: {
                        '@type': 'EntryPoint',
                        urlTemplate: `${SITE_URL}/knowledge?q={search_term_string}`,
                    },
                    'query-input': 'required name=search_term_string',
                },
            },
        ],
    };
}

export interface ArticleSchemaInput {
    slug: string;
    title: string;
    summary: string;
    keywords?: string[];
    createdAtMs: number;
    updatedAtMs: number;
    faqs?: Array<{ question: string; answer: string }>;
}

/**
 * Article + BreadcrumbList (+ FAQPage when faqs exist) @graph for a KB article.
 * FAQPage mainEntity stays [] until the faqs field is populated (P1.7) — an
 * empty FAQPage is harmless; fabricated Q&A is not.
 */
export function knowledgeArticleGraph(a: ArticleSchemaInput) {
    const articleUrl = abs(`/knowledge/${a.slug}`);
    const graph: Record<string, unknown>[] = [
        {
            '@type': 'Article',
            '@id': `${articleUrl}/#article`,
            headline: a.title,
            description: a.summary,
            keywords: a.keywords ?? [],
            datePublished: new Date(a.createdAtMs).toISOString(),
            dateModified: new Date(a.updatedAtMs).toISOString(),
            author: { '@id': ORG_ID },
            publisher: { '@id': ORG_ID },
            mainEntityOfPage: articleUrl,
            inLanguage: 'en-PH',
            isPartOf: { '@id': WEBSITE_ID },
        },
        {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
                { '@type': 'ListItem', position: 2, name: 'Knowledge Base', item: abs('/knowledge') },
                { '@type': 'ListItem', position: 3, name: a.title, item: articleUrl },
            ],
        },
    ];
    if (a.faqs && a.faqs.length > 0) {
        graph.push({
            '@type': 'FAQPage',
            isPartOf: { '@id': `${articleUrl}/#article` },
            mainEntity: a.faqs.map((f) => ({
                '@type': 'Question',
                name: f.question,
                acceptedAnswer: { '@type': 'Answer', text: f.answer },
            })),
        });
    }
    return { '@context': 'https://schema.org', '@graph': graph };
}

/**
 * SoftwareApplication + tiered Offer for the home/pricing page.
 * price MUST be a string per Schema.org; region = PH.
 */
export function softwareApplicationGraph() {
    return {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        '@id': `${SITE_URL}/#software`,
        name: 'Tendso',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web, Android',
        publisher: { '@id': ORG_ID },
        offers: [
            {
                '@type': 'Offer',
                name: 'Website (launch price)',
                price: '999',
                priceCurrency: 'PHP',
                eligibleRegion: { '@type': 'Country', name: 'Philippines' },
            },
            {
                '@type': 'Offer',
                name: 'Website (full price ceiling)',
                price: '4999',
                priceCurrency: 'PHP',
                eligibleRegion: { '@type': 'Country', name: 'Philippines' },
            },
        ],
    };
}
