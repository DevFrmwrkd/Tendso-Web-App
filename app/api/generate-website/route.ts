import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { buildAstroSite } from '@/lib/astro-builder'
import { buildRoleColorCss } from '@/lib/roleColors'
import { asServiceArray } from '@/lib/services-shape'
import { GROQ_TEXT_MODEL } from '@/lib/services/groqModels'
import {
    groqService,
    delimitTranscript,
    hasSuppliedTestimonials,
    stripFabricatedTestimonials,
} from '@/lib/services/groq.service'

/**
 * Used when overriding a `contentWithContact` key that has two coexisting
 * shapes — the legacy primitive form (e.g. `about` = string paragraph,
 * `services` = flat array of {name, description}) and the wrapped object
 * form branded families (Barbershop F–J, SalonSpa K–O) use (e.g.
 * `about` = { tag, headline, paragraphs[], image }). Returns true only
 * for the wrapped form, so the conditional spread above can override the
 * legacy fallback without clobbering Generic A–E sites that still rely on
 * the primitive shape.
 */
function isWrappedObject(v: any): boolean {
    return v != null && typeof v === 'object' && !Array.isArray(v)
}

export async function POST(request: NextRequest) {
    try {
        // Check Clerk authentication
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is admin using Convex
        const creator = await fetchQuery(api.creators.getByClerkId, { clerkId: userId })
        if (!creator || creator.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
        }

        // Rate limit: expensive operation (5/min)
        const { checkRateLimit, RATE_LIMITS } = await import('@/lib/security')
        const { allowed } = checkRateLimit(`generate:${userId}`, RATE_LIMITS.expensive.maxRequests, RATE_LIMITS.expensive.windowMs)
        if (!allowed) {
            return NextResponse.json({ error: 'Too many generation requests. Please wait a moment.' }, { status: 429 })
        }

        const body = await request.json()
        // `preview` + `content` power the editor's "Preview my site" — build the
        // admin's UNSAVED draft into HTML and return it WITHOUT persisting (see the
        // early return after buildAstroSite below). Everything else is identical to
        // a real generate, so the preview matches exactly what Save would produce.
        const { submissionId, templateName, customizations, content: draftContent, preview } = body

        if (!submissionId) {
            return NextResponse.json({ error: 'Submission ID is required' }, { status: 400 })
        }

        // Get submission from Convex
        const submissionData = await fetchQuery(api.submissions.getById, { id: submissionId as any })

        if (!submissionData) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
        }

        // Map Convex data to expected format
        const submission = {
            id: submissionData._id,
            business_name: submissionData.businessName,
            business_type: submissionData.businessType,
            owner_name: submissionData.ownerName,
            owner_phone: submissionData.ownerPhone,
            owner_email: submissionData.ownerEmail,
            address: submissionData.address,
            city: submissionData.city,
            photos: submissionData.photos,
            transcript: submissionData.transcript,
            status: submissionData.status,
            website_content: (submissionData as any).websiteContent,
        }

        // Check if submission is rejected
        if (submission.status === 'rejected') {
            return NextResponse.json({ error: 'Cannot generate website for rejected submission' }, { status: 400 })
        }

        // ── Fabricated-testimonial gate ───────────────────────────────
        // Read from the SUBMISSION, never from generator output: whether a
        // quoted customer is allowed on this page is a fact about what the
        // business told us, and no model gets a vote. See
        // hasSuppliedTestimonials for how each funnel is answered.
        const testimonialsAreSourced = hasSuppliedTestimonials({
            contentSource: (submissionData as any).contentSource,
            interviewQa: (submissionData as any).interviewQa,
        })

        // Everything the guard dropped this run, split by where it came from.
        // A server log tells the admin nothing: on the creator funnel a
        // recording FULL of real customer quotes strips to an empty band, and
        // unless the response says so the admin never learns there was anything
        // quotable to type back in. See the JSON response at the end.
        const guardRemoved = { generated: 0, stored: 0 }

        // Wrap GENERATED output — model JSON and the hardcoded default products.
        // Stored content goes through the assembly pass further down instead,
        // which keeps what an admin typed.
        const guardGenerated = <T>(label: string, generated: T): T => {
            if (testimonialsAreSourced) return generated
            const { content, removed } = stripFabricatedTestimonials(generated)
            const total = removed.testimonials + removed.productTestimonials
            if (total > 0) {
                guardRemoved.generated += total
                // Loud on purpose. Dropping invented praise is correct, but a
                // silent drop leaves nobody able to tell how often the models
                // reach for it.
                console.warn(
                    `[TESTIMONIAL-GUARD] ${label}: dropped ${removed.testimonials} testimonial(s) + ` +
                    `${removed.productTestimonials} product testimonial(s) — submission ${submissionData._id} ` +
                    `supplied no testimonial text (contentSource=${(submissionData as any).contentSource || 'creator'})`
                )
            }
            return content
        }

        // Check if there's an existing generated website with edited content (from Convex)
        const existingWebsite = await fetchQuery(api.generatedWebsites.getBySubmissionId, {
            submissionId: submissionData._id
        })

        // Get or extract content - prioritization:
        // 0. In PREVIEW mode, the admin's UNSAVED draft (from the request body) — so
        //    the preview reflects edits that haven't been saved to Convex yet.
        // 1. Edited content from generated_websites (if exists)
        // 2. Previously extracted content from submissions
        // 3. Fresh extraction via Groq
        let extractedContent = (preview && draftContent)
            ? draftContent
            : (existingWebsite?.extractedContent || submission.website_content)

        // When regenerating with existing content, override with fresh submission data
        // so admin edits to business info are reflected in the regenerated website
        if (extractedContent) {
            extractedContent = {
                ...extractedContent,
                business_name: submission.business_name,
                contact: {
                    ...((extractedContent as any)?.contact || {}),
                    email: submission.owner_email || (extractedContent as any)?.contact?.email || 'contact@example.com',
                    phone: submission.owner_phone || (extractedContent as any)?.contact?.phone || '+63 900 000 0000',
                    address: submission.address ? `${submission.address}, ${submission.city}` : (extractedContent as any)?.contact?.address || submission.city
                }
            }
        }

        // Validate that extractedContent has required fields
        const hasRequiredFields = extractedContent &&
            extractedContent.business_name &&
            extractedContent.tagline &&
            extractedContent.about

        // For beauty/salon businesses, the new design grids need 5-6 services.
        // If a previous extraction only produced 3 (the old prompt's target),
        // re-extract so the page fills out properly. Same for sparse 1-2.
        const businessTypeLowerCheck = (submission.business_type || '').toLowerCase()
        const isBeautyCheck = /salon|spa|beauty|barber|nail|hair|lash|brow|aesthetic/.test(businessTypeLowerCheck)
        // Count BOTH shapes. `services` is a bare array in the legacy shape and
        // `{tag, headline, items[]}` in the one Groq emits and every current
        // template reads — so counting only the array read 0 for real, fully
        // populated room lists, flipped servicesAreSparse true, and let the AI
        // overwrite the owner's own rooms.
        const svc = (extractedContent as any)?.services
        const servicesCount = Array.isArray(svc)
            ? svc.length
            : (Array.isArray(svc?.items) ? svc.items.length : 0)
        const servicesAreSparse =
            (isBeautyCheck && servicesCount < 5) || servicesCount < 3

        // Force re-extraction when content exists but doesn't meet the
        // current grid requirements. Preserves admin-edited contact info
        // (already merged above) by saving it as override before re-extraction.
        const preservedContact = (extractedContent as any)?.contact

        if (!extractedContent || !hasRequiredFields || (servicesAreSparse && submission.transcript)) {

            // Build context from submission data
            const context = `
Business Name: ${submission.business_name}
Business Type: ${submission.business_type}
Owner: ${submission.owner_name}
Location: ${submission.city}, ${submission.address}
Phone: ${submission.owner_phone}
${submission.owner_email ? `Email: ${submission.owner_email}` : ''}

${submission.transcript ? delimitTranscript(submission.transcript, 'Business Interview Transcript') : ''}
            `.trim()

            // Extract structured content using Groq
            const Groq = (await import('groq-sdk')).default
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

            // Count photos for featured projects generation.
            // REAL photos, not array slots: the owner-intake path deliberately
            // stores an empty string at index 0 when the owner skips the optional
            // portrait, so the purely positional role mapping at
            // convex/hyperagent.ts:85-88 keeps every other photo on its own index
            // (see ownerIntake.normalizePhotos). Counting slots would tell Groq a
            // photo exists that it can't write copy for.
            const photoCount = (submission.photos || []).filter(Boolean).length

            // Salon-aware service count — the Lumière + Maison Élite designs
            // both feature 6-service grids, so we ask for more depth when the
            // business type is in the beauty cluster.
            const businessTypeLower = (submission.business_type || '').toLowerCase()
            const isBeauty = /salon|spa|beauty|barber|nail|hair|lash|brow|aesthetic/.test(businessTypeLower)
            const isYmyl = /clinic|dental|medical|doctor|aesthetic/.test(businessTypeLower)
            const targetServices = isBeauty ? 6 : 4

            const prompt = `You are a professional website content writer. Based on the following business information, create compelling website content.

${context}

Number of photos available: ${photoCount}
Business category cues: ${isBeauty ? 'BEAUTY/SALON — high-touch personal service. Write to women + men who care about how they are treated, not just the result. Aspirational, intimate, never gimmicky.' : 'GENERAL — concrete, founder-voiced, no SaaS clichés.'}

Generate a JSON response with the following structure:
{
  "business_name": "${submission.business_name}",
  "tagline": "A catchy, memorable tagline (max 10 words)",
  "about": "A compelling 2-3 sentence description of the business that highlights what makes it special",
  "services": [
    ${Array.from({ length: targetServices }, (_, i) =>
      `{"name": "2-3 WORDS MAX", "description": "ONE single sentence, 12-20 words, no clauses, no semicolons"}`
    ).join(',\n    ')}
  ],
  "unique_selling_points": ["USP 1", "USP 2", "USP 3", "USP 4"],
  "tone": "${isBeauty ? 'warm, refined, aspirational' : 'professional-friendly'}",
  "featured_headline": "Featured Products",
  "featured_subheadline": "A brief description of what makes these projects special",
  "featured_products": [
    {
      "title": "Project title related to the business",
      "description": "A detailed 2-3 sentence description of this project showcasing quality work",
      "tags": ["Tag1", "Duration"],
      "testimonial": {
        "quote": "the customer's words as the owner reported them (2-3 sentences)"
      }
    }
  ]
}

IMPORTANT:
- Make the tagline creative and memorable. For beauty: short, italic-ready, ends without a period.
- Services MUST have exactly ${targetServices} items, specific to this business type. ${isBeauty ? 'Cover: cuts/styling · color · treatments · bridal/event · nails or lash · facials/skin (pick whichever fits this business).' : ''}
- SERVICE NAMES: 2-3 words MAX. Editorial titles like "Cut & Style", "Couture Color", "Bridal & Events", "Glow Facials", "Brow & Lash Studio". NEVER full sentences or descriptions in the name.
- SERVICE DESCRIPTIONS: ONE sentence only, 12-20 words. No clauses joined by semicolons. No "we offer" / "we provide" filler. Concrete and specific.
- USPs should highlight what makes this business unique
- Keep descriptions concise and compelling
- Generate ${Math.min(photoCount, 3) || 3} featured_products (one for each photo if available, max 3)
- Each featured project should have a unique title, description and tags
- TESTIMONIALS: only what the owner reported customers saying, in the transcript. If it isn't there, omit "testimonial" entirely. Never invent a customer or a quote — and never output a name: nobody is ever asked who said it, so a name can only be made up.
- Tags should include project type and estimated duration
${isBeauty ? '- For beauty businesses, lean into ritual + intimacy + the "regular client" relationship. Avoid generic "we offer..." phrasing.' : ''}
${isYmyl ? '- This is a YMYL business (medical/dental/aesthetic). Be precise; no medical claims; no specific outcomes promised.' : ''}
- Return ONLY valid JSON, no markdown or additional text`

            try {
                const completion = await groq.chat.completions.create({
                    messages: [{ role: "user", content: prompt }],
                    model: GROQ_TEXT_MODEL,
                    temperature: 0.7,
                    max_tokens: 2000,
                })

                const content = completion.choices[0]?.message?.content || '{}'

                // Clean up markdown code blocks if present
                const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
                const freshExtraction = guardGenerated('main extraction', JSON.parse(cleanContent))

                // Restore admin-edited contact info that was merged above so
                // a re-extraction doesn't clobber owner phone/email/address.
                if (preservedContact) {
                    freshExtraction.contact = {
                        ...(freshExtraction.contact || {}),
                        ...preservedContact,
                    }
                }
                extractedContent = freshExtraction

            } catch (error) {
                console.error('Groq extraction error:', error)
                return NextResponse.json({
                    error: 'Failed to extract website content. Please try again.'
                }, { status: 500 })
            }
        }

        // Conversion-block AI generation — runs once per submission, then cached
        // into extractedContent so subsequent regenerations skip the LLM call.
        // If transcript is missing or generation fails, per-business-type
        // defaults from lib/block-defaults.ts kick in at build time.
        const ec = extractedContent as any
        const hasAnyConversionBlock = !!(
            ec?.trust || ec?.why || ec?.how ||
            ec?.testimonials || ec?.faq || ec?.credentials || ec?.ctaBand
        )
        if (!hasAnyConversionBlock && submission.transcript) {
            try {
                const blocks = await groqService.generateConversionBlocks(
                    submission.transcript,
                    {
                        name: submission.business_name,
                        type: submission.business_type,
                        owner: submission.owner_name,
                        location: `${submission.address || ''}${submission.address ? ', ' : ''}${submission.city || ''}`.trim(),
                    }
                )
                if (blocks) {
                    extractedContent = { ...extractedContent, ...guardGenerated('conversion blocks', blocks) }
                }
            } catch (err) {
                console.error('Conversion-block generation failed (using defaults):', err)
            }
        }

        // ── Generic-section AI generation ─────────────────────────────
        // When the selected template is one of the generic landing pages
        // (PageA…PageE), produce the section-level content (hero, about,
        // services items, gallery captions, area, location, footer copy,
        // marquee, navbar). One Groq call per submission; result cached
        // into extractedContent so subsequent regenerations are free.
        //
        // Existing admin-edited fields win — we MERGE-FILL, never overwrite.
        const ec2 = extractedContent as any
        // finalCustomizations is declared further down — read the incoming
        // customizations / persisted customizations directly so we don't
        // hoist-trap on the const declaration.
        const incomingHeroStyle = String(
            (customizations as any)?.heroStyle ??
            (existingWebsite?.customizations as any)?.heroStyle ??
            ''
        )
        const isGenericRender = /^generic:[A-E]$/.test(incomingHeroStyle)
        const hasGenericSections = !!(
            ec2?.hero?.headlineLines || ec2?.services?.items ||
            ec2?.about?.paragraphs || ec2?.gallery?.items ||
            ec2?.area?.places || ec2?.marquee?.text
        )
        if (isGenericRender && !hasGenericSections && submission.transcript) {
            try {
                let sections = await groqService.generateGenericSections(
                    submission.transcript,
                    {
                        name: submission.business_name,
                        type: submission.business_type,
                        owner: submission.owner_name,
                        location: `${submission.address || ''}${submission.address ? ', ' : ''}${submission.city || ''}`.trim(),
                    }
                )
                if (sections) {
                    // Guarded like every other generator output, though the key
                    // whitelist below in generateGenericSections cannot emit
                    // testimonials today — so the invariant is "generated
                    // content is always guarded", with no per-callsite exception
                    // to remember when that whitelist grows.
                    sections = guardGenerated('generic sections', sections)
                    // Shallow merge — admin edits already in extractedContent
                    // win on each leaf because they were set first. We only
                    // fill keys that didn't already exist.
                    const merged: any = { ...extractedContent }
                    for (const [k, v] of Object.entries(sections)) {
                        if (merged[k] == null) merged[k] = v
                    }
                    extractedContent = merged
                }
            } catch (err) {
                console.error('Generic-section generation failed (using fallbacks):', err)
            }
        }

        // ── Stored content faces the same gate ────────────────────────
        // Every guard above only fires on something GENERATED this run, and a
        // regenerate generates nothing: `servicesAreSparse` is false because the
        // services are already populated and `hasAnyConversionBlock` is true
        // because the testimonials already exist. So the incident row's three
        // invented customers skip all four call sites and republish verbatim —
        // and would on every future publish, forever. The strip has to run on
        // what we READ as well as on what we write.
        //
        // The tension that kept this pass out until now is real: an admin types
        // real testimonials into the editor, and every editor Save round-trips
        // through here (/api/save-content persists the draft, then calls this
        // route to rebuild), so a blanket strip would delete the admin's words a
        // second after they typed them — and with them the escape hatch the
        // creator-funnel rule in hasSuppliedTestimonials depends on.
        //
        // Resolved per item rather than wholesale, using provenance that already
        // exists in the data and needs no new schema field: the editor stamps an
        // attribution key on every quote a human adds or edits, and nothing a
        // generator writes carries one (see ADMIN_ATTRIBUTION_KEY). Typed quotes
        // survive; machine-written ones do not — including on the row that
        // stored them before this guard existed.
        if (!testimonialsAreSourced && extractedContent) {
            const { content, removed } = stripFabricatedTestimonials(extractedContent, {
                keepAdminAuthored: true,
            })
            const total = removed.testimonials + removed.productTestimonials
            if (total > 0) {
                guardRemoved.stored += total
                console.warn(
                    `[TESTIMONIAL-GUARD] stored content: dropped ${removed.testimonials} testimonial(s) + ` +
                    `${removed.productTestimonials} product testimonial(s) — submission ${submissionData._id} ` +
                    `supplied no testimonial text (contentSource=${(submissionData as any).contentSource || 'creator'})`
                )
            }
            extractedContent = content
        }

        // Template name kept for backward compat in database records
        const selectedTemplate = templateName || 'astro'

        // Fetch enhancedImages — check all possible locations:
        // 1. generatedWebsites top-level (mobile branch patches directly)
        // 2. generatedWebsites.extractedContent.enhancedImages (nested in extractedContent)
        // 3. websiteContent via generatedWebsites chain (by websiteId)
        // 4. websiteContent directly by submissionId (fallback for records without generatedWebsites link)
        let enhancedImageUrls: string[] = []
        let enhancedImagesByCategory: Record<string, string[]> = {}
        try {
            // Source 1: generatedWebsites top-level
            let enhancedImages = (existingWebsite as any)?.enhancedImages || null
            let enhancedSource = enhancedImages ? 'generatedWebsites.enhancedImages' : null

            // Source 2: nested in extractedContent
            if (!enhancedImages) {
                enhancedImages = (existingWebsite?.extractedContent as any)?.enhancedImages || null
                enhancedSource = enhancedImages ? 'generatedWebsites.extractedContent.enhancedImages' : null
            }

            // Source 3: websiteContent via generatedWebsites chain
            if (!enhancedImages) {
                const wcViaChain = await fetchQuery(api.websiteContent.getBySubmissionId, {
                    submissionId: submissionData._id
                })
                enhancedImages = wcViaChain?.enhancedImages || null
                enhancedSource = enhancedImages ? 'websiteContent (via websiteId chain)' : null
            }

            // Source 4: websiteContent directly by submissionId (fallback)
            if (!enhancedImages) {
                const wcDirect = await fetchQuery(api.websiteContent.getDirectBySubmissionId, {
                    submissionId: submissionData._id
                })
                enhancedImages = wcDirect?.enhancedImages || null
                enhancedSource = enhancedImages ? 'websiteContent (direct by submissionId)' : null
            }


            if (enhancedImages && typeof enhancedImages === 'object') {
                // Extract URLs from enhancedImages object
                // Structure: { 
                //   enhanced_headshot: { url, storageId }, 
                //   enhanced_headshot_v1: { url, storageId },
                //   enhanced_headshot_v2: { url, storageId },
                //   interior_1: { url, storageId }, 
                //   ... 
                // }
                // First pass: collect storage IDs that need resolution
                const enhancedEntries: Array<{ key: string; storageId?: string; url?: string }> = []
                for (const [key, img] of Object.entries(enhancedImages)) {
                    const imgData = img as any
                    if (imgData && (imgData.url || imgData.storageId)) {
                        enhancedEntries.push({ key, storageId: imgData.storageId, url: imgData.url })
                    }
                }

                // Batch-resolve all storage IDs at once
                const storageIdsToResolve = enhancedEntries
                    .map(e => e.storageId)
                    .filter((id): id is string => !!id && !id.startsWith('http'))
                let resolvedStorageUrls: (string | null)[] = []
                if (storageIdsToResolve.length > 0) {
                    try {
                        resolvedStorageUrls = await fetchQuery(api.files.getMultipleUrls, {
                            storageIds: storageIdsToResolve
                        })
                        console.log(`[IMAGES] Resolved ${resolvedStorageUrls.filter(Boolean).length}/${storageIdsToResolve.length} enhanced image storage IDs`)
                    } catch (error) {
                        console.error('[IMAGES] Failed to resolve enhanced image storage IDs:', error)
                    }
                }

                // Build resolved URL map: storageId → resolved URL
                const storageUrlMap: Record<string, string> = {}
                storageIdsToResolve.forEach((id, i) => {
                    if (resolvedStorageUrls[i]) storageUrlMap[id] = resolvedStorageUrls[i]!
                })

                // Second pass: categorize with resolved URLs
                for (const entry of enhancedEntries) {
                    // Priority: resolved storageId URL → direct HTTP url (if not expired Airtable)
                    let resolvedUrl = ''
                    if (entry.storageId && storageUrlMap[entry.storageId]) {
                        resolvedUrl = storageUrlMap[entry.storageId]
                    } else if (entry.url && entry.url.startsWith('http') && !entry.url.includes('airtableusercontent.com')) {
                        // Only use direct URL if it's NOT an Airtable URL (which expire)
                        resolvedUrl = entry.url
                    }

                    if (!resolvedUrl) {
                        console.warn(`[IMAGES] Skipping ${entry.key}: no resolved URL (storageId=${entry.storageId ? 'yes' : 'no'}, url=${entry.url ? 'airtable' : 'none'})`)
                        continue
                    }

                    const url = resolvedUrl
                    enhancedImageUrls.push(url)

                    // Extract base field name, removing "enhanced_" prefix and version suffix (_v1, _v2, etc.)
                    let baseKey = entry.key.replace(/^enhanced_/, '').replace(/_v\d+$/, '')

                    // Categorize for section-specific mapping.
                    // Two key families are supported:
                    //  - Legacy role keys: headshot, interior_*, exterior, product_*
                    //  - Tendso Studio v0.2 placement keys: hero, portrait, gallery_<N>
                    //    (a 6-12 image "photoshoot" set keyed by where they go, not source role)

                    // about: people + interiors + portrait + the gallery pool
                    if (baseKey.startsWith('interior') || baseKey === 'headshot' || baseKey === 'portrait' || baseKey.startsWith('gallery')) {
                        ;(enhancedImagesByCategory.about ??= []).push(url)
                    }
                    // featured: products + the gallery pool (gallery is the general set)
                    if (baseKey.startsWith('product') || baseKey.startsWith('gallery')) {
                        ;(enhancedImagesByCategory.featured ??= []).push(url)
                    }
                    // hero: the lead image (placement 'hero'), else exterior/headshot/portrait
                    if (baseKey === 'hero' || baseKey === 'exterior' || baseKey === 'headshot' || baseKey === 'portrait') {
                        ;(enhancedImagesByCategory.hero ??= []).push(url)
                    }
                    // services: interiors, exterior, and the gallery pool
                    if (baseKey.startsWith('interior') || baseKey === 'exterior' || baseKey.startsWith('gallery')) {
                        ;(enhancedImagesByCategory.services ??= []).push(url)
                    }

                    console.log(`[IMAGES] ${entry.key} (${baseKey}) → ${url.substring(0, 50)}...`)
                }
            }
        } catch (error) {
            console.error('Error fetching websiteContent enhancedImages:', error)
        }

        const hasEnhancedImages = enhancedImageUrls.length > 0

        // Helper: filter out expired Airtable URLs (they return 410 Gone)
        const isValidImageUrl = (url: string) => url && url.startsWith('http') && !url.includes('airtableusercontent.com')

        // Helper: accept either a usable HTTP URL OR a Convex storage reference
        // (`convex:<id>` / raw storage ID). Newly uploaded images from VisualEditor
        // arrive as `convex:<id>` strings and must survive the user-edit filter so
        // they can be resolved to a URL further down.
        const isUsableImageRef = (s: string) => {
            if (!s) return false
            if (s.startsWith('http')) return !s.includes('airtableusercontent.com')
            return true
        }

        // Get photos priority:
        // 1. User-edited images from content editor (saved in extractedContent.images) — but filter out expired Airtable URLs
        // 2. Freshly-resolved enhanced images from Airtable (storageIds already resolved above)
        // 3. Original submission photos
        const userEditedImages = ((extractedContent as any)?.images || [])
            .filter((img: string) => isUsableImageRef(img))
        const hasValidUserEditedImages = userEditedImages.length > 0

        const photoStorageIds = hasValidUserEditedImages
            ? userEditedImages
            : (hasEnhancedImages ? enhancedImageUrls : (submission.photos || []))

        console.log(`[IMAGES] Source: ${hasValidUserEditedImages ? 'user-edited' : hasEnhancedImages ? 'enhanced' : 'submission'}`)
        let photos: string[] = []

        console.log(`[IMAGES] photoStorageIds (${photoStorageIds.length}):`, photoStorageIds.map((id: string) => id?.startsWith('http') ? (id.includes('airtable') ? 'AIRTABLE_EXPIRED' : 'HTTP') : 'STORAGE_ID'))

        if (photoStorageIds.length > 0) {
            try {
                // Split into valid HTTP URLs and storage IDs that need resolution
                const validHttpUrls = photoStorageIds.filter((id: string) => isValidImageUrl(id))
                const storageIds = photoStorageIds.filter((id: string) => id && !id.startsWith('http'))

                let resolvedFromStorage: string[] = []
                if (storageIds.length > 0) {
                    const resolvedUrls = await fetchQuery(api.files.getMultipleUrls, {
                        storageIds: storageIds
                    })
                    resolvedFromStorage = resolvedUrls.filter((url: any): url is string => url !== null)
                    console.log(`[IMAGES] Resolved ${resolvedFromStorage.length}/${storageIds.length} storage IDs`)
                }

                photos = [...validHttpUrls, ...resolvedFromStorage]
            } catch (error) {
                console.error('Error resolving photo URLs:', error)
                photos = photoStorageIds.filter((url: string) => isValidImageUrl(url))
            }
        }

        // Fallback: if no photos resolved from enhanced images, use original submission photos
        if (photos.length === 0 && (submission.photos?.length ?? 0) > 0) {
            console.log(`[IMAGES] No enhanced images resolved, falling back to submission.photos`)
            try {
                const subPhotos = submission.photos || []
                const httpPhotos = subPhotos.filter((p: string) => isValidImageUrl(p))
                const storagePhotos = subPhotos.filter((p: string) => p && !p.startsWith('http'))
                let resolved: string[] = []
                if (storagePhotos.length > 0) {
                    const urls = await fetchQuery(api.files.getMultipleUrls, { storageIds: storagePhotos })
                    resolved = urls.filter((u: any): u is string => u !== null)
                }
                photos = [...httpPhotos, ...resolved]
            } catch (error) {
                console.error('Error resolving submission photos:', error)
            }
        }
        console.log(`[IMAGES] Final photos array: ${photos.length} URLs`)

        // Resolve about_images: prefer user-edited, then enhanced, then extractedContent
        const userEditedAboutImages = ((extractedContent as any)?.about_images || [])
            .filter((img: string) => isUsableImageRef(img))
        const rawAboutImages = userEditedAboutImages.length > 0
            ? userEditedAboutImages
            : ((hasEnhancedImages && enhancedImagesByCategory.about?.length)
                ? enhancedImagesByCategory.about
                : ((extractedContent as any)?.about_images || []))
        // Filter out expired Airtable URLs from any source
        const aboutImageStorageIds = rawAboutImages.filter((img: string) =>
            img && (!img.startsWith('http') || isValidImageUrl(img))
        )
        let resolvedAboutImages: string[] = []

        if (aboutImageStorageIds.length > 0) {
            try {
                // Filter out already-resolved URLs and only resolve storage IDs
                const storageIdsToResolve = aboutImageStorageIds.filter(
                    (img: string) => img && !img.startsWith('http')
                )
                const alreadyResolvedUrls = aboutImageStorageIds.filter(
                    (img: string) => img && img.startsWith('http')
                )

                if (storageIdsToResolve.length > 0) {
                    const resolvedUrls = await fetchQuery(api.files.getMultipleUrls, {
                        storageIds: storageIdsToResolve
                    })

                    // Map back to original order
                    resolvedAboutImages = aboutImageStorageIds.map((img: string) => {
                        if (img.startsWith('http')) {
                            return img
                        }
                        const idx = storageIdsToResolve.indexOf(img)
                        return resolvedUrls[idx] || img
                    }).filter((url: string | null): url is string => url !== null)
                } else {
                    resolvedAboutImages = alreadyResolvedUrls
                }
            } catch (error) {
                console.error('Error resolving about image URLs:', error)
                // Fallback to original array if resolution fails
                resolvedAboutImages = aboutImageStorageIds
            }
        }

        // Resolve services_image: prefer user-edited, then enhanced, then extractedContent
        const userEditedServicesImage = (extractedContent as any)?.services_image
        const rawServicesImage = (userEditedServicesImage && isUsableImageRef(userEditedServicesImage))
            ? userEditedServicesImage
            : ((hasEnhancedImages && enhancedImagesByCategory.services?.length)
                ? enhancedImagesByCategory.services[0]
                : (extractedContent as any)?.services_image)
        const servicesImageStorageId = rawServicesImage && (!rawServicesImage.startsWith('http') || isValidImageUrl(rawServicesImage))
            ? rawServicesImage : undefined
        let resolvedServicesImage: string | undefined = undefined

        if (servicesImageStorageId && !servicesImageStorageId.startsWith('http')) {
            try {
                const resolvedUrls = await fetchQuery(api.files.getMultipleUrls, {
                    storageIds: [servicesImageStorageId]
                })
                if (resolvedUrls[0]) {
                    resolvedServicesImage = resolvedUrls[0]
                }
            } catch (error) {
                console.error('Error resolving services image URL:', error)
            }
        } else if (servicesImageStorageId?.startsWith('http')) {
            resolvedServicesImage = servicesImageStorageId
        }

        // Resolve featured_images: prefer user-edited, then enhanced, then extractedContent
        const userEditedFeaturedImages = ((extractedContent as any)?.featured_images || [])
            .filter((img: string) => isUsableImageRef(img))
        const rawFeaturedImages = userEditedFeaturedImages.length > 0
            ? userEditedFeaturedImages
            : ((hasEnhancedImages && enhancedImagesByCategory.featured?.length)
                ? enhancedImagesByCategory.featured
                : ((extractedContent as any)?.featured_images || []))
        const featuredImageStorageIds = rawFeaturedImages.filter((img: string) =>
            img && (!img.startsWith('http') || isValidImageUrl(img))
        )
        let resolvedFeaturedImages: string[] = []

        if (featuredImageStorageIds.length > 0) {
            try {
                // Filter out already-resolved URLs and only resolve storage IDs
                const storageIdsToResolve = featuredImageStorageIds.filter(
                    (img: string) => img && !img.startsWith('http')
                )
                const alreadyResolvedUrls = featuredImageStorageIds.filter(
                    (img: string) => img && img.startsWith('http')
                )

                if (storageIdsToResolve.length > 0) {
                    const resolvedUrls = await fetchQuery(api.files.getMultipleUrls, {
                        storageIds: storageIdsToResolve
                    })

                    // Map back to original order
                    resolvedFeaturedImages = featuredImageStorageIds.map((img: string) => {
                        if (img.startsWith('http')) {
                            return img
                        }
                        const idx = storageIdsToResolve.indexOf(img)
                        return resolvedUrls[idx] || img
                    }).filter((url: string | null): url is string => url !== null)
                } else {
                    resolvedFeaturedImages = alreadyResolvedUrls
                }
            } catch (error) {
                console.error('Error resolving featured image URLs:', error)
                // Fallback to original array if resolution fails
                resolvedFeaturedImages = featuredImageStorageIds
            }
        }

        // Resolve product images inside featured_products (convex:storageId → URL)
        const rawProducts = (extractedContent as any)?.featured_products || []
        let resolvedProducts = rawProducts
        if (rawProducts.length > 0) {
            const productImageIds = rawProducts
                .map((p: any) => p.image)
                .filter((img: string | undefined) => img && !img.startsWith('http'))
                .map((img: string) => img.replace(/^convex:/, ''))

            if (productImageIds.length > 0) {
                try {
                    const resolvedUrls = await fetchQuery(api.files.getMultipleUrls, {
                        storageIds: productImageIds
                    })
                    resolvedProducts = rawProducts.map((p: any) => {
                        if (!p.image || p.image.startsWith('http')) return p
                        const cleanId = p.image.replace(/^convex:/, '')
                        const idx = productImageIds.indexOf(cleanId)
                        const resolvedUrl = idx !== -1 ? resolvedUrls[idx] : null
                        return { ...p, image: resolvedUrl || p.image }
                    })
                } catch (error) {
                    console.error('Error resolving product image URLs:', error)
                }
            }
        }

        const defaultCustomizations = {
            heroStyle: 'A',
            aboutStyle: 'A',
            servicesStyle: 'A',
            galleryStyle: 'A',
            contactStyle: 'A',
            // Legacy fields
            navbarStyle: '1',
            featuredStyle: '1',
            footerStyle: '1',
            colorScheme: 'auto',
            colorSchemeId: 'auto',
            fontPairing: 'modern',
            fontPairingId: 'modern'
        }
        const finalCustomizations = customizations && Object.keys(customizations).length > 0
            ? { ...defaultCustomizations, ...customizations }
            : defaultCustomizations

        // Ensure all required fields are present with fallbacks from submission data
        const contentWithContact = {
            // Core required fields with fallbacks
            business_name: extractedContent?.business_name || submission.business_name,
            tagline: extractedContent?.tagline || `Welcome to ${submission.business_name}`,
            about: extractedContent?.about || `${submission.business_name} is a ${submission.business_type} located in ${submission.city}.`,
            services: extractedContent?.services || [
                { name: 'Service 1', description: 'Quality service for our customers' },
                { name: 'Service 2', description: 'Professional and reliable' },
                { name: 'Service 3', description: 'Customer satisfaction guaranteed' }
            ],
            unique_selling_points: extractedContent?.unique_selling_points || ['Quality', 'Reliability', 'Service'],
            tone: extractedContent?.tone || 'professional-friendly',
            // Optional fields
            hero_cta: extractedContent?.hero_cta,
            hero_cta_secondary: extractedContent?.hero_cta_secondary,
            services_cta: extractedContent?.services_cta,
            methodology: extractedContent?.methodology,
            // Hero section fields
            hero_badge_text: extractedContent?.hero_badge_text,
            hero_testimonial: extractedContent?.hero_testimonial,
            // Visibility toggles
            visibility: extractedContent?.visibility || {
                navbar: true,
                hero_section: true,
                hero_headline: true,
                hero_tagline: true,
                hero_description: true,
                hero_testimonial: true,
                hero_button: true,
                hero_image: true,
                // About section visibility
                about_section: true,
                about_badge: true,
                about_headline: true,
                about_description: true,
                about_images: true,
                about_tagline: true,
                about_tags: true,
                // Services section visibility
                services_section: true,
                services_badge: true,
                services_headline: true,
                services_subheadline: true,
                services_image: true,
                services_list: true,
                // Featured section visibility
                featured_section: true,
                featured_headline: true,
                featured_subheadline: true,
                featured_products: true,
                // Footer section visibility
                footer_section: true,
                footer_badge: true,
                footer_headline: true,
                footer_description: true,
                footer_contact: true,
                footer_social: true
            },
            // About section fields
            about_headline: extractedContent?.about_headline,
            about_description: (extractedContent as any)?.about_description,
            about_tagline: (extractedContent as any)?.about_tagline,
            about_tags: (extractedContent as any)?.about_tags,
            about_images: resolvedAboutImages.length > 0 ? resolvedAboutImages : undefined,
            // Services section fields
            services_headline: (extractedContent as any)?.services_headline,
            services_subheadline: (extractedContent as any)?.services_subheadline,
            services_image: resolvedServicesImage,
            // Featured section fields - generate defaults if not present
            featured_headline: (extractedContent as any)?.featured_headline || 'Featured Products',
            featured_subheadline: (extractedContent as any)?.featured_subheadline || `Take a look at some of our recent work at ${submission.business_name}`,
            // The defaults branch is machine-written down to the customer names
            // (see generateDefaultFeaturedProducts), so it goes through the same
            // guard as the models do. `resolvedProducts` derives from
            // extractedContent, which the stored-content pass above already
            // filtered.
            featured_products: resolvedProducts.length > 0
                ? resolvedProducts
                : guardGenerated('default featured products', generateDefaultFeaturedProducts(submission.business_name, submission.business_type, photos.length)),
            featured_images: resolvedFeaturedImages.length > 0 ? resolvedFeaturedImages : undefined,
            // Featured CTA fields for style 4
            featured_cta_text: (extractedContent as any)?.featured_cta_text,
            featured_cta_link: (extractedContent as any)?.featured_cta_link,
            // Navbar links
            navbar_links: extractedContent?.navbar_links || [
                { label: 'About', href: '#about' },
                { label: 'Services', href: '#services' },
                { label: 'Featured', href: '#featured' },
                { label: 'Contacts', href: '#contact' }
            ],
            navbar_cta_text: (extractedContent as any)?.navbar_cta_text,
            navbar_cta_link: (extractedContent as any)?.navbar_cta_link,
            navbar_headline: (extractedContent as any)?.navbar_headline,
            // Images: preserve user's per-slot image selections if valid, otherwise use resolved photos
            // This keeps the user's content editor choices (slot 1 = X, slot 2 = Y) intact
            // while filtering out expired Airtable URLs
            images: hasValidUserEditedImages ? userEditedImages : photos,
            // Contact info from submission (or from existing extracted content if edited)
            contact: (extractedContent as any)?.contact || {
                email: submission.owner_email || 'contact@example.com',
                phone: submission.owner_phone || '+63 900 000 0000',
                address: submission.address ? `${submission.address}, ${submission.city}` : submission.city
            },
            // Footer section fields
            footer: (extractedContent as any)?.footer || {
                brand_blurb: `For any inquiries or to explore your vision further, we invite you to contact our professional team using the details provided below.`,
                social_links: []
            },
            // ── New v01-spec block content (feeds Location/ServiceArea/ClickToMessage) ──
            // Coordinates: submitter-set wins; else falls back to whatever the
            // editor may have stored under extractedContent.location.
            location: (extractedContent as any)?.location ?? ((submission as any).coordinates ? {
                lat: (submission as any).coordinates.lat,
                lng: (submission as any).coordinates.lng,
            } : undefined),
            // Google Business Profile link — owner edits hours in Google, the
            // LocationBlock renders this as the "See latest hours on Google"
            // deeplink. Builder auto-falls-back to a Maps search-by-address
            // query when this is unset, so the button always works.
            googleMapsUrl:
                (extractedContent as any)?.googleMapsUrl ??
                (submissionData as any).googleMapsUrl ??
                (submissionData as any).googleBusinessUrl ??
                undefined,
            // Service area: editor-set wins; else build pipeline auto-seeds from
            // the city name via SERVICE_AREA_SEEDS adjacency table.
            serviceArea: (extractedContent as any)?.serviceArea,
            // Click-to-message: editor-set wins; else build pipeline auto-derives
            // whatsapp from contact.phone (PH 0917... → 63917...).
            messaging: (extractedContent as any)?.messaging,
            // Hint for the build pipeline's serviceArea seeder.
            business_city: submission.city,
            // Hint for the build pipeline's per-business-type defaults
            // (Trust/WhyUs/HowItWorks/Testimonials/FAQ/Credentials/CtaBand).
            business_type: submission.business_type,
            // Conversion-cluster overrides — admin edits in /admin/submissions
            // override the per-category defaults from lib/block-defaults.ts.
            trust: (extractedContent as any)?.trust,
            why: (extractedContent as any)?.why,
            how: (extractedContent as any)?.how,
            testimonials: (extractedContent as any)?.testimonials,
            faq: (extractedContent as any)?.faq,
            credentials: (extractedContent as any)?.credentials,
            ctaBand: (extractedContent as any)?.ctaBand,
            // Branded-family nested-section content (Barbershop F–J, SalonSpa
            // K–O). These wrappers consume `content.gallery.items[i].image`,
            // `content.hero.image`, `content.about.image`, etc. — distinct
            // from the legacy flat fields above (about_images, featured_images,
            // hero_image_url). Without this pass-through, admin edits made
            // through the click-to-edit / image picker UI land in Convex's
            // extractedContent but never reach the builder — so the next
            // regen falls back to derived defaults and admin's choice is
            // silently discarded. Specifically discovered for gallery image
            // picks; symptom applies to every wrapped section.
            // See TEMPLATE-FAMILY-PLAYBOOK.md §"Common gotchas" for the
            // schema mismatch detail.
            // Each of these is a wrapped section object for branded families
            // (e.g. content.about = { tag, headline, paragraphs[], image }
            // for SalonSpa AboutK). Override the legacy flat field above
            // ONLY when the admin draft stores the wrapped object shape —
            // otherwise we'd clobber the string-shaped `about` / array-shaped
            // `services` paths that Generic A–E still uses.
            ...(isWrappedObject((extractedContent as any)?.about)
                ? { about: (extractedContent as any).about } : {}),
            ...(isWrappedObject((extractedContent as any)?.services)
                ? { services: (extractedContent as any).services } : {}),
            ...(isWrappedObject((extractedContent as any)?.hero)
                ? { hero: (extractedContent as any).hero } : {}),
            ...(isWrappedObject((extractedContent as any)?.gallery)
                ? { gallery: (extractedContent as any).gallery } : {}),
            ...(isWrappedObject((extractedContent as any)?.area)
                ? { area: (extractedContent as any).area } : {}),
            ...(isWrappedObject((extractedContent as any)?.marquee)
                ? { marquee: (extractedContent as any).marquee } : {}),
            navCtaText: (extractedContent as any)?.navCtaText,
            navCtaHref: (extractedContent as any)?.navCtaHref,
            // The browser-tab icon and the social-card image. Both are admin
            // uploads that live at the TOP LEVEL of the draft, and neither was
            // in this whitelist — so transformToAstroData read content.favicon
            // as undefined, layout.favicon came out empty, and every template
            // rendered neither its <link rel="icon"> nor its og:image, both of
            // which are guarded on it. An admin set a favicon, watched it save
            // with a thumbnail in the Media card, published, and got the
            // browser default globe. Verified on a live workers.dev page: the
            // deployed head carried title, description and og:title/description
            // and neither of these two.
            //
            // THIS OBJECT IS A WHITELIST, not a spread. Anything an editor can
            // write that is not named here is dropped silently between save and
            // build — the save succeeds, the toast is green, and the field never
            // reaches the page.
            favicon: (extractedContent as any)?.favicon,
            ogImage: (extractedContent as any)?.ogImage,
        }

        let generatedHtml = await buildAstroSite(contentWithContact, finalCustomizations, photos)

        // Bake per-role colour overrides (click-to-recolour) into the built HTML
        // so they persist on Save + Publish (the live editor injects the same CSS
        // client-side). Template-agnostic — keyed by the shared data-field
        // selectors. See lib/roleColors.ts.
        const __roleColorCss = buildRoleColorCss((finalCustomizations as any)?.roleColors)
        if (__roleColorCss) {
            const __styleTag = `<style id="role-colors">${__roleColorCss}</style>`
            generatedHtml = generatedHtml.includes('</head>')
                ? generatedHtml.replace('</head>', `${__styleTag}</head>`)
                : (generatedHtml.includes('</body>')
                    ? generatedHtml.replace('</body>', `${__styleTag}</body>`)
                    : generatedHtml + __styleTag)
        }

        // ── What the admin is told about the guard ────────────────────
        // The count is the whole point of this block. A creator-funnel
        // recording can be full of genuine customer quotes and every one of
        // them is stripped (nothing on that path can verify a quote), leaving a
        // page with no testimonials band and — until this — no hint that the
        // recording had anything quotable in it. An admin who doesn't know
        // can't type the real words back in.
        //
        // The message ships from here rather than from the UI because the route
        // is the only place that knows WHICH strip fired and therefore what the
        // admin should do next. The caller renders `message` verbatim.
        const testimonialGuard = {
            /** false → this business supplied no testimonial words, so the guard was live. */
            sourced: testimonialsAreSourced,
            removed: guardRemoved.generated + guardRemoved.stored,
            removedFromGenerated: guardRemoved.generated,
            removedFromStored: guardRemoved.stored,
            message: [
                guardRemoved.generated > 0
                    ? `${guardRemoved.generated} customer quote${guardRemoved.generated === 1 ? '' : 's'} written from the interview ${guardRemoved.generated === 1 ? 'was' : 'were'} removed — nothing in this submission records who said ${guardRemoved.generated === 1 ? 'it' : 'them'}. If the recording has real quotes, type them into the Testimonials block and save; typed quotes are kept.`
                    : '',
                guardRemoved.stored > 0
                    ? `${guardRemoved.stored} stored customer quote${guardRemoved.stored === 1 ? '' : 's'} ${guardRemoved.stored === 1 ? 'was' : 'were'} removed from the saved content — machine-written, not supplied by the business.`
                    : '',
            ].filter(Boolean).join(' ') || undefined,
        }

        // PREVIEW mode: hand the built HTML back to the editor's "Preview my site"
        // WITHOUT persisting anything — no generatedWebsites / websiteContent upsert,
        // no publish, no touch to the live site. Same assembly + build as a real
        // save, so what the admin previews is exactly what Save will produce.
        if (preview) {
            return NextResponse.json({ success: true, html: generatedHtml, testimonialGuard })
        }

        // Save to Convex using mutations
        const { fetchMutation, fetchAction } = await import('convex/nextjs')

        // Store the built HTML in Convex file storage (it can exceed the 1 MiB
        // per-document limit, which was throwing "Value is too large" on upsert)
        // and keep only the reference on the row. Readers resolve it via the
        // htmlUrl the getBySubmission* queries return — see lib/website-html.ts.
        const htmlStorageId = await fetchAction(api.generatedWebsites.storeHtml, {
            html: generatedHtml,
        })

        // Save generated website to Convex (legacy table - kept for backward compatibility)
        const websiteId = await fetchMutation(api.generatedWebsites.upsert, {
            submissionId: submissionData._id,
            templateName: selectedTemplate,
            extractedContent: contentWithContact,
            customizations: finalCustomizations,
            htmlStorageId,
            status: 'draft',
        })

        // Also save to the new websiteContent table (normalized content storage)
        await fetchMutation(api.websiteContent.upsert, {
            websiteId: websiteId,
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
        })

        // Update submission status to website_generated (but don't regress if already deployed+)
        const keepStatuses = ['deployed', 'pending_payment', 'paid']
        if (!keepStatuses.includes(submissionData.status)) {
            await fetchMutation(api.submissions.updateStatus, {
                id: submissionId as any,
                status: 'website_generated',
            })
        }

        return NextResponse.json({
            success: true,
            websiteId: websiteId,
            htmlContent: generatedHtml, // For iframe srcdoc preview
            website: {
                extracted_content: contentWithContact,
                customizations: finalCustomizations
            },
            testimonialGuard,
            message: 'Website generated successfully'
        })

    } catch (error: any) {
        console.error('Website generation error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to generate website' },
            { status: 500 }
        )
    }
}

/**
 * Generate default featured projects based on business info
 * Used when no featured_products are provided in extractedContent
 */
function generateDefaultFeaturedProducts(businessName: string, businessType: string, photoCount: number) {
    const productCount = Math.min(Math.max(photoCount, 1), 3) // 1-3 projects based on photos

    // Business type specific project templates
    const productTemplates: Record<string, Array<{ title: string; description: string; tags: string[] }>> = {
        'restaurant': [
            { title: 'Complete Kitchen Renovation', description: `We transformed the heart of ${businessName} with a modern kitchen setup featuring state-of-the-art equipment and efficient workflow design. The result is a space that enhances productivity while maintaining the highest standards of quality.`, tags: ['Kitchen', 'Renovation'] },
            { title: 'Dining Area Enhancement', description: `A complete refresh of the dining space at ${businessName}, creating an inviting atmosphere for guests. We focused on comfortable seating, ambient lighting, and décor that reflects the restaurant's unique character.`, tags: ['Interior', 'Design'] },
            { title: 'Outdoor Patio Setup', description: `Expanded the dining capacity with a beautiful outdoor patio area. The space features weather-resistant furniture and ambient lighting, perfect for al fresco dining experiences.`, tags: ['Outdoor', 'Expansion'] }
        ],
        'retail': [
            { title: 'Store Layout Optimization', description: `Redesigned the floor layout at ${businessName} to improve customer flow and product visibility. The new arrangement has significantly enhanced the shopping experience and increased customer engagement.`, tags: ['Retail', 'Layout'] },
            { title: 'Display System Installation', description: `Installed custom display systems that showcase products beautifully while maximizing floor space. The modular design allows for easy reconfiguration for seasonal changes.`, tags: ['Display', 'Custom'] },
            { title: 'Checkout Area Modernization', description: `Upgraded the checkout experience with modern POS systems and a welcoming counter design. The improvements have reduced wait times and improved customer satisfaction.`, tags: ['Technology', 'Service'] }
        ],
        'default': [
            { title: 'Complete Business Setup', description: `A comprehensive project for ${businessName} that included space planning, equipment installation, and finishing touches. The result is a professional environment that perfectly serves business needs.`, tags: ['Setup', 'Complete'] },
            { title: 'Service Area Enhancement', description: `Upgraded the main service area to improve workflow efficiency and customer experience. The modern design reflects the quality and professionalism of ${businessName}.`, tags: ['Enhancement', 'Service'] },
            { title: 'Customer Experience Improvement', description: `Focused improvements on the customer-facing areas, creating a welcoming atmosphere that encourages return visits and positive reviews.`, tags: ['Customer', 'Experience'] }
        ]
    }

    const templates = productTemplates[businessType.toLowerCase()] || productTemplates['default']

    // Generate projects with testimonials.
    // These names and quotes are invented — nobody named below is a customer of
    // anything. The caller runs the result through the fabricated-testimonial
    // guard, which strips `testimonial` outright unless the business actually
    // supplied testimonial words, so they reach a page only when they have been
    // replaced by real ones. Do not read them as safe defaults.
    const testimonialAuthors = ['Maria Santos', 'Juan Dela Cruz', 'Ana Reyes', 'Carlo Mendoza', 'Lisa Garcia']
    const testimonialQuotes = [
        `${businessName} exceeded all our expectations. The attention to detail and professionalism was outstanding from start to finish.`,
        `Working with ${businessName} was a pleasure. They truly understood our vision and delivered beyond what we imagined.`,
        `The team at ${businessName} transformed our space completely. We couldn't be happier with the results and the service we received.`
    ]

    return templates.slice(0, productCount).map((template, index) => ({
        title: template.title,
        description: template.description,
        tags: template.tags,
        testimonial: {
            quote: testimonialQuotes[index % testimonialQuotes.length],
            author: testimonialAuthors[index % testimonialAuthors.length]
        }
    }))
}
