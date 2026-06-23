/**
 * Email HTML template generators (extracted for reuse in preview).
 * These functions return raw HTML strings without sending any email.
 */

import { getPaymentConfig } from '@/lib/payment/config'
import { CUSTOM_DOMAIN_ADDON, formatPHP } from '@/lib/pricing'

const paymentConfig = getPaymentConfig()

export function getPaymentConfirmationEmailHtml(params: {
    businessName: string
    businessOwnerName: string
    websiteUrl: string
    amount: number
    wiseEmail?: string
    customDomain?: string // If set, shows "domain being configured" notice
}): string {
    const { businessName, businessOwnerName, websiteUrl, amount, wiseEmail: customWiseEmail, customDomain } = params
    
    const wiseEmail = customWiseEmail || paymentConfig.wiseEmail || 'frmwrkd.media@gmail.com'

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
                                <span style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:1px;">NEGOSYO DIGITAL</span>
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
                                Thank you for choosing Tendso! Your business is now online and accessible to everyone. If you need any changes or support, don't hesitate to reach out.
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

export function getPaymentLinkEmailHtml(params: {
    businessName: string
    businessOwnerName: string
    amount: number
    paymentLink: string
    referenceCode: string
    platformEmail?: string
    customDomain?: string
    editMyWebsiteUrl?: string // Owner-portal claim link
}): string {
    const { businessName, businessOwnerName, amount, referenceCode, platformEmail, customDomain, editMyWebsiteUrl } = params
    const wiseEmail = platformEmail || paymentConfig.wiseEmail || 'frmwrkd.media@gmail.com'

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
                                                            <td align="right" style="font-size:14px;color:#111827;font-weight:700;">${formatPHP(amount - CUSTOM_DOMAIN_ADDON)}</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding:12px 16px;">
                                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                                        <tr>
                                                            <td style="font-size:14px;color:#374151;">Custom Domain: <strong style="color:#C89548;">${customDomain}</strong></td>
                                                            <td align="right" style="font-size:14px;color:#111827;font-weight:700;">${formatPHP(CUSTOM_DOMAIN_ADDON)}</td>
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
                    ${editMyWebsiteUrl ? `
                    <!-- Edit my website (owner portal claim link) -->
                    <tr>
                        <td style="padding:8px 40px 24px;text-align:center;">
                            <p style="margin:0 0 12px;font-size:14px;color:#374151;">Want to update your text, photos, or details yourself?</p>
                            <a href="${editMyWebsiteUrl}" style="display:inline-block;padding:12px 28px;background:#ffffff;border:2px solid #E4B05E;color:#92400e;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">✏️ Edit my website</a>
                            <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;">Signs you in with this email — no password needed.</p>
                        </td>
                    </tr>
                    ` : ''}
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
    const { businessName, businessOwnerName, websiteUrl, amount, submissionId } = params

    const wiseEmail = paymentConfig.wiseEmail || 'frmwrkd.media@gmail.com'
    // INTENTIONAL: the default stays 'Negosyo Digital' because this is the
    // LEGAL ACCOUNT NAME registered on Wise (the payment processor). Customers
    // see this string in payment-instruction emails and must match it exactly
    // when sending money — Wise will reject mismatched payee names. Flip this
    // to 'Tendso' (or set the WISE_ACCOUNT_NAME env var) ONLY after the Wise
    // account itself has been renamed to Tendso. See the 2026 rebrand doc.
    const wiseAccountName = process.env.WISE_ACCOUNT_NAME || 'Negosyo Digital'
    // Use the auto-generated payment reference code, or fallback to old format
    const reference = params.paymentReference || submissionId.substring(0, 8).toUpperCase()

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
                                <span style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:1px;">NEGOSYO DIGITAL</span>
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
    const { businessName, businessOwnerName, customDomain, expiresAt } = params
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
    const { creatorName, amount, statusLabel, statusDescription, isFinal, referenceCode, submittedAt } = params
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
    const { businessName, businessOwnerName, customDomain } = params
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
    const { businessName, businessOwnerName, customDomain, expiresAt } = params
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
        businessName,
        businessOwnerName,
        websiteUrl,
        amount,
        referenceCode,
        hoursLeft = 24,
        isManual = false,
    } = params

    const wiseEmail = paymentConfig.wiseEmail || 'frmwrkd.media@gmail.com'
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
