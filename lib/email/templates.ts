/**
 * Email HTML template generators (extracted for reuse in preview).
 * These functions return raw HTML strings without sending any email.
 */

import { getPaymentConfig } from '@/lib/payment/config'
import { CUSTOM_DOMAIN_ADDON, formatPHP } from '@/lib/pricing'

const paymentConfig = getPaymentConfig()

/**
 * Entity-encode a value before it is interpolated into the markup below.
 *
 * WHY: since /start exists, `businessName` / `businessOwnerName` / the owner's
 * email reach these templates from `submitOwnerIntake` — a PUBLIC, unauthenticated
 * Convex mutation — and the intake-received email is scheduled to a caller-supplied
 * address with no admin in the loop. Raw interpolation would let anyone put their
 * own HTML (a phishing link, say) inside a DKIM-signed email from our verified
 * from-address. Every runtime string below is therefore treated as untrusted text,
 * never as markup. Covers both text nodes and quoted attribute values (href, title).
 */
function escapeHtml(value: string | undefined | null): string {
    if (!value) return ''
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

export function getPaymentConfirmationEmailHtml(params: {
    businessName: string
    businessOwnerName: string
    websiteUrl: string
    amount: number
    wiseEmail?: string
    customDomain?: string // If set, shows "domain being configured" notice
}): string {
    const { amount, wiseEmail: customWiseEmail } = params
    // Escaped at the top so no interpolation site below can be missed.
    const businessName = escapeHtml(params.businessName)
    const businessOwnerName = escapeHtml(params.businessOwnerName)
    const websiteUrl = escapeHtml(params.websiteUrl)
    const customDomain = escapeHtml(params.customDomain)
    
    const wiseEmail = escapeHtml(customWiseEmail || paymentConfig.wiseEmail || 'frmwrkd.media@gmail.com')

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Confirmed — ${businessName}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
            <td align="center" style="padding:40px 16px;">

                <!-- Card -->
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#1a1a1a;border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.5);">

                    <!-- Hero gradient header -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#E4B05E 0%,#C89548 50%,#A67836 100%);padding:48px 40px 40px;text-align:center;">
                            <!-- Logo mark -->
                            <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:10px 18px;margin-bottom:24px;">
                                <span style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:1px;">TENDSO</span>
                            </div>
                            <h1 style="margin:0 0 12px;color:#ffffff;font-size:32px;font-weight:800;line-height:1.2;letter-spacing:-0.5px;">
                                Payment Confirmed!
                            </h1>
                            <p style="margin:0;color:rgba(255,255,255,0.75);font-size:16px;line-height:1.6;">
                                Your website is now officially live
                            </p>
                        </td>
                    </tr>

                    <!-- Greeting -->
                    <tr>
                        <td style="padding:36px 40px 0;">
                            <p style="margin:0 0 12px;font-size:16px;color:#a1a1aa;line-height:1.7;">
                                Hi <strong style="color:#ffffff;">${businessOwnerName}</strong>,
                            </p>
                            <p style="margin:0;font-size:16px;color:#a1a1aa;line-height:1.7;">
                                We have received and confirmed your payment of <strong style="color:#E4B05E;">&#8369;${amount.toLocaleString()}</strong> for <strong style="color:#ffffff;">${businessName}</strong>. Your website is now fully published and live on the web!
                            </p>
                        </td>
                    </tr>

                    <!-- Payment Summary -->
                    <tr>
                        <td style="padding:28px 40px 0;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#111111;border:1px solid #2d2d2d;border-radius:12px;overflow:hidden;">
                                <tr>
                                    <td style="padding:28px;">
                                        <p style="margin:0 0 20px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Payment Summary</p>
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                            <tr>
                                                <td style="padding:7px 0;font-size:13px;color:#6b7280;width:140px;">Status</td>
                                                <td style="padding:7px 0;">
                                                    <span style="font-size:13px;color:#E4B05E;font-weight:700;background:#3D2608;padding:3px 10px;border-radius:4px;">CONFIRMED</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding:7px 0;font-size:13px;color:#6b7280;">Amount Paid</td>
                                                <td style="padding:7px 0;font-size:14px;color:#e5e7eb;font-weight:600;">&#8369;${amount.toLocaleString()}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding:7px 0;font-size:13px;color:#6b7280;">Business</td>
                                                <td style="padding:7px 0;font-size:14px;color:#e5e7eb;font-weight:600;">${businessName}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    ${customDomain ? `
                    <!-- Custom Domain Notice -->
                    <tr>
                        <td style="padding:28px 40px 0;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0c1f17;border:1px solid #6B4A12;border-radius:12px;overflow:hidden;">
                                <tr>
                                    <td style="padding:24px;">
                                        <p style="margin:0 0 8px;font-size:14px;color:#E4B05E;font-weight:700;">🌐 Custom Domain: ${customDomain}</p>
                                        <p style="margin:0;font-size:13px;color:#F2D8A0;line-height:1.6;">
                                            Your custom domain is being configured and will be live within 5 minutes. You'll receive a separate email with your domain details and renewal information once it's ready.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    ` : ''}

                    <!-- Website CTA -->
                    <tr>
                        <td style="padding:28px 40px 0;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#111111;border:1px solid #2d2d2d;border-radius:12px;overflow:hidden;">
                                <tr>
                                    <td style="padding:24px;text-align:center;">
                                        <p style="margin:0 0 18px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Your Live Website</p>
                                        <!--[if mso]>
                                        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${websiteUrl}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="17%" fillcolor="#E4B05E">
                                            <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">Visit Your Website &rarr;</center>
                                        </v:roundrect>
                                        <![endif]-->
                                        <!--[if !mso]><!-->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                                            <tr>
                                                <td style="border-radius:8px;background:linear-gradient(135deg,#C89548,#E4B05E);">
                                                    <a href="${websiteUrl}" target="_blank" style="display:block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px;font-family:sans-serif;">
                                                        Visit Your Website &rarr;
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                        <!--<![endif]-->
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Thank you note -->
                    <tr>
                        <td style="padding:28px 40px 0;">
                            <p style="margin:0;font-size:16px;color:#a1a1aa;line-height:1.7;">
                                Thank you for choosing Tendso! Your business is now online and accessible to everyone. <strong style="color:#f5f5f5;">Free edits for your first year.</strong> Tell us what you want changed and we'll make it for you.
                            </p>
                        </td>
                    </tr>

                    <!-- Support -->
                    <tr>
                        <td style="padding:28px 40px 0;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#111111;border:1px solid #2d2d2d;border-radius:10px;">
                                <tr>
                                    <td style="padding:18px 24px;text-align:center;">
                                        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Questions? We're here to help.</p>
                                        <a href="mailto:${wiseEmail}" style="color:#E4B05E;font-size:14px;font-weight:600;text-decoration:none;">${wiseEmail}</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding:32px 40px;text-align:center;">
                            <p style="margin:0 0 4px;font-size:12px;color:#3f3f46;">&copy; 2026 Tendso. All rights reserved.</p>
                            <p style="margin:0;font-size:12px;color:#3f3f46;">The Thinking Ends Here. So the work doesn't.</p>
                        </td>
                    </tr>

    `
}

/**
 * PROMO — the website is live and the owner owes nothing.
 *
 * Deliberately not a variant of getPaymentConfirmationEmailHtml. That template
 * is a receipt: it renders "Payment Summary", "Amount Paid" and a CONFIRMED
 * badge, all of which would be a lie here — the owner never paid. Nothing in
 * this email states or implies a transaction, and nothing invites one, so an
 * owner who reads it carefully cannot come away thinking a bill is coming.
 */
export function getPromoWebsiteLiveEmailHtml(params: {
    businessName: string
    businessOwnerName: string
    websiteUrl: string
    /** The creator who gave the site away — named so the gift has a person behind it. */
    creatorName?: string
    platformEmail?: string
}): string {
    // Escaped at the top so no interpolation site below can be missed.
    const businessName = escapeHtml(params.businessName)
    const businessOwnerName = escapeHtml(params.businessOwnerName)
    const websiteUrl = escapeHtml(params.websiteUrl)
    const creatorName = escapeHtml(params.creatorName)
    const wiseEmail = escapeHtml(params.platformEmail || paymentConfig.wiseEmail || 'frmwrkd.media@gmail.com')

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Website is Live — ${businessName}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
            <td align="center" style="padding:40px 16px;">

                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#1a1a1a;border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.5);">

                    <!-- Hero -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#E4B05E 0%,#C89548 50%,#A67836 100%);padding:48px 40px 40px;text-align:center;">
                            <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:10px 18px;margin-bottom:24px;">
                                <span style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:1px;">TENDSO</span>
                            </div>
                            <h1 style="margin:0 0 12px;color:#ffffff;font-size:32px;font-weight:800;line-height:1.2;letter-spacing:-0.5px;">
                                Your Website is Live!
                            </h1>
                            <p style="margin:0;color:rgba(255,255,255,0.75);font-size:16px;line-height:1.6;">
                                A gift for ${businessName} &mdash; nothing to pay
                            </p>
                        </td>
                    </tr>

                    <!-- Greeting -->
                    <tr>
                        <td style="padding:36px 40px 0;">
                            <p style="margin:0 0 12px;font-size:16px;color:#a1a1aa;line-height:1.7;">
                                Hi <strong style="color:#ffffff;">${businessOwnerName}</strong>,
                            </p>
                            <p style="margin:0;font-size:16px;color:#a1a1aa;line-height:1.7;">
                                ${creatorName
        ? `<strong style="color:#ffffff;">${creatorName}</strong> chose <strong style="color:#ffffff;">${businessName}</strong> for a free website under our current promo &mdash; and it is built, published, and live on the web right now.`
        : `<strong style="color:#ffffff;">${businessName}</strong> was chosen for a free website under our current promo &mdash; and it is built, published, and live on the web right now.`}
                                <strong style="color:#E4B05E;">There is nothing for you to pay.</strong>
                            </p>
                        </td>
                    </tr>

                    <!-- No-charge notice -->
                    <tr>
                        <td style="padding:28px 40px 0;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#111111;border:1px solid #2d2d2d;border-radius:12px;overflow:hidden;">
                                <tr>
                                    <td style="padding:28px;">
                                        <p style="margin:0 0 14px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">What this costs you</p>
                                        <p style="margin:0 0 10px;font-size:26px;color:#E4B05E;font-weight:800;letter-spacing:-0.5px;">&#8369;0</p>
                                        <p style="margin:0;font-size:14px;color:#a1a1aa;line-height:1.7;">
                                            No invoice, no payment link, and no card on file. If anyone contacts you asking for payment for this website, it did not come from us &mdash; reply to this email and we will confirm.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Website CTA -->
                    <tr>
                        <td style="padding:28px 40px 0;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#111111;border:1px solid #2d2d2d;border-radius:12px;overflow:hidden;">
                                <tr>
                                    <td style="padding:24px;text-align:center;">
                                        <p style="margin:0 0 18px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Your Live Website</p>
                                        <!--[if mso]>
                                        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${websiteUrl}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="17%" fillcolor="#E4B05E">
                                            <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">Visit Your Website &rarr;</center>
                                        </v:roundrect>
                                        <![endif]-->
                                        <!--[if !mso]><!-->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                                            <tr>
                                                <td style="border-radius:8px;background:linear-gradient(135deg,#C89548,#E4B05E);">
                                                    <a href="${websiteUrl}" target="_blank" style="display:block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px;font-family:sans-serif;">
                                                        Visit Your Website &rarr;
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                        <!--<![endif]-->
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Edits -->
                    <tr>
                        <td style="padding:28px 40px 0;">
                            <p style="margin:0;font-size:16px;color:#a1a1aa;line-height:1.7;">
                                Your business is now online and accessible to everyone. <strong style="color:#f5f5f5;">Free edits for your first year</strong> &mdash; new hours, new photos, a new price. Tell us what you want changed and we'll make it for you.
                            </p>
                        </td>
                    </tr>

                    <!-- Support -->
                    <tr>
                        <td style="padding:28px 40px 0;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#111111;border:1px solid #2d2d2d;border-radius:10px;">
                                <tr>
                                    <td style="padding:18px 24px;text-align:center;">
                                        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Questions? We're here to help.</p>
                                        <a href="mailto:${wiseEmail}" style="color:#E4B05E;font-size:14px;font-weight:600;text-decoration:none;">${wiseEmail}</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding:32px 40px;text-align:center;">
                            <p style="margin:0 0 4px;font-size:12px;color:#3f3f46;">&copy; 2026 Tendso. All rights reserved.</p>
                            <p style="margin:0;font-size:12px;color:#3f3f46;">The Thinking Ends Here. So the work doesn't.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `
}

export function getPaymentLinkEmailHtml(params: {
    businessName: string
    businessOwnerName: string
    amount: number
    // The published Cloudflare URL. Publish always runs BEFORE this email
    // (app/api/publish-website/route.ts writes status:'deployed'; markEmailSent
    // stamps pending_payment afterwards), so by the time this renders the site
    // is genuinely live — the bill arrives with the thing it is billing for.
    websiteUrl?: string
    referenceCode: string
    platformEmail?: string
    customDomain?: string
    // The REAL frozen domain price (submissions.domainCostPHP). Used to split the
    // itemized breakdown correctly. Falls back to the flat CUSTOM_DOMAIN_ADDON
    // only for legacy submissions that predate real-domain pricing.
    domainCostPHP?: number
    /**
     * @deprecated Accepted but IGNORED. This used to render an "Edit my website"
     * button pointing at the owner portal. There is no self-serve owner editor —
     * edits are requested via /contact and Tendso makes the change — so the button
     * was removed rather than left one auth fix away from mailing customers a link
     * to a portal that cannot deliver. The field stays on the type only so existing
     * callers (lib/email/service.ts, app/api/send-website-email/route.ts) keep
     * compiling; delete it there and here together.
     */
    editMyWebsiteUrl?: string
}): string {
    const { amount, platformEmail, domainCostPHP } = params
    // Escaped at the top so no interpolation site below can be missed.
    const businessName = escapeHtml(params.businessName)
    const businessOwnerName = escapeHtml(params.businessOwnerName)
    const websiteUrl = escapeHtml(params.websiteUrl)
    const referenceCode = escapeHtml(params.referenceCode)
    const customDomain = escapeHtml(params.customDomain)
    // Real domain charge for the line-item split; the website-package line is the remainder.
    const domainLine = domainCostPHP && domainCostPHP > 0 ? domainCostPHP : CUSTOM_DOMAIN_ADDON
    const websiteLine = amount - domainLine
    const wiseEmail = escapeHtml(platformEmail || paymentConfig.wiseEmail || 'frmwrkd.media@gmail.com')

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Instructions — ${businessName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f4f6;">
        <tr>
            <td align="center" style="padding:40px 16px;">

                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

                    <!-- Header -->
                    <tr>
                        <td style="background-color:#E4B05E;padding:32px 40px;text-align:center;">
                            <p style="margin:0 0 4px;font-size:13px;color:rgba(255,255,255,0.8);font-weight:600;letter-spacing:1px;text-transform:uppercase;">Tendso</p>
                            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;">Your Website is Ready!</h1>
                        </td>
                    </tr>

                    <!-- Greeting -->
                    <tr>
                        <td style="padding:32px 40px 0;">
                            <p style="margin:0 0 16px;font-size:18px;color:#111827;line-height:1.6;">
                                Hi <strong>${businessOwnerName}</strong>,
                            </p>
                            <p style="margin:0;font-size:16px;color:#374151;line-height:1.7;">
                                Your website for <strong style="color:#E4B05E;">${businessName}</strong> has been built and is ready to go live! To activate it, please send a payment using <strong>GCash, Maya, any bank app, or the Wise app</strong> — whichever is easiest for you.
                            </p>
                        </td>
                    </tr>

                    ${websiteUrl ? `
                    <!-- See your website — shown before the amount, deliberately -->
                    <tr>
                        <td style="padding:24px 40px 0;text-align:center;">
                            <p style="margin:0 0 14px;font-size:14px;color:#6b7280;">Here is what we built for you:</p>
                            <!--[if mso]>
                            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${websiteUrl}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="17%" fillcolor="#E4B05E">
                                <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">See your website &rarr;</center>
                            </v:roundrect>
                            <![endif]-->
                            <!--[if !mso]><!-->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                                <tr>
                                    <td style="border-radius:8px;background:linear-gradient(135deg,#C89548,#E4B05E);">
                                        <a href="${websiteUrl}" target="_blank" style="display:block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px;font-family:sans-serif;">
                                            See your website &rarr;
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <!--<![endif]-->
                            <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;word-break:break-all;">${websiteUrl}</p>
                        </td>
                    </tr>
                    ` : ''}

                    <!-- Amount Box -->
                    <tr>
                        <td style="padding:24px 40px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f0fdf4;border:2px solid #bbf7d0;border-radius:12px;">
                                <tr>
                                    <td style="padding:24px;text-align:center;">
                                        <p style="margin:0 0 4px;font-size:14px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Total Amount to Pay</p>
                                        <p style="margin:0;font-size:40px;color:#C89548;font-weight:800;">₱${amount.toLocaleString('en-PH')}</p>
                                    </td>
                                </tr>
                                ${customDomain ? `
                                <tr>
                                    <td style="padding:0 24px 16px;">
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:8px;border:1px solid #F5E4C0;">
                                            <tr>
                                                <td style="padding:12px 16px;border-bottom:1px solid #ecfdf5;">
                                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                                        <tr>
                                                            <td style="font-size:14px;color:#374151;">Website Package</td>
                                                            <td align="right" style="font-size:14px;color:#111827;font-weight:700;">${formatPHP(websiteLine)}</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding:12px 16px;">
                                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                                        <tr>
                                                            <td style="font-size:14px;color:#374151;">Custom Domain: <strong style="color:#C89548;">${customDomain}</strong></td>
                                                            <td align="right" style="font-size:14px;color:#111827;font-weight:700;">${formatPHP(domainLine)}</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                ` : ''}
                            </table>
                        </td>
                    </tr>

                    <!-- Bank Account Details -->
                    <tr>
                        <td style="padding:0 40px 24px;">
                            <h2 style="margin:0 0 16px;font-size:20px;color:#111827;font-weight:700;">Send Your Payment To</h2>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;border:2px solid #d1d5db;border-radius:12px;overflow:hidden;">
                                <tr><td style="padding:18px 20px;border-bottom:1px solid #f3f4f6;">
                                    <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Account Holder Name</p>
                                    <p style="margin:0;font-size:20px;color:#111827;font-weight:700;">VONAS, OPC</p>
                                </td></tr>
                                <tr><td style="padding:18px 20px;border-bottom:1px solid #f3f4f6;">
                                    <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Account Number (copy this)</p>
                                    <p style="margin:0;font-size:28px;color:#111827;font-weight:800;font-family:'Courier New',Courier,monospace;letter-spacing:3px;">2006436346</p>
                                </td></tr>
                                <tr><td style="padding:18px 20px;border-bottom:1px solid #f3f4f6;">
                                    <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Bank</p>
                                    <p style="margin:0;font-size:16px;color:#111827;font-weight:600;">Wise Pilipinas Inc. (via InstaPay)</p>
                                </td></tr>
                                <tr><td style="padding:18px 20px;">
                                    <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Amount</p>
                                    <p style="margin:0;font-size:28px;color:#C89548;font-weight:800;">₱${amount.toLocaleString('en-PH')}</p>
                                </td></tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Pay from any app -->
                    <tr>
                        <td style="padding:0 40px 24px;">
                            <div style="padding:16px 20px;background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;">
                                <p style="margin:0;font-size:15px;color:#1e40af;line-height:1.6;">
                                    💡 <strong>You can pay from any of these apps:</strong> GCash, Maya, BDO, BPI, UnionBank, Metrobank, Landbank, or any bank app. Just choose <strong>"Send via InstaPay"</strong> and enter the account details above.
                                </p>
                            </div>
                        </td>
                    </tr>

                    <!-- Reference Code -->
                    <tr>
                        <td style="padding:0 40px 24px;">
                            <div style="padding:24px;background-color:#fefce8;border:2px solid #fde68a;border-radius:12px;text-align:center;">
                                <p style="margin:0 0 8px;font-size:15px;color:#92400e;font-weight:700;">⚠ IMPORTANT — Include this code when sending:</p>
                                <p style="margin:0 0 12px;font-size:32px;color:#78350f;font-weight:800;font-family:'Courier New',Courier,monospace;letter-spacing:5px;">${referenceCode}</p>
                                <p style="margin:0;font-size:14px;color:#92400e;line-height:1.6;">Put this in the <strong>"Reference"</strong>, <strong>"Note"</strong>, or <strong>"Message"</strong> field. This lets us automatically activate your website.</p>
                            </div>
                        </td>
                    </tr>

                    <!-- 3 Easy Steps -->
                    <tr>
                        <td style="padding:0 40px 32px;">
                            <h2 style="margin:0 0 16px;font-size:18px;color:#111827;font-weight:700;">3 Easy Steps</h2>

                            <!-- Step 1 -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:12px;">
                                <tr>
                                    <td valign="top" width="36"><div style="width:28px;height:28px;background-color:#E4B05E;border-radius:50%;text-align:center;line-height:28px;color:#ffffff;font-weight:800;font-size:14px;">1</div></td>
                                    <td style="padding-left:10px;"><p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">Open <strong>GCash, Maya, or your bank app</strong> and choose <strong>"Send Money" → "InstaPay"</strong></p></td>
                                </tr>
                            </table>
                            <!-- Step 2 -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:12px;">
                                <tr>
                                    <td valign="top" width="36"><div style="width:28px;height:28px;background-color:#E4B05E;border-radius:50%;text-align:center;line-height:28px;color:#ffffff;font-weight:800;font-size:14px;">2</div></td>
                                    <td style="padding-left:10px;"><p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">Enter: Bank = <strong>Wise Pilipinas Inc.</strong>, Account = <strong style="font-family:monospace;">2006436346</strong>, Amount = <strong>₱${amount.toLocaleString('en-PH')}</strong></p></td>
                                </tr>
                            </table>
                            <!-- Step 3 -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td valign="top" width="36"><div style="width:28px;height:28px;background-color:#E4B05E;border-radius:50%;text-align:center;line-height:28px;color:#ffffff;font-weight:800;font-size:14px;">3</div></td>
                                    <td style="padding-left:10px;"><p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">Add reference code <strong style="color:#92400e;font-family:monospace;">${referenceCode}</strong> in the note/message field, then <strong>confirm and send</strong>. Your website goes live automatically!</p></td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    ${customDomain ? `
                    <!-- Domain note -->
                    <tr>
                        <td style="padding:0 40px 24px;">
                            <div style="padding:16px 20px;background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;">
                                <p style="margin:0 0 4px;font-size:14px;color:#1e40af;font-weight:700;">About your custom domain: ${customDomain}</p>
                                <p style="margin:0;font-size:13px;color:#3b82f6;line-height:1.6;">
                                    Year 1 is <strong>included free</strong> with your payment. After year 1, renewal is approximately ₱1,120/year and is your responsibility. We do NOT auto-renew — you have full control.
                                </p>
                            </div>
                        </td>
                    </tr>
                    ` : ''}

                    <!-- Summary box -->
                    <tr>
                        <td style="padding:0 40px 32px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
                                <tr><td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                        <tr>
                                            <td style="font-size:14px;color:#6b7280;">Send to</td>
                                            <td align="right" style="font-size:14px;color:#111827;font-weight:700;">${wiseEmail}</td>
                                        </tr>
                                    </table>
                                </td></tr>
                                <tr><td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                        <tr>
                                            <td style="font-size:14px;color:#6b7280;">Amount</td>
                                            <td align="right" style="font-size:14px;color:#111827;font-weight:700;">₱${amount.toLocaleString('en-PH')}</td>
                                        </tr>
                                    </table>
                                </td></tr>
                                <tr><td style="padding:16px 20px;">
                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                        <tr>
                                            <td style="font-size:14px;color:#6b7280;">Reference code</td>
                                            <td align="right" style="font-size:14px;color:#111827;font-weight:700;font-family:monospace;">${referenceCode}</td>
                                        </tr>
                                    </table>
                                </td></tr>
                            </table>
                        </td>
                    </tr>
                    <!-- Edits policy — same wording as every other Tendso surface -->
                    <tr>
                        <td style="padding:8px 40px 24px;text-align:center;">
                            <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">
                                <strong>Free edits for your first year.</strong> Tell us what you want changed and we&rsquo;ll make it for you &mdash; just <a href="https://www.tendso.com/contact" style="color:#E4B05E;font-weight:600;text-decoration:none;">contact us</a>.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center;">
                            <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
                                Questions? Reply to this email or contact us at <a href="mailto:frmwrkd.media@gmail.com" style="color:#E4B05E;font-weight:600;text-decoration:none;">frmwrkd.media@gmail.com</a>
                            </p>
                            <p style="margin:0;font-size:12px;color:#9ca3af;">
                                &copy; ${new Date().getFullYear()} Tendso. The Thinking Ends Here. So the work doesn't..
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>

</body>
</html>
    `
}export function getApprovalEmailHtml(params: {
    businessName: string
    businessOwnerName: string
    websiteUrl: string
    amount: number
    submissionId: string
    paymentReference?: string
}): string {
    const { amount, submissionId } = params
    // Escaped at the top so no interpolation site below can be missed.
    const businessName = escapeHtml(params.businessName)
    const businessOwnerName = escapeHtml(params.businessOwnerName)
    const websiteUrl = escapeHtml(params.websiteUrl)

    const wiseEmail = escapeHtml(paymentConfig.wiseEmail || 'frmwrkd.media@gmail.com')
    // INTENTIONAL: the default stays 'Negosyo Digital' because this is the
    // LEGAL ACCOUNT NAME registered on Wise (the payment processor). Customers
    // see this string in payment-instruction emails and must match it exactly
    // when sending money — Wise will reject mismatched payee names. Flip this
    // to 'Tendso' (or set the WISE_ACCOUNT_NAME env var) ONLY after the Wise
    // account itself has been renamed to Tendso. See the 2026 rebrand doc.
    const wiseAccountName = escapeHtml(process.env.WISE_ACCOUNT_NAME || 'Negosyo Digital')
    // Use the auto-generated payment reference code, or fallback to old format
    const reference = escapeHtml(params.paymentReference || submissionId.substring(0, 8).toUpperCase())

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Website is Ready — ${businessName}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
            <td align="center" style="padding:40px 16px;">

                <!-- Card -->
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#1a1a1a;border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.5);">

                    <!-- Hero gradient header -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#C89548 0%,#E4B05E 50%,#E8C078 100%);padding:48px 40px 40px;text-align:center;">
                            <!-- Logo mark -->
                            <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:10px 18px;margin-bottom:24px;">
                                <span style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:1px;">TENDSO</span>
                            </div>
                            <h1 style="margin:0 0 12px;color:#ffffff;font-size:32px;font-weight:800;line-height:1.2;letter-spacing:-0.5px;">
                                Your website is<br>ready to launch 🚀
                            </h1>
                            <p style="margin:0;color:rgba(255,255,255,0.75);font-size:16px;line-height:1.6;">
                                One payment away from going live
                            </p>
                        </td>
                    </tr>

                    <!-- Greeting -->
                    <tr>
                        <td style="padding:36px 40px 0;">
                            <p style="margin:0 0 12px;font-size:16px;color:#a1a1aa;line-height:1.7;">
                                Hi <strong style="color:#ffffff;">${businessOwnerName}</strong>,
                            </p>
                            <p style="margin:0;font-size:16px;color:#a1a1aa;line-height:1.7;">
                                Great news — your website for <strong style="color:#ffffff;">${businessName}</strong> is fully built and ready. Complete your payment below to get it published live on the web.
                            </p>
                        </td>
                    </tr>

                    <!-- Website CTA -->
                    <tr>
                        <td style="padding:28px 40px 0;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#111111;border:1px solid #2d2d2d;border-radius:12px;overflow:hidden;">
                                <tr>
                                    <td style="padding:24px;text-align:center;">
                                        <p style="margin:0 0 18px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Preview Your Website</p>
                                        <!--[if mso]>
                                        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${websiteUrl}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="17%" fillcolor="#E4B05E">
                                            <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">View Your Website &rarr;</center>
                                        </v:roundrect>
                                        <![endif]-->
                                        <!--[if !mso]><!-->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                                            <tr>
                                                <td style="border-radius:8px;background:linear-gradient(135deg,#C89548,#E4B05E);">
                                                    <a href="${websiteUrl}" target="_blank" style="display:block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px;font-family:sans-serif;">
                                                        View Your Website &rarr;
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                        <!--<![endif]-->
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Payment section -->
                    <tr>
                        <td style="padding:28px 40px 0;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#111111;border:1px solid #2d2d2d;border-radius:12px;overflow:hidden;">
                                <tr>
                                    <td style="padding:28px;">

                                        <!-- Section label -->
                                        <p style="margin:0 0 20px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Payment Details</p>

                                        <!-- Amount row -->
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:linear-gradient(135deg,#5C3A0F,#6B4A12);border-radius:10px;margin-bottom:20px;">
                                            <tr>
                                                <td style="padding:20px 24px;">
                                                    <p style="margin:0 0 4px;font-size:12px;color:#F2D8A0;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Total Amount Due</p>
                                                    <p style="margin:0;font-size:36px;font-weight:800;color:#ffffff;line-height:1;">&#8369;${amount.toLocaleString()}</p>
                                                </td>
                                            </tr>
                                        </table>

                                        <!-- Wise details -->
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0d1117;border:1px solid #6B4A12;border-radius:10px;">
                                            <tr>
                                                <td style="padding:20px 24px;">
                                                    <!-- Wise logo row -->
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:16px;">
                                                        <tr>
                                                            <td style="background:#9fe870;border-radius:6px;padding:4px 10px;">
                                                                <span style="color:#0d1117;font-size:13px;font-weight:800;letter-spacing:-0.3px;">wise</span>
                                                            </td>
                                                            <td style="padding-left:10px;">
                                                                <span style="color:#E4B05E;font-size:13px;font-weight:600;">Bank Transfer</span>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                    <!-- Details table -->
                                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                                        <tr>
                                                            <td style="padding:7px 0;font-size:13px;color:#6b7280;width:140px;vertical-align:top;">Account Name</td>
                                                            <td style="padding:7px 0;font-size:14px;color:#e5e7eb;font-weight:600;">${wiseAccountName}</td>
                                                        </tr>
                                                        <tr>
                                                            <td style="padding:7px 0;font-size:13px;color:#6b7280;vertical-align:top;">Email / ID</td>
                                                            <td style="padding:7px 0;font-size:14px;color:#e5e7eb;font-weight:600;">${wiseEmail}</td>
                                                        </tr>
                                                        <tr>
                                                            <td style="padding:7px 0;font-size:13px;color:#6b7280;vertical-align:top;">Currency</td>
                                                            <td style="padding:7px 0;font-size:14px;color:#e5e7eb;font-weight:600;">PHP (Philippine Peso)</td>
                                                        </tr>
                                                        <tr>
                                                            <td style="padding:7px 0;font-size:13px;color:#6b7280;vertical-align:top;">Reference #</td>
                                                            <td style="padding:7px 0;">
                                                                <span style="font-size:14px;color:#9fe870;font-weight:700;font-family:'Courier New',monospace;background:#0a1f0a;padding:3px 8px;border-radius:4px;">${reference}</span>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>

                                        <!-- Include reference note -->
                                        <p style="margin:14px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
                                            &#9888;&#65039; Always include the reference number <strong style="color:#e5e7eb;">${reference}</strong> when sending payment so we can match it to your account.
                                        </p>

                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- 3-day urgency warning -->
                    <tr>
                        <td style="padding:20px 40px 0;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:linear-gradient(135deg,#3D2608,#5C3A0F);border-radius:12px;border:1px solid #6B4A12;">
                                <tr>
                                    <td style="padding:20px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                            <tr>
                                                <td style="vertical-align:top;padding-right:14px;font-size:22px;line-height:1;">&#9201;</td>
                                                <td>
                                                    <p style="margin:0 0 6px;font-size:14px;color:#F2D8A0;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Action Required Within 3 Days</p>
                                                    <p style="margin:0;font-size:14px;color:#a7f3d0;line-height:1.6;">
                                                        Your website preview will be <strong>automatically taken offline</strong> if payment is not received within <strong>3 days</strong> of this email. Complete your payment now to keep it live.
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- What's Next -->
                    <tr>
                        <td style="padding:28px 40px 0;">
                            <p style="margin:0 0 16px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">What Happens Next</p>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                ${[
                                    ['1', 'Send payment via Wise using the details above', '#C89548'],
                                    ['2', 'Reply to this email with your payment confirmation screenshot', '#E4B05E'],
                                    ['3', 'We\'ll verify your payment and fully activate your website', '#E8C078'],
                                    ['4', 'Your business goes live online — visible to everyone!', '#F2D8A0'],
                                ].map(([num, text, color]) => `
                                <tr>
                                    <td style="padding:8px 0;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                            <tr>
                                                <td style="vertical-align:top;padding-right:14px;">
                                                    <div style="width:28px;height:28px;background:${color}22;border-radius:50%;text-align:center;line-height:28px;font-size:12px;font-weight:700;color:${color};">${num}</div>
                                                </td>
                                                <td style="vertical-align:middle;font-size:14px;color:#a1a1aa;line-height:1.5;padding-top:4px;">${text}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>`).join('')}
                            </table>
                        </td>
                    </tr>

                    <!-- Support -->
                    <tr>
                        <td style="padding:28px 40px 0;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#111111;border:1px solid #2d2d2d;border-radius:10px;">
                                <tr>
                                    <td style="padding:18px 24px;text-align:center;">
                                        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Questions? We're here to help.</p>
                                        <a href="mailto:${wiseEmail}" style="color:#E4B05E;font-size:14px;font-weight:600;text-decoration:none;">${wiseEmail}</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding:32px 40px;text-align:center;">
                            <p style="margin:0 0 4px;font-size:12px;color:#3f3f46;">© 2026 Tendso. All rights reserved.</p>
                            <p style="margin:0;font-size:12px;color:#3f3f46;">The Thinking Ends Here. So the work doesn't.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>

</body>
</html>
    `
}

// ==================== DOMAIN LIVE EMAIL ====================

export function getDomainLiveEmailHtml(params: {
    businessName: string
    businessOwnerName: string
    customDomain: string
    expiresAt: number
}): string {
    const { expiresAt } = params
    // Escaped at the top so no interpolation site below can be missed.
    const businessName = escapeHtml(params.businessName)
    const businessOwnerName = escapeHtml(params.businessOwnerName)
    const customDomain = escapeHtml(params.customDomain)
    const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${customDomain} is Live</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #f5f5f5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #0a0a0a;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background: #1a1a1a; border-radius: 16px; overflow: hidden; max-width: 600px;">
                    <tr>
                        <td style="background: linear-gradient(135deg, #E4B05E 0%, #C89548 100%); padding: 48px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 800;">🎉 Your Website is Live!</h1>
                            <p style="margin: 12px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">${businessName}</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; color: #f5f5f5; font-size: 16px; line-height: 1.6;">Hi ${businessOwnerName},</p>
                            <p style="margin: 0 0 24px; color: #d4d4d4; font-size: 16px; line-height: 1.6;">
                                Great news! Your custom domain has been registered and your website is now live at:
                            </p>
                            <div style="background: #0a0a0a; border: 2px solid #E4B05E; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                                <a href="https://${customDomain}" style="color: #E4B05E; font-size: 24px; font-weight: 700; text-decoration: none;">${customDomain}</a>
                            </div>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 32px 0;">
                                <tr>
                                    <td style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 24px;">
                                        <h2 style="margin: 0 0 12px; color: #78350f; font-size: 18px; font-weight: 700;">⚠ Important: Domain Renewal Notice</h2>
                                        <p style="margin: 0 0 12px; color: #78350f; font-size: 14px; line-height: 1.6;">
                                            <strong>The first year of your custom domain is included FREE</strong> with your Tendso website package.
                                        </p>
                                        <p style="margin: 0 0 12px; color: #78350f; font-size: 14px; line-height: 1.6;">
                                            Your domain will expire on <strong>${expiryDate}</strong>.
                                        </p>
                                        <p style="margin: 0 0 12px; color: #78350f; font-size: 14px; line-height: 1.6;">
                                            <strong>After year 1, renewal is approximately ₱1,120 ($20) per year</strong> and is the business owner's responsibility. We do <strong>NOT</strong> auto-renew the domain — this is intentional, so you have full control.
                                        </p>
                                        <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.6;">
                                            We'll send you a reminder email 30 days before the expiry date so you don't lose the domain.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 24px 0 0; color: #a3a3a3; font-size: 14px; line-height: 1.6;">
                                You can renew through any registrar (we recommend Hostinger or Cloudflare) or transfer the domain to your own account.
                            </p>
                            <div style="margin: 24px 0 0; padding: 20px; background: #0f1f17; border: 1px solid #E4B05E; border-radius: 12px;">
                                <p style="margin: 0 0 8px; color: #E4B05E; font-size: 14px; font-weight: 700;">💬 Want us to handle the renewal for you?</p>
                                <p style="margin: 0; color: #d4d4d4; font-size: 14px; line-height: 1.6;">
                                    Just reply to this email and our team will help you renew <strong>${customDomain}</strong> on your behalf — no need to deal with the registrar yourself.
                                </p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="background: #0a0a0a; padding: 24px 40px; text-align: center; border-top: 1px solid #262626;">
                            <p style="margin: 0; color: #737373; font-size: 12px;">© ${new Date().getFullYear()} Tendso. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `
}

// ==================== WITHDRAWAL STATUS EMAIL ====================

export function getWithdrawalStatusEmailHtml(params: {
    creatorName: string
    creatorEmail: string
    amount: number
    statusLabel: string
    statusDescription: string
    isFinal: boolean
    referenceCode?: string
    submittedAt: number
}): string {
    const { amount, isFinal, submittedAt } = params
    // creatorName is self-set profile text and statusLabel/statusDescription are
    // operator-supplied; escaped at the top so no site below can be missed.
    const creatorName = escapeHtml(params.creatorName)
    const statusLabel = escapeHtml(params.statusLabel)
    const statusDescription = escapeHtml(params.statusDescription)
    const referenceCode = escapeHtml(params.referenceCode)
    const submittedDate = new Date(submittedAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
    const accentColor = isFinal ? '#E4B05E' : '#f59e0b'
    const accentBg = isFinal ? '#F5E4C0' : '#fef3c7'
    const accentText = isFinal ? '#6B4A12' : '#78350f'
    const icon = isFinal ? '✅' : '⏳'
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Withdrawal Update</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #f5f5f5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #0a0a0a;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background: #1a1a1a; border-radius: 16px; overflow: hidden; max-width: 600px;">
                    <tr>
                        <td style="background: linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%); padding: 48px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 800;">${icon} Withdrawal Update</h1>
                            <p style="margin: 12px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">₱${amount.toLocaleString()}</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; color: #f5f5f5; font-size: 16px; line-height: 1.6;">Hi ${creatorName},</p>
                            <p style="margin: 0 0 24px; color: #d4d4d4; font-size: 16px; line-height: 1.6;">
                                Here's the latest update on your withdrawal request:
                            </p>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 24px;">
                                <tr>
                                    <td style="background: ${accentBg}; border-left: 4px solid ${accentColor}; border-radius: 8px; padding: 24px;">
                                        <h2 style="margin: 0 0 8px; color: ${accentText}; font-size: 20px; font-weight: 700;">${statusLabel}</h2>
                                        <p style="margin: 0; color: ${accentText}; font-size: 14px; line-height: 1.6;">${statusDescription}</p>
                                    </td>
                                </tr>
                            </table>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #0a0a0a; border: 1px solid #262626; border-radius: 8px; padding: 0; margin: 0 0 24px;">
                                <tr>
                                    <td style="padding: 16px 20px; border-bottom: 1px solid #262626;">
                                        <p style="margin: 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Amount</p>
                                        <p style="margin: 4px 0 0; color: #f5f5f5; font-size: 18px; font-weight: 700;">₱${amount.toLocaleString()}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 16px 20px; ${referenceCode ? 'border-bottom: 1px solid #262626;' : ''}">
                                        <p style="margin: 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Submitted</p>
                                        <p style="margin: 4px 0 0; color: #f5f5f5; font-size: 14px;">${submittedDate}</p>
                                    </td>
                                </tr>
                                ${referenceCode ? `
                                <tr>
                                    <td style="padding: 16px 20px;">
                                        <p style="margin: 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Wise Reference</p>
                                        <p style="margin: 4px 0 0; color: #f5f5f5; font-size: 13px; font-family: monospace;">${referenceCode}</p>
                                    </td>
                                </tr>` : ''}
                            </table>
                            ${!isFinal ? `
                            <p style="margin: 0 0 16px; color: #d4d4d4; font-size: 14px; line-height: 1.6;">
                                Wise transfers usually complete within minutes after Wise verification, but some can take 1-2 business days depending on the recipient bank. Your funds are safe and being processed.
                            </p>
                            <p style="margin: 0; color: #a3a3a3; font-size: 13px; line-height: 1.6;">
                                We'll send you another update as soon as the status changes. If you have questions, just reply to this email.
                            </p>` : `
                            <p style="margin: 0; color: #d4d4d4; font-size: 14px; line-height: 1.6;">
                                Thank you for your patience! If you have any questions, just reply to this email.
                            </p>`}
                        </td>
                    </tr>
                    <tr>
                        <td style="background: #0a0a0a; padding: 24px 40px; text-align: center; border-top: 1px solid #262626;">
                            <p style="margin: 0; color: #737373; font-size: 12px;">© ${new Date().getFullYear()} Tendso. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `
}

// ==================== DOMAIN SETUP IN PROGRESS EMAIL ====================
// Sent when SSL provisioning starts — domain registered, DNS pointed, SSL pending.

export function getDomainSetupInProgressEmailHtml(params: {
    businessName: string
    businessOwnerName: string
    customDomain: string
}): string {
    // Escaped at the top so no interpolation site below can be missed.
    const businessName = escapeHtml(params.businessName)
    const businessOwnerName = escapeHtml(params.businessOwnerName)
    const customDomain = escapeHtml(params.customDomain)
    return [
        '<!DOCTYPE html>',
        '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">',
        `<title>Setting up ${customDomain}</title></head>`,
        '<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;">',
        '<table width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f4f6;"><tr><td align="center" style="padding:40px 16px;">',
        '<table width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">',
        '<tr><td style="padding:48px 40px;background:linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%);text-align:center;color:#ffffff;">',
        '<div style="display:inline-block;padding:6px 14px;background:rgba(255,255,255,0.2);border-radius:999px;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:16px;">Tendso</div>',
        '<h1 style="margin:0;font-size:28px;font-weight:700;line-height:1.2;">Setting up your domain</h1>',
        `<p style="margin:12px 0 0;font-size:15px;opacity:0.9;">${customDomain}</p>`,
        '</td></tr>',
        '<tr><td style="padding:40px;color:#1f2937;">',
        `<p style="margin:0 0 16px;font-size:16px;">Hi <strong>${businessOwnerName}</strong>,</p>`,
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">Great news — we have successfully registered <strong>${customDomain}</strong> for your <strong>${businessName}</strong> website and pointed it to our servers.</p>`,
        '<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">We are now provisioning a free SSL certificate so your visitors can browse securely over HTTPS. This usually takes <strong>2 to 10 minutes</strong>. You do not need to do anything — we will send another email as soon as your site is fully live.</p>',
        '<table width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;background:#eff6ff;border-left:4px solid #3b82f6;border-radius:8px;"><tr><td style="padding:16px 20px;">',
        '<p style="margin:0;font-size:13px;color:#1e40af;line-height:1.5;"><strong>What is happening behind the scenes:</strong><br>Domain registered<br>DNS configured<br>SSL certificate being issued by Cloudflare<br>Final activation</p>',
        '</td></tr></table>',
        '<p style="margin:24px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">If your site does not load yet, your browser may be cached. Try opening it in an incognito window in a few minutes.</p>',
        '</td></tr>',
        '<tr><td style="padding:24px 40px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;"><p style="margin:0;font-size:12px;color:#9ca3af;">Tendso — Hands Full. The Thinking Ends Here.</p></td></tr>',
        '</table></td></tr></table></body></html>',
    ].join('')
}

// ==================== DOMAIN RENEWAL REMINDER EMAIL ====================
// Sent ~30 days before the registered domain's expiry date.

export function getDomainRenewalReminderEmailHtml(params: {
    businessName: string
    businessOwnerName: string
    customDomain: string
    expiresAt: number
}): string {
    const { expiresAt } = params
    // Escaped at the top so no interpolation site below can be missed.
    const businessName = escapeHtml(params.businessName)
    const businessOwnerName = escapeHtml(params.businessOwnerName)
    const customDomain = escapeHtml(params.customDomain)
    const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
    const daysRemaining = Math.max(
        0,
        Math.floor((expiresAt - Date.now()) / (1000 * 60 * 60 * 24))
    )
    return [
        '<!DOCTYPE html>',
        '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">',
        `<title>Renew ${customDomain} before it expires</title></head>`,
        '<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;">',
        '<table width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f4f6;"><tr><td align="center" style="padding:40px 16px;">',
        '<table width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">',
        '<tr><td style="padding:48px 40px;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);text-align:center;color:#ffffff;">',
        '<div style="display:inline-block;padding:6px 14px;background:rgba(255,255,255,0.2);border-radius:999px;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:16px;">Reminder · Tendso</div>',
        `<h1 style="margin:0;font-size:28px;font-weight:700;line-height:1.2;">Renew ${customDomain}</h1>`,
        `<p style="margin:12px 0 0;font-size:15px;opacity:0.95;">${daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Expires soon'}</p>`,
        '</td></tr>',
        '<tr><td style="padding:40px;color:#1f2937;">',
        `<p style="margin:0 0 16px;font-size:16px;">Hi <strong>${businessOwnerName}</strong>,</p>`,
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">This is your friendly reminder that your custom domain <strong>${customDomain}</strong> for <strong>${businessName}</strong> will expire on <strong>${expiryDate}</strong>.</p>`,
        '<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">Tendso paid for your first year of registration. <strong>Year 2 onwards is your responsibility</strong> — if the domain is not renewed before the expiry date, you will lose it and your website will stop being reachable on this address.</p>',
        '<table width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:8px;"><tr><td style="padding:20px;">',
        '<p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#92400e;">How to renew:</p>',
        `<ol style="margin:0;padding-left:20px;font-size:13px;color:#78350f;line-height:1.7;"><li>Visit your domain registrar (or transfer to one of your choice)</li><li>Search for <strong>${customDomain}</strong> and follow their renewal process</li><li>Pay the standard yearly registration fee (around 500 to 1200 PHP depending on registrar)</li></ol>`,
        '</td></tr></table>',
        '<table width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0 0;background:#ecfdf5;border:1px solid #E4B05E;border-radius:8px;"><tr><td style="padding:16px 20px;">',
        '<p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#6B4A12;">Want us to handle the renewal for you?</p>',
        `<p style="margin:0;font-size:13px;color:#6B4A12;line-height:1.6;">Just reply to this email and our team will renew <strong>${customDomain}</strong> on your behalf — no need to deal with the registrar yourself.</p>`,
        '</td></tr></table>',
        '<p style="margin:24px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">If you have any questions or need help transferring the domain to your own account, just reply to this email and we will guide you through it.</p>',
        '</td></tr>',
        '<tr><td style="padding:24px 40px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;"><p style="margin:0;font-size:12px;color:#9ca3af;">Tendso — Hands Full. The Thinking Ends Here.</p></td></tr>',
        '</table></td></tr></table></body></html>',
    ].join('')
}

/**
 * Final follow-up — sent on the LAST day before the website is auto-unpublished.
 * Style mirrors getPaymentLinkEmailHtml (white card, emerald header, Wise/InstaPay
 * details). Tone: urgent but warm — "your site goes offline tomorrow."
 *
 * Used by both the automated cron (24h before deadline) and the manual admin
 * "Follow up" button on the submission detail page.
 */
export function getPaymentFollowUpEmailHtml(params: {
    businessName: string
    businessOwnerName: string
    websiteUrl?: string
    amount: number
    referenceCode?: string
    hoursLeft?: number
    isManual?: boolean
}): string {
    const {
        amount,
        hoursLeft = 24,
        isManual = false,
    } = params
    // Escaped at the top so no interpolation site below can be missed —
    // including the `intro` strings, which are markup too.
    const businessName = escapeHtml(params.businessName)
    const businessOwnerName = escapeHtml(params.businessOwnerName)
    const websiteUrl = escapeHtml(params.websiteUrl)
    const referenceCode = escapeHtml(params.referenceCode)

    const wiseEmail = escapeHtml(paymentConfig.wiseEmail || 'frmwrkd.media@gmail.com')
    const headlineTone = isManual ? "We're following up on your website" : 'Final reminder — your website goes offline soon'
    const intro = isManual
        ? `We're checking in on <strong style="color:#C89548;">${businessName}</strong>'s website. It's been live and waiting for you. Once we receive payment, your website stays live permanently — no monthly fees, no contracts.`
        : `Your website for <strong style="color:#C89548;">${businessName}</strong> will be taken offline in about <strong style="color:#dc2626;">${hoursLeft} hours</strong> if payment is not received. We don't want you to miss this — your site has been ready and live this whole time.`

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isManual ? 'Following up' : 'Final reminder'} — ${businessName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f4f6;">
        <tr>
            <td align="center" style="padding:40px 16px;">

                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

                    <!-- Header (matches payment-link email) -->
                    <tr>
                        <td style="background-color:#E4B05E;padding:32px 40px;text-align:center;">
                            <p style="margin:0 0 4px;font-size:13px;color:rgba(255,255,255,0.85);font-weight:600;letter-spacing:1px;text-transform:uppercase;">Tendso</p>
                            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;line-height:1.25;">${headlineTone}</h1>
                        </td>
                    </tr>

                    <!-- Urgency banner (auto only) -->
                    ${!isManual ? `
                    <tr>
                        <td style="padding:0;">
                            <div style="background:#fff7ed;border-bottom:1px solid #fed7aa;padding:14px 40px;text-align:center;">
                                <p style="margin:0;font-size:14px;color:#9a3412;font-weight:700;">
                                    ⏰ Last day before your website is taken offline
                                </p>
                            </div>
                        </td>
                    </tr>
                    ` : ''}

                    <!-- Greeting -->
                    <tr>
                        <td style="padding:32px 40px 0;">
                            <p style="margin:0 0 16px;font-size:18px;color:#111827;line-height:1.6;">
                                Hi <strong>${businessOwnerName}</strong>,
                            </p>
                            <p style="margin:0;font-size:16px;color:#374151;line-height:1.7;">
                                ${intro}
                            </p>
                        </td>
                    </tr>

                    <!-- Amount Box -->
                    <tr>
                        <td style="padding:24px 40px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f0fdf4;border:2px solid #bbf7d0;border-radius:12px;">
                                <tr>
                                    <td style="padding:24px;text-align:center;">
                                        <p style="margin:0 0 4px;font-size:14px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Amount Due</p>
                                        <p style="margin:0;font-size:40px;color:#C89548;font-weight:800;">₱${amount.toLocaleString('en-PH')}</p>
                                        <p style="margin:6px 0 0;font-size:12px;color:#6b7280;">One-time. No monthly fees. Website stays live forever.</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- View website CTA (if URL present) -->
                    ${websiteUrl ? `
                    <tr>
                        <td style="padding:0 40px 24px;text-align:center;">
                            <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">See what's waiting to go permanently live:</p>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                                <tr>
                                    <td style="border-radius:8px;background:#ffffff;border:2px solid #E4B05E;">
                                        <a href="${websiteUrl}" target="_blank" style="display:block;padding:11px 24px;color:#C89548;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.2px;font-family:sans-serif;">
                                            View your website &rarr;
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    ` : ''}

                    <!-- Bank Account Details -->
                    <tr>
                        <td style="padding:0 40px 24px;">
                            <h2 style="margin:0 0 16px;font-size:20px;color:#111827;font-weight:700;">Send Your Payment To</h2>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;border:2px solid #d1d5db;border-radius:12px;overflow:hidden;">
                                <tr><td style="padding:18px 20px;border-bottom:1px solid #f3f4f6;">
                                    <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Account Holder Name</p>
                                    <p style="margin:0;font-size:20px;color:#111827;font-weight:700;">VONAS, OPC</p>
                                </td></tr>
                                <tr><td style="padding:18px 20px;border-bottom:1px solid #f3f4f6;">
                                    <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Account Number</p>
                                    <p style="margin:0;font-size:28px;color:#111827;font-weight:800;font-family:'Courier New',Courier,monospace;letter-spacing:3px;">2006436346</p>
                                </td></tr>
                                <tr><td style="padding:18px 20px;border-bottom:1px solid #f3f4f6;">
                                    <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Bank</p>
                                    <p style="margin:0;font-size:16px;color:#111827;font-weight:600;">Wise Pilipinas Inc. (via InstaPay)</p>
                                </td></tr>
                                <tr><td style="padding:18px 20px;">
                                    <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Amount</p>
                                    <p style="margin:0;font-size:28px;color:#C89548;font-weight:800;">₱${amount.toLocaleString('en-PH')}</p>
                                </td></tr>
                                ${referenceCode ? `
                                <tr><td style="padding:0 20px 18px;">
                                    <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Reference Code</p>
                                    <p style="margin:0;font-size:16px;color:#111827;font-weight:600;font-family:'Courier New',Courier,monospace;">${referenceCode}</p>
                                </td></tr>
                                ` : ''}
                            </table>
                        </td>
                    </tr>

                    <!-- Pay from any app -->
                    <tr>
                        <td style="padding:0 40px 24px;">
                            <div style="padding:16px 20px;background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;">
                                <p style="margin:0;font-size:15px;color:#1e40af;line-height:1.6;">
                                    💡 <strong>Pay from any app:</strong> GCash, Maya, BDO, BPI, UnionBank, Metrobank, Landbank, or any bank app. Choose <strong>"Send via InstaPay"</strong> and enter the details above.
                                </p>
                            </div>
                        </td>
                    </tr>

                    ${!isManual ? `
                    <!-- What happens if not paid -->
                    <tr>
                        <td style="padding:0 40px 24px;">
                            <div style="padding:18px 20px;background-color:#fef2f2;border:1px solid #fecaca;border-radius:10px;">
                                <p style="margin:0 0 6px;font-size:14px;color:#991b1b;font-weight:700;">What happens if not paid by tomorrow:</p>
                                <p style="margin:0;font-size:13px;color:#7f1d1d;line-height:1.6;">
                                    Your website will be taken offline and the URL will stop working. You can still restart with us anytime — just reply to this email and we'll relaunch it for you.
                                </p>
                            </div>
                        </td>
                    </tr>
                    ` : ''}

                    <!-- Soft close -->
                    <tr>
                        <td style="padding:0 40px 32px;">
                            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.7;">
                                Already paid? Send us a quick screenshot at <a href="mailto:${wiseEmail}" style="color:#E4B05E;font-weight:600;text-decoration:none;">${wiseEmail}</a> and we'll mark you paid right away.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center;">
                            <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
                                Questions? Reply to this email or contact us at <a href="mailto:${wiseEmail}" style="color:#E4B05E;font-weight:600;text-decoration:none;">${wiseEmail}</a>
                            </p>
                            <p style="margin:0;font-size:12px;color:#9ca3af;">
                                &copy; ${new Date().getFullYear()} Tendso. The Thinking Ends Here. So the work doesn't..
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>

</body>
</html>
    `
}

// ==================== INTAKE RECEIVED EMAIL ====================
// Sent within a minute of an owner completing /start, scheduled from
// convex/ownerIntake's submitOwnerIntake.
//
// WHY IT EXISTS: the payment email cannot fire until the admin has reviewed,
// generated, picked a template, approved and published — 48-72h of total
// silence. On the creator funnel that silence was invisible because the creator
// was standing in the shop closing the loop verbally. With the creator removed,
// the owner's first contact would otherwise be a bill for a website nobody ever
// told them was being built.
//
// Deliberately promises NOTHING that does not exist: no portal, no account, no
// editor, no status page. Replying to this email is the only channel back, and
// saying so is the truth. Style mirrors getPaymentLinkEmailHtml (white card,
// gold header) so the email that follows it looks like the same sender.

export function getIntakeReceivedEmailHtml(params: {
    businessName: string
    businessOwnerName: string
    amount: number
    platformEmail?: string
}): string {
    const { amount, platformEmail } = params
    // The one template whose inputs reach us with NO admin in between (see
    // escapeHtml) — escaped at the top so no interpolation site below can be missed.
    const businessName = escapeHtml(params.businessName)
    const businessOwnerName = escapeHtml(params.businessOwnerName)

    const wiseEmail = escapeHtml(platformEmail || paymentConfig.wiseEmail || 'frmwrkd.media@gmail.com')

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>We got your details — ${businessName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f4f6;">
        <tr>
            <td align="center" style="padding:40px 16px;">

                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

                    <!-- Header (matches payment-link email) -->
                    <tr>
                        <td style="background-color:#E4B05E;padding:32px 40px;text-align:center;">
                            <p style="margin:0 0 4px;font-size:13px;color:rgba(255,255,255,0.85);font-weight:600;letter-spacing:1px;text-transform:uppercase;">Tendso</p>
                            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;line-height:1.25;">We got your details!</h1>
                        </td>
                    </tr>

                    <!-- Greeting -->
                    <tr>
                        <td style="padding:32px 40px 0;">
                            <p style="margin:0 0 16px;font-size:18px;color:#111827;line-height:1.6;">
                                Hi <strong>${businessOwnerName}</strong>,
                            </p>
                            <p style="margin:0;font-size:16px;color:#374151;line-height:1.7;">
                                Thank you — everything you sent for <strong style="color:#E4B05E;">${businessName}</strong> arrived safely, and we have started building your website.
                            </p>
                        </td>
                    </tr>

                    <!-- Timeline box -->
                    <tr>
                        <td style="padding:24px 40px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f0fdf4;border:2px solid #bbf7d0;border-radius:12px;">
                                <tr>
                                    <td style="padding:24px;text-align:center;">
                                        <p style="margin:0 0 4px;font-size:14px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Your Website Will Be Ready In</p>
                                        <p style="margin:0;font-size:40px;color:#C89548;font-weight:800;">48&ndash;72 hours</p>
                                        <p style="margin:6px 0 0;font-size:12px;color:#6b7280;">We will email you the moment it is done.</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- What happens next -->
                    <tr>
                        <td style="padding:0 40px 32px;">
                            <h2 style="margin:0 0 16px;font-size:18px;color:#111827;font-weight:700;">What Happens Next</h2>

                            <!-- Step 1 -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:12px;">
                                <tr>
                                    <td valign="top" width="36"><div style="width:28px;height:28px;background-color:#E4B05E;border-radius:50%;text-align:center;line-height:28px;color:#ffffff;font-weight:800;font-size:14px;">1</div></td>
                                    <td style="padding-left:10px;"><p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">Our team builds your website from the answers and photos you sent. <strong>Nothing else is needed from you right now.</strong></p></td>
                                </tr>
                            </table>
                            <!-- Step 2 -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:12px;">
                                <tr>
                                    <td valign="top" width="36"><div style="width:28px;height:28px;background-color:#E4B05E;border-radius:50%;text-align:center;line-height:28px;color:#ffffff;font-weight:800;font-size:14px;">2</div></td>
                                    <td style="padding-left:10px;"><p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">Within <strong>48&ndash;72 hours</strong> we email you the <strong>link to your finished website</strong>, so you can open it and see it for yourself.</p></td>
                                </tr>
                            </table>
                            <!-- Step 3 -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td valign="top" width="36"><div style="width:28px;height:28px;background-color:#E4B05E;border-radius:50%;text-align:center;line-height:28px;color:#ffffff;font-weight:800;font-size:14px;">3</div></td>
                                    <td style="padding-left:10px;"><p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">That same email carries the payment instructions — <strong>₱${amount.toLocaleString('en-PH')}</strong>, payable from GCash, Maya, or any bank app.</p></td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Price note -->
                    <tr>
                        <td style="padding:0 40px 24px;">
                            <div style="padding:16px 20px;background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;">
                                <p style="margin:0;font-size:15px;color:#1e40af;line-height:1.6;">
                                    💡 <strong>Nothing to pay today.</strong> The price is <strong>₱${amount.toLocaleString('en-PH')}</strong>, one time — no monthly fees, no contract — and you only pay after you have seen your finished website.
                                </p>
                            </div>
                        </td>
                    </tr>

                    <!-- Corrections -->
                    <tr>
                        <td style="padding:0 40px 32px;">
                            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.7;">
                                Spotted a mistake in your business name, address, or phone number? Just reply to this email and we will fix it before your website is built.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center;">
                            <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
                                Questions? Reply to this email or contact us at <a href="mailto:${wiseEmail}" style="color:#E4B05E;font-weight:600;text-decoration:none;">${wiseEmail}</a>
                            </p>
                            <p style="margin:0;font-size:12px;color:#9ca3af;">
                                &copy; ${new Date().getFullYear()} Tendso. The Thinking Ends Here. So the work doesn't..
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>

</body>
</html>
    `
}

/**
 * Sent the moment a creator requests a withdrawal.
 *
 * Before this, `withdrawals.create` dispatched nothing at all — no email, no
 * push, no in-app row. The first message a creator ever received about their
 * own payout came from Wise, under our registered company name rather than
 * "Tendso", telling them to enter bank details. One creator read that as spam,
 * never claimed it, and the transfer auto-refunded after seven days while the
 * admin page showed a healthy-looking "processing" the whole time.
 *
 * So this pre-empts all four of those failures at the one moment the creator is
 * definitely paying attention: who the Wise email comes from, that a Wise
 * account is required, that the address must match, and that the claim window
 * is finite.
 *
 * `wiseSenderName` is optional and omitted rather than guessed. Naming the
 * wrong company is worse than naming none — it trains creators to distrust the
 * real email.
 */
export function getWithdrawalRequestedEmailHtml(params: {
    creatorName: string
    amount: number
    wiseEmail: string
    reference?: string
    requestedAt: number
    wiseSenderName?: string
}): string {
    const { amount, requestedAt } = params
    const creatorName = escapeHtml(params.creatorName)
    const wiseEmail = escapeHtml(params.wiseEmail)
    const reference = escapeHtml(params.reference)
    const wiseSenderName = escapeHtml(params.wiseSenderName)
    const requestedDate = new Date(requestedAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
    const senderLine = wiseSenderName
        ? `It will show the sender as <strong style="color:#f5f5f5;">${wiseSenderName}</strong> — that is our registered company name, so it really is from us.`
        : `It comes from <strong style="color:#f5f5f5;">noreply@wise.com</strong>, so check your spam folder if you do not see it.`
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Withdrawal Requested</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #f5f5f5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #0a0a0a;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background: #1a1a1a; border-radius: 16px; overflow: hidden; max-width: 600px;">
                    <tr>
                        <td style="background: linear-gradient(135deg, #E4B05E 0%, #E4B05Ecc 100%); padding: 48px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 800;">Withdrawal requested</h1>
                            <p style="margin: 12px 0 0; color: rgba(255, 255, 255, 0.92); font-size: 18px; font-weight: 600;">&#8369;${amount.toLocaleString()}</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; color: #f5f5f5; font-size: 16px; line-height: 1.6;">Hi ${creatorName},</p>
                            <p style="margin: 0 0 28px; color: #d4d4d4; font-size: 16px; line-height: 1.6;">
                                We have your request to withdraw <strong style="color:#f5f5f5;">&#8369;${amount.toLocaleString()}</strong>. Here is exactly what happens next, so nothing catches you by surprise.
                            </p>

                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 28px;">
                                <tr>
                                    <td style="padding: 0 0 18px;">
                                        <p style="margin: 0 0 4px; color: #E4B05E; font-size: 13px; font-weight: 700; letter-spacing: 0.4px;">STEP 1</p>
                                        <p style="margin: 0; color: #d4d4d4; font-size: 15px; line-height: 1.6;">We send your money to your Wise account at <strong style="color:#f5f5f5;">${wiseEmail}</strong>.</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 0 0 18px;">
                                        <p style="margin: 0 0 4px; color: #E4B05E; font-size: 13px; font-weight: 700; letter-spacing: 0.4px;">STEP 2</p>
                                        <p style="margin: 0; color: #d4d4d4; font-size: 15px; line-height: 1.6;">Wise emails you directly. ${senderLine}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 0 0 18px;">
                                        <p style="margin: 0 0 4px; color: #E4B05E; font-size: 13px; font-weight: 700; letter-spacing: 0.4px;">STEP 3</p>
                                        <p style="margin: 0; color: #d4d4d4; font-size: 15px; line-height: 1.6;"><strong style="color:#f5f5f5;">If you already have a verified Wise account on that email</strong>, the money lands in your Wise balance, usually within minutes. Nothing for you to do.</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <p style="margin: 0 0 4px; color: #E4B05E; font-size: 13px; font-weight: 700; letter-spacing: 0.4px;">STEP 4</p>
                                        <p style="margin: 0; color: #d4d4d4; font-size: 15px; line-height: 1.6;"><strong style="color:#f5f5f5;">If you do not have a Wise account yet</strong>, that email has a link to claim your money. Wise is free, but you will need to sign up and verify your ID first.</p>
                                    </td>
                                </tr>
                            </table>

                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 28px;">
                                <tr>
                                    <td style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 20px 24px;">
                                        <h2 style="margin: 0 0 8px; color: #78350f; font-size: 16px; font-weight: 800;">You have 7 days to claim it</h2>
                                        <p style="margin: 0 0 10px; color: #78350f; font-size: 14px; line-height: 1.6;">
                                            If the payment is not claimed within 7 days, Wise cancels it and the money comes straight back to your Tendso balance. Nothing is lost, but you would have to withdraw again and wait all over.
                                        </p>
                                        <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.6;">
                                            Your Wise account must use <strong>${wiseEmail}</strong>. A different address means the payment cannot reach you.
                                        </p>
                                    </td>
                                </tr>
                            </table>

                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #111111; border: 1px solid #262626; border-radius: 12px; margin: 0 0 28px;">
                                <tr>
                                    <td style="padding: 16px 20px; ${reference ? 'border-bottom: 1px solid #262626;' : ''}">
                                        <p style="margin: 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Requested</p>
                                        <p style="margin: 4px 0 0; color: #f5f5f5; font-size: 14px;">${requestedDate}</p>
                                    </td>
                                </tr>
                                ${reference ? `
                                <tr>
                                    <td style="padding: 16px 20px;">
                                        <p style="margin: 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Reference</p>
                                        <p style="margin: 4px 0 0; color: #f5f5f5; font-size: 13px; font-family: monospace;">${reference}</p>
                                    </td>
                                </tr>` : ''}
                            </table>

                            <p style="margin: 0; color: #a3a3a3; font-size: 14px; line-height: 1.6;">
                                We will email you again as soon as the status changes. Something not right? Just reply to this email.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background: #0a0a0a; padding: 24px 40px; text-align: center; border-top: 1px solid #262626;">
                            <p style="margin: 0; color: #737373; font-size: 12px;">&copy; ${new Date().getFullYear()} Tendso. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
}

/**
 * An admin broadcast, as the creator receives it.
 *
 * `title` and `body` are free text typed by an admin and land in an HTML email,
 * so both are escaped before any interpolation. Paragraph breaks are then
 * rebuilt from the escaped text — an admin writing a blank line between
 * thoughts should not have them collapse into a wall.
 */
export function getAnnouncementEmailHtml(params: {
    name: string
    title: string
    body: string
}): string {
    const name = escapeHtml(params.name)
    const title = escapeHtml(params.title)
    // Escape FIRST, then rebuild paragraphs — the reverse would let typed
    // markup survive into the output.
    const paragraphs = escapeHtml(params.body)
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map(
            (p) =>
                `<p style="margin: 0 0 16px; color: #d4d4d4; font-size: 16px; line-height: 1.7;">${p.replace(/\n/g, '<br>')}</p>`
        )
        .join('')
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #f5f5f5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #0a0a0a;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background: #1a1a1a; border-radius: 16px; overflow: hidden; max-width: 600px;">
                    <tr>
                        <td style="background: linear-gradient(135deg, #E4B05E 0%, #E4B05Ecc 100%); padding: 44px 40px; text-align: center;">
                            <p style="margin: 0 0 8px; color: rgba(255,255,255,0.85); font-size: 12px; font-weight: 700; letter-spacing: 1.2px;">TENDSO</p>
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800; line-height: 1.25;">${title}</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; color: #f5f5f5; font-size: 16px; line-height: 1.6;">Hi ${name},</p>
                            ${paragraphs}
                            <p style="margin: 24px 0 0; color: #a3a3a3; font-size: 14px; line-height: 1.6;">
                                Questions? Just reply to this email.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background: #0a0a0a; padding: 24px 40px; text-align: center; border-top: 1px solid #262626;">
                            <p style="margin: 0; color: #737373; font-size: 12px;">&copy; ${new Date().getFullYear()} Tendso. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
}

// ==================== FIELD AGENT CALL (10-minute booking) ====================
//
// The three emails the /field-agent/book flow sends. Built to match the booking
// page itself — ink header, one word in gold, paper body — so the email and the
// page a person lands on read as the same product.
//
// EVERY LAYOUT DECISION HERE IS ABOUT EMAIL CLIENTS, not taste: tables rather
// than flex, inline styles rather than classes, and buttons that are padded
// anchors, because Outlook ignores most of what a browser would honour.

/** Shared frame, so the three cannot drift apart. */
function callEmailShell(params: {
    title: string
    heading: string
    /** The word inside `heading` to paint gold. Left plain if not found. */
    goldWord?: string
    lede?: string
    body: string
}): string {
    const heading = params.goldWord
        ? params.heading.replace(
              params.goldWord,
              `<span style="color: #D4A146;">${params.goldWord}</span>`,
          )
        : params.heading
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(params.title)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #1B1B22;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #1B1B22;">
        <tr>
            <td align="center" style="padding: 32px 16px;">
                <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; width: 100%;">
                    <tr>
                        <td style="padding: 24px 32px 32px;">
                            <span style="display: inline-block; background: #D4A146; color: #1B1B22; font-size: 12px; font-weight: 700; letter-spacing: .12em; padding: 7px 14px; border-radius: 999px;">TENDSO</span>
                            <h1 style="margin: 24px 0 0; color: #F3F0EA; font-size: 32px; line-height: 1.15; font-weight: 800; letter-spacing: -.02em;">${heading}</h1>
                            ${params.lede ? `<p style="margin: 10px 0 0; color: #F3F0EA; font-size: 18px; font-weight: 600;">${escapeHtml(params.lede)}</p>` : ''}
                        </td>
                    </tr>
                    <tr>
                        <td style="background: #F3F0EA; border-radius: 20px; padding: 28px 32px 32px; color: #1B1B22;">
                            ${params.body}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 32px 0; color: #8F8B83; font-size: 12px; line-height: 1.6;">
                            Tendso · This call is 10 minutes, on Google Meet, Philippine time.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
}

/** A padded anchor, which is as close to a button as email gets. */
function callEmailButton(href: string, label: string, variant: 'solid' | 'outline'): string {
    const style =
        variant === 'solid'
            ? 'background: #1B1B22; color: #F3F0EA; border: 1px solid #1B1B22;'
            : 'background: #FFFFFF; color: #1B1B22; border: 1px solid #D8D4CC;'
    return `<a href="${href}" style="display: inline-block; ${style} text-decoration: none; font-size: 15px; font-weight: 700; padding: 13px 22px; border-radius: 999px; margin: 0 6px 10px 0;">${escapeHtml(label)}</a>`
}

/** Confirmation, sent the moment a call is booked. */
export function getCallBookedEmailHtml(params: {
    firstName: string
    dayLabel: string
    timeLabel: string
    meetUrl?: string | null
    manageUrl?: string | null
}): string {
    const firstName = escapeHtml(params.firstName)
    const body = `
        <p style="margin: 0 0 18px; font-size: 16px; line-height: 1.55;">Hi ${firstName}, you're booked. We'll send a reminder before the call.</p>
        ${
            params.meetUrl
                ? `<p style="margin: 0 0 22px; font-size: 15px; line-height: 1.55;">Your Google Meet link:<br><a href="${params.meetUrl}" style="color: #5C3A0F; font-weight: 600;">${escapeHtml(params.meetUrl)}</a></p>`
                : `<p style="margin: 0 0 22px; font-size: 15px; line-height: 1.55;">We'll send your Google Meet link shortly.</p>`
        }
        ${
            params.manageUrl
                ? `<p style="margin: 0 0 14px; font-size: 15px; font-weight: 600;">Need a different time?</p>
                   ${callEmailButton(params.manageUrl, 'Reschedule', 'solid')}
                   ${callEmailButton(`${params.manageUrl}&action=cancel`, 'Cancel', 'outline')}
                   <p style="margin: 8px 0 0; font-size: 13px; color: #8F8B83; line-height: 1.55;">Rescheduling keeps the same Meet link, so anything you've already saved keeps working.</p>`
                : `<p style="margin: 0; font-size: 15px;">If you can no longer make it, just reply CANCEL to this email.</p>`
        }`
    return callEmailShell({
        title: 'Your call is booked',
        heading: `You're booked for ${params.timeLabel}`,
        goldWord: params.timeLabel,
        lede: params.dayLabel,
        body,
    })
}

/** Sent after a self-serve reschedule. */
export function getCallMovedEmailHtml(params: {
    firstName: string
    dayLabel: string
    timeLabel: string
    meetUrl?: string | null
    manageUrl?: string | null
}): string {
    const firstName = escapeHtml(params.firstName)
    const body = `
        <p style="margin: 0 0 18px; font-size: 16px; line-height: 1.55;">Hi ${firstName}, your call has been moved.</p>
        ${
            params.meetUrl
                ? `<p style="margin: 0 0 22px; font-size: 15px; line-height: 1.55;"><strong>Your Google Meet link is unchanged</strong>, so the one you already have still works:<br><a href="${params.meetUrl}" style="color: #5C3A0F; font-weight: 600;">${escapeHtml(params.meetUrl)}</a></p>`
                : ''
        }
        <p style="margin: 0 0 14px; font-size: 15px; color: #8F8B83; line-height: 1.55;">If your own calendar still shows the old time, add the new one.</p>
        ${params.manageUrl ? callEmailButton(params.manageUrl, 'Change it again', 'outline') : ''}`
    return callEmailShell({
        title: 'Your call has moved',
        heading: `Moved to ${params.timeLabel}`,
        goldWord: params.timeLabel,
        lede: params.dayLabel,
        body,
    })
}

/** Sent after a self-serve cancellation. */
export function getCallCancelledEmailHtml(params: {
    firstName: string
    dayLabel: string
    timeLabel: string
    bookUrl: string
}): string {
    const firstName = escapeHtml(params.firstName)
    const body = `
        <p style="margin: 0 0 18px; font-size: 16px; line-height: 1.55;">Hi ${firstName}, your ${escapeHtml(params.timeLabel)} call on ${escapeHtml(params.dayLabel)} is cancelled, and that time is open again.</p>
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.55;">Changed your mind? You can book another any time.</p>
        ${callEmailButton(params.bookUrl, 'Book another time', 'solid')}`
    return callEmailShell({
        title: 'Your call is cancelled',
        heading: 'Your call is cancelled',
        goldWord: 'cancelled',
        body,
    })
}
