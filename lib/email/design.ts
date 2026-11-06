/** Email-safe Tendso design primitives. Pure string rendering; never sends mail. */
import { escapeHtml } from './escape'

export const EMAIL_COLORS = {
    ink: '#0C0A08', body: '#4A4943', muted: '#6C6B64', canvas: '#FFFFFF', stage: '#F2F3F1',
    white: '#FFFFFF', line: '#ECECE8', accent: '#E4F222', quiet: '#F7F7F5',
    warning: '#FFF2D8', danger: '#FBE9E5', success: '#EAF3DF',
} as const
const SANS = "'Onest','Helvetica Neue',Helvetica,Arial,sans-serif"
export const EMAIL_BRAND_MARK = 'https://tendso.com/v2/brand/mark-ink-256.png'
export const EMAIL_BRAND_BUDDY = 'https://tendso.com/v2/brand/buddy-email.png'

export function emailParagraph(html: string): string {
    return `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:${EMAIL_COLORS.body};">${html}</p>`
}

function safeHref(value: string): string {
    const trimmed = value.trim()
    try {
        const url = new URL(trimmed, 'https://tendso.com')
        return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? trimmed : '#'
    } catch {
        return '#'
    }
}

export function emailTextLink(href: string, label = href): string {
    return `<a href="${escapeHtml(safeHref(href))}" style="color:${EMAIL_COLORS.ink};text-decoration:underline;overflow-wrap:anywhere;">${escapeHtml(label)}</a>`
}

export function emailButton(href: string, label: string, variant: 'primary' | 'secondary' = 'primary'): string {
    const background = variant === 'primary' ? EMAIL_COLORS.accent : EMAIL_COLORS.white
    return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;max-width:100%;"><tr><td align="center" bgcolor="${background}" style="background:${background};border:1px solid ${variant === 'primary' ? EMAIL_COLORS.accent : EMAIL_COLORS.line};border-radius:999px;"><a href="${escapeHtml(safeHref(href))}" target="_blank" style="display:inline-block;padding:16px 26px;font-family:${SANS};font-size:16px;line-height:1.4;font-weight:500;color:${EMAIL_COLORS.ink};text-decoration:none;text-align:center;">${escapeHtml(label)}</a></td></tr></table>`
}

export function emailPanel(html: string, tone: 'quiet' | 'accent' | 'warning' | 'danger' | 'success' = 'quiet'): string {
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;border-collapse:separate;"><tr><td bgcolor="${EMAIL_COLORS[tone]}" style="background:${EMAIL_COLORS[tone]};border-radius:16px;padding:20px;overflow-wrap:anywhere;word-break:break-word;">${html}</td></tr></table>`
}

export function emailFeature(input: { label: string; value: string; detailHtml?: string; tone?: 'ink' | 'accent' | 'quiet' | 'white'; size?: 'large' | 'medium' }): string {
    const dark = input.tone === 'ink'
    const fill = dark ? EMAIL_COLORS.ink : input.tone === 'accent' ? EMAIL_COLORS.accent : input.tone === 'white' ? EMAIL_COLORS.white : EMAIL_COLORS.quiet
    const ink = dark ? EMAIL_COLORS.white : EMAIL_COLORS.ink
    const muted = dark ? '#D0D4C8' : EMAIL_COLORS.muted
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;border-collapse:separate;"><tr><td bgcolor="${fill}" style="background:${fill};padding:22px 20px;border-radius:20px;color:${ink};"><p style="margin:0 0 10px;font-size:13px;line-height:1.6;font-weight:400;color:${muted};">${escapeHtml(input.label)}</p><p class="${input.size === 'medium' ? 't-email-feature-text' : 't-email-feature'}" style="margin:0;font-size:${input.size === 'medium' ? '28' : '52'}px;line-height:1.1;font-weight:500;letter-spacing:${input.size === 'medium' ? '-1' : '-2'}px;overflow-wrap:anywhere;word-break:break-word;color:${ink};">${escapeHtml(input.value)}</p>${input.detailHtml ? `<div style="margin-top:12px;font-size:13px;line-height:1.6;color:${ink};">${input.detailHtml}</div>` : ''}</td></tr></table>`
}

export function emailSchedule(input: { day: string; time: string; timezone?: string; duration?: string }): string {
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;border:1px solid ${EMAIL_COLORS.line};border-radius:18px;border-collapse:separate;overflow:hidden;"><tr><td style="padding:18px 22px;background:${EMAIL_COLORS.quiet};border-bottom:1px dashed #C7CDBB;font-size:13px;line-height:1.5;color:${EMAIL_COLORS.body};">${escapeHtml(input.day)}</td><td align="right" style="padding:18px 22px 18px 0;background:${EMAIL_COLORS.quiet};border-bottom:1px dashed #C7CDBB;font-size:12px;line-height:1.5;color:${EMAIL_COLORS.muted};white-space:nowrap;">${escapeHtml(input.duration || '10 minutes')}</td></tr><tr><td colspan="2" style="padding:24px 22px;"><p class="t-email-feature" style="margin:0 0 10px;font-size:34px;line-height:1.15;font-weight:500;letter-spacing:-1px;color:${EMAIL_COLORS.ink};">${escapeHtml(input.time)}</p><p style="margin:0;font-size:13px;line-height:1.6;color:${EMAIL_COLORS.muted};">${escapeHtml(input.timezone || 'Philippine time (Asia/Manila)')} · Google Meet</p></td></tr></table>`
}

export function emailActions(actions: Array<{ href: string; label: string; primary?: boolean }>): string {
    const cells = actions.map((action, index) => {
        const href = escapeHtml(safeHref(action.href))
        const label = escapeHtml(action.label)
        const content = action.primary
            ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="${EMAIL_COLORS.accent}" style="background:${EMAIL_COLORS.accent};border-radius:999px;"><a href="${href}" style="display:inline-block;padding:14px 20px;color:${EMAIL_COLORS.ink};text-decoration:none;font-weight:500;">${label}</a></td></tr></table>`
            : `<a href="${href}" style="color:${EMAIL_COLORS.ink};text-decoration:underline;font-weight:500;">${label}</a>`
        return `<td class="t-email-action-cell" valign="middle" style="${index ? 'padding-left:16px;' : ''}font-size:14px;line-height:1.5;">${content}</td>`
    }).join('')
    return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;max-width:100%;"><tr>${cells}</tr></table>`
}

export function emailSteps(steps: Array<{ label: string; state: 'done' | 'current' | 'upcoming' }>): string {
    if (!steps.length) return ''
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 28px;table-layout:fixed;"><tr>${steps.map((step, index) => `<td valign="top" width="${100 / steps.length}%" style="padding:${index ? '0 0 0 8px' : '0'};"><div style="height:4px;line-height:4px;font-size:1px;background:${step.state === 'current' ? EMAIL_COLORS.accent : step.state === 'done' ? EMAIL_COLORS.ink : EMAIL_COLORS.line};border-radius:3px;">&nbsp;</div><p style="margin:8px 0 0;font-size:12px;line-height:1.4;color:${step.state === 'upcoming' ? EMAIL_COLORS.muted : EMAIL_COLORS.ink};font-weight:${step.state === 'current' ? '500' : '400'};">${step.state === 'done' ? '&#10003; ' : ''}${escapeHtml(step.label)}</p></td>`).join('')}</tr></table>`
}

/** Values are trusted HTML assembled by the caller; labels are always escaped. */
export function emailDetails(rows: Array<{ label: string; valueHtml: string }>): string {
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows.map((row, index) => `<tr><td valign="top" style="padding:${index ? '12px' : '0'} 12px 12px 0;${index ? `border-top:1px solid ${EMAIL_COLORS.line};` : ''}font-size:14px;line-height:1.5;color:${EMAIL_COLORS.muted};width:36%;">${escapeHtml(row.label)}</td><td valign="top" style="padding:${index ? '12px' : '0'} 0 12px;${index ? `border-top:1px solid ${EMAIL_COLORS.line};` : ''}font-size:15px;line-height:1.5;font-weight:500;color:${EMAIL_COLORS.ink};overflow-wrap:anywhere;word-break:break-word;">${row.valueHtml}</td></tr>`).join('')}</table>`
}

export function emailStatus(label: string, tone: 'quiet' | 'accent' | 'warning' | 'danger' | 'success' = 'quiet'): string {
    return `<span style="display:inline-block;padding:6px 11px;border-radius:999px;background:${EMAIL_COLORS[tone]};color:${EMAIL_COLORS.ink};font-size:12px;line-height:1.4;font-weight:500;">${escapeHtml(label)}</span>`
}

export interface EmailFrameOptions {
    title: string
    preheader?: string
    eyebrow?: string
    heading: string
    /** Only escaped or static, trusted HTML belongs here. */
    bodyHtml: string
    supportEmail?: string
    footerHtml?: string
    variant?: 'standard' | 'payment' | 'booking' | 'success' | 'attention'
    status?: string
    /** Escaped by the frame and shown as 'For …' beside the official wordmark. */
    recipientName?: string
    /** Trusted HTML, with runtime content escaped by the caller. */
    introHtml?: string
    heroHtml?: string
    heroActions?: Array<{ href: string; label: string; primary?: boolean }>
    /** Only use on friendly invitations/previews or confirmed positive outcomes. */
    friendly?: boolean
}

export function emailFrame(options: EmailFrameOptions): string {
    const preheader = escapeHtml(options.preheader || options.heading)
    const variant = options.variant || 'standard'
    const fonts = [400, 500, 600, 700].map(weight => `@font-face{font-family:'Onest';font-style:normal;font-weight:${weight};src:url('https://tendso.com/fonts/onest-latin-${weight}-normal.woff2') format('woff2');}`).join('')
    const heroLabel = options.status || options.eyebrow || 'From the Tendso team'
    const support = options.supportEmail
        ? `<p style="margin:0 0 18px;font-size:13px;line-height:1.7;color:${EMAIL_COLORS.body};">Need a hand? <a href="mailto:${escapeHtml(options.supportEmail)}" style="color:${EMAIL_COLORS.ink};text-decoration:underline;font-weight:500;">Reply to the team</a><br>${escapeHtml(options.supportEmail)}</p>`
        : `<p style="margin:0 0 18px;font-size:13px;line-height:1.7;color:${EMAIL_COLORS.body};">Need a hand? Reply to this email.</p>`
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(options.title)}</title><style>${fonts}@media only screen and (max-width:600px){.t-email-outer{padding:12px 4px!important}.t-email-pad{padding-left:22px!important;padding-right:22px!important}.t-email-hero{padding:24px 22px!important;border-radius:28px!important}.t-email-heading{font-size:36px!important;letter-spacing:-1.8px!important}.t-email-feature{font-size:38px!important}.t-email-feature-text{font-size:25px!important}.t-email-wordmark{font-size:72px!important;letter-spacing:-4.5px!important}}@media only screen and (max-width:360px){.t-email-action-cell{display:block!important;padding:0 0 14px!important}.t-email-feature-text{font-size:22px!important}}</style></head>
<body style="margin:0;padding:0;background:${EMAIL_COLORS.canvas};font-family:${SANS};color:${EMAIL_COLORS.ink};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${EMAIL_COLORS.canvas}" style="background:${EMAIL_COLORS.canvas};"><tr><td class="t-email-outer" align="center" style="padding:20px 12px;">
<!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="${EMAIL_COLORS.white}" style="width:100%;max-width:600px;background:${EMAIL_COLORS.white};border-collapse:separate;">
<tr><td class="t-email-pad" style="padding:16px 24px 24px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="36"><img src="${EMAIL_BRAND_MARK}" alt="" width="26" height="26" style="display:block;border:0;width:26px;height:26px;"></td><td style="font-family:${SANS};font-size:27px;line-height:1;font-weight:500;letter-spacing:-1.2px;color:${EMAIL_COLORS.ink};">tendso</td></tr></table></td><td align="right" style="font-size:11px;line-height:1.5;color:${EMAIL_COLORS.body};">${options.recipientName ? `For ${escapeHtml(options.recipientName)}` : escapeHtml(options.eyebrow || 'From the Tendso team')}</td></tr></table></td></tr>
<tr><td class="t-email-hero" bgcolor="${EMAIL_COLORS.stage}" style="padding:30px 32px;background:${EMAIL_COLORS.stage};border-radius:40px;overflow-wrap:anywhere;word-break:break-word;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td valign="middle">${emailStatus(heroLabel, variant === 'attention' ? 'warning' : 'quiet')}</td>${options.friendly ? `<td align="right" width="70"><img src="${EMAIL_BRAND_BUDDY}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;border:0;"></td>` : ''}</tr></table><h1 class="t-email-heading" style="margin:24px 0 20px;font-family:${SANS};font-size:48px;line-height:.99;font-weight:500;letter-spacing:-2.4px;color:${EMAIL_COLORS.ink};overflow-wrap:anywhere;">${escapeHtml(options.heading)}</h1>${options.introHtml || ''}${options.heroHtml || ''}${options.heroActions?.length ? emailActions(options.heroActions) : ''}</td></tr>
<tr><td class="t-email-pad" style="padding:26px 28px 8px;font-family:${SANS};color:${EMAIL_COLORS.body};font-size:16px;line-height:1.65;overflow-wrap:anywhere;word-break:break-word;">${options.bodyHtml}</td></tr>
<tr><td class="t-email-pad" style="padding:26px 24px 24px;background:${EMAIL_COLORS.stage};border-radius:40px;">${options.footerHtml || ''}${support}<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:${EMAIL_COLORS.body};">The thinking ends here.</p><p class="t-email-wordmark" style="margin:0;font-family:${SANS};font-size:122px;line-height:.95;letter-spacing:-7px;font-weight:500;color:${EMAIL_COLORS.ink};">tendso</p><p style="margin:20px 0 0;font-size:11px;line-height:1.7;color:${EMAIL_COLORS.muted};">&copy; ${new Date().getFullYear()} Tendso</p></td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`
}
