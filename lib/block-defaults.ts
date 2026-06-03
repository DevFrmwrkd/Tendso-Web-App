/**
 * Block defaults — neutral fallback only.
 *
 * The per-business-type content overrides (barber, restaurant, salon, auto,
 * clinic, etc.) were removed when the template library was wiped for a
 * clean-slate redesign. `defaultsFor()` now returns the same neutral
 * placeholder regardless of `businessType`. The signature is preserved so
 * `lib/astro-builder.ts` and any future call sites keep working unchanged.
 *
 * When the new templates land, either:
 *   • re-add a per-type lookup table here, or
 *   • move per-design defaults next to the template that consumes them.
 */

export type WhyItem = { title: string; body: string }
export type HowStep = { step: string; title: string; body: string }
export type Testimonial = { quote: string; name: string; context?: string }
export type FaqItem = { q: string; a: string }
export type CredItem = { label: string; detail: string }
export type CtaBand = {
    heading?: string
    body?: string
    primaryLabel?: string
    primaryLink?: string
    secondaryLabel?: string
    secondaryLink?: string
}
export type TrustData = {
    years?: string
    licenses?: string[]
    memberships?: string[]
}

export interface BlockDefaults {
    trust?: TrustData
    why?: WhyItem[]
    how?: HowStep[]
    testimonials?: Testimonial[]
    faq?: FaqItem[]
    credentials?: CredItem[]
    ctaBand?: CtaBand
}

// Neutral placeholder copy. Generic enough to read on any business while
// new designs are being built; admin can override any field through the
// editor and those values win over this default.
const NEUTRAL: BlockDefaults = {
    why: [
        { title: 'We answer when you call.', body: 'Real people, same-day reply during business hours.' },
        { title: 'We finish what we start.', body: 'Every job has a clear scope and one point of contact.' },
        { title: 'We stand behind the work.', body: 'If something is wrong after we leave, we come back and fix it.' },
    ],
    how: [
        { step: '01', title: 'You message us', body: 'Phone, WhatsApp, or the form — whichever is easiest.' },
        { step: '02', title: 'We confirm the details', body: 'Quick reply with what we can do and when.' },
        { step: '03', title: 'We do the work', body: 'On the agreed date and on time.' },
    ],
    testimonials: [],
    faq: [
        { q: 'How do I book?', a: 'Phone, message, or walk in. We reply the same day.' },
        { q: 'Where are you?', a: 'See the Location section below.' },
    ],
    credentials: [],
    ctaBand: {
        heading: 'Ready when you are.',
        body: 'Message us and we will get back to you the same day.',
        primaryLabel: 'Get in touch',
        primaryLink: '#contact',
    },
}

export function defaultsFor(_businessType: string | undefined | null): BlockDefaults {
    // Per-business-type lookup was removed with the template wipe. Every
    // business gets the same neutral fallback until new designs land.
    return NEUTRAL
}
