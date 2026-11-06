/** Design proposals only. Fictional fixtures, no transport, configuration, or account reads. */
import { escapeHtml } from './escape'

export type ProposalDirectionId = 'studio' | 'bold' | 'letter'
export type ProposalMessageId = 'preview' | 'booking' | 'payout' | 'payment'

export interface ProposalDirection {
    id: ProposalDirectionId
    name: string
    kicker: string
    description: string
    bestFor: string
}
export interface ProposalMessage { id: ProposalMessageId; label: string; subject: string }

export const directions: ProposalDirection[] = [
    { id: 'studio', name: 'Tendso', kicker: 'The website, in your inbox.', description: 'The official mark, expressive sentence-case type, soft rounded stages, clear message tiles, and the familiar lime pill.', bestFor: 'A recognisable Tendso experience from the website to every inbox.' },
    { id: 'bold', name: 'Bold', kicker: 'Confident and expressive.', description: 'A lime opening, large type, dark summary panels, and a prominent next action.', bestFor: 'Website launches, approvals, and payout milestones.' },
    { id: 'letter', name: 'Personal', kicker: 'Human and straightforward.', description: 'A simple white letter with the official mark, quiet links, and a personal sign-off from the Tendso team.', bestFor: 'Invitations, corrections, and support updates.' },
]

export const messages: ProposalMessage[] = [
    { id: 'preview', label: 'Private website preview', subject: 'Luna Corner Store: your website is ready to check' },
    { id: 'booking', label: 'Call booked', subject: 'Your Tendso call is booked · Thursday, November 12' },
    { id: 'payout', label: 'Payout completed', subject: 'Your ₱3,750 payout is complete' },
    { id: 'payment', label: 'Payment request', subject: 'Luna Corner Store · your payment details' },
]

// Both names are exported so comparison boards can use explicit or concise imports.
export const proposalDirections = directions
export const proposalMessages = messages

export const TENDSO_EMAIL_LOGO = '/v2/brand/mark-ink-256.png'
export const TENDSO_EMAIL_BUDDY = '/v2/brand/buddy-email.png'
const BRAND_ORIGIN = 'https://tendso.com'
const SANS = "'Onest','Helvetica Neue',Helvetica,Arial,sans-serif"
const INK = '#0C0A08'
const LIME = '#E4F222'
const STAGE = '#F2F3F1'
const QUIET = '#F7F7F5'
const MUTED = '#4A4943'
const LINE = '#ECECE8'
const SHOP = 'Luna Corner Store'
const OWNER = 'Alex Rivera'
const PRICE = '₱3,499'
const PAYOUT = '₱3,750'
const DAY = 'Thursday, November 12'
const TIME = '10:30 AM'
const ZONE = 'Philippine time (Asia/Manila)'
const E = escapeHtml

interface Action { label: string; href: string }
interface Fact { label: string; value: string }
interface ProposalContent {
    subject: string
    kind: string
    status: string
    studioTitle: string[]
    boldTitle: string[]
    letterTitle: string
    intro: string
    explanation: string
    note: string
    featureLabel: string
    featureValue: string
    facts: Fact[]
    primary: Action
    secondary: Action[]
}

const content: Record<ProposalMessageId, ProposalContent> = {
    preview: {
        subject: messages[0].subject, kind: 'Your website', status: 'Private preview',
        studioTitle: ['Your site is', 'ready to check.'], boldTitle: ['Your site is', 'ready to check.'], letterTitle: 'Your website is ready to check.',
        intro: `The website for ${SHOP} is ready for your eyes only. Take a look when you have a moment.`,
        explanation: 'Check the photos, business details, and wording. Ask for a change, or choose Looks good when you are happy with it.',
        note: `This is a private preview. Your site goes public after you approve it and pay ${PRICE} once.`,
        featureLabel: 'Built for', featureValue: SHOP,
        facts: [{ label: 'Business', value: SHOP }, { label: 'Visibility', value: 'Only you can see the preview' }, { label: 'One-time website price', value: PRICE }],
        primary: { label: 'See my preview', href: 'https://example.com/preview/luna' },
        secondary: [{ label: 'Ask for a change', href: 'https://example.com/preview/luna/changes' }],
    },
    booking: {
        subject: messages[1].subject, kind: 'Your Tendso call', status: 'Confirmed',
        studioTitle: ['You’re booked.'], boldTitle: ['You’re', 'booked.'], letterTitle: 'We will see you on Thursday.',
        intro: `Your 10-minute call with Tendso is booked for ${DAY} at ${TIME}, Philippine time.`,
        explanation: 'We will meet on Google Meet. There is nothing to prepare — just find a spot with a steady connection.',
        note: 'Need a different time? Reschedule or cancel using the links below. Rescheduling keeps the same Meet link.',
        featureLabel: DAY, featureValue: TIME,
        facts: [{ label: 'Date', value: DAY }, { label: 'Time', value: `${TIME} · ${ZONE}` }, { label: 'Duration and place', value: '10 minutes · Google Meet' }],
        primary: { label: 'Join Google Meet', href: 'https://example.com/meet/luna' },
        secondary: [{ label: 'Add to calendar', href: 'https://example.com/calendar/luna' }, { label: 'Reschedule', href: 'https://example.com/manage/luna?action=reschedule' }, { label: 'Cancel', href: 'https://example.com/manage/luna?action=cancel' }],
    },
    payout: {
        subject: messages[2].subject, kind: 'Your earnings', status: 'Completed',
        studioTitle: ['Your payout', 'is complete.'], boldTitle: ['Your payout', 'is complete.'], letterTitle: 'Your payout is complete.',
        intro: `Your ${PAYOUT} payout is complete. We have sent it to your Wise account at alex@example.com.`,
        explanation: 'You can open your payout history to see the transfer details and keep a copy for your records.',
        note: 'Something does not look right? Reply to this email and the Tendso team will help.',
        featureLabel: 'Payout completed', featureValue: PAYOUT,
        facts: [{ label: 'Amount', value: PAYOUT }, { label: 'Sent to', value: 'Wise · alex@example.com' }, { label: 'Reference', value: 'DEMO-PAYOUT-001' }],
        primary: { label: 'View my payout', href: 'https://example.com/payouts/DEMO-PAYOUT-001' }, secondary: [],
    },
    payment: {
        subject: messages[3].subject, kind: 'Your website order', status: 'Payment due',
        studioTitle: ['Your payment', 'details.'], boldTitle: ['Your payment', 'details.'], letterTitle: 'The last step before we publish.',
        intro: `The website for ${SHOP} is ready. Your one-time payment is ${PRICE}.`,
        explanation: 'Review your website first, then open checkout when you are ready. Your site goes public after approval and payment.',
        note: 'Keep your order reference with your payment confirmation. This fictional checkout is for design review only.',
        featureLabel: 'One-time amount due', featureValue: PRICE,
        facts: [{ label: 'Website', value: SHOP }, { label: 'Amount due', value: PRICE }, { label: 'Order reference', value: 'DEMO-ORDER-001' }],
        primary: { label: 'Open checkout', href: 'https://example.com/checkout/luna' }, secondary: [{ label: 'Review my website', href: 'https://example.com/preview/luna' }],
    },
}

/** These proposals must never acquire a real destination through a later fixture edit. */
function safeHref(value: string): string {
    try {
        const url = new URL(value)
        return url.protocol === 'https:' && url.hostname === 'example.com' && !url.username && !url.password ? url.href : '#'
    } catch { return '#' }
}

function brandLockup(): string {
    return `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="36" valign="middle"><img src="${BRAND_ORIGIN}${TENDSO_EMAIL_LOGO}" width="28" height="28" alt="" style="display:block;width:28px;height:28px;border:0;"></td><td valign="middle" style="font-family:${SANS};font-size:25px;line-height:1.1;font-weight:600;letter-spacing:-1.1px;color:${INK};">tendso</td></tr></table>`
}
function paragraphs(text: string, color = MUTED, size = 17): string {
    return `<p style="margin:0 0 20px;font-family:${SANS};font-size:${size}px;line-height:1.65;color:${color};">${E(text)}</p>`
}
function inlineAction(action: Action, color = INK): string {
    return `<a href="${E(safeHref(action.href))}" target="_blank" rel="noopener noreferrer" style="font-family:${SANS};font-size:14px;line-height:1.7;font-weight:600;color:${color};text-decoration:underline;">${E(action.label)}</a>`
}
function button(action: Action, background: string, color: string, rounded: boolean): string {
    return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;"><tr><td bgcolor="${background}" style="background:${background};border-radius:${rounded ? '999px' : '7px'};"><a href="${E(safeHref(action.href))}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:${rounded ? '17px 27px' : '14px 22px'};font-family:${SANS};font-size:16px;line-height:1.5;font-weight:700;color:${color};text-decoration:none;">${E(action.label)} <span aria-hidden="true">↗</span></a></td></tr></table>`
}
function quietActions(actions: Action[], color = INK): string {
    return actions.length ? `<p style="margin:0 0 22px;font-size:14px;line-height:2;color:${color};">${actions.map(action => inlineAction(action, color)).join(' &nbsp;·&nbsp; ')}</p>` : ''
}

/** Shared only at the document level; each direction below owns its entire visual structure. */
function documentHtml(direction: ProposalDirectionId, title: string, preheader: string, background: string, body: string): string {
    const fonts = [400, 500, 600, 700].map(weight => `@font-face{font-family:'Onest';font-style:normal;font-weight:${weight};src:url('https://tendso.com/fonts/onest-latin-${weight}-normal.woff2') format('woff2');}`).join('')
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${E(title)}</title><style>${fonts}@media only screen and (max-width:600px){.p-outer{padding:12px 4px!important}.p-pad{padding-left:22px!important;padding-right:22px!important}.p-hero-pad{padding:24px 22px!important}.p-studio-title{font-size:36px!important;letter-spacing:-1.8px!important}.p-bold-title{font-size:42px!important;letter-spacing:-2px!important}.p-number{font-size:44px!important}.p-letter-title{font-size:28px!important}.p-wordmark{font-size:72px!important;letter-spacing:-4.5px!important}}</style></head><body data-proposal="${direction}" style="margin:0;padding:0;background:${background};font-family:${SANS};-webkit-text-size-adjust:100%;color:${INK};"><div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${E(preheader)}</div>${body}</body></html>`
}

function studioFacts(facts: Fact[]): string {
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0 26px;">${facts.map(fact => `<tr><td valign="top" width="35%" style="padding:9px 14px 9px 0;font-size:13px;line-height:1.6;color:${MUTED};">${E(fact.label)}</td><td valign="top" style="padding:9px 0;font-size:14px;line-height:1.6;font-weight:500;color:${INK};overflow-wrap:anywhere;word-break:break-word;">${E(fact.value)}</td></tr>`).join('')}</table>`
}

function studio(message: ProposalMessageId, c: ProposalContent): string {
    const friendly = message === 'preview' || message === 'payout'
    const featureDetail = message === 'booking' ? `10 minutes · ${ZONE}` : message === 'preview' ? 'Your private website preview' : message === 'payout' ? 'Wise · alex@example.com' : 'See it first. Pay once to publish.'
    const feature = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 0;"><tr><td bgcolor="#FFFFFF" style="background:#FFFFFF;border-radius:20px;padding:22px 20px;"><p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:${MUTED};">${E(c.featureLabel)}</p><p class="${message === 'preview' ? 'p-shop-name' : 'p-number'}" style="margin:0;font-size:${message === 'preview' ? '29' : '52'}px;line-height:1.1;letter-spacing:-1.7px;font-weight:500;color:${INK};overflow-wrap:anywhere;">${E(c.featureValue)}</p><p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:${MUTED};">${E(featureDetail)}</p></td></tr></table>`
    return documentHtml('studio', c.subject, c.intro, '#FFFFFF', `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td class="p-outer" align="center" style="padding:20px 12px;"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="#FFFFFF" style="width:100%;max-width:600px;background:#FFFFFF;">
<tr><td class="p-pad" style="padding:16px 24px 24px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td>${brandLockup()}</td><td align="right" style="font-size:11px;line-height:1.5;color:${MUTED};">For ${E(OWNER)}</td></tr></table></td></tr>
<tr><td class="p-hero-pad" bgcolor="${STAGE}" style="padding:30px 32px;background:${STAGE};border-radius:40px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td valign="middle"><span style="display:inline-block;padding:7px 12px;border-radius:999px;background:#FFFFFF;font-size:12px;line-height:1.4;font-weight:500;">${E(c.status)}</span></td>${friendly ? `<td align="right" width="70"><img src="${BRAND_ORIGIN}${TENDSO_EMAIL_BUDDY}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;border:0;"></td>` : ''}</tr></table><h1 class="p-studio-title" style="margin:24px 0 20px;font-family:${SANS};font-size:48px;line-height:.99;font-weight:500;letter-spacing:-2.4px;color:${INK};">${c.studioTitle.map(E).join('<br>')}</h1>${paragraphs(c.intro)}${feature}${button(c.primary, LIME, INK, true)}</td></tr>
<tr><td class="p-pad" style="padding:26px 28px 8px;">${quietActions(c.secondary)}${paragraphs('Hi Alex,')}${paragraphs(c.explanation)}${studioFacts(c.facts)}<p style="margin:0 0 24px;padding:16px 18px;background:${QUIET};border-radius:20px;font-size:14px;line-height:1.7;color:${MUTED};">${E(c.note)}</p><p style="margin:0 0 26px;font-size:14px;line-height:1.7;">The Tendso team</p></td></tr>
<tr><td class="p-pad" style="padding:26px 24px 24px;background:${STAGE};border-radius:40px;"><p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:${MUTED};">The thinking ends here.</p><p class="p-wordmark" style="margin:0;font-family:${SANS};font-size:122px;line-height:.95;letter-spacing:-7px;font-weight:500;color:${INK};">tendso</p><p style="margin:20px 0 0;font-size:11px;line-height:1.7;color:${MUTED};">Fictional design sample · No email has been sent.</p></td></tr></table></td></tr></table>`)
}

function boldFacts(facts: Fact[]): string {
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${facts.map((fact, index) => `<tr><td valign="top" width="34" style="padding:14px 12px 14px 0;font-size:11px;line-height:1.6;"><span style="display:inline-block;width:24px;height:24px;border-radius:999px;background:${LIME};color:${INK};text-align:center;line-height:24px;">${index + 1}</span></td><td valign="top" style="padding:14px 0;"><p style="margin:0 0 5px;font-size:12px;line-height:1.5;color:${LINE};">${E(fact.label)}</p><p style="margin:0;font-size:17px;line-height:1.5;font-weight:500;color:#FFFFFF;overflow-wrap:anywhere;word-break:break-word;">${E(fact.value)}</p></td></tr>`).join('')}</table>`
}

function bold(message: ProposalMessageId, c: ProposalContent): string {
    const value = message === 'preview' ? '' : `<div style="margin:26px 0 0;padding-top:20px;"><p style="margin:0 0 8px;font-size:13px;line-height:1.5;">${E(c.featureLabel)}</p><p class="p-number" style="margin:0;font-size:66px;line-height:1;font-weight:500;letter-spacing:-3px;">${E(c.featureValue)}</p></div>`
    return documentHtml('bold', c.subject, c.intro, '#FFFFFF', `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td class="p-outer" align="center" style="padding:26px 12px;"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="#FFFFFF" style="width:100%;max-width:600px;background:#FFFFFF;">
<tr><td class="p-pad" bgcolor="${LIME}" style="padding:28px 34px 34px;background:${LIME};border-radius:40px 40px 0 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td>${brandLockup()}</td><td align="right"><span style="display:inline-block;padding:6px 10px;background:#FFFFFF;border-radius:999px;font-size:11px;font-weight:500;line-height:1.4;">${E(c.status)}</span></td></tr></table><p style="margin:32px 0 14px;font-size:12px;line-height:1.5;">${E(c.kind)} / ${E(OWNER)}</p><h1 class="p-bold-title" style="margin:0;font-family:${SANS};font-size:61px;line-height:.98;font-weight:500;letter-spacing:-3px;color:${INK};">${c.boldTitle.map(E).join('<br>')}</h1>${value}${button(c.primary, INK, '#FFFFFF', true)}</td></tr>
<tr><td class="p-pad" bgcolor="${INK}" style="padding:16px 34px 18px;background:${INK};border-radius:0 0 40px 40px;">${boldFacts(c.facts)}</td></tr>
<tr><td class="p-pad" style="padding:30px 34px 8px;">${paragraphs('Hi Alex,', INK)}${paragraphs(c.intro)}${paragraphs(c.explanation)}${quietActions(c.secondary)}<p style="margin:0 0 26px;padding-left:14px;border-left:3px solid ${LIME};font-size:13px;line-height:1.7;color:${MUTED};">${E(c.note)}</p></td></tr>
<tr><td class="p-pad" style="padding:20px 34px 26px;background:${STAGE};border-radius:20px;"><p style="margin:0;font-size:14px;line-height:1.6;font-weight:500;color:${INK};">The thinking ends here.</p><p style="margin:8px 0 0;font-size:11px;line-height:1.6;color:${MUTED};">Tendso team · Fictional design sample</p></td></tr></table></td></tr></table>`)
}

function personal(message: ProposalMessageId, c: ProposalContent): string {
    const plainFacts = message === 'booking'
        ? `<p style="margin:24px 0;font-size:18px;line-height:1.7;color:${INK};"><strong>${E(DAY)}<br>${E(TIME)} · Philippine time</strong><br><span style="font-size:15px;color:${MUTED};">10 minutes on Google Meet · Asia/Manila</span></p>`
        : `<dl style="margin:24px 0;">${c.facts.map(fact => `<dt style="margin:16px 0 3px;font-size:12px;line-height:1.6;color:${MUTED};">${E(fact.label)}</dt><dd style="margin:0;font-size:16px;line-height:1.65;font-weight:600;color:${INK};overflow-wrap:anywhere;word-break:break-word;">${E(fact.value)}</dd>`).join('')}</dl>`
    return documentHtml('letter', c.subject, c.intro, STAGE, `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td class="p-outer" align="center" style="padding:36px 12px;"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="#FFFFFF" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:40px;">
<tr><td class="p-pad" style="padding:34px 40px 16px;">${brandLockup()}<p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:${MUTED};">A note for ${E(OWNER)}</p></td></tr>
<tr><td class="p-pad" style="padding:18px 40px 36px;"><h1 class="p-letter-title" style="margin:0 0 30px;font-family:${SANS};font-size:31px;line-height:1.2;font-weight:500;letter-spacing:-1px;color:${INK};">${E(c.letterTitle)}</h1>${paragraphs('Hi Alex,', INK, 18)}${paragraphs(c.intro, MUTED, 18)}${plainFacts}${paragraphs(c.explanation, MUTED, 18)}<p style="margin:26px 0 12px;font-size:17px;line-height:1.8;">${inlineAction({ href: c.primary.href, label: `${c.primary.label} →` })}</p>${quietActions(c.secondary)}${paragraphs(c.note, MUTED, 15)}<p style="margin:32px 0 0;font-size:17px;line-height:1.7;color:${INK};">All the best,<br><strong>The Tendso team</strong></p></td></tr>
<tr><td class="p-pad" style="padding:0 40px 26px;"><p style="margin:0;font-size:11px;line-height:1.7;color:${MUTED};">The thinking ends here.<br>Fictional design sample · No email has been sent.</p></td></tr></table></td></tr></table>`)
}

export function renderEmailProposal(direction: ProposalDirectionId, message: ProposalMessageId): string {
    const selected = content[message]
    if (!selected) throw new Error('Unknown email proposal message')
    if (direction === 'studio') return studio(message, selected)
    if (direction === 'bold') return bold(message, selected)
    if (direction === 'letter') return personal(message, selected)
    throw new Error('Unknown email proposal direction')
}
