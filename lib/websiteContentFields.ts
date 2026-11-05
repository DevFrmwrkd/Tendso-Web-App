/* eslint-disable @typescript-eslint/no-explicit-any -- moved verbatim from app/api/generate-website/route.ts, which is typed the same way */
import { asServiceArray } from './services-shape'

/**
 * The `websiteContent` row (normalized content table) for a built site, from
 * the assembled `contentWithContact` and the final customizations.
 *
 * Moved verbatim out of app/api/generate-website/route.ts so the admin build
 * and the AI pipeline (lib/aiPipeline, convex/aiPipeline) write the SAME row
 * from the same build: the route returns these fields to the pipeline, which
 * saves them server-side because it has no admin session.
 */
export function websiteContentFields(contentWithContact: any, finalCustomizations: any) {
    return {
        // Business info
        businessName: contentWithContact.business_name,
        tagline: contentWithContact.tagline,
        // `content.about` can arrive as a wrapped object on branded/bespoke
        // families (e.g. after an admin edits the About image, which writes
        // `about.image` and turns `about` into `{ image, ... }`). The
        // websiteContent.aboutText column is `v.string()`, so coerce — mirror
        // transformToAstroData's description coercion (lead > description >
        // body > joined paragraphs > ''). Without this the mutation throws
        // ArgumentValidationError on any About-image edit.
        aboutText: (() => {
            const a = contentWithContact.about as any;
            if (typeof a === 'string') return a;
            return a?.lead ?? a?.description ?? a?.body
                ?? (Array.isArray(a?.paragraphs) ? a.paragraphs.join('\n\n') : '');
        })(),
        tone: contentWithContact.tone,
        // Hero section
        heroBadgeText: contentWithContact.hero_badge_text,
        heroTestimonial: contentWithContact.hero_testimonial,
        heroCtaLabel: (contentWithContact.hero_cta as any)?.label,
        heroCtaLink: (contentWithContact.hero_cta as any)?.link,
        // About section
        aboutHeadline: contentWithContact.about_headline,
        aboutDescription: contentWithContact.about_description,
        aboutTagline: contentWithContact.about_tagline,
        aboutTags: contentWithContact.about_tags,
        uniqueSellingPoints: contentWithContact.unique_selling_points,
        // Services section
        servicesHeadline: contentWithContact.services_headline,
        servicesSubheadline: contentWithContact.services_subheadline,
        services: asServiceArray(contentWithContact.services).map((s: any) => ({
            name: s.name || s.title || '',
            description: s.description || '',
            icon: s.icon,
        })),
        // Featured section
        featuredHeadline: contentWithContact.featured_headline,
        featuredSubheadline: contentWithContact.featured_subheadline,
        featuredProducts: contentWithContact.featured_products?.map((p: any) => ({
            title: p.title || '',
            description: p.description || '',
            image: p.image,
            tags: p.tags,
            testimonial: p.testimonial ? {
                quote: p.testimonial.quote || '',
                author: p.testimonial.author || '',
                avatar: p.testimonial.avatar,
            } : undefined,
        })),
        featuredImages: contentWithContact.featured_images,
        // Contact info
        contact: contentWithContact.contact ? {
            email: contentWithContact.contact.email || '',
            phone: contentWithContact.contact.phone || '',
            address: contentWithContact.contact.address,
            whatsapp: contentWithContact.contact.whatsapp,
            messenger: contentWithContact.contact.messenger,
        } : undefined,
        // Footer
        footerDescription: contentWithContact.footer?.brand_blurb,
        socialLinks: contentWithContact.footer?.social_links?.map((l: any) => ({
            platform: l.platform || '',
            url: l.url || '',
        })),
        // Navigation
        navbarLinks: contentWithContact.navbar_links?.map((l: any) => ({
            label: l.label || '',
            href: l.href || '',
        })),
        navbarCtaText: contentWithContact.navbar_cta_text,
        navbarCtaLink: contentWithContact.navbar_cta_link,
        navbarHeadline: contentWithContact.navbar_headline,
        // Images
        images: {
            hero: Array.isArray(contentWithContact.images) ? contentWithContact.images : undefined,
            about: contentWithContact.about_images,
            services: contentWithContact.services_image ? [contentWithContact.services_image] : undefined,
        },
        // Visibility settings — both legacy snake_case keys (kept for the
        // A–O templates) AND the new generic-template block keys are
        // forwarded so a toggle in the Blocks tab actually takes effect.
        visibility: contentWithContact.visibility ? {
            navbar: contentWithContact.visibility.navbar,
            navbarHeadline: contentWithContact.visibility.navbar_headline,
            heroSection: contentWithContact.visibility.hero_section,
            heroHeadline: contentWithContact.visibility.hero_headline,
            heroTagline: contentWithContact.visibility.hero_tagline,
            heroDescription: contentWithContact.visibility.hero_description,
            heroTestimonial: contentWithContact.visibility.hero_testimonial,
            heroButton: contentWithContact.visibility.hero_button,
            heroImage: contentWithContact.visibility.hero_image,
            aboutSection: contentWithContact.visibility.about_section,
            aboutBadge: contentWithContact.visibility.about_badge,
            aboutHeadline: contentWithContact.visibility.about_headline,
            aboutDescription: contentWithContact.visibility.about_description,
            aboutImages: contentWithContact.visibility.about_images,
            aboutTagline: contentWithContact.visibility.about_tagline,
            aboutTags: contentWithContact.visibility.about_tags,
            servicesSection: contentWithContact.visibility.services_section,
            servicesBadge: contentWithContact.visibility.services_badge,
            servicesHeadline: contentWithContact.visibility.services_headline,
            servicesSubheadline: contentWithContact.visibility.services_subheadline,
            servicesImage: contentWithContact.visibility.services_image,
            servicesList: contentWithContact.visibility.services_list,
            featuredSection: contentWithContact.visibility.featured_section,
            featuredHeadline: contentWithContact.visibility.featured_headline,
            featuredSubheadline: contentWithContact.visibility.featured_subheadline,
            featuredProducts: contentWithContact.visibility.featured_products,
            featuredImages: contentWithContact.visibility.featured_images,
            gallerySection: contentWithContact.visibility.gallery_section ?? contentWithContact.visibility.featured_section,
            footerSection: contentWithContact.visibility.footer_section,
            footerBadge: contentWithContact.visibility.footer_badge,
            footerHeadline: contentWithContact.visibility.footer_headline,
            footerDescription: contentWithContact.visibility.footer_description,
            footerContact: contentWithContact.visibility.footer_contact,
            footerSocial: contentWithContact.visibility.footer_social,
            contactSection: contentWithContact.visibility.contact_section ?? contentWithContact.visibility.footer_section,
            // New generic-template block keys. These are the ones the
            // Blocks tab actually toggles; the Astro PageA…PageE wrappers
            // read camelCase block keys (visibility.trustBlock etc.).
            trustBlock: contentWithContact.visibility.trust_block,
            whyUsBlock: contentWithContact.visibility.why_us_block,
            howItWorksBlock: contentWithContact.visibility.how_it_works_block,
            testimonialsBlock: contentWithContact.visibility.testimonials_block,
            faqBlock: contentWithContact.visibility.faq_block,
            serviceAreaBlock: contentWithContact.visibility.service_area_block,
            credentialsBlock: contentWithContact.visibility.credentials_block,
            locationBlock: contentWithContact.visibility.location_block,
            ctaBandBlock: contentWithContact.visibility.cta_band_block,
            clickToMessage: contentWithContact.visibility.click_to_message,
            scrollTopButton: contentWithContact.visibility.scroll_top_button,
        } : undefined,
        // Customizations
        customizations: {
            heroStyle: finalCustomizations.heroStyle,
            aboutStyle: finalCustomizations.aboutStyle,
            servicesStyle: finalCustomizations.servicesStyle,
            galleryStyle: finalCustomizations.galleryStyle || finalCustomizations.featuredStyle,
            contactStyle: finalCustomizations.contactStyle || finalCustomizations.footerStyle,
            // Legacy fields
            navbarStyle: finalCustomizations.navbarStyle,
            featuredStyle: finalCustomizations.featuredStyle,
            footerStyle: finalCustomizations.footerStyle,
            colorScheme: finalCustomizations.colorScheme || finalCustomizations.colorSchemeId,
            fontPairing: finalCustomizations.fontPairing || finalCustomizations.fontPairingId,
        },
    }
}
