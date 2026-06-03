import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// ==================== QUERIES ====================

/**
 * Get website content by website ID
 */
export const getByWebsiteId = query({
    args: { websiteId: v.id('generatedWebsites') },
    handler: async (ctx, args) => {
        return await ctx.db
            .query('websiteContent')
            .withIndex('by_websiteId', (q) => q.eq('websiteId', args.websiteId))
            .first();
    },
});

/**
 * Get website content by submission ID (convenience query)
 */
export const getBySubmissionId = query({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        // First find the generatedWebsite
        const website = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();

        if (!website) return null;

        // Then get the content
        return await ctx.db
            .query('websiteContent')
            .withIndex('by_websiteId', (q) => q.eq('websiteId', website._id))
            .first();
    },
});

/**
 * Get website content directly by submission ID (uses submissionId field on websiteContent)
 * This is a fallback for when the generatedWebsites chain doesn't have the data
 */
export const getDirectBySubmissionId = query({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        return await ctx.db
            .query('websiteContent')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();
    },
});

// ==================== MUTATIONS ====================

/**
 * Create or update website content
 */
export const upsert = mutation({
    args: {
        websiteId: v.id('generatedWebsites'),
        // Business info
        businessName: v.string(),
        tagline: v.string(),
        aboutText: v.string(),
        tone: v.optional(v.string()),
        // Hero section
        heroHeadline: v.optional(v.string()),
        heroSubheadline: v.optional(v.string()),
        heroBadgeText: v.optional(v.string()),
        heroTestimonial: v.optional(v.string()),
        heroCtaLabel: v.optional(v.string()),
        heroCtaLink: v.optional(v.string()),
        // About section
        aboutHeadline: v.optional(v.string()),
        aboutDescription: v.optional(v.string()),
        aboutTagline: v.optional(v.string()),
        aboutTags: v.optional(v.array(v.string())),
        uniqueSellingPoints: v.optional(v.array(v.string())),
        // Services section
        servicesHeadline: v.optional(v.string()),
        servicesSubheadline: v.optional(v.string()),
        services: v.optional(v.array(v.object({
            name: v.string(),
            description: v.string(),
            icon: v.optional(v.string()),
        }))),
        // Featured section
        featuredHeadline: v.optional(v.string()),
        featuredSubheadline: v.optional(v.string()),
        featuredProducts: v.optional(v.array(v.object({
            title: v.string(),
            description: v.string(),
            image: v.optional(v.string()),
            tags: v.optional(v.array(v.string())),
            testimonial: v.optional(v.object({
                quote: v.string(),
                author: v.string(),
                avatar: v.optional(v.string()),
            })),
        }))),
        featuredImages: v.optional(v.array(v.string())), // For style 3 gallery
        featuredCtaText: v.optional(v.string()), // CTA button text for style 4
        featuredCtaLink: v.optional(v.string()), // CTA button link for style 4
        // Contact info
        contact: v.optional(v.object({
            email: v.string(),
            phone: v.string(),
            address: v.optional(v.string()),
            whatsapp: v.optional(v.string()),
            messenger: v.optional(v.string()),
        })),
        // Footer
        footerDescription: v.optional(v.string()),
        socialLinks: v.optional(v.array(v.object({
            platform: v.string(),
            url: v.string(),
        }))),
        // Navigation
        navbarLinks: v.optional(v.array(v.object({
            label: v.string(),
            href: v.string(),
        }))),
        navbarCtaText: v.optional(v.string()),
        navbarCtaLink: v.optional(v.string()),
        navbarHeadline: v.optional(v.string()), // For style 4
        // Images
        images: v.optional(v.object({
            hero: v.optional(v.array(v.string())),
            about: v.optional(v.array(v.string())),
            services: v.optional(v.array(v.string())),
            featured: v.optional(v.array(v.string())),
            gallery: v.optional(v.array(v.string())),
        })),
        // Visibility
        visibility: v.optional(v.object({
            navbar: v.optional(v.boolean()),
            navbarHeadline: v.optional(v.boolean()), // For style 4
            heroSection: v.optional(v.boolean()),
            heroHeadline: v.optional(v.boolean()),
            heroTagline: v.optional(v.boolean()),
            heroDescription: v.optional(v.boolean()),
            heroTestimonial: v.optional(v.boolean()),
            heroButton: v.optional(v.boolean()),
            heroImage: v.optional(v.boolean()),
            aboutSection: v.optional(v.boolean()),
            aboutBadge: v.optional(v.boolean()),
            aboutHeadline: v.optional(v.boolean()),
            aboutDescription: v.optional(v.boolean()),
            aboutImages: v.optional(v.boolean()),
            aboutTagline: v.optional(v.boolean()),
            aboutTags: v.optional(v.boolean()),
            servicesSection: v.optional(v.boolean()),
            servicesBadge: v.optional(v.boolean()),
            servicesHeadline: v.optional(v.boolean()),
            servicesSubheadline: v.optional(v.boolean()),
            servicesImage: v.optional(v.boolean()),
            servicesList: v.optional(v.boolean()),
            featuredSection: v.optional(v.boolean()),
            featuredHeadline: v.optional(v.boolean()),
            featuredSubheadline: v.optional(v.boolean()),
            featuredProducts: v.optional(v.boolean()),
            featuredImages: v.optional(v.boolean()),
            footerSection: v.optional(v.boolean()),
            footerBadge: v.optional(v.boolean()),
            footerHeadline: v.optional(v.boolean()),
            footerDescription: v.optional(v.boolean()),
            footerContact: v.optional(v.boolean()),
            footerSocial: v.optional(v.boolean()),
            // ── New generic-template block keys (PageA…PageE read these) ──
            gallerySection: v.optional(v.boolean()),
            contactSection: v.optional(v.boolean()),
            trustBlock: v.optional(v.boolean()),
            whyUsBlock: v.optional(v.boolean()),
            howItWorksBlock: v.optional(v.boolean()),
            testimonialsBlock: v.optional(v.boolean()),
            faqBlock: v.optional(v.boolean()),
            serviceAreaBlock: v.optional(v.boolean()),
            credentialsBlock: v.optional(v.boolean()),
            locationBlock: v.optional(v.boolean()),
            ctaBandBlock: v.optional(v.boolean()),
            clickToMessage: v.optional(v.boolean()),
            scrollTopButton: v.optional(v.boolean()),
        })),
        // Customizations
        customizations: v.optional(v.object({
            heroStyle: v.optional(v.string()),
            aboutStyle: v.optional(v.string()),
            servicesStyle: v.optional(v.string()),
            galleryStyle: v.optional(v.string()),
            contactStyle: v.optional(v.string()),
            // Legacy fields
            navbarStyle: v.optional(v.string()),
            featuredStyle: v.optional(v.string()),
            footerStyle: v.optional(v.string()),
            colorScheme: v.optional(v.string()),
            fontPairing: v.optional(v.string()),
        })),
    },
    handler: async (ctx, args) => {
        const { websiteId, ...contentData } = args;

        // Check if content already exists
        const existing = await ctx.db
            .query('websiteContent')
            .withIndex('by_websiteId', (q) => q.eq('websiteId', websiteId))
            .first();

        if (existing) {
            // Update existing
            await ctx.db.patch(existing._id, {
                ...contentData,
                updatedAt: Date.now(),
            });
            return existing._id;
        } else {
            // Create new
            return await ctx.db.insert('websiteContent', {
                websiteId,
                ...contentData,
                updatedAt: Date.now(),
            });
        }
    },
});

/**
 * Update specific fields of website content
 */
export const update = mutation({
    args: {
        websiteId: v.id('generatedWebsites'),
        // All fields optional for partial updates
        businessName: v.optional(v.string()),
        tagline: v.optional(v.string()),
        aboutText: v.optional(v.string()),
        tone: v.optional(v.string()),
        heroHeadline: v.optional(v.string()),
        heroSubheadline: v.optional(v.string()),
        heroBadgeText: v.optional(v.string()),
        heroTestimonial: v.optional(v.string()),
        heroCtaLabel: v.optional(v.string()),
        heroCtaLink: v.optional(v.string()),
        aboutHeadline: v.optional(v.string()),
        aboutDescription: v.optional(v.string()),
        aboutTagline: v.optional(v.string()),
        aboutTags: v.optional(v.array(v.string())),
        uniqueSellingPoints: v.optional(v.array(v.string())),
        servicesHeadline: v.optional(v.string()),
        servicesSubheadline: v.optional(v.string()),
        services: v.optional(v.array(v.object({
            name: v.string(),
            description: v.string(),
            icon: v.optional(v.string()),
        }))),
        featuredHeadline: v.optional(v.string()),
        featuredSubheadline: v.optional(v.string()),
        featuredProducts: v.optional(v.array(v.object({
            title: v.string(),
            description: v.string(),
            image: v.optional(v.string()),
            tags: v.optional(v.array(v.string())),
            testimonial: v.optional(v.object({
                quote: v.string(),
                author: v.string(),
                avatar: v.optional(v.string()),
            })),
        }))),
        featuredImages: v.optional(v.array(v.string())),
        featuredCtaText: v.optional(v.string()), // CTA button text for style 4
        featuredCtaLink: v.optional(v.string()), // CTA button link for style 4
        contact: v.optional(v.object({
            email: v.string(),
            phone: v.string(),
            address: v.optional(v.string()),
            whatsapp: v.optional(v.string()),
            messenger: v.optional(v.string()),
        })),
        footerDescription: v.optional(v.string()),
        socialLinks: v.optional(v.array(v.object({
            platform: v.string(),
            url: v.string(),
        }))),
        navbarLinks: v.optional(v.array(v.object({
            label: v.string(),
            href: v.string(),
        }))),
        navbarCtaText: v.optional(v.string()),
        navbarCtaLink: v.optional(v.string()),
        navbarHeadline: v.optional(v.string()), // For style 4
        images: v.optional(v.object({
            hero: v.optional(v.array(v.string())),
            about: v.optional(v.array(v.string())),
            services: v.optional(v.array(v.string())),
            featured: v.optional(v.array(v.string())),
            gallery: v.optional(v.array(v.string())),
        })),
        visibility: v.optional(v.object({
            navbar: v.optional(v.boolean()),
            navbarHeadline: v.optional(v.boolean()), // For style 4
            heroSection: v.optional(v.boolean()),
            heroHeadline: v.optional(v.boolean()),
            heroTagline: v.optional(v.boolean()),
            heroDescription: v.optional(v.boolean()),
            heroTestimonial: v.optional(v.boolean()),
            heroButton: v.optional(v.boolean()),
            heroImage: v.optional(v.boolean()),
            aboutSection: v.optional(v.boolean()),
            aboutBadge: v.optional(v.boolean()),
            aboutHeadline: v.optional(v.boolean()),
            aboutDescription: v.optional(v.boolean()),
            aboutImages: v.optional(v.boolean()),
            aboutTagline: v.optional(v.boolean()),
            aboutTags: v.optional(v.boolean()),
            servicesSection: v.optional(v.boolean()),
            servicesBadge: v.optional(v.boolean()),
            servicesHeadline: v.optional(v.boolean()),
            servicesSubheadline: v.optional(v.boolean()),
            servicesImage: v.optional(v.boolean()),
            servicesList: v.optional(v.boolean()),
            featuredSection: v.optional(v.boolean()),
            featuredHeadline: v.optional(v.boolean()),
            featuredSubheadline: v.optional(v.boolean()),
            featuredProducts: v.optional(v.boolean()),
            featuredImages: v.optional(v.boolean()),
            footerSection: v.optional(v.boolean()),
            footerBadge: v.optional(v.boolean()),
            footerHeadline: v.optional(v.boolean()),
            footerDescription: v.optional(v.boolean()),
            footerContact: v.optional(v.boolean()),
            footerSocial: v.optional(v.boolean()),
            // ── New generic-template block keys (PageA…PageE read these) ──
            gallerySection: v.optional(v.boolean()),
            contactSection: v.optional(v.boolean()),
            trustBlock: v.optional(v.boolean()),
            whyUsBlock: v.optional(v.boolean()),
            howItWorksBlock: v.optional(v.boolean()),
            testimonialsBlock: v.optional(v.boolean()),
            faqBlock: v.optional(v.boolean()),
            serviceAreaBlock: v.optional(v.boolean()),
            credentialsBlock: v.optional(v.boolean()),
            locationBlock: v.optional(v.boolean()),
            ctaBandBlock: v.optional(v.boolean()),
            clickToMessage: v.optional(v.boolean()),
            scrollTopButton: v.optional(v.boolean()),
        })),
        customizations: v.optional(v.object({
            heroStyle: v.optional(v.string()),
            aboutStyle: v.optional(v.string()),
            servicesStyle: v.optional(v.string()),
            galleryStyle: v.optional(v.string()),
            contactStyle: v.optional(v.string()),
            // Legacy fields
            navbarStyle: v.optional(v.string()),
            featuredStyle: v.optional(v.string()),
            footerStyle: v.optional(v.string()),
            colorScheme: v.optional(v.string()),
            fontPairing: v.optional(v.string()),
        })),
    },
    handler: async (ctx, args) => {
        const { websiteId, ...updates } = args;

        // Find existing content
        const existing = await ctx.db
            .query('websiteContent')
            .withIndex('by_websiteId', (q) => q.eq('websiteId', websiteId))
            .first();

        if (!existing) {
            throw new Error('Website content not found');
        }

        // Filter out undefined values
        const filteredUpdates = Object.fromEntries(
            Object.entries(updates).filter(([, value]) => value !== undefined)
        );

        await ctx.db.patch(existing._id, {
            ...filteredUpdates,
            updatedAt: Date.now(),
        });
    },
});

/**
 * Delete website content
 */
export const remove = mutation({
    args: { websiteId: v.id('generatedWebsites') },
    handler: async (ctx, args) => {
        const content = await ctx.db
            .query('websiteContent')
            .withIndex('by_websiteId', (q) => q.eq('websiteId', args.websiteId))
            .first();

        if (content) {
            await ctx.db.delete(content._id);
        }
    },
});
