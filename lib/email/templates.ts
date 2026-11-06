/** Pure email renderers. Sending and payment-state changes live in the service/backend. */
import { getPaymentConfig } from '../payment/config'
import { creatorDiscount, domainAddOnFor, formatPHP, type CreatorDiscount } from '../pricing'
import { escapeHtml } from './escape'
import { EMAIL_COLORS, emailActions, emailDetails, emailFeature, emailFrame, emailPanel, emailParagraph, emailSchedule, emailSteps, emailTextLink } from './design'
import { getGiveawayLiveEmailHtml, getGiveawayReceivedEmailHtml } from './giveawayTemplates'
export { getGiveawayApprovedEmailHtml, getGiveawayRejectedEmailHtml } from './giveawayTemplates'

const paymentConfig = getPaymentConfig()
/** Optional presentation overrides let local previews use fictional payment details. */
export interface EmailPaymentDetails {
    accountName?: string
    accountNumber?: string
    bankName?: string
    wiseEmail?: string
}
function supportEmail(override?: string) { return override || paymentConfig.wiseEmail || 'frmwrkd.media@gmail.com' }
function hello(name: string) { return emailParagraph(`Hi <strong>${escapeHtml(name)}</strong>,`) }
function heading(text: string) { return `<h2 style="margin:26px 0 14px;font-size:20px;line-height:1.3;font-weight:500;letter-spacing:-0.4px;color:${EMAIL_COLORS.ink};">${escapeHtml(text)}</h2>` }
function dateLabel(value: number, time = false) {
    return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', ...(time ? { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' } as const : {}) }) + (time ? ' (Philippine time)' : '')
}
function websiteSplit(amount: number, customDomain: string, domainCostPHP: number | undefined, websiteListPrice: number | undefined, domainChargedPHP?: number) {
    const domainLine = domainAddOnFor(customDomain ? 'with_custom_domain' : 'standard', domainCostPHP, domainChargedPHP)
    const websiteLine = customDomain ? amount - domainLine : amount
    return { domainLine, websiteLine, discount: creatorDiscount(websiteLine, websiteListPrice) }
}
function struckPriceHtml(amount: number, style = '', color: string = EMAIL_COLORS.muted) {
    return `<span style="text-decoration:line-through;color:${color};${style}">${formatPHP(amount)}</span>`
}
function percentOffHtml(discount: CreatorDiscount, color: string = EMAIL_COLORS.ink) { return `<span style="color:${color};font-weight:500;">${discount.percentOff}% off</span>` }
function amountFeature(label: string, amount: number, discount: CreatorDiscount | null = null, tone: 'ink' | 'accent' | 'quiet' | 'white' = 'white') {
    return emailFeature({ label, value: formatPHP(amount), tone,
        detailHtml: discount ? `${struckPriceHtml(discount.listPrice, 'margin-right:8px;', tone === 'ink' ? '#D0D4C8' : EMAIL_COLORS.muted)} ${percentOffHtml(discount, tone === 'ink' ? EMAIL_COLORS.white : EMAIL_COLORS.ink)}` : undefined,
    })
}
function orderBreakdown(domain: string, domainLine: number, websiteLine: number, discount: CreatorDiscount | null) {
    return heading('Your order') + emailDetails([
        { label: 'Website package', valueHtml: (discount ? struckPriceHtml(discount.listPrice, 'font-weight:400;margin-right:8px;') : '') + formatPHP(websiteLine) + (discount ? `<br>${percentOffHtml(discount)}` : '') },
        { label: `Custom domain: ${domain}`, valueHtml: formatPHP(domainLine) },
    ])
}
function bankDetails(details?: EmailPaymentDetails) {
    return heading('Send your payment to') + emailDetails([
        { label: 'Account holder name', valueHtml: escapeHtml(details?.accountName ?? 'VONAS, OPC') },
        { label: 'Account number', valueHtml: escapeHtml(details?.accountNumber ?? '2006436346') },
        { label: 'Bank', valueHtml: escapeHtml(details?.bankName ?? 'Wise Pilipinas Inc. (via InstaPay)') },
    ]) + emailParagraph('Pay from GCash, Maya, BDO, BPI, UnionBank, Metrobank, Landbank, or your bank app. Choose <strong>Send via InstaPay</strong> and enter the details above.')
}
function referencePanel(reference: string) {
    return emailFeature({ label: 'Include your reference', value: reference, size: 'medium', tone: 'accent',
        detailHtml: 'Put this in the <strong>Reference</strong>, <strong>Note</strong>, or <strong>Message</strong> field so we can match your transfer. A transfer without a matching reference needs team verification.',
    })
}
function editsNote() { return emailParagraph(`<strong>Free edits for your first year.</strong> Tell us what you want changed and we will make it for you — ${emailTextLink('https://www.tendso.com/contact', 'contact us')}.`) }
function domainNote(domain: string) {
    return heading('Your custom domain') + emailParagraph(`<strong>${escapeHtml(domain)}</strong>: the first year is included. After year 1, renewal is approximately ₱1,120/year and is your responsibility. We do not auto-renew. Reply if you would like help renewing it.`)
}

export function getPaymentConfirmationEmailHtml(params: {
    businessName: string; businessOwnerName: string; websiteUrl: string; amount: number; wiseEmail?: string; customDomain?: string
}): string {
    return emailFrame({ variant: 'success', status: 'Payment confirmed', title: `Payment confirmed — ${params.businessName}`, eyebrow: 'Payment received', heading: 'Your site is live.', supportEmail: supportEmail(params.wiseEmail),
        recipientName: params.businessOwnerName, friendly: true,
        introHtml: emailParagraph(`We have received and confirmed your payment for <strong>${escapeHtml(params.businessName)}</strong>. Your website is now published and live.`),
        heroHtml: amountFeature('Amount paid', params.amount), heroActions: [{ href: params.websiteUrl, label: 'Visit my website', primary: true }],
        bodyHtml: hello(params.businessOwnerName) + emailDetails([{ label: 'Business', valueHtml: escapeHtml(params.businessName) }])
            + (params.customDomain ? emailPanel(emailParagraph(`<strong>Custom domain: ${escapeHtml(params.customDomain)}</strong>`)
                + emailParagraph('Your custom domain is being configured. We will email you when it is live. You can use your Tendso website address in the meantime.')) : '')
            + emailParagraph(emailTextLink(params.websiteUrl)) + editsNote(),
    })
}

export function getPromoWebsiteLiveEmailHtml(params: {
    businessName: string; businessOwnerName: string; websiteUrl: string; creatorName?: string; platformEmail?: string; giveawayApplication?: boolean
}): string {
    if (params.giveawayApplication === true) return getGiveawayLiveEmailHtml(params)
    return emailFrame({ variant: 'success', status: 'Free website', title: `${params.businessName} is live — free`, eyebrow: 'A website for your business', heading: 'Your site is live.', supportEmail: supportEmail(params.platformEmail),
        recipientName: params.businessOwnerName, friendly: true,
        introHtml: emailParagraph(`${params.creatorName ? `<strong>${escapeHtml(params.creatorName)}</strong> chose` : 'We chose'} <strong>${escapeHtml(params.businessName)}</strong> for a free website under our current promo.`),
        heroHtml: emailFeature({ label: 'A gift for your business', value: 'Nothing to pay.', tone: 'white', detailHtml: 'There is nothing for you to pay. No invoice, no payment link, and no card on file.' }),
        heroActions: [{ href: params.websiteUrl, label: 'Visit my website', primary: true }],
        bodyHtml: hello(params.businessOwnerName) + emailParagraph(emailTextLink(params.websiteUrl))
            + emailParagraph('Share the link with your customers so they can find your business online.') + editsNote(),
    })
}

export function getPaymentLinkEmailHtml(params: {
    businessName: string; businessOwnerName: string; amount: number; websiteUrl?: string; referenceCode: string; platformEmail?: string
    customDomain?: string; domainCostPHP?: number; domainChargedPHP?: number; websiteListPrice?: number
    /** Claim the business in the owner account; website changes still go through Tendso. */
    editMyWebsiteUrl?: string
    paymentDetails?: EmailPaymentDetails
}): string {
    const { domainLine, websiteLine, discount } = websiteSplit(params.amount, params.customDomain ?? '', params.domainCostPHP, params.websiteListPrice, params.domainChargedPHP)
    const breakdown = params.customDomain ? orderBreakdown(params.customDomain, domainLine, websiteLine, discount) : ''
    return emailFrame({ variant: 'payment', status: 'Payment due', title: `Payment instructions — ${params.businessName}`, eyebrow: 'Your website', heading: 'Your payment details.', supportEmail: supportEmail(params.paymentDetails?.wiseEmail ?? params.platformEmail),
        recipientName: params.businessOwnerName,
        introHtml: emailParagraph(`The website for <strong>${escapeHtml(params.businessName)}</strong> is ready. Here are the payment details for your order.`),
        heroHtml: amountFeature('Total amount to pay', params.amount, params.customDomain ? null : discount),
        heroActions: [...(params.websiteUrl ? [{ href: params.websiteUrl, label: 'See my website', primary: true }] : []), ...(params.editMyWebsiteUrl ? [{ href: params.editMyWebsiteUrl, label: 'Manage my business', primary: !params.websiteUrl }] : [])],
        bodyHtml: hello(params.businessOwnerName) + breakdown
            + bankDetails(params.paymentDetails) + referencePanel(params.referenceCode)
            + emailParagraph('Check the bank, account number, amount and reference before sending. Keep your payment confirmation; reply to this email if you need help matching your transfer.')
            + (params.customDomain ? domainNote(params.customDomain) : '') + editsNote(),
    })
}

export function getApprovalEmailHtml(params: {
    businessName: string; businessOwnerName: string; websiteUrl: string; amount: number; submissionId: string; paymentReference?: string; paymentDetails?: EmailPaymentDetails
}): string {
    const reference = params.paymentReference || params.submissionId.substring(0, 8).toUpperCase()
    // Preserve the legal Wise payee name; changing the visual brand must not change payment routing.
    const accountName = params.paymentDetails?.accountName ?? process.env.WISE_ACCOUNT_NAME ?? 'Negosyo Digital'
    const address = supportEmail(params.paymentDetails?.wiseEmail)
    return emailFrame({ variant: 'payment', status: 'Ready to review', title: `Your website is ready — ${params.businessName}`, eyebrow: 'Ready to review', heading: 'Your website is ready.', supportEmail: address,
        recipientName: params.businessOwnerName, introHtml: emailParagraph(`Take a look at the website for <strong>${escapeHtml(params.businessName)}</strong>.`),
        heroHtml: amountFeature('Amount due', params.amount), heroActions: [{ href: params.websiteUrl, label: 'View my website', primary: true }],
        bodyHtml: hello(params.businessOwnerName) + emailDetails([
                { label: 'Account name', valueHtml: escapeHtml(accountName) }, { label: 'Email / ID', valueHtml: escapeHtml(address) },
                { label: 'Currency', valueHtml: 'PHP (Philippine Peso)' },
            ]) + referencePanel(reference)
            + emailPanel(emailParagraph('<strong>Action required within 3 days.</strong> This website preview is taken offline if payment is not received within 3 days of this email.'), 'warning')
            + heading('What happens next') + emailParagraph('Send payment via Wise using the details above. Reply with your payment confirmation screenshot. We will verify the payment and activate your website.'),
    })
}

export function getDomainLiveEmailHtml(params: {
    businessName: string; businessOwnerName: string; customDomain: string; expiresAt: number; platformEmail?: string
}): string {
    return emailFrame({ variant: 'success', status: 'Domain connected', title: `${params.customDomain} is live`, eyebrow: 'Custom domain', heading: 'Your address is live.', supportEmail: supportEmail(params.platformEmail),
        recipientName: params.businessOwnerName, friendly: true,
        introHtml: emailParagraph(`The custom domain for <strong>${escapeHtml(params.businessName)}</strong> is now registered and connected.`),
        heroHtml: emailFeature({ label: 'Your website address', value: params.customDomain, size: 'medium', tone: 'white', detailHtml: `Connected to ${escapeHtml(params.businessName)}` }),
        heroActions: [{ href: `https://${params.customDomain}`, label: 'Open my website', primary: true }],
        bodyHtml: hello(params.businessOwnerName) + emailDetails([{ label: 'Expires', valueHtml: dateLabel(params.expiresAt) }])
            + domainNote(params.customDomain)
            + emailParagraph('We will send a reminder 30 days before expiry. You can renew through your registrar, transfer the domain to your own account, or reply to ask our team for help.'),
    })
}

export function getWithdrawalStatusEmailHtml(params: {
    creatorName: string; creatorEmail: string; amount: number; statusLabel: string; statusDescription: string; isFinal: boolean; referenceCode?: string; submittedAt: number; platformEmail?: string
}): string {
    const confirmedSuccess = params.isFinal && /^(completed|complete|paid|sent|successful)$/i.test(params.statusLabel.trim())
    return emailFrame({ variant: confirmedSuccess ? 'success' : params.isFinal ? 'standard' : 'payment', status: params.statusLabel, title: `Withdrawal update — ${params.statusLabel}`, eyebrow: 'Your payout', heading: 'Your payout update.', supportEmail: supportEmail(params.platformEmail),
        recipientName: params.creatorName, friendly: confirmedSuccess,
        introHtml: emailParagraph('Here is the latest update on your withdrawal request.'),
        heroHtml: emailFeature({ label: params.statusLabel, value: formatPHP(params.amount), tone: 'white', detailHtml: escapeHtml(params.statusDescription) }),
        bodyHtml: hello(params.creatorName) + emailDetails([{ label: 'Payment method', valueHtml: 'Wise transfer' }, { label: 'Submitted', valueHtml: dateLabel(params.submittedAt, true) },
                ...(params.referenceCode ? [{ label: 'Wise reference', valueHtml: escapeHtml(params.referenceCode) }] : []),
            ]) + (params.isFinal ? emailParagraph('If you have a question about this update, reply to this email.')
                : emailParagraph('We will send another update when the status changes. Transfer timing depends on Wise verification and the recipient bank.')),
    })
}

export function getDomainSetupInProgressEmailHtml(params: {
    businessName: string; businessOwnerName: string; customDomain: string; platformEmail?: string
}): string {
    return emailFrame({ variant: 'standard', status: 'SSL being issued', title: `Setting up ${params.customDomain}`, eyebrow: 'Custom domain', heading: 'Your domain is being set up.', supportEmail: supportEmail(params.platformEmail),
        recipientName: params.businessOwnerName,
        introHtml: emailParagraph(`We have registered <strong>${escapeHtml(params.customDomain)}</strong> for <strong>${escapeHtml(params.businessName)}</strong> and pointed it to our servers.`),
        heroHtml: emailFeature({ label: 'Your custom domain', value: params.customDomain, size: 'medium', tone: 'white', detailHtml: 'Secure connection in progress' }),
        bodyHtml: hello(params.businessOwnerName) + emailSteps([{ label: 'Registered', state: 'done' }, { label: 'DNS configured', state: 'done' }, { label: 'SSL certificate', state: 'current' }, { label: 'Live', state: 'upcoming' }])
            + emailParagraph('Cloudflare is issuing the SSL certificate for secure HTTPS browsing. You do not need to do anything; we will email you when the address is live.')
            + emailParagraph('If the site does not load yet, try again after activation or open it in a private browser window.'),
    })
}

export function getDomainRenewalReminderEmailHtml(params: {
    businessName: string; businessOwnerName: string; customDomain: string; expiresAt: number; platformEmail?: string
}): string {
    const daysRemaining = Math.max(0, Math.floor((params.expiresAt - Date.now()) / (1000 * 60 * 60 * 24)))
    return emailFrame({ variant: 'attention', status: daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Expires soon', title: `Renew ${params.customDomain}`, eyebrow: 'Domain renewal', heading: 'Your domain needs renewal.', supportEmail: supportEmail(params.platformEmail),
        recipientName: params.businessOwnerName,
        introHtml: emailParagraph(`The custom domain for <strong>${escapeHtml(params.businessName)}</strong> is due for renewal.`),
        heroHtml: emailFeature({ label: 'Domain to renew', value: params.customDomain, size: 'medium', tone: 'white', detailHtml: `Expires ${dateLabel(params.expiresAt)}` }),
        bodyHtml: hello(params.businessOwnerName)
            + emailParagraph('The first year of registration was included. Year 2 onwards is your responsibility. We do not auto-renew. If it expires, your website will stop being reachable at this custom address.')
            + heading('How to renew') + emailParagraph(`Visit your registrar, search for <strong>${escapeHtml(params.customDomain)}</strong>, and follow its renewal process. Pay the standard yearly fee (around 500 to 1200 PHP depending on the registrar).`)
            + emailParagraph('You can also reply to ask our team to help renew or transfer the domain. The current registrar price applies.'),
    })
}

export function getPaymentFollowUpEmailHtml(params: {
    businessName: string; businessOwnerName: string; websiteUrl?: string; amount: number; referenceCode?: string; hoursLeft?: number; isManual?: boolean
    customDomain?: string; domainCostPHP?: number; domainChargedPHP?: number; websiteListPrice?: number; fromCreator?: string; paymentDetails?: EmailPaymentDetails
}): string {
    const isManual = (params.isManual ?? false) || !!params.fromCreator
    const hoursLeft = params.hoursLeft ?? 24
    const { domainLine, websiteLine, discount } = websiteSplit(params.amount, params.customDomain ?? '', params.domainCostPHP, params.websiteListPrice, params.domainChargedPHP)
    const intro = params.fromCreator
        ? `<strong>${escapeHtml(params.fromCreator)}</strong>, who made <strong>${escapeHtml(params.businessName)}</strong>'s website with you, asked us to send a reminder.`
        : isManual ? `We are checking in on the website for <strong>${escapeHtml(params.businessName)}</strong>.`
        : `Your website for <strong>${escapeHtml(params.businessName)}</strong> will be taken offline in about <strong>${hoursLeft} hours</strong> if payment is not received.`
    return emailFrame({ variant: isManual ? 'payment' : 'attention', status: isManual ? 'Payment reminder' : `${hoursLeft} hours left`, title: `${isManual ? 'Following up' : 'Final reminder'} — ${params.businessName}`, eyebrow: isManual ? 'Payment reminder' : 'Payment due', heading: params.fromCreator ? `A reminder from ${params.fromCreator}` : isManual ? 'A payment reminder.' : 'Your payment is due.', supportEmail: supportEmail(params.paymentDetails?.wiseEmail),
        recipientName: params.businessOwnerName, introHtml: emailParagraph(intro),
        heroHtml: amountFeature('Amount due', params.amount, params.customDomain ? null : discount),
        heroActions: params.websiteUrl ? [{ href: params.websiteUrl, label: 'View my website', primary: true }] : [],
        bodyHtml: hello(params.businessOwnerName) + (params.customDomain ? orderBreakdown(params.customDomain, domainLine, websiteLine, discount) : '')
            + bankDetails(params.paymentDetails)
            + (params.referenceCode ? referencePanel(params.referenceCode) : '')
            + (!isManual ? emailPanel(emailParagraph(`If payment is not received in about ${hoursLeft} hours, the website is taken offline and its URL stops working. Reply if you need help restarting it.`), 'warning') : '')
            + emailParagraph('Already paid? Keep your confirmation and reply so we can check your transfer. Otherwise, include the reference when sending your payment.'),
    })
}

export function getIntakeReceivedEmailHtml(params: {
    businessName: string; businessOwnerName: string; amount: number; platformEmail?: string; giveawayApplication?: boolean
}): string {
    if (params.giveawayApplication) return getGiveawayReceivedEmailHtml(params)
    return emailFrame({ variant: 'standard', status: 'Building', title: `We got your details — ${params.businessName}`, eyebrow: 'Details received', heading: 'We have your details.', supportEmail: supportEmail(params.platformEmail),
        recipientName: params.businessOwnerName,
        introHtml: emailParagraph(`Everything you sent for <strong>${escapeHtml(params.businessName)}</strong> arrived safely, and we have started building your website.`),
        heroHtml: emailFeature({ label: 'Your business', value: params.businessName, size: 'medium', tone: 'white', detailHtml: 'Building your website' }),
        bodyHtml: hello(params.businessOwnerName) + emailSteps([{ label: 'Details received', state: 'done' }, { label: 'Building', state: 'current' }, { label: 'Your review', state: 'upcoming' }, { label: 'Publish', state: 'upcoming' }])
            + emailParagraph('We will email you when your website is ready to check.')
            + heading('What happens next') + emailParagraph('Our team uses your answers and photos to build the website. Nothing else is needed from you right now.')
            + emailParagraph(`We send a link to your finished website and the payment instructions — ${formatPHP(params.amount)}, payable from the options available at checkout.`)
            + emailParagraph(`<strong>Nothing to pay today.</strong> The price is ${formatPHP(params.amount)} — see it first, then pay once to publish it. No contract.`)
            + emailParagraph('Spotted a mistake in your business name, address, or phone number? Reply to this email so we can correct it.'),
    })
}

export function getWithdrawalRequestedEmailHtml(params: {
    creatorName: string; amount: number; wiseEmail: string; reference?: string; requestedAt: number; wiseSenderName?: string; platformEmail?: string
}): string {
    const sender = params.wiseSenderName
        ? `It will show the sender as <strong>${escapeHtml(params.wiseSenderName)}</strong> — that is our registered company name, so it really is from us.`
        : 'It comes from <strong>noreply@wise.com</strong>, so check your spam folder if you do not see it.'
    return emailFrame({ variant: 'payment', status: 'Requested', title: 'Withdrawal requested', eyebrow: 'Your payout', heading: 'Your cash out is requested.', supportEmail: supportEmail(params.platformEmail),
        recipientName: params.creatorName, introHtml: emailParagraph('We have your withdrawal request. Here is what happens next.'),
        heroHtml: emailFeature({ label: 'Requested amount', value: formatPHP(params.amount), tone: 'white', detailHtml: `To your Wise account at <strong>${escapeHtml(params.wiseEmail)}</strong>` }),
        bodyHtml: hello(params.creatorName) + heading('What happens next') + emailParagraph(`We send the money to Wise. Wise emails you directly. ${sender}`)
            + emailParagraph('If you already have a verified Wise account on that email, the money goes to your Wise balance after processing. If you do not have one yet, the email has a link to claim the money. Sign up and verify your ID first.')
            + emailPanel(heading('You have 7 days to claim it') + emailParagraph('If the payment is not claimed within 7 days, Wise cancels it and the money comes back to your Tendso balance. You would need to withdraw again.')
                + emailParagraph(`Your Wise account must use <strong>${escapeHtml(params.wiseEmail)}</strong>. A different address means the payment cannot reach you.`), 'warning')
            + emailDetails([{ label: 'Requested', valueHtml: dateLabel(params.requestedAt, true) }, ...(params.reference ? [{ label: 'Reference', valueHtml: escapeHtml(params.reference) }] : [])])
            + emailParagraph('We will email you again when the status changes. Something not right? Reply to this email.'),
    })
}

export function getAnnouncementEmailHtml(params: { name: string; title: string; body: string; platformEmail?: string }): string {
    const paragraphs = escapeHtml(params.body).split(/\n\s*\n/).map(part => part.trim()).filter(Boolean).map(part => emailParagraph(part.replace(/\n/g, '<br>')))
    return emailFrame({ variant: 'standard', title: params.title, eyebrow: 'From the Tendso team', heading: params.title, recipientName: params.name, supportEmail: supportEmail(params.platformEmail), introHtml: paragraphs[0] ?? '', bodyHtml: paragraphs.slice(1).join('') })
}

// Booking messages share the same shell and keep Philippine time and all manage links explicit.
interface CallDetails { firstName: string; dayLabel: string; timeLabel: string }
interface ManagedCall extends CallDetails { meetUrl?: string | null; manageUrl?: string | null; calendarUrl?: string | null }
function callSummary(params: CallDetails) {
    return emailSchedule({ day: params.dayLabel, time: params.timeLabel, timezone: 'Philippine time (Asia/Manila)', duration: '10 minutes' })
}
function cancelUrl(url: string) {
    const hashAt = url.indexOf('#')
    const base = hashAt < 0 ? url : url.slice(0, hashAt)
    const hash = hashAt < 0 ? '' : url.slice(hashAt)
    return `${base}${base.includes('?') ? '&' : '?'}action=cancel${hash}`
}
function manageButtons(url?: string | null) {
    return url ? emailActions([{ href: url, label: 'Reschedule' }, { href: cancelUrl(url), label: 'Cancel' }]) : ''
}
interface CallAction { href: string; label: string; primary?: boolean }
function meetingActions(params: ManagedCall): CallAction[] {
    return [
        ...(params.meetUrl ? [{ href: params.meetUrl, label: 'Join Google Meet', primary: true }] : []),
        ...(params.calendarUrl ? [{ href: params.calendarUrl, label: 'Add to calendar', primary: !params.meetUrl }] : []),
    ]
}
function callFrame(title: string, status: string, params: CallDetails, introHtml: string, heroActions: CallAction[], body: string) {
    return emailFrame({ variant: 'booking', status, title, eyebrow: 'Your Tendso call', heading: title, recipientName: params.firstName,
        introHtml, heroHtml: callSummary(params), heroActions,
        bodyHtml: (params.firstName ? hello(params.firstName) : '') + body,
        footerHtml: emailParagraph('This call is 10 minutes, on Google Meet, Philippine time.'),
    })
}
export function getCallBookedEmailHtml(params: ManagedCall): string {
    return callFrame('Your call is booked.', 'Confirmed', params, emailParagraph('You are booked. We will send a reminder before the call.'), meetingActions(params),
        (!params.meetUrl ? emailParagraph('We will send your Google Meet link shortly.') : '')
        + (params.manageUrl ? manageButtons(params.manageUrl) + emailParagraph('Rescheduling keeps the same Meet link, so anything you have already saved keeps working.') : emailParagraph('If you can no longer make it, just reply CANCEL to this email.')))
}
export function getCallMovedEmailHtml(params: ManagedCall): string {
    return callFrame('Your call has moved.', 'Rescheduled', params, emailParagraph('Your call has been moved.'), meetingActions(params),
        (params.meetUrl ? emailParagraph('<strong>Your Google Meet link is unchanged</strong>. The one you already saved still works.') : '')
        + (params.calendarUrl ? emailParagraph('If your calendar still shows the old time, use Add to calendar to replace it.') : '')
        + manageButtons(params.manageUrl))
}
export function getCallReminderEmailHtml(params: CallDetails & {
    kind: 'early' | 'soon'; whenWord: string; meetUrl?: string | null; manage?: { kind: 'tendso'; url: string } | { kind: 'external'; url: string } | null
}): string {
    const intro = params.kind === 'soon' ? 'Your 10-minute call with Tendso is coming up. There is nothing to prepare — just be somewhere with a steady connection.' : 'A quick reminder about your 10-minute call with Tendso.'
    const manage = params.manage?.kind === 'tendso' ? manageButtons(params.manage.url) + emailParagraph('Cancelling frees the time for someone else, and rescheduling keeps the same Meet link.')
        : params.manage?.kind === 'external' ? emailActions([{ href: params.manage.url, label: 'Reschedule or cancel' }]) + emailParagraph('Cancelling frees the time for someone else.')
        : emailParagraph('If you can no longer make it, just reply CANCEL to this email.')
    return callFrame('Your call is coming up.', params.whenWord, params, emailParagraph(intro),
        params.meetUrl && params.kind === 'soon' ? [{ href: params.meetUrl, label: 'Join Google Meet', primary: true }] : [],
        (params.meetUrl && params.kind === 'early' ? emailParagraph(`Your Google Meet link: ${emailTextLink(params.meetUrl)}`) : '') + manage)
}
export function getCallCancelledEmailHtml(params: CallDetails & { bookUrl: string }): string {
    return callFrame('Your call is cancelled.', 'Cancelled', params, emailParagraph('Your call is cancelled, and that time is open again.'),
        [{ href: params.bookUrl, label: 'Book another time', primary: true }], emailParagraph('Changed your mind? You can book another time.'))
}
export function getCallOutOfHoursEmailHtml(params: CallDetails & { bookUrl: string }): string {
    return callFrame('We have cancelled your call.', 'Cancelled', params,
        emailParagraph('Sorry, this one is on us. An old booking link offered times we do not work. We have cancelled the call rather than leave you waiting.'),
        [{ href: params.bookUrl, label: 'Pick a new time', primary: true }],
        emailParagraph('We would still like to have the call. The current booking page shows Monday to Friday, 10am to 2pm and 8pm to midnight, Philippine time.')
        + emailParagraph('You do not need to cancel anything; we have already cleared it. If none of those hours work, reply to this email.'))
}
