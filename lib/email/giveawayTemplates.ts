/**
 * Off the Record's giveaway, in the shared Tendso email design.
 * The campaign remains the gift giver; Tendso builds the websites. All runtime
 * content is escaped before entering the frame's trusted HTML slots.
 */
import { getPaymentConfig } from '../payment/config'
import { escapeHtml } from './escape'
import { EMAIL_COLORS, emailFeature, emailFrame, emailPanel, emailParagraph, emailSteps, emailTextLink, type EmailFrameOptions } from './design'

const GIVER_LINE = 'A gift from Off the Record. Websites built by Tendso.'

/** The frame escapes the support address itself; keep it plain until then. */
function replyAddress(platformEmail?: string): string {
    return platformEmail || getPaymentConfig().wiseEmail || 'frmwrkd.media@gmail.com'
}

function campaignFrame(title: string, preheader: string, heading: string, bodyHtml: string, supportEmail: string, options: Pick<EmailFrameOptions, 'variant' | 'status' | 'introHtml' | 'heroHtml' | 'heroActions' | 'friendly' | 'recipientName'> = {}): string {
    return emailFrame({
        title, preheader, heading, bodyHtml, supportEmail,
        variant: options.variant,
        status: options.status,
        introHtml: options.introHtml,
        heroHtml: options.heroHtml,
        heroActions: options.heroActions,
        friendly: options.friendly,
        recipientName: options.recipientName,
        eyebrow: 'Off the Record × Tendso',
        footerHtml: `<p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:${EMAIL_COLORS.muted};">Off the Record × Tendso</p>`
            + `<p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:${EMAIL_COLORS.ink};"><strong>${GIVER_LINE}</strong></p>`,
    })
}

function hello(name: string, greeting = 'Hi'): string {
    return emailParagraph(`${greeting} <strong>${name}</strong>,`)
}

function sectionLabel(text: string): string {
    return `<p style="margin:26px 0 14px;font-size:12px;font-weight:700;line-height:1.4;letter-spacing:1px;text-transform:uppercase;color:${EMAIL_COLORS.muted};">${escapeHtml(text)}</p>`
}

/** The numbered instructions remain real text with email-safe table alignment. */
function steps(items: string[]): string {
    return items.map((item, index) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:16px;"><tr>`
        + `<td valign="top" width="40"><span style="display:inline-block;width:26px;height:26px;border-radius:50%;background:${EMAIL_COLORS.accent};color:${EMAIL_COLORS.ink};text-align:center;font-size:12px;font-weight:700;line-height:26px;">${index + 1}</span></td>`
        + `<td style="font-size:15px;line-height:1.65;color:${EMAIL_COLORS.body};">${item}</td>`
        + `</tr></table>`).join('')
}

function check(text: string): string {
    return `<p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:${EMAIL_COLORS.ink};"><span style="display:inline-block;width:22px;height:22px;margin-right:8px;border-radius:50%;background:${EMAIL_COLORS.accent};text-align:center;line-height:22px;font-size:12px;font-weight:700;">&#10003;</span>${text}</p>`
}

/** The receipt promises eligibility review, never an approved website. */
export function getGiveawayReceivedEmailHtml(params: {
    businessName: string
    businessOwnerName: string
    platformEmail?: string
}): string {
    const businessName = escapeHtml(params.businessName)
    return campaignFrame(
        `Off the Record received your application — ${params.businessName}`,
        'Your slot is held while Off the Record reviews your poster photo.',
        'Off the Record received your application.',
        emailSteps([{ label: 'Applied', state: 'done' }, { label: 'Eligibility review', state: 'current' }, { label: 'Website', state: 'upcoming' }])
        + sectionLabel('What happens next')
        + steps([
            'Off the Record checks your business details and the photo of its poster hanging where your customers can see it. <strong>Nothing else is needed from you right now.</strong>',
            'If your application qualifies, Off the Record approves it and Tendso builds your free website. You get an email at each step. If it cannot be accepted, you receive an email explaining why.',
            'Your free website comes with a <strong>Tendso web address</strong>. Custom domains are not included.',
        ])
        + emailParagraph('<strong>If eligible, your website is free — nothing to pay.</strong> Your application is awaiting eligibility review.')
        + emailParagraph(`Spotted a mistake in your business name, address or phone number? Just reply to this email and we'll fix it before your website is built.`),
        replyAddress(params.platformEmail),
        {
            status: 'Awaiting review', recipientName: params.businessOwnerName,
            introHtml: emailParagraph(`Thank you — Off the Record received your application for a free Tendso website for <strong>${businessName}</strong>. Your slot is held while Off the Record reviews your eligibility and poster photo.`),
            heroHtml: emailFeature({ label: 'Eligibility review', value: 'Your slot is held.', size: 'medium', tone: 'white', detailHtml: `You'll get an email the moment Off the Record decides.` }),
        },
    )
}

/** OTR approved the poster photo; the website build can now begin. */
export function getGiveawayApprovedEmailHtml(params: {
    businessName: string
    businessOwnerName: string
    platformEmail?: string
}): string {
    const businessName = escapeHtml(params.businessName)
    const ownerName = escapeHtml(params.businessOwnerName)
    return campaignFrame(
        `Approved by Off the Record — ${params.businessName}`,
        'Good news: Off the Record approved your application. Tendso is building your free website now.',
        'Approved by Off the Record.',
        hello(ownerName, 'Good news,')
        + emailSteps([{ label: 'Applied', state: 'done' }, { label: 'Approved by OTR', state: 'done' }, { label: 'Building', state: 'current' }, { label: 'Website live', state: 'upcoming' }])
        + sectionLabel('What happens next')
        + steps([
            'Tendso builds your website from your answers and photos. <strong>Nothing is needed from you.</strong>',
            `We email you the link the moment it's live, with a free Tendso web address.`,
        ])
        + emailParagraph('<strong>Still free — nothing to pay.</strong> Keep the Off the Record poster up in your shop, and keep an eye on this inbox (check spam too).')
        + emailParagraph(`Want to change something before we build? Reply to this email with the new name, address, phone number or photo and we'll use it.`),
        replyAddress(params.platformEmail),
        {
            variant: 'success', status: 'Approved by OTR', recipientName: params.businessOwnerName,
            introHtml: emailParagraph(`Off the Record checked your poster photo and approved <strong>${businessName}</strong> for a free website. <strong>Tendso is building it now</strong>, from the answers and photos you sent.`),
            heroHtml: emailFeature({ label: 'Your website', value: 'Building now', size: 'medium', detailHtml: 'Your answers and photos are in. Nothing is needed from you.', tone: 'white' }),
        },
    )
}

/** Preserve the reviewer's reason and the conditional route back into review. */
export function getGiveawayRejectedEmailHtml(params: {
    businessName: string
    businessOwnerName: string
    reason: string
    applyUrl: string
    platformEmail?: string
}): string {
    const businessName = escapeHtml(params.businessName)
    const reason = escapeHtml(params.reason)
    return campaignFrame(
        `Your Off the Record application — ${params.businessName}`,
        'An update on your free website application from Off the Record.',
        'An update on your free website application',
        emailParagraph('Your held slot has been released. You can fix the issue above and apply again while slots remain. A new application holds a new slot; your earlier application no longer holds one.')
        + sectionLabel('A photo that gets approved')
        + check('The OTR poster is clearly visible')
        + check('Your sign or storefront is in the shot')
        + emailParagraph(`If anything is unclear, reply to this email and we'll help.`),
        replyAddress(params.platformEmail),
        {
            variant: 'attention', status: 'Changes needed', recipientName: params.businessOwnerName,
            introHtml: emailParagraph(`Thank you for applying for a free Tendso website for <strong>${businessName}</strong> through Off the Record’s giveaway. Off the Record reviewed your application and couldn't accept it for this reason:`),
            heroHtml: emailPanel(`<p style="margin:0 0 10px;font-size:13px;font-weight:500;line-height:1.5;color:${EMAIL_COLORS.muted};">Off the Record’s reason</p>`
                + `<div style="font-size:16px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;color:${EMAIL_COLORS.ink};">${reason}</div>`, 'warning'),
            heroActions: [{ href: params.applyUrl, label: 'Check slots and apply again', primary: true }],
        },
    )
}

/** OTR's gift is live, with no invoice or payment action. */
export function getGiveawayLiveEmailHtml(params: {
    businessName: string
    businessOwnerName: string
    websiteUrl: string
    platformEmail?: string
}): string {
    const businessName = escapeHtml(params.businessName)
    return campaignFrame(
        `Your Website is Live — ${params.businessName}`,
        `Off the Record's gift is live: your free Tendso website is on the web now.`,
        'Your website is live.',
        emailParagraph(`<strong>Off the Record</strong> is giving <strong>${businessName}</strong> a free Tendso website &mdash; and it is built, published, and live on the web right now. <strong>There is nothing for you to pay.</strong>`)
        + emailParagraph('If anyone contacts you asking for payment for this website, it did not come from us &mdash; reply to this email and we will confirm.')
        + emailParagraph(`Your business is now online for everyone to find. <strong>Free edits for your first year</strong> &mdash; new hours, new photos, a new price. Tell us what you want changed and we'll make it for you.`)
        + emailParagraph(`You're one of the businesses in <strong>Off the Record's 100 free websites</strong> giveaway.`),
        replyAddress(params.platformEmail),
        {
            variant: 'success', status: 'Live · Free', recipientName: params.businessOwnerName, friendly: true,
            introHtml: emailParagraph(`<strong>A gift from Off the Record for ${businessName}. Built by Tendso.</strong>`),
            heroHtml: emailFeature({ label: 'What it costs', value: '₱0', tone: 'white', detailHtml: 'No invoice, no payment link, and no card on file.' })
                + `<p style="margin:20px 0 0;font-size:21px;line-height:1.5;font-weight:500;overflow-wrap:anywhere;">${emailTextLink(params.websiteUrl)}</p>`,
            heroActions: [{ href: params.websiteUrl, label: 'Visit your website', primary: true }],
        },
    )
}
