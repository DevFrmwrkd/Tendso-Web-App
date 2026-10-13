/**
 * The OTR × Tendso giveaway's emails, in the campaign look of
 * /100-pages-giveaway: OTR black, Tendso gold, a red accent.
 *
 * Email clients drop tilts, diagonal cuts and web fonts, so each festive header
 * is ONE hosted image (public/email/giveaway-*.png, drawn by
 * scripts/generate-giveaway-email-headers.mjs) with its words in the alt text,
 * and everything else is tables, solid colours, borders and Arial. The offset
 * "sticker" shadow is a thicker right and bottom border, which survives
 * everywhere a box-shadow does not.
 *
 * Every runtime string is escaped before interpolation (see ./escape).
 */
import { getPaymentConfig } from '../payment/config'
import { SITE_URL } from '../seo'
import { escapeHtml } from './escape'

const INK = '#0D0D0D'
const GOLD = '#FFC531'
const RED = '#E23A1F'
const PAPER = '#F3EFE6'
const BODY = '#2B2721'
const MUTED = '#4A463F'
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif"
const DISPLAY = "'Arial Black','Arial Bold',Arial,sans-serif"

const GIVER_LINE = 'A gift from Off the Record. Websites built by Tendso.'

function replyAddress(platformEmail?: string): string {
    return escapeHtml(platformEmail || getPaymentConfig().wiseEmail || 'frmwrkd.media@gmail.com')
}

/** The festive header: one image, its words repeated in the alt text. */
function headerImage(file: string, alt: string): string {
    return `<tr><td style="background:${INK};padding:0;line-height:0;font-size:0;">`
        + `<img src="${SITE_URL}/email/${file}" width="600" alt="${escapeHtml(alt)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;color:${GOLD};font-family:${DISPLAY};font-size:24px;line-height:1.3;background:${INK};">`
        + `</td></tr>`
}

/** A quieter text header, for news that is not a celebration. */
function textHeader(title: string): string {
    return `<tr><td style="background:${INK};border-bottom:6px solid ${GOLD};padding:24px 36px 26px;">`
        + `<p style="margin:0 0 14px;font-family:${DISPLAY};font-size:12px;font-weight:900;letter-spacing:1px;color:#FFFFFF;">OFF THE RECORD <span style="color:${GOLD};">&times;</span> TENDSO</p>`
        + `<h1 style="margin:0;font-family:${DISPLAY};font-size:26px;font-weight:900;line-height:1.2;color:#FFFFFF;">${title}</h1>`
        + `</td></tr>`
}

function row(html: string, padding = '0 36px 22px'): string {
    return `<tr><td style="padding:${padding};font-family:${SANS};font-size:16px;line-height:1.6;color:${BODY};">${html}</td></tr>`
}

function hello(name: string, greeting = 'Hi'): string {
    return `<p style="margin:0 0 12px;font-size:18px;color:${INK};">${greeting} <strong>${name}</strong>,</p>`
}

/** The gold card with the hard offset edge. */
function goldCard(inner: string, align: 'left' | 'center' = 'left'): string {
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;background:${GOLD};border:3px solid ${INK};border-right-width:8px;border-bottom-width:8px;border-radius:14px;">`
        + `<tr><td style="padding:18px 20px;text-align:${align};font-family:${SANS};color:${INK};">${inner}</td></tr></table>`
}

function paperNote(inner: string): string {
    return `<p style="margin:0;padding:14px 16px;background:${PAPER};border:2px solid ${INK};border-radius:12px;font-size:15px;line-height:1.6;color:${INK};">${inner}</p>`
}

function smallCaps(text: string, color = '#3A2E10'): string {
    return `<p style="margin:0 0 4px;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:1.3px;color:${color};">${text}</p>`
}

function blackLabel(text: string): string {
    return `<span style="display:inline-block;padding:6px 12px;background:${INK};color:${GOLD};font-family:${DISPLAY};font-size:12px;font-weight:900;letter-spacing:0.5px;">${text}</span>`
}

/** Numbered steps with red badges. */
function steps(items: string[]): string {
    return items.map((item, index) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:12px;"><tr>`
        + `<td valign="top" width="40"><div style="width:28px;height:28px;background:${RED};border:2px solid ${INK};border-radius:50%;text-align:center;line-height:28px;color:#FFFFFF;font-family:${DISPLAY};font-size:13px;font-weight:900;">${index + 1}</div></td>`
        + `<td style="font-family:${SANS};font-size:15px;line-height:1.6;color:${BODY};">${item}</td>`
        + `</tr></table>`).join('')
}

function button(href: string, label: string): string {
    return `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>`
        + `<td style="background:${INK};border-radius:999px;"><a href="${href}" target="_blank" style="display:inline-block;padding:15px 28px;font-family:${DISPLAY};font-size:14px;font-weight:900;letter-spacing:0.3px;color:${GOLD};text-decoration:none;">${label} &rarr;</a></td>`
        + `</tr></table>`
}

function check(text: string): string {
    return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:8px;"><tr>`
        + `<td valign="middle" width="32"><div style="width:22px;height:22px;background:#FFFFFF;border:2px solid ${INK};border-radius:50%;text-align:center;line-height:22px;font-size:12px;font-weight:900;color:${INK};">&#10003;</div></td>`
        + `<td style="font-family:${SANS};font-size:15px;color:${INK};">${text}</td>`
        + `</tr></table>`
}

function footer(replyEmail: string, lead: string): string {
    return `<tr><td style="background:${INK};border-top:6px solid ${GOLD};padding:22px 36px;text-align:center;font-family:${SANS};">`
        + `<p style="margin:0 0 8px;font-family:${DISPLAY};font-size:13px;font-weight:900;letter-spacing:1px;color:#FFFFFF;">OFF THE RECORD <span style="color:${GOLD};">&times;</span> TENDSO</p>`
        + `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.5px;color:${GOLD};">${GIVER_LINE}</p>`
        + `<p style="margin:0 0 6px;font-size:13px;color:#CFC8BA;">${lead} <a href="mailto:${replyEmail}" style="color:#FFFFFF;">${replyEmail}</a></p>`
        + `<p style="margin:0;font-size:12px;color:#8A847B;">&copy; ${new Date().getFullYear()} Tendso</p>`
        + `</td></tr>`
}

/** The shared frame: grey ground, one bordered 600px card, an inbox preview line. */
function shell(title: string, preheader: string, rows: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#E9E6DF;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#E9E6DF;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;border-collapse:separate;background:#FFFFFF;border:3px solid ${INK};border-radius:14px;overflow:hidden;">
${rows}
</table>
</td></tr>
</table>
</body>
</html>`
}

/** The receipt, sent within a minute of /start. Promises review, not a website. */
export function getGiveawayReceivedEmailHtml(params: {
    businessName: string
    businessOwnerName: string
    platformEmail?: string
}): string {
    const businessName = escapeHtml(params.businessName)
    const ownerName = escapeHtml(params.businessOwnerName)
    const replyEmail = replyAddress(params.platformEmail)
    return shell(
        `Off the Record received your application — ${businessName}`,
        `Your slot is held while Off the Record reviews your poster photo.`,
        headerImage('giveaway-received.png', 'Salamat! Off the Record received your application.')
        + row(`${hello(ownerName)}<p style="margin:0;">Thank you — Off the Record received your application for a free Tendso website for <strong style="color:${INK};">${businessName}</strong>. Your slot is held while Off the Record reviews your eligibility and poster photo.</p>`, '30px 36px 22px')
        + row(goldCard(
            `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>`
            + `<td style="font-family:${SANS};color:${INK};">${smallCaps('OFF THE RECORD GIVEAWAY')}`
            + `<p style="margin:0 0 4px;font-family:${DISPLAY};font-size:24px;font-weight:900;line-height:1.1;">Awaiting review</p>`
            + `<p style="margin:0;font-size:13px;line-height:1.5;color:${BODY};">You'll get an email the moment Off the Record decides.</p></td>`
            + `<td width="78" align="right" valign="middle"><div style="display:inline-block;padding:6px 9px;background:#FFFFFF;border:3px solid ${RED};border-radius:8px;color:${RED};font-family:${DISPLAY};font-size:12px;font-weight:900;line-height:1.2;text-align:center;">SLOT<br>HELD</div></td>`
            + `</tr></table>`,
        ))
        + row(blackLabel('WHAT HAPPENS NEXT'), '0 36px 14px')
        + row(steps([
            `Off the Record checks your business details and the photo of its poster hanging where your customers can see it. <strong style="color:${INK};">Nothing else is needed from you right now.</strong>`,
            `If your application qualifies, Off the Record approves it and Tendso builds your free website. You get an email at each step. If it cannot be accepted, you receive an email explaining why.`,
            `Your free website comes with a <strong style="color:${INK};">Tendso web address</strong>. Custom domains are not included.`,
        ]), '0 36px 10px')
        + row(paperNote(`<strong>If eligible, your website is free — nothing to pay.</strong> Your application is awaiting eligibility review.`))
        + row(`<p style="margin:0;font-size:14px;line-height:1.7;color:${MUTED};">Spotted a mistake in your business name, address or phone number? Just reply to this email and we'll fix it before your website is built.</p>`, '0 36px 30px')
        + footer(replyEmail, 'Questions? Reply to this email or write to'),
    )
}

/** OTR approved the poster photo: good news first, then the wait for the build. */
export function getGiveawayApprovedEmailHtml(params: {
    businessName: string
    businessOwnerName: string
    platformEmail?: string
}): string {
    const businessName = escapeHtml(params.businessName)
    const ownerName = escapeHtml(params.businessOwnerName)
    const replyEmail = replyAddress(params.platformEmail)
    const stage = (mark: string, label: string, note: string, done: boolean) => `<td width="30%" align="center" valign="top" style="font-family:${SANS};color:${INK};">`
        + `<div style="width:34px;height:34px;margin:0 auto 6px;border-radius:50%;text-align:center;line-height:${done ? 34 : 28}px;font-family:${DISPLAY};font-size:15px;font-weight:900;${done ? `background:${INK};color:${GOLD};` : `background:#FFFFFF;color:${INK};border:3px dashed ${INK};`}">${mark}</div>`
        + `<p style="margin:0;font-size:13px;font-weight:700;">${label}</p>`
        + (note ? `<p style="margin:2px 0 0;font-size:12px;color:#3A2E10;">${note}</p>` : '')
        + `</td>`
    const link = (dashed: boolean) => `<td width="5%" valign="top" style="padding-top:16px;"><div style="height:0;border-top:3px ${dashed ? 'dashed' : 'solid'} ${INK};"></div></td>`
    return shell(
        `Approved by Off the Record — ${businessName}`,
        `Good news: Off the Record approved your application. Tendso is building your free website now.`,
        headerImage('giveaway-approved.png', 'Approved by Off the Record!')
        + row(`${hello(ownerName, 'Good news,')}<p style="margin:0;">Off the Record checked your poster photo and approved <strong style="color:${INK};">${businessName}</strong> for a free website. <strong style="color:${INK};">Tendso is building it now</strong>, from the answers and photos you sent.</p>`, '30px 36px 22px')
        + row(goldCard(
            smallCaps('WHERE YOUR WEBSITE IS')
            + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:12px;"><tr>`
            + stage('&#10003;', 'Applied', '', true) + link(false)
            + stage('&#10003;', 'Approved by OTR', '', true) + link(true)
            + stage('3', 'Website live', 'Building now', false)
            + `</tr></table>`,
        ))
        + row(blackLabel('WHAT HAPPENS NEXT'), '0 36px 14px')
        + row(steps([
            `Tendso builds your website from your answers and photos. <strong style="color:${INK};">Nothing is needed from you.</strong>`,
            `We email you the link the moment it's live, with a free Tendso web address.`,
        ]), '0 36px 10px')
        + row(paperNote(`<strong>Still free — nothing to pay.</strong> Keep the Off the Record poster up in your shop, and keep an eye on this inbox (check spam too).`))
        + row(`<p style="margin:0;font-size:14px;line-height:1.7;color:${MUTED};">Want to change something before we build? Reply to this email with the new name, address, phone number or photo and we'll use it.</p>`, '0 36px 30px')
        + footer(replyEmail, 'Questions? Reply to this email or write to'),
    )
}

/** OTR could not accept the application: the reviewer's reason, and the way back in. */
export function getGiveawayRejectedEmailHtml(params: {
    businessName: string
    businessOwnerName: string
    reason: string
    applyUrl: string
    platformEmail?: string
}): string {
    const businessName = escapeHtml(params.businessName)
    const ownerName = escapeHtml(params.businessOwnerName)
    const reason = escapeHtml(params.reason)
    const applyUrl = escapeHtml(params.applyUrl)
    const replyEmail = replyAddress(params.platformEmail)
    return shell(
        `Your Off the Record application — ${businessName}`,
        `An update on your free website application from Off the Record.`,
        textHeader('An update on your free website application')
        + row(`${hello(ownerName)}<p style="margin:0;">Thank you for applying for a free Tendso website for <strong style="color:${INK};">${businessName}</strong> through Off the Record’s giveaway. Off the Record reviewed your application and couldn't accept it for this reason:</p>`, '30px 36px 18px')
        + row(`<div style="padding:16px 18px;background:${PAPER};border:2px solid ${INK};border-radius:12px;">${smallCaps('OFF THE RECORD’S REASON', MUTED)}<div style="font-size:16px;line-height:1.6;color:${INK};white-space:pre-wrap;overflow-wrap:anywhere;">${reason}</div></div>`, '0 36px 18px')
        + row(`<p style="margin:0;">Your held slot has been released. You can fix the issue above and apply again while slots remain. A new application holds a new slot; your earlier application no longer holds one.</p>`)
        + row(goldCard(
            `<p style="margin:0 0 4px;font-family:${DISPLAY};font-size:13px;font-weight:900;letter-spacing:0.5px;">A PHOTO THAT GETS APPROVED</p>`
            + check('The OTR poster is clearly visible')
            + check('Your sign or storefront is in the shot'),
        ))
        + row(button(applyUrl, 'CHECK SLOTS AND APPLY AGAIN'))
        + row(`<p style="margin:0;font-size:15px;line-height:1.7;color:${MUTED};">If anything is unclear, reply to this email and we'll help.</p>`, '0 36px 30px')
        + footer(replyEmail, 'Questions? Reply or write to'),
    )
}

/** The site is live: the link first, then the promise that it costs nothing. */
export function getGiveawayLiveEmailHtml(params: {
    businessName: string
    businessOwnerName: string
    websiteUrl: string
    platformEmail?: string
}): string {
    const businessName = escapeHtml(params.businessName)
    const ownerName = escapeHtml(params.businessOwnerName)
    const websiteUrl = escapeHtml(params.websiteUrl)
    const replyEmail = replyAddress(params.platformEmail)
    return shell(
        `Your Website is Live — ${businessName}`,
        `Off the Record's gift is live: your free Tendso website is on the web now.`,
        headerImage('giveaway-live.png', "It's live! A gift from Off the Record. You pay ₱0.")
        + `<tr><td style="background:${INK};padding:0 36px 16px;text-align:center;font-family:${SANS};font-size:14px;font-weight:700;color:${GOLD};">A gift from Off the Record for ${businessName}. Built by Tendso.</td></tr>`
        + row(`${hello(ownerName)}<p style="margin:0;"><strong style="color:${INK};">Off the Record</strong> is giving <strong style="color:${INK};">${businessName}</strong> a free Tendso website &mdash; and it is built, published, and live on the web right now. <strong style="color:${INK};">There is nothing for you to pay.</strong></p>`, '30px 36px 22px')
        + row(goldCard(
            smallCaps('YOUR LIVE WEBSITE')
            + `<p style="margin:0 0 14px;font-size:16px;font-weight:700;color:${INK};overflow-wrap:anywhere;">${websiteUrl}</p>`
            + `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"><tr><td style="background:${INK};border-radius:999px;"><a href="${websiteUrl}" target="_blank" style="display:inline-block;padding:15px 28px;font-family:${DISPLAY};font-size:14px;font-weight:900;letter-spacing:0.3px;color:${GOLD};text-decoration:none;">VISIT YOUR WEBSITE &rarr;</a></td></tr></table>`,
            'center',
        ))
        + row(`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;background:${PAPER};border:2px solid ${INK};border-radius:12px;"><tr>`
            + `<td width="96" valign="top" style="padding:16px 0 16px 18px;font-family:${SANS};">${smallCaps('WHAT IT COSTS', MUTED)}<p style="margin:0;font-family:${DISPLAY};font-size:32px;font-weight:900;line-height:1;color:${RED};">&#8369;0</p></td>`
            + `<td valign="top" style="padding:16px 18px;font-family:${SANS};font-size:14px;line-height:1.6;color:${BODY};">No invoice, no payment link, and no card on file. If anyone contacts you asking for payment for this website, it did not come from us &mdash; reply to this email and we will confirm.</td>`
            + `</tr></table>`)
        + row(`<p style="margin:0;">Your business is now online for everyone to find. <strong style="color:${INK};">Free edits for your first year</strong> &mdash; new hours, new photos, a new price. Tell us what you want changed and we'll make it for you.</p>`)
        + row(`<p style="margin:0;padding:12px 16px;background:${INK};border-radius:12px;font-size:14px;line-height:1.5;color:#FFFFFF;text-align:center;">You're one of the businesses in <strong style="color:${GOLD};">Off the Record's 100 free websites</strong> giveaway.</p>`, '0 36px 30px')
        + footer(replyEmail, "Questions? We're here to help:"),
    )
}
