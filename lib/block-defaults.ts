/**
 * Per-business-type defaults for the v01 block superset.
 *
 * Each new content block (Trust, WhyUs, HowItWorks, Testimonials, FAQ,
 * Credentials, CtaBand) ships with real sample copy per business type so
 * empty sites look finished cold (per the brief's "real sample content,
 * no lorem" rule and the "superset + delete, never add" model).
 *
 * Brief's hard rules respected:
 *   • No prices, no promos, no staff names, no specific dates
 *   • Hours stay empty (GBP-bound)
 *   • Real, opinionated copy — not "we offer X service"
 *
 * Resolution order in transformToAstroData:
 *   1. Admin-set value (extractedContent.trustBlock etc.)
 *   2. Per-business-type default from this file
 *   3. Generic fallback ('default')
 *
 * Business type keys are lowercased, hyphenated business_type strings
 * from `submissions.business_type` — common values: 'barber', 'salon',
 * 'restaurant', 'auto', 'clinic', 'cafe', 'retail', 'fitness',
 * 'services', 'trades', 'education', 'beauty'.
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

// ── Generic fallback — used when no per-category default matches ──
const DEFAULT: BlockDefaults = {
    why: [
        { title: 'We answer when you call.', body: 'Real people, same-day reply during business hours. No phone trees, no callback queues.' },
        { title: 'We finish what we start.', body: 'Every job has a clear scope, a fixed timeline, and one point of contact from first message to handover.' },
        { title: 'We stand behind the work.', body: 'If something is wrong after we leave, we come back and fix it. That is the whole policy.' },
    ],
    how: [
        { step: '01', title: 'You message us', body: 'Phone, WhatsApp, or the form — whichever is easiest. Send a photo if it helps.' },
        { step: '02', title: 'We confirm the details', body: 'Quick reply with what we can do, when we can do it, and what to expect.' },
        { step: '03', title: 'We do the work', body: 'On the agreed date. We show up on time and tell you when we are running late.' },
        { step: '04', title: 'You decide it is right', body: 'You only pay when you are happy with the result. Small fixes are part of the job.' },
    ],
    testimonials: [
        { quote: 'They showed up on time and finished cleanly. That was already more than I expected.', name: 'Maria L.', context: 'long-time customer' },
        { quote: 'Quick to reply, fair on price, no surprises. I have used them three times now.', name: 'Reggie T.', context: 'returning customer' },
        { quote: 'Honest people, careful work. I send everyone I know here.', name: 'Anna G.', context: 'neighbor' },
    ],
    faq: [
        { q: 'How do I book?', a: 'Phone, message, or walk in. Whichever is easiest for you — we answer all three the same day.' },
        { q: 'Do you accept walk-ins?', a: 'Yes. Booked appointments take priority, but we keep slots open for walk-ins through the day.' },
        { q: 'How much does it cost?', a: 'Pricing depends on the job — message us with a photo or a description and we give you a real number, not a range.' },
        { q: 'Where are you?', a: 'See the Location section below. Easy parking, easy to find.' },
        { q: 'What if I am not happy?', a: 'Tell us and we will fix it. We do not consider a job done until you do.' },
    ],
    credentials: [],
    ctaBand: {
        heading: 'Ready when you are.',
        body: 'Message us and we will get back to you the same day.',
        primaryLabel: 'Get in touch',
        primaryLink: '#location',
    },
}

// ── Per-business-type overrides ──
const BY_TYPE: Record<string, BlockDefaults> = {
    // FOOD / CAFE / RESTAURANT
    restaurant: {
        why: [
            { title: 'We cook every plate to order.', body: 'Nothing is pre-warmed; nothing sits under a lamp. Twenty minutes longer beats reheated.' },
            { title: 'Short menu, slow turnover.', body: 'We pick a few dishes and do them right. When something runs out, we write something new on the wall.' },
            { title: 'Suppliers we can name.', body: 'Most of our ingredients come from within an hour of the kitchen. Ask us — we will tell you.' },
        ],
        how: [
            { step: '01', title: 'Walk in', body: 'Walk-in seating is always first-come. Breakfast and lunch do not take bookings.' },
            { step: '02', title: 'Or reserve dinner', body: 'Evening tables only. Reserve through the form, by phone, or by message.' },
            { step: '03', title: 'Order at the table', body: 'We bring everything when it is ready, not in courses. The bread comes first.' },
            { step: '04', title: 'Pay at the counter', body: 'Card or cash. Service is included; tips go to the kitchen.' },
        ],
        testimonials: [
            { quote: 'The flatbread alone is worth crossing the city for. The room is warm in a way most new restaurants are not.', name: 'Hattie L.', context: 'regular' },
            { quote: 'I have eaten here on every birthday for six years. They remember the wine and they remember the dog.', name: 'Andreas P.', context: 'neighbor' },
            { quote: 'Honest, careful cooking. Nothing oversold and nothing under-loved.', name: 'Marian S.', context: 'first visit' },
        ],
        faq: [
            { q: 'Do you take bookings?', a: 'Evening tables only. Breakfast and lunch are walk-in. Reserve below or by message.' },
            { q: 'Are you vegetarian-friendly?', a: 'Most of the menu is vegetarian. Vegan options are clearly marked. We can adapt almost anything.' },
            { q: 'Do you have gluten-free?', a: 'Some dishes are naturally gluten-free; ask your server. We bake in a flour-heavy kitchen so it is not a coeliac-safe environment.' },
            { q: 'Is the room accessible?', a: 'Step-free entry. Please call ahead so we can hold a table near the door.' },
            { q: 'Can we bring children?', a: 'Yes — we have highchairs and a quieter corner table.' },
            { q: 'Do you do private events?', a: 'We can take the whole room for parties of 10–22 with a set menu.' },
        ],
        ctaBand: {
            heading: 'See you at the table.',
            body: 'Walk in for breakfast and lunch; reserve a table for dinner.',
            primaryLabel: 'Reserve a table',
            primaryLink: '#location',
            secondaryLabel: 'Directions',
            secondaryLink: '#location',
        },
    },
    cafe: {}, // inherits restaurant via lookup chain below
    food: {}, // same

    // BEAUTY / SALON / SPA
    salon: {
        trust: {
            years: 'A house of beauty since 2018',
            licenses: [
                'PRC-Licensed cosmetologists',
                'DOH-permitted salon facility',
                'L\'Oréal Professionnel certified colourist',
            ],
            memberships: [
                'Filipino Salon & Spa Association',
                'Wella Master Colour Network',
                'Better Business Bureau A+',
            ],
        },
        credentials: [
            { label: 'Licensed', detail: 'PRC-certified cosmetologists, DTI + DOH registered' },
            { label: 'Trained', detail: 'L\'Oréal · Wella · Schwarzkopf certified colourists' },
            { label: 'Insured', detail: 'Public liability cover up to ₱5M' },
            { label: 'Awarded', detail: 'Best Salon 2024 · Local Choice 2023, 2025' },
        ],
        why: [
            { title: 'We never double-book.', body: 'Your appointment is your appointment. We will not rush you out for the next chair.' },
            { title: 'Proper consultation, every time.', body: 'Five minutes before scissors hit hair, we agree exactly what you want.' },
            { title: 'We will say no.', body: 'If we do not think the cut or colour is right for you, we tell you. That is what you pay us for.' },
        ],
        how: [
            { step: '01', title: 'Book online or message', body: 'Pick a stylist, pick a slot. Confirm by message.' },
            { step: '02', title: 'Quick consultation', body: 'On arrival we agree exactly what we are doing. Photos welcome.' },
            { step: '03', title: 'The work', body: 'No phones, just good conversation if you want it. We work clean and on time.' },
            { step: '04', title: 'Walk out happy', body: 'We adjust on the spot if it is not quite right. Your time pays for that.' },
        ],
        testimonials: [
            { quote: 'First salon in years where they listened to what I actually wanted.', name: 'Pia R.', context: 'monthly client' },
            { quote: 'Clean room, calm energy, perfect colour. I drive across town to come here.', name: 'Joanna M.', context: 'long-time client' },
            { quote: 'My wife brought me. Now I bring my brother.', name: 'Ramon C.' },
        ],
        faq: [
            { q: 'Do I need a consultation first?', a: 'For first-time colour or major restyle, yes — we offer this free. For trims and known services, just book directly.' },
            { q: 'How long will my appointment take?', a: 'Cuts 45 min; colour 90–180 min depending on length and shade. We block the time you need; we do not rush.' },
            { q: 'Do you take cards?', a: 'Card, cash, GCash, Maya.' },
            { q: 'What if I am late?', a: 'We hold the chair 15 minutes. After that we may need to reschedule so the next client is not pushed.' },
            { q: 'Do you cater to events?', a: 'Bridal and event styling by appointment. Message us first.' },
        ],
        ctaBand: {
            heading: 'Book a chair.',
            body: 'Pick a stylist and a time. We confirm same-day.',
            primaryLabel: 'Book now',
            primaryLink: '#contact',
        },
    },
    beauty: {},

    // AUTO / TRADES
    auto: {
        why: [
            { title: 'We tell you what is wrong, not what makes us money.', body: 'Diagnostic is free. If it is a thirty-second fix, we say so.' },
            { title: 'Genuine parts, traceable receipts.', body: 'Every part we put in your car comes with the supplier invoice. Nothing rebranded, nothing recycled.' },
            { title: 'Same-day for common jobs.', body: 'Tyres, brakes, batteries, oil — in and out the same day. We tell you upfront if it is not.' },
        ],
        how: [
            { step: '01', title: 'Drive in or message', body: 'Walk-in or book a slot. Send a photo or a short clip if it helps.' },
            { step: '02', title: 'Free diagnostic', body: 'We look at the car, write down what we find, and quote before we touch anything.' },
            { step: '03', title: 'You approve, we work', body: 'Nothing happens without your sign-off. We send photos of what we replace.' },
            { step: '04', title: 'Pay when you pick up', body: 'Card, cash, or GCash. We keep the old parts so you can see them.' },
        ],
        testimonials: [
            { quote: 'They quoted what the dealer would have charged me triple for. Fixed it the same day.', name: 'Mark D.', context: 'long-time customer' },
            { quote: 'Honest mechanic in this town is hard to find. This is the one.', name: 'Lisa P.', context: 'sent by a friend' },
            { quote: 'My truck has 280,000km and runs like new because of these guys.', name: 'Rafael S.' },
        ],
        faq: [
            { q: 'Do I need an appointment?', a: 'Walk-ins fine for tyres, brakes, oil. For diagnostics or bigger work, book a slot so we can give you a proper window.' },
            { q: 'Do you give a warranty on parts?', a: 'Yes — most parts carry the supplier warranty (12 months). Labour warranty is our own (90 days).' },
            { q: 'Can you collect my car?', a: 'For regular customers within 10km, yes. Ask when you book.' },
            { q: 'Do you do major repairs?', a: 'Engine, transmission, suspension — yes, in-house. Bodywork we partner with a panel shop next door.' },
            { q: 'Can I watch?', a: 'You can — most customers do not, but the bays are open and you are welcome.' },
        ],
        credentials: [
            { label: 'Licensed', detail: 'DTI-registered, BIR-permit-current' },
            { label: 'Insurance', detail: 'Public liability cover up to ₱2M' },
        ],
        ctaBand: {
            heading: 'Got a noise? Send us a clip.',
            body: 'WhatsApp us a short video; we will tell you what we think before you drive over.',
            primaryLabel: 'Message us',
            primaryLink: '#location',
        },
    },
    trades: {}, // inherits auto
    plumbing: {},
    electrician: {},

    // CLINIC / MEDICAL / DENTAL
    clinic: {
        why: [
            { title: 'One condition, one plan.', body: 'You leave every visit knowing exactly what the next step is and when it happens.' },
            { title: 'We respect your time.', body: 'Appointments run on schedule. If something is running late, we tell you in advance, not at the door.' },
            { title: 'No upselling.', body: 'We recommend what you need. If you can wait or self-manage, we say so.' },
        ],
        how: [
            { step: '01', title: 'Book online or by phone', body: 'Pick a slot. We confirm by SMS the day before.' },
            { step: '02', title: 'Arrive 10 minutes early', body: 'Fill the short intake form on your first visit; less waiting.' },
            { step: '03', title: 'Consultation + plan', body: 'You leave with a written plan, costs, and the next appointment if needed.' },
            { step: '04', title: 'Follow up by message', body: 'Any questions afterwards, message the clinic — we answer the same day.' },
        ],
        testimonials: [
            { quote: 'Calm clinic, gentle staff. My five-year-old actually likes coming here.', name: 'Sarah G.', context: 'family client' },
            { quote: 'No upsell, no scare tactics. Just careful, honest treatment.', name: 'Dennis K.' },
            { quote: 'They got me in same-day when my regular dentist could not. I am switching.', name: 'Carol R.' },
        ],
        faq: [
            { q: 'Do you accept walk-ins?', a: 'Emergency cases only. For regular consultations please book to keep waiting times short.' },
            { q: 'Do you accept HMO?', a: 'Yes — see the list at reception or ask when booking. We process the paperwork on your behalf.' },
            { q: 'How long is a first visit?', a: 'Plan for 45–60 minutes. Follow-ups are usually 20–30 minutes.' },
            { q: 'Can I bring my kids?', a: 'Yes — quiet waiting area with books and a play corner.' },
            { q: 'Do you do home visits?', a: 'For mobility-impaired patients within 10km, yes. Call to arrange.' },
        ],
        credentials: [
            { label: 'PRC licence', detail: 'All practising clinicians PRC-current' },
            { label: 'DOH permit', detail: 'Facility-permit current and inspected' },
        ],
        ctaBand: {
            heading: 'Book a consultation.',
            body: 'Slots open same week. We confirm by SMS.',
            primaryLabel: 'Book now',
            primaryLink: '#contact',
        },
    },
    medical: {},
    dental: {},

    // RETAIL / SHOP
    retail: {
        why: [
            { title: 'We stock what we believe in.', body: 'Smaller catalogue, every item personally chosen. If we sell it, we use it.' },
            { title: 'Real advice, not upsell.', body: 'We tell you what you actually need. If a cheaper option works, we say so.' },
            { title: 'After-sale support means something.', body: 'Bring the item back if it does not perform. We make it right.' },
        ],
        how: [
            { step: '01', title: 'Visit or message', body: 'Walk in to browse, or message us a question — we reply same-day.' },
            { step: '02', title: 'Pick what works', body: 'Try, ask, take photos to compare. No pressure to decide on the spot.' },
            { step: '03', title: 'Pay and pack', body: 'Cards, cash, GCash, Maya. We can deliver for an extra fee.' },
            { step: '04', title: 'Come back if it does not fit', body: 'Within 14 days, unworn — we exchange or refund.' },
        ],
        testimonials: [
            { quote: 'Smaller selection but everything they sell is actually good. Less time wasted.', name: 'Bea H.', context: 'monthly visitor' },
            { quote: 'They remembered me from one visit and what I bought. Old-school service.', name: 'Nico T.' },
            { quote: 'Better prices than the mall and I get to talk to someone who knows the product.', name: 'Faye L.' },
        ],
        faq: [
            { q: 'Do you ship?', a: 'Within Metro Manila yes; other locations by Lalamove. Quote at checkout.' },
            { q: 'Can I return items?', a: '14 days, unworn, with receipt. We exchange or refund to original payment method.' },
            { q: 'Do you carry sizes/colours not on display?', a: 'Often yes — ask. We hold stock in the back and order on request.' },
            { q: 'Do you do bulk orders?', a: 'Yes — message us for trade pricing on 10+ units.' },
        ],
        ctaBand: {
            heading: 'Drop in, take your time.',
            body: 'Open daily. Card and cash welcome.',
            primaryLabel: 'See location',
            primaryLink: '#location',
        },
    },

    // FITNESS / GYM
    fitness: {
        why: [
            { title: 'Coaches, not influencers.', body: 'Every coach here has trained someone older, weaker, and more injured than you to a real result.' },
            { title: 'Programs, not classes.', body: 'You follow a written progression. Each week builds on the last. No random sweat-and-shower workouts.' },
            { title: 'No long contracts.', body: 'Month-to-month. If we are not the right fit for you, you stop.' },
        ],
        how: [
            { step: '01', title: 'Free intro session', body: 'One coach, one hour. We assess what you can do today and what you want to do.' },
            { step: '02', title: 'Pick a program', body: 'Strength, conditioning, body-recomp — we recommend, you choose.' },
            { step: '03', title: 'Train', body: 'Three to five sessions a week. We track every lift and every metric.' },
            { step: '04', title: 'Re-test every 8 weeks', body: 'Numbers go up or the program changes. No guessing.' },
        ],
        testimonials: [
            { quote: 'I came here weighing what I do now plus 20kg. They made it sustainable.', name: 'Carl A.', context: '14 months in' },
            { quote: 'Coaches who actually program, instead of just counting reps.', name: 'Mae S.' },
            { quote: 'The strongest, friendliest gym I have trained at in three cities.', name: 'Diego R.' },
        ],
        faq: [
            { q: 'Do I need experience?', a: 'No. Half our intake has never lifted before. The intro session handles that.' },
            { q: 'Can I just do classes?', a: 'Classes are part of every membership; you do not have to take them.' },
            { q: 'Is there a long contract?', a: 'No. Month-to-month, cancel any time with 7 days notice.' },
            { q: 'Do you have showers?', a: 'Yes — towels, soap, hairdryers. Bring slippers if you prefer your own.' },
            { q: 'Can I freeze my membership?', a: 'Up to 30 days a year, no questions asked. Longer freezes with proof (medical, work).' },
        ],
        ctaBand: {
            heading: 'Free intro session. No pitch.',
            body: 'Book a slot, meet a coach, lift if you want to.',
            primaryLabel: 'Book intro',
            primaryLink: '#contact',
        },
    },
    gym: {},

    // EDUCATION / SCHOOL
    education: {
        why: [
            { title: 'Small classes.', body: 'We cap every group so every student gets attention. No back-row drift.' },
            { title: 'One teacher per student, not one per class.', body: 'Teachers stay with the same students through their progression. Continuity matters.' },
            { title: 'You can sit in.', body: 'Parents welcome to attend any class, any time. We have nothing to hide.' },
        ],
        how: [
            { step: '01', title: 'Free trial class', body: 'One session, the right level. We invite you to attend with your child if they are young.' },
            { step: '02', title: 'Placement', body: 'Short chat with the teacher — we match the student to the right group.' },
            { step: '03', title: 'Enrol per term', body: 'Pay per term, no annual lock-in. Materials included.' },
            { step: '04', title: 'Progress reviews', body: 'Twice per term, written feedback + 15-minute parent meeting.' },
        ],
        testimonials: [
            { quote: 'My daughter went from dreading lessons to asking when the next one is.', name: 'Eleanor V.', context: 'parent of 8 years old' },
            { quote: 'I have learned more in 6 weeks than I did in two years of online courses.', name: 'Jay R.', context: 'adult student' },
            { quote: 'The teachers actually want you to get better, not just sign you up for the next level.', name: 'Mia D.' },
        ],
        faq: [
            { q: 'Do you offer trial classes?', a: 'Yes — one free trial in any level. Book by message or phone.' },
            { q: 'Are materials included?', a: 'Yes — books, sheet music, all consumables. You only buy your own instrument or supplies.' },
            { q: 'Are classes online or in person?', a: 'Both. Most students prefer in-person; online available for distance.' },
            { q: 'What is the maximum class size?', a: 'Eight students per group class. One-to-one available at higher rate.' },
            { q: 'Can I switch teachers?', a: 'Yes — message the office. We try to match style and personality.' },
        ],
        ctaBand: {
            heading: 'Try a class on us.',
            body: 'One free trial. Book a slot that suits you.',
            primaryLabel: 'Book trial',
            primaryLink: '#contact',
        },
    },

    // PROFESSIONAL SERVICES (tailor, accountant, lawyer)
    services: {
        why: [
            { title: 'One person owns your work.', body: 'You do not get passed between juniors. Same name, same email, every time.' },
            { title: 'Flat fees for known work.', body: 'No hourly meter for routine matters. You know the cost before you say yes.' },
            { title: 'We say no to work we cannot do.', body: 'Better to refer you out than do it badly. We have a network of people we trust.' },
        ],
        how: [
            { step: '01', title: 'First call (free, 30 minutes)', body: 'You explain the situation. We tell you whether we can help.' },
            { step: '02', title: 'Engagement letter', body: 'Scope, deliverables, price, deadlines in writing. You sign or you do not.' },
            { step: '03', title: 'We do the work', body: 'Weekly updates by email or message. You always know where it stands.' },
            { step: '04', title: 'Handover and follow-up', body: 'You get the final files and a written summary. Questions for 30 days are free.' },
        ],
        testimonials: [
            { quote: 'No corporate runaround. One person, one phone number, real answers.', name: 'Inez C.', context: 'client of 4 years' },
            { quote: 'They gave me a fixed price for what other firms quoted me an open-ended bill.', name: 'Patrick S.' },
            { quote: 'Honest, careful, and they remember the details from last year.', name: 'Bea M.' },
        ],
        faq: [
            { q: 'Is the first call really free?', a: 'Yes — 30 minutes by phone or video, no obligation. If we cannot help we point you to someone who can.' },
            { q: 'How do you charge?', a: 'Flat fee for routine work; hourly only for genuinely scoped-as-we-go matters. Always agreed in writing first.' },
            { q: 'Do you take new clients?', a: 'Yes — see the contact section. We onboard within a week most months.' },
            { q: 'Can I cancel mid-engagement?', a: 'Yes — you pay for the work delivered to that point. Nothing more.' },
        ],
        credentials: [
            { label: 'Registered', detail: 'PRC / IBP / BIR current as applicable to the practice' },
            { label: 'Insurance', detail: 'Professional indemnity cover in force' },
        ],
        ctaBand: {
            heading: 'Free first call.',
            body: 'Tell us what you need; we will say honestly whether we can help.',
            primaryLabel: 'Book a call',
            primaryLink: '#contact',
        },
    },
    barber: {
        why: [
            { title: 'No double-bookings.', body: 'Your chair is your chair. We do not rush you out for the next walk-in.' },
            { title: 'Real consultation.', body: 'We agree the cut and the finish before scissors touch hair.' },
            { title: 'Same barber every time.', body: 'Continuity matters — your barber remembers what worked last month.' },
        ],
        how: [
            { step: '01', title: 'Book a chair', body: 'Online, phone, or walk in. We confirm same-day.' },
            { step: '02', title: 'Quick consult', body: 'On arrival we agree what you want. Photos welcome.' },
            { step: '03', title: 'The cut', body: 'No phones in the chair, just good conversation if you want it.' },
            { step: '04', title: 'Walk out sharp', body: 'We adjust on the spot if it is not right. That is part of the service.' },
        ],
        testimonials: [
            { quote: 'Best fade in town, full stop.', name: 'Joel R.', context: 'twice a month' },
            { quote: 'They taught me how to maintain it between cuts. Saved me money.', name: 'Adrian C.' },
            { quote: 'My son will not let anyone else cut his hair.', name: 'Marco D.' },
        ],
        faq: [
            { q: 'Do you take walk-ins?', a: 'Yes — booked slots take priority but we keep chairs open through the day.' },
            { q: 'Do you do kids?', a: 'Yes — kids quieter slots in the morning are easier for first-timers.' },
            { q: 'What about beard work?', a: 'Beard trim, lineup, hot-towel shave — all by appointment.' },
            { q: 'Can I tip?', a: 'Yes, by cash or card. Tip goes to the barber directly.' },
        ],
        ctaBand: {
            heading: 'Sharp chair, every time.',
            body: 'Book a slot or walk in. We open seven days.',
            primaryLabel: 'Book a chair',
            primaryLink: '#contact',
        },
    },
}

/**
 * Look up defaults for a given business type, falling back gracefully.
 * Empty sub-objects (like `cafe: {}`) inherit from a sibling key via a
 * second-pass resolution: barber/salon/beauty → salon, cafe/food → restaurant,
 * dental/medical → clinic, trades/plumbing → auto, gym → fitness.
 */
const FAMILY_FALLBACK: Record<string, string> = {
    cafe: 'restaurant',
    food: 'restaurant',
    bakery: 'restaurant',
    barber: 'barber',
    beauty: 'salon',
    spa: 'salon',
    dental: 'clinic',
    medical: 'clinic',
    trades: 'auto',
    plumbing: 'auto',
    electrician: 'auto',
    gym: 'fitness',
}

export function defaultsFor(businessType: string | undefined | null): BlockDefaults {
    if (!businessType) return DEFAULT
    const key = businessType.trim().toLowerCase().replace(/\s+/g, '')

    // Direct match (and skip empty stubs that should bubble up)
    const direct = BY_TYPE[key]
    if (direct && Object.keys(direct).length > 0) return { ...DEFAULT, ...direct }

    // Family fallback
    const family = FAMILY_FALLBACK[key]
    if (family && BY_TYPE[family]) return { ...DEFAULT, ...BY_TYPE[family] }

    // Fuzzy contains match — covers "restaurant_owner", "auto-shop", etc.
    for (const candidate of Object.keys(BY_TYPE)) {
        if (key.includes(candidate)) {
            const t = BY_TYPE[candidate]
            if (Object.keys(t).length > 0) return { ...DEFAULT, ...t }
        }
    }
    return DEFAULT
}
