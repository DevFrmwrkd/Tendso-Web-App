/**
 * Field configuration for each section's style variants.
 *
 * The VisualEditor (components/editor/VisualEditor.tsx) calls
 * getXStyleFields(styleKey) to decide which input panels to render. The
 * values are derived from each .astro variant's `show*` flags — i.e., they
 * answer the question "does this variant render a headline / image / etc.?"
 *
 * Style key conventions:
 *   - 'A'–'J' → default styles (10 variants)
 *   - 'K1'–'K5' → Barber category (5 variants)
 *   - 'L1'–'L5' → Auto category
 *   - 'M1'–'M5' → Salon category
 *   - 'N1'–'N5' → Restaurant category
 *   - 'O1'–'O5' → Clinic category
 *   - '1'–'10' → legacy numeric aliases for A–J
 *
 * 175 total variants × 5 sections = 875 cells. We don't enumerate every cell;
 * within a section we factor common patterns (e.g. most K–O hero variants
 * accept the full set) and override the exceptions.
 */

interface HeroStyleFields {
    usesHeadline: boolean
    usesTagline: boolean
    usesDescription: boolean
    usesTestimonial: boolean
    usesBadge: boolean
    usesButton: boolean
    usesImage: boolean
}

interface AboutStyleFields {
    usesHeadline: boolean
    usesBadge: boolean
    usesDescription: boolean
    usesImages: boolean
    usesUsps: boolean
    usesTagline: boolean
    usesTags: boolean
}

interface ServicesStyleFields {
    usesHeadline: boolean
    usesSubheadline: boolean
    usesBadge: boolean
    usesImage: boolean
    usesList: boolean
    usesCta: boolean
}

interface GalleryStyleFields {
    usesHeadline: boolean
    usesSubheadline: boolean
    usesProducts: boolean
    usesTestimonials: boolean
    usesTags: boolean
    usesImages: boolean
    usesCta: boolean
}

interface ContactStyleFields {
    // "uses*" = the rendered template includes this slot (drives visibility toggles)
    usesHeadline: boolean
    usesDescription: boolean
    usesBadge: boolean
    usesInfo: boolean    // phone / email / address — always editable
    usesSocial: boolean  // social links — always editable
    // "editable*" = the .astro variant accepts a prop for the slot's text.
    // Variants where the headline/badge text is hardcoded (most defaults & all
    // K–O variants) leave these false — visibility toggles still work, but no
    // text input is shown.
    editableHeadline: boolean
    editableBadge: boolean
}

// ============================================================
// HERO
// ============================================================
// Most K–O hero variants render the full set (headline + tagline + description +
// testimonial + button + image). Exceptions are explicit.
const HERO_FULL: HeroStyleFields = {
    usesHeadline: true,
    usesTagline: true,
    usesDescription: true,
    usesTestimonial: true,
    usesBadge: true,
    usesButton: true,
    usesImage: true,
}

const heroFields: Record<string, HeroStyleFields> = {
    // Defaults (A–J) — preserved from original config
    'A': HERO_FULL,
    'B': { usesHeadline: true, usesTagline: false, usesDescription: false, usesTestimonial: false, usesBadge: false, usesButton: false, usesImage: true },
    'C': { usesHeadline: true, usesTagline: true, usesDescription: false, usesTestimonial: false, usesBadge: false, usesButton: true, usesImage: true },
    'D': { usesHeadline: true, usesTagline: true, usesDescription: true, usesTestimonial: false, usesBadge: true, usesButton: false, usesImage: true },
    'E': HERO_FULL,
    'F': { usesHeadline: true, usesTagline: true, usesDescription: true, usesTestimonial: false, usesBadge: true, usesButton: true, usesImage: true },
    'G': { usesHeadline: true, usesTagline: true, usesDescription: true, usesTestimonial: false, usesBadge: true, usesButton: true, usesImage: true },
    'H': { usesHeadline: true, usesTagline: true, usesDescription: true, usesTestimonial: false, usesBadge: true, usesButton: true, usesImage: true },
    'I': { usesHeadline: true, usesTagline: true, usesDescription: true, usesTestimonial: false, usesBadge: true, usesButton: true, usesImage: true },
    'J': { usesHeadline: true, usesTagline: true, usesDescription: true, usesTestimonial: false, usesBadge: true, usesButton: true, usesImage: true },

    // Barber category — K3 has no image/tagline/testimonial; K5 has no tagline/testimonial
    'K1': HERO_FULL,
    'K2': { usesHeadline: true, usesTagline: true, usesDescription: true, usesTestimonial: false, usesBadge: true, usesButton: true, usesImage: true },
    'K3': { usesHeadline: true, usesTagline: false, usesDescription: true, usesTestimonial: false, usesBadge: false, usesButton: true, usesImage: false },
    'K4': { usesHeadline: true, usesTagline: true, usesDescription: true, usesTestimonial: false, usesBadge: true, usesButton: true, usesImage: true },
    'K5': { usesHeadline: true, usesTagline: false, usesDescription: true, usesTestimonial: false, usesBadge: false, usesButton: true, usesImage: true },

    // Auto, Salon, Restaurant, Clinic — all five variants accept the full set
    'L1': HERO_FULL, 'L2': HERO_FULL, 'L3': HERO_FULL, 'L4': HERO_FULL, 'L5': HERO_FULL,
    'M1': HERO_FULL, 'M2': HERO_FULL, 'M3': HERO_FULL, 'M4': HERO_FULL, 'M5': HERO_FULL,
    'N1': HERO_FULL, 'N2': HERO_FULL, 'N3': HERO_FULL, 'N4': HERO_FULL, 'N5': HERO_FULL,
    'O1': HERO_FULL, 'O2': HERO_FULL, 'O3': HERO_FULL, 'O4': HERO_FULL, 'O5': HERO_FULL,
}

// ============================================================
// ABOUT
// ============================================================
const ABOUT_RICH: AboutStyleFields = {
    usesHeadline: true,
    usesBadge: false,
    usesDescription: true,
    usesImages: true,
    usesUsps: false,
    usesTagline: true,
    usesTags: true,
}

const aboutFields: Record<string, AboutStyleFields> = {
    // Defaults — preserved
    'A': { usesHeadline: true, usesBadge: true, usesDescription: true, usesImages: true, usesUsps: true, usesTagline: false, usesTags: false },
    'B': { usesHeadline: false, usesBadge: true, usesDescription: true, usesImages: true, usesUsps: false, usesTagline: false, usesTags: false },
    'C': { usesHeadline: true, usesBadge: false, usesDescription: true, usesImages: true, usesUsps: false, usesTagline: true, usesTags: true },
    'D': { usesHeadline: false, usesBadge: true, usesDescription: true, usesImages: true, usesUsps: false, usesTagline: false, usesTags: false },
    'E': { usesHeadline: true, usesBadge: true, usesDescription: true, usesImages: true, usesUsps: true, usesTagline: false, usesTags: true },
    'F': { usesHeadline: true, usesBadge: true, usesDescription: true, usesImages: true, usesUsps: true, usesTagline: true, usesTags: false },
    'G': { usesHeadline: true, usesBadge: false, usesDescription: true, usesImages: true, usesUsps: true, usesTagline: true, usesTags: false },
    'H': { usesHeadline: true, usesBadge: true, usesDescription: true, usesImages: true, usesUsps: true, usesTagline: true, usesTags: true },
    'I': { usesHeadline: true, usesBadge: true, usesDescription: true, usesImages: false, usesUsps: true, usesTagline: true, usesTags: true },
    'J': { usesHeadline: true, usesBadge: true, usesDescription: true, usesImages: true, usesUsps: true, usesTagline: true, usesTags: true },

    // Barber — K3 has no images, K4 + K5 have no tagline/tags
    'K1': ABOUT_RICH,
    'K2': { usesHeadline: true, usesBadge: false, usesDescription: true, usesImages: true, usesUsps: false, usesTagline: false, usesTags: false },
    'K3': { usesHeadline: true, usesBadge: false, usesDescription: true, usesImages: false, usesUsps: false, usesTagline: false, usesTags: false },
    'K4': { usesHeadline: true, usesBadge: false, usesDescription: true, usesImages: true, usesUsps: false, usesTagline: false, usesTags: false },
    'K5': { usesHeadline: true, usesBadge: false, usesDescription: true, usesImages: true, usesUsps: false, usesTagline: false, usesTags: false },

    // Auto — L4 no tags; rest are full
    'L1': ABOUT_RICH,
    'L2': ABOUT_RICH,
    'L3': ABOUT_RICH,
    'L4': { usesHeadline: true, usesBadge: false, usesDescription: true, usesImages: true, usesUsps: false, usesTagline: true, usesTags: false },
    'L5': ABOUT_RICH,

    // Salon — M4 and M5 no tags
    'M1': ABOUT_RICH,
    'M2': ABOUT_RICH,
    'M3': ABOUT_RICH,
    'M4': { usesHeadline: true, usesBadge: false, usesDescription: true, usesImages: true, usesUsps: false, usesTagline: true, usesTags: false },
    'M5': { usesHeadline: true, usesBadge: false, usesDescription: true, usesImages: true, usesUsps: false, usesTagline: true, usesTags: false },

    // Restaurant — N3 and N4 no tags
    'N1': ABOUT_RICH,
    'N2': ABOUT_RICH,
    'N3': { usesHeadline: true, usesBadge: false, usesDescription: true, usesImages: true, usesUsps: false, usesTagline: true, usesTags: false },
    'N4': { usesHeadline: true, usesBadge: false, usesDescription: true, usesImages: true, usesUsps: false, usesTagline: true, usesTags: false },
    'N5': ABOUT_RICH,

    // Clinic — O2, O3, O5 no tags; O4 no images either
    'O1': ABOUT_RICH,
    'O2': { usesHeadline: true, usesBadge: false, usesDescription: true, usesImages: true, usesUsps: false, usesTagline: true, usesTags: false },
    'O3': { usesHeadline: true, usesBadge: false, usesDescription: true, usesImages: true, usesUsps: false, usesTagline: true, usesTags: false },
    'O4': { usesHeadline: true, usesBadge: false, usesDescription: true, usesImages: false, usesUsps: false, usesTagline: true, usesTags: false },
    'O5': { usesHeadline: true, usesBadge: false, usesDescription: true, usesImages: true, usesUsps: false, usesTagline: true, usesTags: false },
}

// ============================================================
// SERVICES
// ============================================================
// Every K–O services variant accepts the same core fields: headline,
// subheadline, services list. None have a header image, badge, or trailing
// CTA section (those are visual flourishes, not content slots).
const SERVICES_STANDARD: ServicesStyleFields = {
    usesHeadline: true,
    usesSubheadline: true,
    usesBadge: false,
    usesImage: false,
    usesList: true,
    usesCta: false,
}

const servicesFields: Record<string, ServicesStyleFields> = {
    // Defaults — preserved
    'A': { usesHeadline: true, usesSubheadline: true, usesBadge: true, usesImage: true, usesList: true, usesCta: false },
    'B': { usesHeadline: true, usesSubheadline: false, usesBadge: false, usesImage: false, usesList: true, usesCta: false },
    'C': { usesHeadline: true, usesSubheadline: true, usesBadge: true, usesImage: false, usesList: true, usesCta: false },
    'D': { usesHeadline: true, usesSubheadline: true, usesBadge: true, usesImage: true, usesList: true, usesCta: false },
    'E': { usesHeadline: true, usesSubheadline: false, usesBadge: true, usesImage: false, usesList: true, usesCta: false },
    'F': { usesHeadline: true, usesSubheadline: true, usesBadge: true, usesImage: false, usesList: true, usesCta: false },
    'G': { usesHeadline: true, usesSubheadline: true, usesBadge: true, usesImage: false, usesList: true, usesCta: false },
    'H': { usesHeadline: true, usesSubheadline: true, usesBadge: true, usesImage: false, usesList: true, usesCta: true },
    'I': { usesHeadline: true, usesSubheadline: true, usesBadge: true, usesImage: false, usesList: true, usesCta: true },
    'J': { usesHeadline: true, usesSubheadline: true, usesBadge: true, usesImage: false, usesList: true, usesCta: true },

    // Category K–O — all share the same shape
    'K1': SERVICES_STANDARD, 'K2': SERVICES_STANDARD, 'K3': SERVICES_STANDARD, 'K4': SERVICES_STANDARD, 'K5': SERVICES_STANDARD,
    'L1': SERVICES_STANDARD, 'L2': SERVICES_STANDARD, 'L3': SERVICES_STANDARD, 'L4': SERVICES_STANDARD, 'L5': SERVICES_STANDARD,
    'M1': SERVICES_STANDARD, 'M2': SERVICES_STANDARD, 'M3': SERVICES_STANDARD, 'M4': SERVICES_STANDARD, 'M5': SERVICES_STANDARD,
    'N1': SERVICES_STANDARD, 'N2': SERVICES_STANDARD, 'N3': SERVICES_STANDARD, 'N4': SERVICES_STANDARD, 'N5': SERVICES_STANDARD,
    'O1': SERVICES_STANDARD, 'O2': SERVICES_STANDARD, 'O3': SERVICES_STANDARD, 'O4': SERVICES_STANDARD, 'O5': SERVICES_STANDARD,
}

// ============================================================
// GALLERY
// ============================================================
// Every K–O gallery variant accepts the same core fields: headline,
// subheadline, items (project entries with title/description/image).
const GALLERY_STANDARD: GalleryStyleFields = {
    usesHeadline: true,
    usesSubheadline: true,
    usesProducts: true,
    usesTestimonials: false,
    usesTags: false,
    usesImages: false,
    usesCta: false,
}

const galleryFields: Record<string, GalleryStyleFields> = {
    // Defaults — preserved
    'A': { usesHeadline: true, usesSubheadline: true, usesProducts: true, usesTestimonials: true, usesTags: true, usesImages: false, usesCta: false },
    'B': { usesHeadline: true, usesSubheadline: true, usesProducts: true, usesTestimonials: false, usesTags: true, usesImages: false, usesCta: false },
    'C': { usesHeadline: true, usesSubheadline: true, usesProducts: false, usesTestimonials: false, usesTags: false, usesImages: true, usesCta: false },
    'D': { usesHeadline: true, usesSubheadline: true, usesProducts: true, usesTestimonials: false, usesTags: true, usesImages: false, usesCta: true },
    'E': { usesHeadline: true, usesSubheadline: true, usesProducts: true, usesTestimonials: true, usesTags: true, usesImages: false, usesCta: false },
    'F': { usesHeadline: true, usesSubheadline: true, usesProducts: true, usesTestimonials: false, usesTags: true, usesImages: false, usesCta: true },
    'G': { usesHeadline: true, usesSubheadline: true, usesProducts: true, usesTestimonials: true, usesTags: true, usesImages: false, usesCta: false },
    'H': { usesHeadline: true, usesSubheadline: true, usesProducts: true, usesTestimonials: false, usesTags: true, usesImages: false, usesCta: true },
    'I': { usesHeadline: true, usesSubheadline: true, usesProducts: true, usesTestimonials: false, usesTags: true, usesImages: false, usesCta: true },
    'J': { usesHeadline: true, usesSubheadline: true, usesProducts: true, usesTestimonials: false, usesTags: true, usesImages: false, usesCta: true },

    // Category K–O — all share the same shape
    'K1': GALLERY_STANDARD, 'K2': GALLERY_STANDARD, 'K3': GALLERY_STANDARD, 'K4': GALLERY_STANDARD, 'K5': GALLERY_STANDARD,
    'L1': GALLERY_STANDARD, 'L2': GALLERY_STANDARD, 'L3': GALLERY_STANDARD, 'L4': GALLERY_STANDARD, 'L5': GALLERY_STANDARD,
    'M1': GALLERY_STANDARD, 'M2': GALLERY_STANDARD, 'M3': GALLERY_STANDARD, 'M4': GALLERY_STANDARD, 'M5': GALLERY_STANDARD,
    'N1': GALLERY_STANDARD, 'N2': GALLERY_STANDARD, 'N3': GALLERY_STANDARD, 'N4': GALLERY_STANDARD, 'N5': GALLERY_STANDARD,
    'O1': GALLERY_STANDARD, 'O2': GALLERY_STANDARD, 'O3': GALLERY_STANDARD, 'O4': GALLERY_STANDARD, 'O5': GALLERY_STANDARD,
}

// ============================================================
// CONTACT
// ============================================================
// All Contact variants always render the core info (phone/email/address) +
// social links — `usesInfo` and `usesSocial` are true everywhere. What varies
// is whether they show a top headline and a descriptive paragraph above the
// info block. Many K–O variants use a "minimal" form (no headline/desc).
const CONTACT_FULL: ContactStyleFields = {
    usesHeadline: true,
    usesDescription: true,
    usesBadge: false,
    usesInfo: true,
    usesSocial: true,
    editableHeadline: false,
    editableBadge: false,
}

const CONTACT_MINIMAL: ContactStyleFields = {
    usesHeadline: false,
    usesDescription: false,
    usesBadge: false,
    usesInfo: true,
    usesSocial: true,
    editableHeadline: false,
    editableBadge: false,
}

const contactFields: Record<string, ContactStyleFields> = {
    // Defaults — only G, H, I, J accept editable headline + badge text props.
    // All other variants render hardcoded headings, so editable* stays false.
    'A': { usesHeadline: true, usesDescription: true, usesBadge: true, usesInfo: true, usesSocial: true, editableHeadline: false, editableBadge: false },
    'B': CONTACT_FULL,
    'C': CONTACT_FULL,
    'D': { usesHeadline: true, usesDescription: false, usesBadge: true, usesInfo: true, usesSocial: true, editableHeadline: false, editableBadge: false },
    'E': { usesHeadline: true, usesDescription: true, usesBadge: true, usesInfo: true, usesSocial: true, editableHeadline: false, editableBadge: false },
    'F': CONTACT_FULL,
    'G': { usesHeadline: true, usesDescription: true, usesBadge: true, usesInfo: true, usesSocial: true, editableHeadline: true, editableBadge: true },
    'H': { usesHeadline: true, usesDescription: true, usesBadge: true, usesInfo: true, usesSocial: true, editableHeadline: true, editableBadge: true },
    'I': { usesHeadline: true, usesDescription: true, usesBadge: true, usesInfo: true, usesSocial: true, editableHeadline: true, editableBadge: true },
    'J': { usesHeadline: true, usesDescription: true, usesBadge: true, usesInfo: true, usesSocial: true, editableHeadline: true, editableBadge: true },

    // Barber — K1, K2 have headline+desc; K3, K4, K5 are minimal
    'K1': CONTACT_FULL, 'K2': CONTACT_FULL,
    'K3': CONTACT_MINIMAL, 'K4': CONTACT_MINIMAL, 'K5': CONTACT_MINIMAL,

    // Auto — L1 has headline+desc; L2-L5 are minimal
    'L1': CONTACT_FULL,
    'L2': CONTACT_MINIMAL, 'L3': CONTACT_MINIMAL, 'L4': CONTACT_MINIMAL, 'L5': CONTACT_MINIMAL,

    // Salon — M1 has headline+desc; M2-M5 are minimal
    'M1': CONTACT_FULL,
    'M2': CONTACT_MINIMAL, 'M3': CONTACT_MINIMAL, 'M4': CONTACT_MINIMAL, 'M5': CONTACT_MINIMAL,

    // Restaurant — N1 has headline+desc; N2-N5 are minimal
    'N1': CONTACT_FULL,
    'N2': CONTACT_MINIMAL, 'N3': CONTACT_MINIMAL, 'N4': CONTACT_MINIMAL, 'N5': CONTACT_MINIMAL,

    // Clinic — O1 has headline+desc; O2-O5 are minimal
    'O1': CONTACT_FULL,
    'O2': CONTACT_MINIMAL, 'O3': CONTACT_MINIMAL, 'O4': CONTACT_MINIMAL, 'O5': CONTACT_MINIMAL,
}

// ============================================================
// Normalization + exports
// ============================================================

// Map legacy numeric keys (1–10) to letter keys (A–J)
const numToLetter: Record<string, string> = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E', '6': 'F', '7': 'G', '8': 'H', '9': 'I', '10': 'J' }

function normalize(style: string): string {
    if (!style) return 'A'
    return numToLetter[style] || style
}

export function getHeroStyleFields(style: string): HeroStyleFields {
    return heroFields[normalize(style)] || heroFields['A']
}

export function getAboutStyleFields(style: string): AboutStyleFields {
    return aboutFields[normalize(style)] || aboutFields['A']
}

export function getServicesStyleFields(style: string): ServicesStyleFields {
    return servicesFields[normalize(style)] || servicesFields['A']
}

export function getGalleryStyleFields(style: string): GalleryStyleFields {
    return galleryFields[normalize(style)] || galleryFields['A']
}

export function getContactStyleFields(style: string): ContactStyleFields {
    return contactFields[normalize(style)] || contactFields['A']
}
