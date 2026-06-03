/**
 * genericContentSchema — every editable field across the 5 generic
 * landing-page templates (A=Ironwood, B=Stillwater, C=Cedar&Stone,
 * D=Northpoint, E=WashHouse).
 *
 * Each field declares ONE primary `path` (where admin edits land) plus
 * optional `fallbackPaths` for reading. Fallbacks chain through:
 *   1. legacy Groq output ("business_name", "tagline", "about", flat services)
 *   2. submission top-level fields
 * so the form shows real content even before admin has edited anything,
 * but writes always land at the primary path the Astro components read.
 */

export type FieldKind = 'text' | 'textarea' | 'link' | 'image';

export interface FieldSpec {
    kind: FieldKind;
    label: string;
    path: string;
    /** Companion href path for kind: 'link'. */
    hrefPath?: string;
    /**
     * Additional dotted paths to READ from when `path` is empty. Used when
     * the admin's edit lives at one place but the AI / submission populated
     * the data at another (e.g. brand at `footer.brand` admin-side, but
     * `business_name` from the submission). Writes always go to `path` so
     * the admin's edit is the source of truth from then on.
     */
    fallbackPaths?: string[];
    /** Same idea for the link's href. */
    hrefFallbackPaths?: string[];
    /** Hint shown under the input. */
    hint?: string;
    placeholder?: string;
}

export interface ListSpec {
    kind: 'list';
    label: string;
    /** Path to the array, e.g. "services.items". */
    path: string;
    /** Sub-fields for each row. Paths relative to the row. */
    itemFields: FieldSpec[];
    /** Read-only fallback array paths — when the primary path is empty,
     *  the form displays rows from a fallback path. Adding/removing/editing
     *  any row materializes the array at the primary path. */
    fallbackPaths?: string[];
    /** When user clicks +Add, the new row's default value. Strings for
     *  string-arrays (places, paragraphs); objects for row-arrays
     *  (services.items, footer.social, etc). */
    newItem?: string | Record<string, any>;
    /** Lock to a fixed length (e.g. trust has 4 cells). */
    maxItems?: number;
    /** Don't allow add / remove (used when section requires N items). */
    fixed?: boolean;
}

export interface GroupSpec {
    id: string;
    title: string;
    description?: string;
    fields: Array<FieldSpec | ListSpec>;
}

export const GENERIC_CONTENT_SCHEMA: GroupSpec[] = [
    {
        id: 'header',
        title: 'Header / Nav',
        description: 'Sticky top bar — brand, navigation links, phone, primary CTA.',
        fields: [
            {
                kind: 'text',
                label: 'Brand name',
                path: 'footer.brand',
                fallbackPaths: ['business_name'],
                placeholder: 'Your business name',
            },
            {
                kind: 'text',
                label: 'Phone',
                path: 'contact.phone',
                placeholder: '+0 000 000 0000',
            },
            {
                kind: 'link',
                label: 'Header CTA',
                path: 'navCtaText',
                hrefPath: 'navCtaHref',
                placeholder: 'Get in touch',
            },
            {
                kind: 'list',
                label: 'Nav links',
                path: 'navbar_links',
                newItem: { label: '', href: '' },
                itemFields: [
                    { kind: 'text', label: 'Label', path: 'label', placeholder: 'About' },
                    { kind: 'text', label: 'Anchor', path: 'href', placeholder: '#about' },
                ],
            } as ListSpec,
        ],
    },
    {
        id: 'hero',
        title: 'Hero',
        description: 'Top of the page — background image, headline, sub-copy, CTAs.',
        fields: [
            { kind: 'image', label: 'Background image', path: 'hero.image' },
            {
                kind: 'text',
                label: 'Kicker / eyebrow',
                path: 'hero.kicker',
                fallbackPaths: ['hero_badge_text'],
                placeholder: 'Tagline · location · niche',
            },
            {
                kind: 'text',
                label: 'Headline (single line)',
                path: 'hero.headline',
                fallbackPaths: ['tagline', 'business_name'],
                placeholder: 'Your one-line pitch',
                hint: 'The H1 / hero title. Multi-line H1s use the list below.',
            },
            {
                kind: 'list',
                label: 'Headline lines (3 lines)',
                path: 'hero.headlineLines',
                newItem: '',
                maxItems: 4,
                itemFields: [
                    { kind: 'text', label: 'Line', path: '', placeholder: 'Line of headline' },
                ],
            } as ListSpec,
            {
                kind: 'textarea',
                label: 'Sub-headline / elevator pitch',
                path: 'hero.sub',
                fallbackPaths: ['about'],
                placeholder: '1–2 sentences explaining what you do.',
            },
            {
                kind: 'link',
                label: 'Primary CTA',
                path: 'hero.cta1.text',
                hrefPath: 'hero.cta1.href',
                placeholder: 'Visit us',
            },
            {
                kind: 'link',
                label: 'Secondary CTA',
                path: 'hero.cta2.text',
                hrefPath: 'hero.cta2.href',
                placeholder: 'See services',
            },
            { kind: 'text', label: 'Meta line 1', path: 'hero.meta1', placeholder: '★★★★★ rated on Google' },
            { kind: 'text', label: 'Meta line 2', path: 'hero.meta2', placeholder: 'Open daily · address' },
            { kind: 'text', label: 'Trust line (Stillwater)', path: 'hero.trustLine', hint: 'Used by Stillwater hero only.' },
        ],
    },
    {
        id: 'marquee',
        title: 'Marquee',
        description: 'Scrolling band of keywords between hero and trust.',
        fields: [
            { kind: 'text', label: 'Marquee text', path: 'marquee.text', placeholder: 'Keyword ✺ Keyword ✺ Keyword' },
        ],
    },
    {
        id: 'trust',
        title: 'Trust band',
        description: 'Four numeric proof-points.',
        fields: [
            {
                kind: 'list',
                label: 'Trust cells',
                path: 'trust.cells',
                maxItems: 4,
                newItem: { num: '', label: '' },
                itemFields: [
                    { kind: 'text', label: 'Number', path: 'num', placeholder: '2014' },
                    { kind: 'text', label: 'Label', path: 'label', placeholder: 'Years in business' },
                ],
            } as ListSpec,
        ],
    },
    {
        id: 'about',
        title: 'About',
        description: 'Story / origin section.',
        fields: [
            { kind: 'image', label: 'Image', path: 'about.image' },
            { kind: 'text', label: 'Eyebrow tag', path: 'about.tag', placeholder: 'Our story' },
            {
                kind: 'text',
                label: 'Headline',
                path: 'about.headline',
                fallbackPaths: ['about_headline'],
                placeholder: 'A short headline for the about section',
            },
            {
                kind: 'textarea',
                label: 'Lead paragraph',
                path: 'about.lead',
                fallbackPaths: ['about_description', 'about'],
            },
            { kind: 'text', label: 'Signature line', path: 'about.signature', placeholder: 'A short closing line' },
            {
                kind: 'list',
                label: 'Body paragraphs',
                path: 'about.paragraphs',
                newItem: '',
                itemFields: [{ kind: 'textarea', label: 'Paragraph', path: '' }],
            } as ListSpec,
        ],
    },
    {
        id: 'services',
        title: 'Services',
        description: 'What you offer.',
        fields: [
            {
                kind: 'text',
                label: 'Eyebrow tag',
                path: 'services.tag',
                placeholder: 'What we do',
            },
            {
                kind: 'text',
                label: 'Headline',
                path: 'services.headline',
                fallbackPaths: ['services_headline'],
                placeholder: 'Section headline',
            },
            {
                kind: 'textarea',
                label: 'Sub-headline',
                path: 'services.sub',
                fallbackPaths: ['services_subheadline'],
            },
            {
                kind: 'list',
                label: 'Items',
                path: 'services.items',
                newItem: { title: '', desc: '', note: '' },
                itemFields: [
                    { kind: 'text', label: 'Title', path: 'title', placeholder: 'Service name' },
                    { kind: 'textarea', label: 'Description', path: 'desc' },
                    { kind: 'text', label: 'Note / meta', path: 'note', placeholder: 'Optional small print' },
                    { kind: 'image', label: 'Image (zig-zag templates)', path: 'image' },
                ],
            } as ListSpec,
        ],
    },
    {
        id: 'why',
        title: 'Why us',
        description: 'Reasons to pick this business.',
        fields: [
            { kind: 'text', label: 'Eyebrow tag', path: 'why.tag', placeholder: 'Why us' },
            { kind: 'text', label: 'Headline', path: 'why.headline' },
            {
                kind: 'list',
                label: 'Items',
                path: 'why.items',
                newItem: { title: '', body: '' },
                itemFields: [
                    { kind: 'text', label: 'Title', path: 'title' },
                    { kind: 'textarea', label: 'Body', path: 'body' },
                ],
            } as ListSpec,
        ],
    },
    {
        id: 'how',
        title: 'How it works',
        description: 'Three step process.',
        fields: [
            { kind: 'text', label: 'Eyebrow tag', path: 'how.tag', placeholder: 'How it works' },
            { kind: 'text', label: 'Headline', path: 'how.headline' },
            {
                kind: 'list',
                label: 'Steps',
                path: 'how.steps',
                newItem: { title: '', body: '' },
                itemFields: [
                    { kind: 'text', label: 'Title', path: 'title' },
                    { kind: 'textarea', label: 'Body', path: 'body' },
                ],
            } as ListSpec,
        ],
    },
    {
        id: 'testimonials',
        title: 'Testimonials',
        description: 'Customer quotes.',
        fields: [
            { kind: 'text', label: 'Eyebrow tag', path: 'testimonials.tag', placeholder: 'Reviews' },
            { kind: 'text', label: 'Headline', path: 'testimonials.headline' },
            { kind: 'textarea', label: 'Big pull-quote (A/D templates)', path: 'testimonials.bigQuote' },
            { kind: 'text', label: 'Source line', path: 'testimonials.source', placeholder: '★ Reviews on Google' },
            {
                kind: 'list',
                label: 'Quotes',
                path: 'testimonials.items',
                fallbackPaths: ['testimonials'],
                newItem: { quote: '', who: '' },
                itemFields: [
                    { kind: 'textarea', label: 'Quote', path: 'quote' },
                    { kind: 'text', label: 'Attribution', path: 'who' },
                ],
            } as ListSpec,
        ],
    },
    {
        id: 'gallery',
        title: 'Gallery',
        description: 'Image tiles with captions.',
        fields: [
            {
                kind: 'text',
                label: 'Eyebrow tag',
                path: 'gallery.tag',
                fallbackPaths: ['featured_headline'],
                placeholder: 'Gallery',
            },
            {
                kind: 'text',
                label: 'Headline',
                path: 'gallery.headline',
                fallbackPaths: ['featured_subheadline'],
            },
            {
                kind: 'list',
                label: 'Tiles',
                path: 'gallery.items',
                newItem: { image: '', caption: '' },
                itemFields: [
                    { kind: 'image', label: 'Image', path: 'image' },
                    { kind: 'text', label: 'Caption', path: 'caption' },
                ],
            } as ListSpec,
        ],
    },
    {
        id: 'faq',
        title: 'FAQ',
        description: 'Frequently asked questions.',
        fields: [
            { kind: 'text', label: 'Eyebrow tag', path: 'faq.tag', placeholder: 'FAQ' },
            { kind: 'text', label: 'Headline', path: 'faq.headline' },
            {
                kind: 'list',
                label: 'Items',
                path: 'faq.items',
                fallbackPaths: ['faq'],
                newItem: { q: '', a: '' },
                itemFields: [
                    { kind: 'text', label: 'Question', path: 'q' },
                    { kind: 'textarea', label: 'Answer', path: 'a' },
                ],
            } as ListSpec,
        ],
    },
    {
        id: 'area',
        title: 'Service area',
        description: 'Neighborhoods / cities covered.',
        fields: [
            { kind: 'text', label: 'Eyebrow tag', path: 'area.tag', placeholder: 'Service area' },
            { kind: 'text', label: 'Headline', path: 'area.headline' },
            { kind: 'textarea', label: 'Body', path: 'area.body' },
            {
                kind: 'list',
                label: 'Places',
                path: 'area.places',
                newItem: '',
                itemFields: [{ kind: 'text', label: 'Place', path: '' }],
            } as ListSpec,
        ],
    },
    {
        id: 'credentials',
        title: 'Credentials',
        description: 'Licenses, certifications, warranty proofs.',
        fields: [
            { kind: 'text', label: 'Eyebrow tag', path: 'credentials.tag', placeholder: 'Credentials' },
            { kind: 'text', label: 'Headline', path: 'credentials.headline' },
            {
                kind: 'list',
                label: 'Items',
                path: 'credentials.items',
                fallbackPaths: ['credentials'],
                newItem: { title: '', body: '' },
                itemFields: [
                    { kind: 'text', label: 'Title / label', path: 'title' },
                    { kind: 'textarea', label: 'Body / detail', path: 'body' },
                ],
            } as ListSpec,
        ],
    },
    {
        id: 'location',
        title: 'Location',
        description: 'Address, hours, phone, map link.',
        fields: [
            { kind: 'text', label: 'Eyebrow tag', path: 'location.tag', placeholder: 'Visit' },
            { kind: 'text', label: 'Headline', path: 'location.headline' },
            {
                kind: 'textarea',
                label: 'Address',
                path: 'location.address',
                fallbackPaths: ['contact.address'],
                hint: 'Multi-line — uses line breaks.',
            },
            {
                kind: 'text',
                label: 'Phone',
                path: 'location.phone',
                fallbackPaths: ['contact.phone'],
            },
            { kind: 'text', label: 'Hours line', path: 'location.hours' },
            { kind: 'text', label: 'Latitude', path: 'location.lat' },
            { kind: 'text', label: 'Longitude', path: 'location.lng' },
            {
                kind: 'link',
                label: 'Directions button',
                path: 'location.directions.text',
                hrefPath: 'location.directions.href',
                placeholder: 'Get directions',
            },
        ],
    },
    {
        id: 'ctaBand',
        title: 'Closing CTA band',
        description: 'Big closing call-to-action above the footer.',
        fields: [
            { kind: 'text', label: 'Headline', path: 'ctaBand.headline', placeholder: 'Your closing call' },
            { kind: 'textarea', label: 'Sub-line', path: 'ctaBand.sub' },
            {
                kind: 'link',
                label: 'CTA button',
                path: 'ctaBand.cta.text',
                hrefPath: 'ctaBand.cta.href',
                placeholder: 'Get in touch',
            },
        ],
    },
    {
        id: 'footer',
        title: 'Footer',
        description: 'Bottom of the page — brand blurb, link columns, hours, social, copyright.',
        fields: [
            {
                kind: 'text',
                label: 'Footer brand',
                path: 'footer.brand',
                fallbackPaths: ['business_name'],
            },
            {
                kind: 'textarea',
                label: 'Brand blurb',
                path: 'footer.blurb',
                fallbackPaths: ['footer.brand_blurb', 'about'],
            },
            {
                kind: 'text',
                label: 'Email',
                path: 'contact.email',
            },
            {
                kind: 'text',
                label: 'Address',
                path: 'contact.address',
            },
            {
                kind: 'list',
                label: 'Visit column lines',
                path: 'footer.visit.lines',
                newItem: '',
                itemFields: [{ kind: 'text', label: 'Line', path: '' }],
            } as ListSpec,
            {
                kind: 'list',
                label: 'Explore column links',
                path: 'footer.explore.links',
                newItem: { text: '', href: '' },
                itemFields: [
                    { kind: 'text', label: 'Text', path: 'text' },
                    { kind: 'text', label: 'Href', path: 'href' },
                ],
            } as ListSpec,
            {
                kind: 'list',
                label: 'Hours rows',
                path: 'footer.hours',
                newItem: { day: '', time: '' },
                itemFields: [
                    { kind: 'text', label: 'Day', path: 'day' },
                    { kind: 'text', label: 'Time', path: 'time' },
                ],
            } as ListSpec,
            {
                kind: 'list',
                label: 'Social links',
                path: 'footer.social',
                fallbackPaths: ['footer.social_links'],
                newItem: { platform: '', url: '' },
                itemFields: [
                    { kind: 'text', label: 'Platform', path: 'platform', placeholder: 'Instagram' },
                    { kind: 'text', label: 'URL', path: 'url' },
                ],
            } as ListSpec,
            {
                kind: 'list',
                label: 'Footer notes (copyright row)',
                path: 'footer.notes',
                newItem: '',
                itemFields: [{ kind: 'text', label: 'Note', path: '' }],
            } as ListSpec,
        ],
    },
];
