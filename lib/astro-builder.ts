import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'
import { defaultsFor, type WhyItem, type HowStep, type Testimonial, type FaqItem, type CredItem, type TrustData, type CtaBand } from './block-defaults'

interface ExtractedContent {
    business_name: string
    tagline: string
    about: string
    services?: Array<{ name: string; description: string; icon?: string }>
    unique_selling_points?: string[]
    tone?: string
    contact?: {
        phone?: string
        email?: string
        address?: string
        whatsapp?: string
        messenger?: string
    }
    hero_cta?: { label: string; link: string }
    hero_cta_secondary?: { label: string; link: string }
    hero_badge_text?: string
    hero_testimonial?: string
    visibility?: Record<string, boolean>
    // Style G extra fields
    footer_badge?: string
    footer_headline?: string
    footer_hours?: string
    footer_days?: string
    about_signature_name?: string
    about_signature_role?: string
    about_headline?: string
    about_description?: string
    about_tagline?: string
    about_tags?: string[]
    about_images?: string[]
    services_headline?: string
    services_subheadline?: string
    services_image?: string
    services_cta?: { label: string; link: string }
    featured_headline?: string
    featured_subheadline?: string
    featured_products?: Array<{
        title: string
        description: string
        image?: string
        tags?: string[]
        testimonial?: { quote: string; author: string; avatar?: string }
    }>
    featured_images?: string[]
    featured_cta_text?: string
    featured_cta_link?: string
    navbar_links?: Array<{ label: string; href: string }>
    navbar_cta_text?: string
    navbar_cta_link?: string
    navbar_headline?: string
    footer?: {
        brand_blurb?: string
        social_links?: Array<{ platform: string; url: string }>
    }
    images?: string[]
    // ── New v01-spec block content (all optional; auto-seeded by build pipeline) ──
    location?: {
        lat?: number
        lng?: number
    }
    serviceArea?: {
        heading?: string
        places?: string[]
    }
    messaging?: {
        whatsapp?: string  // raw phone-like string; sanitized into wa.me URL at render
        messenger?: string // full messenger.com / m.me URL
    }
    business_city?: string  // used to seed serviceArea.places
    business_type?: string  // used to pick per-category content defaults
    googleMapsUrl?: string  // GBP / google.com/maps link — renders "Hours on Google" deeplink
    favicon?: string        // URL for the browser-tab icon (rel="icon")
    ogImage?: string        // URL for og:image / twitter:image link previews
    // ── Conversion-cluster blocks (admin overrides; else per-business-type defaults) ──
    trust?: TrustData
    why?: WhyItem[]
    how?: HowStep[]
    testimonials?: Testimonial[]
    faq?: FaqItem[]
    credentials?: CredItem[]
    ctaBand?: CtaBand
}

interface Customizations {
    navbarStyle?: string
    heroStyle?: string
    aboutStyle?: string
    servicesStyle?: string
    featuredStyle?: string
    footerStyle?: string
    galleryStyle?: string
    contactStyle?: string
    colorScheme?: string
    colorSchemeId?: string
    fontPairing?: string
    fontPairingId?: string
}

/**
 * Map numeric style (1-4) to letter (A-D) for backward compatibility
 */
function mapStyleToLetter(numericStyle: string | undefined, fallback: string = 'A'): string {
    if (!numericStyle) return fallback
    const map: Record<string, string> = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E', '6': 'F', '7': 'G', '8': 'H', '9': 'I', '10': 'J' }
    return map[numericStyle] || numericStyle // Pass through if already a letter
}

/**
 * Normalize Why / How / Testimonials / FAQ / Credentials block shape so
 * downstream Astro components can rely on a single consistent contract:
 *   { tag?, headline?, items: [...] }
 *
 * The codebase has three historical shapes for these blocks, all of which
 * land in `extractedContent` depending on origin:
 *
 *   A) Flat array straight from the AI / mobile pipeline:
 *        [{ title, body }, ...]
 *      OR
 *        [{ quote, name, context }, ...]
 *
 *   B) Wrapped shape from admin edits via the Content tab:
 *        { tag, headline, items: [{ title, body }, ...] }
 *
 *   C) `null` / `undefined` when no AI extraction + no admin edits.
 *
 * Components only read `(block).items` (or `.steps`). Shape A meant
 * `.items` was undefined → empty array → `items.length > 0` gate hides
 * the section entirely. That's why Why-Us, How-It-Works, and Testimonials
 * had their visibility toggle ON but didn't render — the gate inside the
 * component itself failed.
 *
 * `itemAliases` rewrites field names from the AI's naming (e.g. `name`)
 * to the canonical name components consume (e.g. `who`). Only renames
 * the alias key if it exists AND the canonical key doesn't — never
 * destroys admin-edited data.
 *
 * `opts.itemsKey` lets the How block keep its `steps` array name.
 */
function normalizeBlock(
    input: any,
    itemsKey: 'items' | 'steps' = 'items',
    itemAliases: Record<string, string> = {},
    opts: { altItemsKey?: string } = {},
): { tag?: string; headline?: string; items?: any[]; steps?: any[] } | undefined {
    if (input == null) return undefined
    // Find the array of items wherever it lives.
    let arr: any[] | null = null
    let wrapper: Record<string, any> = {}
    if (Array.isArray(input)) {
        arr = input
    } else if (typeof input === 'object') {
        wrapper = { ...input }
        if (Array.isArray(input[itemsKey])) {
            arr = input[itemsKey]
        } else if (opts.altItemsKey && Array.isArray(input[opts.altItemsKey])) {
            arr = input[opts.altItemsKey]
        }
    }
    if (!arr) return undefined
    // Apply field aliases per item. Never overwrite an existing canonical key.
    const mappedItems = arr.map((it: any) => {
        if (!it || typeof it !== 'object') return it
        const out: Record<string, any> = { ...it }
        for (const [from, to] of Object.entries(itemAliases)) {
            if (out[from] != null && out[to] == null) {
                out[to] = out[from]
            }
        }
        return out
    })
    // Strip the original itemsKey from wrapper to avoid double-emit.
    delete wrapper[itemsKey]
    if (opts.altItemsKey) delete wrapper[opts.altItemsKey]
    return { ...wrapper, [itemsKey]: mappedItems }
}

// Variant-code → category routing was removed when the template library was
// wiped. `submission.business_type` is still passed through for whatever new
// designs do with it (e.g. picking a default color palette).

// ─── Derived defaults for generic templates ────────────────────────────
// Shared, browser-safe helpers live in ./derive-content-defaults so the
// editor sidebar (ContentFieldsAuto) can mirror what we render here.
import {
    deriveContentDefaults,
    normalizeBusinessType,
} from './derive-content-defaults'

function deriveDefaultsFor(content: ExtractedContent, photos: string[]) {
    return deriveContentDefaults(content as any, photos)
}

/**
 * Maps business_type → color scheme id for the `auto` palette. Used by
 * the generic-template theme override when admin leaves Color Scheme on
 * "auto". Empty string means "keep the template's native palette".
 */
export const AUTO_SCHEME_BY_BUSINESS_TYPE: Record<string, string> = {
    barber:    'brown',
    salon:     'pink',
    spa:       'pink',
    // Autoshop family (P–T) default = Foundry hazard orange.
    auto:      'orange',
    autoshop:  'orange',
    automotive:'orange',
    // Restaurant family (U–Y) default = Harvest rustic warm.
    restaurant:'orange',
    food:      'orange',
    cafe:      'orange',
    // Shirtstore family (Z, AA–AD) default = Editorial warm earthy.
    retail:    'brown',
    store:     'brown',
    apparel:   'brown',
    clothing:  'brown',
    clinic:    'green',
    fitness:   'red',
    education: 'purple',
    services:  'maroon',
}

export function autoSchemeFor(businessType: string | undefined | null): string {
    const k = normalizeBusinessType(businessType)
    return AUTO_SCHEME_BY_BUSINESS_TYPE[k] || ''
}

// Minimal PH city-adjacency seed for the ServiceArea block (3-4 places per
// known business city). The brief: "service area as a real map or list of
// named places, not a vague 'we serve the area'". We seed concrete neighbors
// so the block reads finished cold; admin can edit any of them.
const SERVICE_AREA_SEEDS: Record<string, string[]> = {
    'manila': ['Sampaloc', 'Binondo', 'Ermita', 'Malate'],
    'quezon city': ['Cubao', 'Diliman', 'Project 4', 'Novaliches'],
    'makati': ['Poblacion', 'Salcedo Village', 'Legazpi Village', 'San Antonio'],
    'pasig': ['Ortigas', 'Kapitolyo', 'Maybunga', 'San Miguel'],
    'taguig': ['BGC', 'Western Bicutan', 'Lower Bicutan', 'Pinagsama'],
    'pasay': ['Bangkal', 'San Roque', 'Manila Bay area', 'Buendia'],
    'cebu city': ['Mandaue', 'Lapu-Lapu', 'Talisay', 'Banawa'],
    'davao city': ['Toril', 'Bunawan', 'Calinan', 'Buhangin'],
    'iloilo city': ['Jaro', 'La Paz', 'Mandurriao', 'Molo'],
    'bacolod': ['Talisay', 'Silay', 'Bago', 'Murcia'],
    'cagayan de oro': ['Lapasan', 'Carmen', 'Macasandig', 'Bulua'],
    'baguio': ['La Trinidad', 'Itogon', 'Tuba', 'Sablan'],
    'meycauayan': ['Marilao', 'Bocaue', 'Obando', 'Valenzuela'],
    'marilao': ['Meycauayan', 'Bocaue', 'Sta. Maria', 'Bulacan'],
    'bulacan': ['Malolos', 'Plaridel', 'Pulilan', 'Hagonoy'],
}

// Auto-derive a WhatsApp deeplink-safe phone string from a typed phone.
// Strips non-digits. If the result starts with "0" and looks like a PH local
// number, prepend "63". Empty string when input is unusable.
function derivePhoneDigits(phone: string | undefined | null): string {
    if (!phone) return ''
    const digits = phone.replace(/[^0-9]/g, '')
    if (!digits) return ''
    if (digits.startsWith('0') && digits.length === 11) return '63' + digits.slice(1)
    if (digits.startsWith('9') && digits.length === 10) return '63' + digits
    return digits
}

/**
 * Format a phone for display: forces a `+63` PH country prefix when the
 * input is a local PH mobile number (10 digits starting `9`, or 11
 * digits starting `09`). Numbers already in international form are left
 * alone. Empty input returns empty string so callers can fall through.
 */
function formatPhoneDisplay(phone: string | undefined | null): string {
    if (!phone) return ''
    const trimmed = String(phone).trim()
    if (!trimmed) return ''
    // Already international (+countrycode) — return as-is.
    if (trimmed.startsWith('+')) return trimmed
    const digits = trimmed.replace(/[^0-9]/g, '')
    if (!digits) return trimmed
    // PH local mobile patterns.
    if (digits.startsWith('09') && digits.length === 11) return '+63' + digits.slice(1)
    if (digits.startsWith('9') && digits.length === 10)  return '+63' + digits
    if (digits.startsWith('63') && digits.length >= 12)  return '+' + digits
    // Fallback — leave whatever the admin typed.
    return trimmed
}

/**
 * Transform existing ExtractedContent + Customizations into the Astro site-data.json format.
 *
 * Async because we geocode the business address at build time when no
 * lat/lng was provided — otherwise the Leaflet map points at a per-template
 * fallback city (Mission St / Linden Ave / etc).
 */
async function transformToAstroData(
    content: ExtractedContent,
    customizations: Customizations,
    photos: string[]
) {
    // ── Geocode address if no coords known ─────────────────────────────
    // Resolution order: admin-typed coords > submission.coordinates >
    // content.location > Nominatim lookup of contact.address. Cached into
    // content.location so subsequent regens skip the network call.
    const haveLatLng = (
        typeof content.location?.lat === 'number' &&
        typeof content.location?.lng === 'number'
    );
    if (!haveLatLng && content.contact?.address) {
        try {
            const { geocodeAddress } = await import('./geocode')
            const coords = await geocodeAddress(content.contact.address)
            if (coords) {
                content = {
                    ...content,
                    location: { ...(content.location || {}), lat: coords.lat, lng: coords.lng },
                }
            }
        } catch {
            // Geocoding failure is non-fatal — components fall back to
            // rendering the map at a coarse center if no coords.
        }
    }

    const heroStyle = mapStyleToLetter(customizations.heroStyle)
    const aboutStyle = mapStyleToLetter(customizations.aboutStyle)
    const servicesStyle = mapStyleToLetter(customizations.servicesStyle)
    const galleryStyle = mapStyleToLetter(customizations.galleryStyle || customizations.featuredStyle)
    const contactStyle = mapStyleToLetter(customizations.contactStyle || customizations.footerStyle)

    // Map visibility from snake_case to camelCase
    const vis = content.visibility || {}

    // Format the phone with +63 prefix for PH local mobiles so the header,
    // nav, footer, location card, and CTAs all show "+639278147733"
    // instead of "9278147733". Original raw value still available on the
    // submission if some component needs the local form.
    const formattedContact = content.contact
        ? { ...content.contact, phone: formatPhoneDisplay(content.contact.phone) || content.contact.phone }
        : content.contact

    return {
        layout: {
            businessName: content.business_name,
            tagline: content.tagline,
            navLinks: content.navbar_links || [
                { label: 'About', href: '#about' },
                { label: 'Services', href: '#services' },
                { label: 'Gallery', href: '#gallery' },
                { label: 'Contact', href: '#contact' },
            ],
            socialLinks: content.footer?.social_links || [],
            colorScheme: customizations.colorSchemeId || customizations.colorScheme || 'auto',
            fontPairing: customizations.fontPairingId || customizations.fontPairing || 'modern',
            contact: formattedContact || {},
            navbarStyle: heroStyle,
            // Favicon — admin uploads via the Images tab "Website tab image"
            // slot; flows through to BaseLayout's <link rel="icon">.
            favicon: (content as any).favicon || undefined,
            ogImage: (content as any).ogImage || (content as any).favicon || undefined,
        },
        customizations: {
            heroStyle,
            aboutStyle,
            servicesStyle,
            galleryStyle,
            contactStyle,
            // v01 extras — each block picks its own variant from the
            // Template tab. Pass through verbatim so the .astro block can
            // read variantStyle and switch between M1 / M2 layouts.
            trustStyle: (customizations as any).trustStyle ?? 'M1',
            whyUsStyle: (customizations as any).whyUsStyle ?? 'M1',
            howItWorksStyle: (customizations as any).howItWorksStyle ?? 'M1',
            testimonialsStyle: (customizations as any).testimonialsStyle ?? 'M1',
            faqStyle: (customizations as any).faqStyle ?? 'M1',
            serviceAreaStyle: (customizations as any).serviceAreaStyle ?? 'M1',
            credentialsStyle: (customizations as any).credentialsStyle ?? 'M1',
            ctaBandStyle: (customizations as any).ctaBandStyle ?? 'M1',
            clickToMessageStyle: (customizations as any).clickToMessageStyle ?? 'M1',
        },
        visibility: {
            heroSection: vis.hero_section !== false,
            heroHeadline: vis.hero_headline !== false,
            heroTagline: vis.hero_tagline !== false,
            heroDescription: vis.hero_description !== false,
            heroTestimonial: vis.hero_testimonial !== false,
            heroButton: vis.hero_button !== false,
            heroImage: vis.hero_image !== false,
            aboutSection: vis.about_section !== false,
            aboutBadge: vis.about_badge !== false,
            aboutHeadline: vis.about_headline !== false,
            aboutDescription: vis.about_description !== false,
            aboutImages: vis.about_images !== false,
            aboutTagline: vis.about_tagline !== false,
            aboutTags: vis.about_tags !== false,
            servicesSection: vis.services_section !== false,
            servicesBadge: vis.services_badge !== false,
            servicesHeadline: vis.services_headline !== false,
            servicesSubheadline: vis.services_subheadline !== false,
            servicesImage: vis.services_image !== false,
            servicesList: vis.services_list !== false,
            // (gallerySection moved below — auto-hides when empty)
            galleryHeadline: vis.featured_headline !== false,
            gallerySubheadline: vis.featured_subheadline !== false,
            galleryItems: vis.featured_products !== false,
            galleryImages: vis.featured_images !== false,
            galleryCta: vis.featured_cta !== false,
            contactSection: vis.footer_section !== false,
            contactBadge: vis.footer_badge !== false,
            contactHeadline: vis.footer_headline !== false,
            contactDescription: vis.footer_description !== false,
            contactInfo: vis.footer_contact !== false,
            contactSocial: vis.footer_social !== false,
            // New v01-spec blocks — render on every variant unless explicitly hidden.
            locationBlock: vis.location_block !== false,
            serviceAreaBlock: vis.service_area_block !== false,
            // Default off — floating WhatsApp/Messenger FAB is opt-in.
            // Admins can flip it on from the Blocks tab if the business
            // actually wants chat. Most don't, and the FAB clutters layout.
            clickToMessage: vis.click_to_message === true,
            // Scroll-to-top button — default ON. Themed via --primary so it
            // picks up the admin's color scheme automatically.
            scrollTopButton: vis.scroll_top_button !== false,
            // Trust/Testimonials/Credentials auto-hide when the admin
            // hasn't supplied content AND no AI extracted any. Avoids
            // fake-looking empty bands. Admin can re-enable explicitly
            // from the Blocks tab.
            trustBlock: vis.trust_block === false
                ? false
                : Array.isArray((content as any).trust?.cells)
                    ? (content as any).trust.cells.length > 0
                    : false,
            whyUsBlock: vis.why_us_block !== false,
            howItWorksBlock: vis.how_it_works_block !== false,
            // testimonials is an object `{ tag, headline, items[] }` on
            // generic templates; legacy A-O stored a plain array. Accept
            // either: section renders when admin disabled is explicitly
            // false OR there are zero quotes in either shape.
            testimonialsBlock: vis.testimonials_block === false
                ? false
                : (
                    Array.isArray((content as any).testimonials)
                        ? (content as any).testimonials.length > 0
                        : Array.isArray((content as any).testimonials?.items)
                            ? (content as any).testimonials.items.length > 0
                            : false
                ),
            faqBlock: vis.faq_block !== false,
            // Credentials auto-hides when no items exist. Like testimonials
            // the new shape is `{ tag, headline, items[] }` while legacy
            // stored a plain array. Accept either.
            credentialsBlock: vis.credentials_block === false
                ? false
                : (
                    Array.isArray((content as any).credentials)
                        ? (content as any).credentials.length > 0
                        : Array.isArray((content as any).credentials?.items)
                            ? (content as any).credentials.items.length > 0
                            : false
                ),
            // Gallery auto-hides when there's nothing to show (no admin
            // gallery items AND no submission photos).
            gallerySection: vis.gallery_section === false || vis.featured_section === false
                ? false
                : (Array.isArray((content as any).gallery?.items) && (content as any).gallery.items.length > 0)
                    || photos.length > 0,
            ctaBandBlock: vis.cta_band_block !== false,
        },
        hero: {
            businessName: content.business_name,
            headline: content.tagline,
            description: content.about,
            badgeText: content.hero_badge_text,
            testimonial: content.hero_testimonial,
            ctaLabel: content.hero_cta?.label,
            ctaLink: content.hero_cta?.link,
            ctaSecondaryLabel: content.hero_cta_secondary?.label,
            ctaSecondaryLink: content.hero_cta_secondary?.link,
            photos,
            services: content.services?.slice(0, 3),
            visibility: {
                heroHeadline: vis.hero_headline !== false,
                heroTagline: vis.hero_tagline !== false,
                heroDescription: vis.hero_description !== false,
                heroTestimonial: vis.hero_testimonial !== false,
                heroButton: vis.hero_button !== false,
                heroImage: vis.hero_image !== false,
            },
        },
        about: {
            businessName: content.business_name,
            description: content.about_description || content.about,
            headline: content.about_headline || 'About Us',
            tagline: content.about_tagline,
            tags: content.about_tags,
            usps: content.unique_selling_points,
            signatureName: content.about_signature_name,
            signatureRole: content.about_signature_role,
            photos: content.about_images?.length ? content.about_images : photos,
            visibility: {
                aboutBadge: vis.about_badge !== false,
                aboutHeadline: vis.about_headline !== false,
                aboutDescription: vis.about_description !== false,
                aboutImages: vis.about_images !== false,
                aboutTagline: vis.about_tagline !== false,
                aboutTags: vis.about_tags !== false,
            },
        },
        services: {
            headline: content.services_headline || 'Our Services',
            subheadline: content.services_subheadline,
            services: content.services || [
                { name: 'Service 1', description: 'Quality service' },
                { name: 'Service 2', description: 'Professional service' },
                { name: 'Service 3', description: 'Reliable service' },
            ],
            photos: content.services_image ? [content.services_image] : (photos.length > 0 ? [photos[0]] : []),
            ctaLabel: content.services_cta?.label,
            ctaLink: content.services_cta?.link,
            visibility: {
                servicesBadge: vis.services_badge !== false,
                servicesHeadline: vis.services_headline !== false,
                servicesSubheadline: vis.services_subheadline !== false,
                servicesImage: vis.services_image !== false,
                servicesList: vis.services_list !== false,
                servicesButton: vis.services_button !== false,
            },
        },
        gallery: {
            headline: content.featured_headline || 'Featured Work',
            subheadline: content.featured_subheadline,
            items: (content.featured_products || []).map((p, i) => ({
                title: p.title,
                description: p.description,
                image: p.image || photos[i],
                tags: p.tags,
                testimonial: p.testimonial,
            })),
            images: content.featured_images,
            ctaText: content.featured_cta_text,
            ctaLink: content.featured_cta_link,
            photos,
            visibility: {
                galleryHeadline: vis.featured_headline !== false,
                gallerySubheadline: vis.featured_subheadline !== false,
                galleryItems: vis.featured_products !== false,
                galleryImages: vis.featured_images !== false,
                galleryCta: vis.featured_cta !== false,
            },
        },
        contact: {
            businessName: content.business_name,
            email: content.contact?.email || 'contact@example.com',
            phone: content.contact?.phone || '+63 900 000 0000',
            address: content.contact?.address,
            whatsapp: content.contact?.whatsapp,
            messenger: content.contact?.messenger,
            description: content.footer?.brand_blurb,
            badgeText: content.footer_badge,
            headline: content.footer_headline,
            days: content.footer_days,
            hours: content.footer_hours,
            socialLinks: content.footer?.social_links,
            photos,
            visibility: {
                contactBadge: vis.footer_badge !== false,
                contactHeadline: vis.footer_headline !== false,
                contactDescription: vis.footer_description !== false,
                contactInfo: vis.footer_contact !== false,
                contactSocial: vis.footer_social !== false,
            },
        },
        // ── New v01-spec block payloads (auto-derived when admin hasn't set them) ──
        location: {
            lat: content.location?.lat,
            lng: content.location?.lng,
            // Owner edits hours in Google. If we have a GBP / maps link, we
            // surface it as the "Hours on Google" button. If not present,
            // fall back to a search-by-address Maps query so the button still
            // takes visitors to a Google surface that has live hours.
            googleMapsUrl:
                content.googleMapsUrl ||
                (content.contact?.address
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(content.contact.address)}`
                    : undefined),
        },
        serviceArea: (() => {
            const explicit = content.serviceArea?.places ?? []
            if (explicit.length > 0) {
                return {
                    heading: content.serviceArea?.heading ?? 'Service area',
                    places: explicit,
                }
            }
            // Seed from business city — try lowercased exact match against the
            // adjacency table. Falls back to silence (block renders nothing).
            const cityKey = (content.business_city ?? '').trim().toLowerCase()
            const seeds = SERVICE_AREA_SEEDS[cityKey]
            if (!seeds) return undefined
            return {
                heading: content.serviceArea?.heading ?? 'Service area',
                places: [content.business_city as string, ...seeds].filter(Boolean) as string[],
            }
        })(),
        messaging: {
            // Admin-typed value wins; otherwise derive from contact.phone so
            // the WhatsApp FAB just-works for any business that gave us a phone.
            whatsapp:
                content.messaging?.whatsapp ||
                derivePhoneDigits(content.contact?.phone) ||
                undefined,
            messenger: content.messaging?.messenger,
        },
        // ── Conversion-cluster blocks (neutral fallback after template wipe) ──
        // Resolution order: admin-typed → generic neutral fallback.
        ...(() => {
            const d = defaultsFor(content.business_type)
            return {
                trust: content.trust ?? d.trust,
                why: content.why ?? d.why,
                how: content.how ?? d.how,
                testimonials: content.testimonials ?? d.testimonials,
                faq: content.faq ?? d.faq,
                credentials: content.credentials ?? d.credentials,
                ctaBand: content.ctaBand ?? d.ctaBand,
            }
        })(),
        // ── Generic landing-page nested content ─────────────────────────
        // The Astro PageA…PageE wrappers read `siteData.content.hero.*`,
        // `siteData.content.about.*`, etc. — pass through the nested shape
        // produced by groq.service.generateGenericSections() / admin edits.
        // Existing legacy-template flows ignore this field, so it's
        // additive and doesn't affect A-O variants.
        content: (() => {
            const d = defaultsFor(content.business_type)
            const derived = deriveDefaultsFor(content, photos)
            const c = content as any

            // `content.services` is "array of {name, description}" in the
            // legacy shape, "object with .items[]" in the new shape. Detect.
            const servicesNested = (
                typeof c.services === 'object' &&
                !Array.isArray(c.services) &&
                c.services !== null
            ) ? c.services : undefined

            // Per-section "did admin/AI supply anything?" — if no, use the
            // derived defaults so the section renders coherently. Each leaf
            // still falls back individually inside the section component.
            const mergeShallow = <T extends object>(src: T | undefined, fb: T): T => {
                if (!src || typeof src !== 'object') return fb
                const out: any = { ...fb }
                for (const [k, v] of Object.entries(src)) {
                    if (v !== undefined && v !== null && v !== '') out[k] = v
                }
                return out as T
            }

            const heroMerged = mergeShallow<any>(c.hero, derived.hero)
            // Headline backfills: if neither admin nor AI gave a
            // single-line headline, use derived.headline. If neither gave
            // headlineLines, fall back to splitting headline on newlines.
            if (!heroMerged.headlineLines || (Array.isArray(heroMerged.headlineLines) && heroMerged.headlineLines.length === 0)) {
                if (typeof heroMerged.headline === 'string') {
                    heroMerged.headlineLines = heroMerged.headline.split('\n').filter(Boolean)
                }
                if (!heroMerged.headlineLines || heroMerged.headlineLines.length === 0) {
                    heroMerged.headlineLines = derived.hero.headlineLines
                }
            }

            return {
                description: content.about,
                photos,
                contact: formattedContact,
                marquee: mergeShallow<any>(c.marquee, derived.marquee),
                hero: heroMerged,
                about: mergeShallow<any>(c.about, derived.about),
                services: servicesNested
                    ? mergeShallow<any>(servicesNested, derived.services)
                    : derived.services,
                gallery: (() => {
                    const g = mergeShallow<any>(c.gallery, derived.gallery)
                    // Fill empty image slots with submission photos so the
                    // gallery is never an empty grid on first build.
                    if (Array.isArray(g.items)) {
                        g.items = g.items.map((it: any, i: number) => ({
                            ...it,
                            image: it?.image || photos[i] || '',
                        }))
                    } else if (photos.length) {
                        g.items = photos.slice(0, 6).map((image, i) => ({
                            image,
                            caption: derived.gallery.items[i]?.caption || '',
                        }))
                    }
                    return g
                })(),
                area: mergeShallow<any>(c.area, derived.area),
                location: { ...derived.location, ...(content.location || {}) },
                ctaBand: mergeShallow<any>(c.ctaBand, derived.ctaBand),
                footer: mergeShallow<any>(c.footer, derived.footer),
                navCtaText: c.navCtaText || 'Get in touch',
                navCtaHref: c.navCtaHref || '#visit',
                navbar_links: Array.isArray(c.navbar_links) && c.navbar_links.length
                    ? c.navbar_links
                    : derived.navbar_links,
                // Why / How / Testimonials / FAQ / Credentials — same 3-tier
                // resolution (admin > AI > derived) PLUS a shape normalizer
                // because the AI / legacy paths emit flat arrays
                // ([{title, body}]) while Astro components read the wrapped
                // shape ({tag, headline, items: [...]}). Without this every
                // first-build site rendered empty Why/How/Testimonials
                // sections — block toggle says ON but items.length === 0.
                // See docs/changes/TEMPLATES-SALONSPA-PLAN.md for full
                // context. Also remaps field aliases so components can
                // read a single canonical name (body / who / role).
                why:          normalizeBlock(c.why ?? derived.why, 'items', { description: 'body' }),
                how:          normalizeBlock(c.how ?? derived.how, 'steps', { description: 'body' }, { altItemsKey: 'items' }),
                trust:        c.trust ?? d.trust,
                testimonials: normalizeBlock(c.testimonials ?? undefined, 'items', { name: 'who', author: 'who', context: 'role' }),
                faq:          normalizeBlock(c.faq ?? derived.faq, 'items', { question: 'q', answer: 'a' }),
                credentials:  normalizeBlock(c.credentials ?? undefined, 'items', { description: 'desc', body: 'desc' }),
                // Carry over enhancedImages so the image picker modal can
                // surface them from inside the iframe-rendered Astro output.
                enhancedImages: c.enhancedImages,
                business_name: content.business_name,
                business_type: c.business_type,
                business_city: content.business_city,
            }
        })(),
    }
}

/**
 * Recursively copy a directory, skipping specified folder names.
 */
async function copyDir(src: string, dest: string, skip: Set<string> = new Set()): Promise<void> {
    await fs.mkdir(dest, { recursive: true })
    const entries = await fs.readdir(src, { withFileTypes: true })
    for (const entry of entries) {
        if (skip.has(entry.name)) continue
        const srcPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)
        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath, skip)
        } else {
            await fs.copyFile(srcPath, destPath)
        }
    }
}

/**
 * Build an Astro site from extracted content and customizations.
 * Writes site-data.json, runs astro build, and returns the generated HTML.
 *
 * On Vercel (read-only filesystem), copies the template to /tmp/ and builds there.
 */
export async function buildAstroSite(
    content: ExtractedContent,
    customizations: Customizations,
    photos: string[]
): Promise<string> {
    const sourceDir = path.join(process.cwd(), 'astro-site-template')

    // Detect read-only filesystem (Vercel) by checking if we can write to the source dir
    const isReadOnly = await fs.writeFile(
        path.join(sourceDir, '.write-test'), ''
    ).then(() => {
        fs.unlink(path.join(sourceDir, '.write-test')).catch(() => {})
        return false
    }).catch(() => true)

    let astroDir: string
    if (isReadOnly) {
        // Copy template source to /tmp/ (Vercel filesystem is read-only)
        // Skip node_modules/dist/.astro — we symlink node_modules from the deployed copy
        astroDir = path.join(os.tmpdir(), `astro-build-${Date.now()}`)
        console.log(`[ASTRO] Read-only filesystem detected, building in ${astroDir}`)
        await copyDir(sourceDir, astroDir, new Set(['node_modules', 'dist', '.astro']))
        // Symlink to the subdirectory's own node_modules (deployed via outputFileTracingIncludes)
        // This has astro + all transitive deps installed by the build script
        const sourceNM = path.join(sourceDir, 'node_modules')
        try {
            await fs.symlink(sourceNM, path.join(astroDir, 'node_modules'), 'dir')
            console.log(`[ASTRO] Symlinked node_modules → ${sourceNM}`)
        } catch (e) {
            console.warn(`[ASTRO] Symlink failed:`, e)
        }
    } else {
        astroDir = sourceDir
    }

    const dataPath = path.join(astroDir, 'src', 'data', 'site-data.json')
    const outputPath = path.join(astroDir, 'dist', 'index.html')

    // 1. Transform data to Astro format
    const siteData = await transformToAstroData(content, customizations, photos)

    // 2. Write site-data.json + ensure .astro cache dir exists
    await fs.writeFile(dataPath, JSON.stringify(siteData, null, 2), 'utf-8')
    await fs.mkdir(path.join(astroDir, '.astro'), { recursive: true })

    // 3. Run astro build via worker script (child process with cwd = astroDir)
    //    - Worker runs with cwd set to the build dir, so Astro's .astro/ cache resolves correctly
    //    - astro-site-template has its own node_modules (installed during Vercel build step)
    //    - outputFileTracingIncludes deploys them to /var/task/astro-site-template/node_modules/
    //    - Symlinked into /tmp/ build dir so the worker's imports resolve
    // Worker lives inside astro-site-template/ so it resolves astro from the subdirectory's
    // own node_modules — not from the root (which doesn't have astro)
    const workerScript = path.join(sourceDir, 'build-worker.mjs')
    console.log(`[ASTRO] Building site from ${astroDir} via worker`)
    try {
        const output = execSync(`node "${workerScript}" "${astroDir}"`, {
            cwd: astroDir,
            stdio: 'pipe',
            timeout: 60000,
            env: {
                ...process.env,
                NODE_ENV: 'production',
                // Astro telemetry tries to mkdir ~/.config/astro — Vercel sandbox has no writable home dir
                HOME: os.tmpdir(),
                ASTRO_TELEMETRY_DISABLED: '1',
            },
        })
        const stdout = output.toString()
        if (!stdout.includes('ASTRO_BUILD_SUCCESS')) {
            throw new Error(stdout)
        }
    } catch (error: any) {
        const stderr = error.stderr?.toString() || ''
        const stdout = error.stdout?.toString() || ''
        throw new Error(`Astro build failed: ${stderr || stdout || error.message}`)
    }

    // 4. Read output HTML
    let html: string
    try {
        html = await fs.readFile(outputPath, 'utf-8')
    } catch {
        throw new Error('Astro build completed but output file not found at ' + outputPath)
    }

    // 5. Clean up temp directory if we created one
    if (astroDir !== sourceDir) {
        fs.rm(astroDir, { recursive: true, force: true }).catch(() => {})
    }

    console.log(`[ASTRO] Build complete: ${(html.length / 1024).toFixed(0)}KB HTML`)
    return html
}

export { transformToAstroData, mapStyleToLetter }
export type { ExtractedContent, Customizations }
