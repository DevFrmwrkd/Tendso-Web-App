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

/**
 * Content group -> the page section it edits.
 *
 * The Content panel used to list all sixteen groups for every template, so an
 * admin editing a template with no marquee still got a Marquee group whose
 * fields reach nothing, and every group was titled in OUR vocabulary
 * ("Services") rather than the template's ("The rooms"). ContentFieldsAuto now
 * filters and retitles through this map plus templateCatalog.sectionsForTemplate.
 *
 * 'header' has no entry on purpose: no wrapper gates on the header, so it is
 * never filtered out. Any group missing from this map is likewise always shown —
 * failing open, because a hidden field the owner needs is worse than a spare one.
 */
export const GROUP_BLOCK: Record<string, string> = {
    hero: 'HERO',
    marquee: 'MARQUEE',
    trust: 'TRUST',
    about: 'ABOUT',
    services: 'SERVICES',
    why: 'WHY-US',
    how: 'HOW-IT-WORKS',
    testimonials: 'TESTIMONIALS',
    gallery: 'GALLERY',
    faq: 'FAQ',
    area: 'SERVICE-AREA',
    credentials: 'CREDENTIALS',
    location: 'LOCATION',
    ctaBand: 'CTA-BAND',
    footer: 'FOOTER',
};

export const GENERIC_CONTENT_SCHEMA: GroupSpec[] = [
    {
        id: 'header',
        title: 'Header / Nav',
        description: 'Sticky top bar — brand, navigation links, phone, primary CTA.',
        fields: [
            {
                kind: 'text',
                label: 'Brand name (nav wordmark)',
                path: 'footer.brand',
                fallbackPaths: ['business_name'],
                placeholder: 'Your business name',
            },
            // A bare place name printed beside the wordmark. One field, three
            // consumers: the header tag, the footer wordmark and the map
            // caption — nothing else carries a locality (hero.kicker is a
            // sentence, contact.address is the whole address, area.places is a
            // list). Lives in this group because the header is where it first
            // appears; it is `footer.*` because the footer owns the wordmark.
            // Optional: a template that never renders it is unaffected.
            {
                kind: 'text',
                label: 'Location tag (beside the brand name)',
                path: 'footer.locality',
                placeholder: 'Nasugbu',
            },
            // business_name and tagline drive the DOCUMENT, not the page body:
            // astro-builder maps them to layout.businessName/tagline, which every
            // wrapper bakes into <title>, <meta name="description">, og:title and
            // og:description. Nothing else in the editor writes either one, so
            // without these two fields a misspelt name in the browser tab or a
            // wrong Google snippet could only be fixed in the database.
            //
            // They are easy to confuse with 'Brand name' above, which is the
            // on-page wordmark (content.footer.brand) — hence the explicit
            // labels. And note the trap they close: hero.headline declares
            // fallbackPaths ['tagline','business_name'], so the Hero group
            // DISPLAYS the tagline while writing to hero.headline. Correcting it
            // there changes the on-page H1 and leaves the page title untouched.
            {
                kind: 'text',
                label: 'Business name (browser tab & search)',
                path: 'business_name',
                placeholder: 'Your business name',
            },
            {
                kind: 'text',
                label: 'Tagline (browser tab & search)',
                path: 'tagline',
                placeholder: 'What the business does, in a line',
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
                // Several templates print the closing phrase of the headline in
                // their accent colour — it is the most recognisable thing about
                // them. They derive it from the sentence itself (the last line,
                // or whatever follows the last comma), so most headlines get it
                // for free; this line is here so an owner who wants to choose
                // the phrase knows they can, instead of the feature being
                // reachable only by someone who guesses at HTML.
                hint: 'The H1 / hero title. Multi-line H1s use the list below. Wrap a phrase in <em>…</em> to print it in the accent colour.',
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
            {
                // Glacier (barbershop:BP) draws these as the three-cell strip
                // across the bottom of its hero. It is the only consumer today,
                // and it takes the first three. Rows accept a title alone — the
                // body line is optional and is not invented when it is absent.
                //
                // OPT-IN, WITH NO PRODUCER, DELIBERATELY. The obvious source is
                // content.unique_selling_points, and it was wired that way
                // first. It cannot stay: generate-website defaults that key to
                // the literal ['Quality','Reliability','Service'] and persists
                // the default back as extracted content, so a shop whose
                // extraction found no USPs would publish QUALITY / RELIABILITY
                // / SERVICE across its own hero, in its own voice, under barber
                // iconography — and nothing downstream can tell that triple
                // apart from three the owner really gave. An empty strip that
                // an admin fills is the honest state; the hero draws nothing at
                // all until a row has a title.
                kind: 'list',
                label: 'Hero USP strip (3 cells)',
                path: 'hero.usps',
                maxItems: 3,
                newItem: { title: '', text: '' },
                itemFields: [
                    { kind: 'text', label: 'Title', path: 'title', placeholder: 'Walk-ins welcome' },
                    { kind: 'text', label: 'Body', path: 'text', placeholder: 'Seven days a week, 9-7' },
                ],
            } as ListSpec,
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
            // The italic “— Name, role” line under the paragraphs. AboutF binds
            // it and falls back to about.signature for the value, so before this
            // field the line rendered the business name under a hook that led
            // nowhere: editing “Signature line” changed the pull-quote instead.
            { kind: 'text', label: 'Signature name / role', path: 'about.signatureName', fallbackPaths: ['about.signature'], placeholder: 'Ariel Bautista, master barber' },
            // The circular EST. disc over the about photo. Both halves are
            // optional and the disc is not drawn at all without one of them.
            { kind: 'text', label: 'Stamp · year', path: 'about.stampYear', placeholder: '2013' },
            { kind: 'text', label: 'Stamp · label', path: 'about.stampTag', placeholder: 'EST.' },
            // The line under the name in an owner / host identity row. ONE piece
            // of free text, never assembled from parts — "hosting since 2019" is
            // a claim only the owner may make. Optional, so a template with no
            // identity row is unaffected.
            {
                kind: 'text',
                label: 'Role line (under the signature)',
                path: 'about.role',
                placeholder: 'Owner · lives on site',
            },
            {
                kind: 'list',
                label: 'Body paragraphs',
                path: 'about.paragraphs',
                newItem: '',
                itemFields: [{ kind: 'textarea', label: 'Paragraph', path: '' }],
            } as ListSpec,
            // Label / value rows printed beside the story — "Bedrooms · 4
            // en-suite", "Pool · 18 m salt". They live on about.* rather than a
            // prefix of their own because the design draws them INSIDE the about
            // section, and a section mixing two content prefixes gets hidden by
            // either Blocks toggle. Empty by default: a template that draws no
            // ledger is unaffected, and an owner who types nothing gets no rows.
            {
                kind: 'list',
                label: 'Spec rows (label · value)',
                path: 'about.specs',
                newItem: { label: '', value: '' },
                itemFields: [
                    { kind: 'text', label: 'Label', path: 'label', placeholder: 'Bedrooms' },
                    { kind: 'text', label: 'Value', path: 'value', placeholder: '4 en-suite' },
                ],
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
                // The legacy shape stores this block as a BARE ARRAY at
                // content.services. Every sibling list declares the same kind of
                // fallback (testimonials, faq, credentials); services was the one
                // that did not, so an owner's real rooms read as "Items (0)" and
                // + Add then wrote onto an Array — silently dropped on save.
                fallbackPaths: ['services'],
                // Every row key below is OPTIONAL and blank on a new row, so a
                // template that renders none of them is unchanged — an empty
                // string reads exactly like the missing key it replaces.
                //
                // tag / price / duration are not new inventions: ServicesBI (and
                // other family sections) already EMIT data-field hooks for them
                // while the schema stopped at title/desc/note/image. That made
                // them dead hooks — clickable in v3, owned by no input. Declaring
                // them here fixes that existing gap as well as serving the rooms
                // ledger the new hospitality template needs.
                newItem: {
                    title: '', desc: '', note: '', tag: '', meta: '',
                    rating: '', price: '', duration: '', features: '', image: '',
                },
                itemFields: [
                    { kind: 'text', label: 'Title', path: 'title', placeholder: 'Service name' },
                    { kind: 'textarea', label: 'Description', path: 'desc' },
                    { kind: 'text', label: 'Note / meta', path: 'note', placeholder: 'Optional small print' },
                    { kind: 'text', label: 'Badge (floor / area / category)', path: 'tag', placeholder: 'Upstairs' },
                    { kind: 'text', label: 'Small line above the title', path: 'meta', placeholder: 'Private bath' },
                    {
                        kind: 'text',
                        label: 'Rating',
                        path: 'rating',
                        placeholder: '4.96',
                        hint: 'A ★ is drawn only next to a rating you type here.',
                    },
                    {
                        kind: 'text',
                        label: 'Price',
                        path: 'price',
                        placeholder: '₱3,200',
                        hint: 'Printed exactly as typed — never converted or totalled.',
                    },
                    { kind: 'text', label: 'Price unit', path: 'duration', placeholder: '/ night' },
                    // ONE comma-separated scalar, split at render time. A nested
                    // list inside a list row is impossible: ContentFieldsAuto's
                    // itemFields are FieldSpec (scalar) only, so a ListSpec here
                    // would render nothing and own no path.
                    {
                        kind: 'text',
                        label: 'Feature chips (comma-separated)',
                        path: 'features',
                        placeholder: 'Sea view, Queen bed, Own balcony',
                    },
                    { kind: 'image', label: 'Image (zig-zag templates)', path: 'image' },
                ],
            } as ListSpec,
            // The per-card button. Deliberately ONE label + href for the whole
            // grid rather than a field on every row: a card added with '+ Add'
            // must arrive with a working button instead of a blank one the owner
            // has to retype. Templates without a per-card button ignore both.
            {
                kind: 'link',
                label: 'Card button (all cards)',
                path: 'services.ctaLabel',
                hrefPath: 'services.ctaHref',
                placeholder: 'Enquire about this room',
            },
            // Optional band under the item grid for a second, whole-of-it offer
            // (the hospitality templates use it for "the whole house"). Every
            // field blank by default and the band only renders when one of them
            // is filled, so no existing template gains an empty slab.
            { kind: 'text', label: 'Whole-package band · eyebrow', path: 'services.whole.tag', placeholder: 'Whole house' },
            { kind: 'text', label: 'Whole-package band · headline', path: 'services.whole.headline', placeholder: 'All three rooms — sleeps 7' },
            { kind: 'textarea', label: 'Whole-package band · body', path: 'services.whole.body' },
            {
                kind: 'text',
                label: 'Whole-package band · price',
                path: 'services.whole.price',
                placeholder: '₱7,200',
                hint: 'Printed exactly as typed — never added up from the items above.',
            },
            { kind: 'text', label: 'Whole-package band · price unit', path: 'services.whole.unit', placeholder: '/ night' },
        ],
    },
    {
        id: 'why',
        title: 'Why us',
        description: 'Reasons to pick this business.',
        fields: [
            // Both optional. Templates that draw this section as text only leave
            // them blank and render exactly as before; the templates that use a
            // photo plate need the image on the why.* prefix, because a section
            // that mixes two content prefixes gets hidden by either Blocks toggle.
            { kind: 'image', label: 'Image', path: 'why.image' },
            { kind: 'text', label: 'Eyebrow tag', path: 'why.tag', placeholder: 'Why us' },
            { kind: 'text', label: 'Headline', path: 'why.headline' },
                // Every barbershop sect-head is a two-column head whose right
                // column is `{sub && …}`. The components have always read
                // `<section>.sub`; nothing ever declared or wrote it, so the
                // lead paragraph beside the heading could not render on any of
                // the six barbershop templates. services.sub was the only
                // member of the family that worked, which is likely how the
                // pattern got copied without its field.
            { kind: 'textarea', label: 'Sub-paragraph', path: 'why.sub', fallbackPaths: ['why.lead'] },
            { kind: 'textarea', label: 'Lead paragraph', path: 'why.lead' },
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
            { kind: 'textarea', label: 'Sub-paragraph', path: 'how.sub' },
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
            { kind: 'textarea', label: 'Sub-paragraph', path: 'testimonials.sub' },
            { kind: 'textarea', label: 'Big pull-quote (A/D templates)', path: 'testimonials.bigQuote' },
            { kind: 'text', label: 'Source line', path: 'testimonials.source', placeholder: '★ Reviews on Google' },
            {
                kind: 'list',
                label: 'Quotes',
                path: 'testimonials.items',
                fallbackPaths: ['testimonials'],
                newItem: { quote: '', who: '', rating: '' },
                itemFields: [
                    { kind: 'textarea', label: 'Quote', path: 'quote' },
                    { kind: 'text', label: 'Attribution', path: 'who' },
                    // Several designs draw a row of stars over every quote. Five
                    // stars printed for a guest who never gave a rating is a
                    // fabricated claim, so the stars are drawn from THIS number
                    // and a review with none gets the template's plain rule
                    // instead. Whole numbers 1-5.
                    {
                        kind: 'text',
                        label: 'Rating out of 5',
                        path: 'rating',
                        placeholder: '5',
                        hint: 'Stars are drawn only for a rating you type here. Leave blank for none.',
                    },
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
            { kind: 'textarea', label: 'Sub-paragraph', path: 'gallery.sub' },
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
            { kind: 'textarea', label: 'Sub-paragraph', path: 'faq.sub' },
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
            // Place + travel time, for the templates that print "Lio Airport ·
            // 25 min" rather than a bare chip. A SEPARATE list rather than
            // reshaping area.places above, which is a list of plain STRINGS that
            // seven templates already read as strings — turning it into a list of
            // objects is precisely the two-shape break that cost a sweep to find.
            // Empty by default; a template reading area.places is untouched.
            {
                kind: 'list',
                label: 'Places with travel time',
                path: 'area.rows',
                newItem: { place: '', time: '' },
                itemFields: [
                    { kind: 'text', label: 'Place', path: 'place', placeholder: 'Lio Airport' },
                    { kind: 'text', label: 'Time / distance', path: 'time', placeholder: '25 min' },
                ],
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
            { kind: 'textarea', label: 'Sub-paragraph', path: 'credentials.sub', fallbackPaths: ['credentials.body'] },
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
            // LocationBI already emits data-field="location.sub" against nothing,
            // so declaring it converts an existing dead hook into a real input
            // as well as feeding the new template's "getting here" paragraph.
            { kind: 'textarea', label: 'Sub-paragraph', path: 'location.sub' },
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
            // Key/value policy rows — check in, check out, pets, quiet hours.
            // A NEW list on purpose: `location.hours` directly above is declared
            // as a single TEXT field, and re-declaring it as a list would hide
            // whatever string is already typed there and let the next '+ Add'
            // destroy it. That is the exact data loss isSchemaEditablePath was
            // written to stop, so the rows get their own path instead. Empty by
            // default, and nothing else in the repo reads it yet.
            {
                kind: 'list',
                label: 'Policy / rules rows',
                path: 'location.rules',
                newItem: { label: '', value: '' },
                itemFields: [
                    { kind: 'text', label: 'Label', path: 'label', placeholder: 'Check in' },
                    { kind: 'text', label: 'Value', path: 'value', placeholder: 'After 2:00 PM' },
                ],
            } as ListSpec,
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
            // CtaBandBI already emits data-field="ctaBand.tag" against nothing —
            // another dead hook this declaration turns into a real input.
            { kind: 'text', label: 'Eyebrow tag', path: 'ctaBand.tag', placeholder: 'Ready when you are' },
            // Some closing bands are a full-bleed photograph under a scrim rather
            // than a flat colour. Optional: with no upload the band falls back to
            // its template's own ground, so nothing gains an empty grey slab.
            { kind: 'image', label: 'Background photo', path: 'ctaBand.image' },
            { kind: 'text', label: 'Headline', path: 'ctaBand.headline', placeholder: 'Your closing call' },
            { kind: 'textarea', label: 'Sub-line', path: 'ctaBand.sub' },
            {
                kind: 'link',
                label: 'CTA button',
                path: 'ctaBand.cta.text',
                hrefPath: 'ctaBand.cta.href',
                placeholder: 'Get in touch',
            },
            // The band's SECOND, outlined button. CtaBandF has always bound it
            // and always fallen back to `Call <phone>` -> tel: when the field is
            // empty, so before this the label and target were uneditable on
            // every barbershop template and the button vanished entirely on a
            // site with no phone number, with no input to bring it back.
            {
                kind: 'link',
                label: 'Second CTA button',
                path: 'ctaBand.cta2.text',
                hrefPath: 'ctaBand.cta2.href',
                placeholder: 'Call the shop',
                hint: 'Left blank, this falls back to your phone number as a tel: link.',
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
            // Column headings. Most footers hardcode "Visit" / "Index"; binding
            // them means the words on the page are the owner's, and a blank
            // value removes the heading rather than printing an empty one.
            // Optional everywhere — a footer that still hardcodes its heading
            // simply never reads these.
            {
                kind: 'text',
                label: 'Contact column heading',
                path: 'footer.visit.title',
                placeholder: 'Get in touch',
            },
            {
                kind: 'list',
                label: 'Visit column lines',
                path: 'footer.visit.lines',
                newItem: '',
                itemFields: [{ kind: 'text', label: 'Line', path: '' }],
            } as ListSpec,
            {
                kind: 'text',
                label: 'Links column heading',
                path: 'footer.explore.title',
                placeholder: 'This page',
            },
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


/* ────────────────────────────────────────────────────────────────────────────
 * WHICH data-field PATHS THE FORM ACTUALLY OWNS
 *
 * v3 makes text in the preview directly editable. It decided what was editable
 * with a hand-written SKIP regex, which is an unwinnable game: every template
 * family that ships a new data-field path gets inline editing for free, whether
 * or not the schema can represent it. LocationBI's `location.hours.<i>.day` slipped
 * through exactly that way, and the deep writer then converted the existing
 * `location.hours` STRING into an array — silently dropping every other hours row
 * on the next rebuild.
 *
 * Inverting it kills the whole class: a node is editable only if the form could
 * have edited it anyway.
 * ──────────────────────────────────────────────────────────────────────────── */

/** What one list looks like, flattened out of the schema for path lookups. */
export interface ListShape {
    /** Where the array is WRITTEN, e.g. "gallery.items". */
    path: string;
    /** Declared row sub-paths. An empty string means the row IS the value. */
    itemPaths: string[];
    /** Read-only paths the form displays rows from when `path` is empty. */
    fallbackPaths: string[];
}

const SCALAR_PATHS = new Set<string>();
const LIST_SHAPES: ListShape[] = [];

for (const group of GENERIC_CONTENT_SCHEMA) {
    for (const field of group.fields) {
        if ((field as ListSpec).kind === 'list') {
            const l = field as ListSpec;
            LIST_SHAPES.push({
                path: l.path,
                itemPaths: (l.itemFields ?? []).map((f) => f.path),
                fallbackPaths: l.fallbackPaths ?? [],
            });
        } else {
            const f = field as FieldSpec;
            SCALAR_PATHS.add(f.path);
            if (f.kind === 'link') SCALAR_PATHS.add(f.hrefPath || `${f.path}.href`);
        }
    }
}

/**
 * True when `path` is a field this schema declares — including list rows, whose
 * rendered paths are `<list>.<n>` (string arrays) or `<list>.<n>.<itemField>`.
 */
export function isSchemaEditablePath(path: string): boolean {
    if (!path) return false;
    if (SCALAR_PATHS.has(path)) return true;
    for (const list of LIST_SHAPES) {
        if (!path.startsWith(list.path + '.')) continue;
        const rest = path.slice(list.path.length + 1);
        const m = /^(\d+)(?:\.(.+))?$/.exec(rest);
        if (!m) continue;
        // `<list>.<n>` with no sub-path is a plain string row (area.places).
        // A string-array list declares one item field with an EMPTY path
        // (area.places), so `<list>.<n>` is the whole row.
        if (!m[2]) return list.itemPaths.length === 0 || list.itemPaths.includes('');
        if (list.itemPaths.includes(m[2])) return true;
    }
    return false;
}

/**
 * True when `path` addresses a ROW of a list this schema declares — either
 * `<list>.<n>` (a string-array row) or `<list>.<n>.<key>` (an object row).
 *
 * WHY IT EXISTS. Inline click-to-edit in the preview commits ONE leaf, and a
 * leaf write inside a list the draft does not hold yet mints a fresh sparse
 * array with that single row — every sibling becomes a JSON `null`. So array
 * rows are edited in the sidebar, which writes the whole array at once.
 *
 * WHY IT IS DERIVED. The exclusion used to be the hand-written regex
 * `/\.(items|steps|paragraphs)\.\d+/`, which matches list NAMES, not list
 * SHAPE. It covered half the schema's lists and left the rest wide open —
 * hero.headlineLines, trust.cells, about.specs, area.places, area.rows,
 * location.rules, footer.visit.lines, footer.explore.links, footer.hours,
 * footer.social and footer.notes — including `footer.hours.<i>.day`, the same
 * path family whose `location.hours` twin already destroyed data once (see the
 * block comment above). Reading the shape off LIST_SHAPES means a list added
 * to this schema tomorrow is excluded the moment it is declared.
 *
 * This can only ever NARROW what is inline-editable: every path it matches is
 * a list row the caller's allow-list had already admitted.
 *
 * ONE definition of "row", shared with listShapeForRowPath below — the writer
 * that has to preserve a row's siblings and the gate that keeps rows out of
 * inline editing must agree on what a row IS, or a path could be inline-edited
 * as a scalar while the writer treats it as a row (or worse, the reverse).
 */
export function isSchemaListRowPath(path: string): boolean {
    return listShapeForRowPath(path) !== null;
}

/**
 * The list `path` addresses a ROW of, or null.
 *
 *   gallery.items.2.image     -> the gallery.items shape
 *   about.paragraphs.0        -> the about.paragraphs shape
 *   gallery.items             -> null (the array itself, not a row)
 *   gallery.headline          -> null
 *
 * Deliberately LOOSER than isSchemaEditablePath: the sub-path is not required
 * to be a declared itemField. Anything under `<list>.<index>.` is a row write
 * by construction, and a link field's hrefPath can reach a key the ListSpec
 * never spelled out (`services.items.0.cta.text`). Refusing those would send
 * exactly the writes this exists to protect back down the destructive path.
 *
 * Longest list path wins, so a list living under another list's namespace
 * resolves to the inner one. None exist today — itemFields are scalar-only, so
 * the schema cannot express a nested list — but the tie-break costs nothing.
 */
export function listShapeForRowPath(path: string): ListShape | null {
    if (!path) return null;
    let best: ListShape | null = null;
    for (const list of LIST_SHAPES) {
        if (!path.startsWith(list.path + '.')) continue;
        const head = path.slice(list.path.length + 1).split('.')[0];
        if (!/^\d+$/.test(head)) continue;
        if (!best || list.path.length > best.path.length) best = list;
    }
    return best;
}
