/** Fictional, local design-review fixtures. Pure rendering only: no mail transport or account reads. */
import {
    getAnnouncementEmailHtml, getApprovalEmailHtml, getCallBookedEmailHtml, getCallCancelledEmailHtml,
    getCallMovedEmailHtml, getCallOutOfHoursEmailHtml, getCallReminderEmailHtml, getDomainLiveEmailHtml,
    getDomainRenewalReminderEmailHtml, getDomainSetupInProgressEmailHtml, getIntakeReceivedEmailHtml,
    getPaymentConfirmationEmailHtml, getPaymentFollowUpEmailHtml, getPaymentLinkEmailHtml,
    getPromoWebsiteLiveEmailHtml, getWithdrawalRequestedEmailHtml, getWithdrawalStatusEmailHtml,
} from './templates';
import { ownerBuildingEmail, ownerInviteEmail, ownerPreviewReadyEmail, ownerSiteLiveEmail } from './ownerV2Templates';
import { getGiveawayApprovedEmailHtml, getGiveawayLiveEmailHtml, getGiveawayReceivedEmailHtml, getGiveawayRejectedEmailHtml } from './giveawayTemplates';

export type EmailPreviewCategory = 'Owner journey' | 'Payments & websites' | 'Calls & bookings' | 'Off the Record';
export interface EmailPreviewVariant { id: string; label: string; html: string }
export interface EmailPreviewFamily {
    id: string;
    category: EmailPreviewCategory;
    label: string;
    description: string;
    subject: string;
    renderer: string;
    variants: EmailPreviewVariant[];
}

const contact = { platformEmail: 'support@example.com' };
const business = { businessName: 'Luna Corner Store', businessOwnerName: 'Alex Rivera' };
const owner = { businessName: business.businessName, ownerName: business.businessOwnerName };
const websiteUrl = 'https://luna.example.com';
const appUrl = 'https://example.com/my-business/sample-business';
const paymentDetails = {
    accountName: 'Example Business — sample only', accountNumber: '0000000000',
    bankName: 'Example Bank — sample only', wiseEmail: 'payments@example.com',
};
const quote = { ...business, ...contact, amount: 3499, websiteListPrice: 4999,
    websiteUrl, referenceCode: 'SAMPLE-ONLY', paymentDetails };
const call = {
    firstName: 'Alex', dayLabel: 'Thursday, November 12, 2026', timeLabel: '10:30 AM',
    meetUrl: 'https://example.com/sample-call', manageUrl: 'https://example.com/sample-booking?sample=1',
    calendarUrl: 'https://example.com/sample-calendar', ...contact,
};
const withdrawal = {
    creatorName: 'Alex Rivera', creatorEmail: 'alex@example.com', amount: 3750,
    referenceCode: 'SAMPLE-ONLY', submittedAt: Date.UTC(2026, 10, 5, 2, 30), ...contact,
};

function family(
    id: string, category: EmailPreviewCategory, label: string, description: string,
    renderer: string, subject: string, html: string, extras: EmailPreviewVariant[] = [],
): EmailPreviewFamily {
    return { id, category, label, description, renderer, subject,
        variants: [{ id: 'default', label: 'Default', html }, ...extras] };
}

/** Render the same exports used by transactional sends. Every destination and person is fictional. */
export function getEmailPreviewSamples(): EmailPreviewFamily[] {
    const invite = ownerInviteEmail({ ...owner, email: 'alex@example.com', appUrl });
    const building = ownerBuildingEmail({ ...owner, appUrl });
    const preview = ownerPreviewReadyEmail({ ...owner, appUrl, priceText: '₱3,499' });
    const live = ownerSiteLiveEmail({ ...owner, websiteUrl });
    return [
        family('owner-invite', 'Owner journey', 'Business invitation', 'A field agent has added the owner’s business.',
            'ownerInviteEmail', invite.subject, invite.html),
        family('owner-building', 'Owner journey', 'Website building', 'The owner has sent their photos and interview.',
            'ownerBuildingEmail', building.subject, building.html),
        family('owner-preview', 'Owner journey', 'Private preview ready', 'Review the finished site before approving payment.',
            'ownerPreviewReadyEmail', preview.subject, preview.html),
        family('owner-live', 'Owner journey', 'Website live', 'Publication confirmation, including the optional balance state.',
            'ownerSiteLiveEmail', live.subject, live.html, [
                { id: 'balance', label: 'Balance remaining', html: ownerSiteLiveEmail({ ...owner, websiteUrl, balanceText: '₱2,999' }).html },
            ]),

        family('payment-link', 'Payments & websites', 'Payment request', 'The existing payment-link email with a creator discount.',
            'getPaymentLinkEmailHtml', 'Your website payment', getPaymentLinkEmailHtml(quote), [
                { id: 'domain', label: 'With a domain', html: getPaymentLinkEmailHtml({ ...quote, amount: 3999, customDomain: 'luna.example.com', domainCostPHP: 500, domainChargedPHP: 500 }) },
            ]),
        family('legacy-approval', 'Payments & websites', 'Legacy approval', 'The legacy approval renderer, preserved for its existing send path.',
            'getApprovalEmailHtml', 'Your website is ready', getApprovalEmailHtml({ ...business, ...contact, websiteUrl, amount: 3499, submissionId: 'sample-business', paymentReference: 'SAMPLE-ONLY', paymentDetails })),
        family('payment-confirmed', 'Payments & websites', 'Payment confirmation', 'Receipt and website details after confirmed payment.',
            'getPaymentConfirmationEmailHtml', 'Payment confirmed', getPaymentConfirmationEmailHtml({ ...business, ...contact, websiteUrl, amount: 3499, wiseEmail: 'payments@example.com' })),
        family('gift-live', 'Payments & websites', 'Gifted website live', 'An ordinary gifted website, distinct from the OTR giveaway.',
            'getPromoWebsiteLiveEmailHtml', 'Your gifted website is live', getPromoWebsiteLiveEmailHtml({ ...business, ...contact, websiteUrl, creatorName: 'Sam Cruz' })),
        family('domain-live', 'Payments & websites', 'Custom domain live', 'The connected custom address and renewal date.',
            'getDomainLiveEmailHtml', 'Your custom domain is live', getDomainLiveEmailHtml({ ...business, ...contact, customDomain: 'luna.example.com', expiresAt: Date.UTC(2027, 10, 5) })),
        family('domain-progress', 'Payments & websites', 'Domain setup', 'The website is ready while its custom address is being configured.',
            'getDomainSetupInProgressEmailHtml', 'Your custom domain is being set up', getDomainSetupInProgressEmailHtml({ ...business, ...contact, customDomain: 'luna.example.com' })),
        family('domain-renewal', 'Payments & websites', 'Domain renewal', 'A reminder before the domain’s expiry.',
            'getDomainRenewalReminderEmailHtml', 'Your domain renewal reminder', getDomainRenewalReminderEmailHtml({ ...business, ...contact, customDomain: 'luna.example.com', expiresAt: Date.UTC(2027, 10, 5) })),
        family('cashout-status', 'Payments & websites', 'Cash-out status', 'The progress and final outcomes of a cash-out request.',
            'getWithdrawalStatusEmailHtml', 'Cash-out update', getWithdrawalStatusEmailHtml({ ...withdrawal, statusLabel: 'Processing', statusDescription: 'Your cash-out request is being processed.', isFinal: false }), [
                { id: 'completed', label: 'Completed', html: getWithdrawalStatusEmailHtml({ ...withdrawal, statusLabel: 'Completed', statusDescription: 'Your transfer has been completed.', isFinal: true }) },
                { id: 'failed', label: 'Failed', html: getWithdrawalStatusEmailHtml({ ...withdrawal, statusLabel: 'Failed', statusDescription: 'The transfer could not be completed. Contact the team to check the request.', isFinal: true }) },
            ]),
        family('payment-followup', 'Payments & websites', 'Payment reminder', 'Automatic and field-agent-requested reminders.',
            'getPaymentFollowUpEmailHtml', 'A reminder about your website', getPaymentFollowUpEmailHtml({ ...quote, hoursLeft: 24 }), [
                { id: 'agent', label: 'From a field agent', html: getPaymentFollowUpEmailHtml({ ...quote, isManual: true, fromCreator: 'Sam' }) },
            ]),
        family('intake-received', 'Payments & websites', 'Details received', 'The ordinary business-intake receipt.',
            'getIntakeReceivedEmailHtml', 'We received your business details', getIntakeReceivedEmailHtml({ ...business, ...contact, amount: 3499 })),
        family('cashout-requested', 'Payments & websites', 'Cash-out requested', 'A receipt for a new cash-out request.',
            'getWithdrawalRequestedEmailHtml', 'Your cash-out request', getWithdrawalRequestedEmailHtml({ ...withdrawal, wiseEmail: 'alex@example.com', wiseSenderName: 'Example Business — sample only', reference: 'SAMPLE-ONLY', requestedAt: withdrawal.submittedAt })),
        family('announcement', 'Payments & websites', 'Announcement', 'A team announcement with readable paragraphs.',
            'getAnnouncementEmailHtml', 'A few useful updates', getAnnouncementEmailHtml({ ...contact, name: 'Alex', title: 'A few useful updates', body: 'You can now continue your saved business draft on another device.\n\nOpen Tendso with the same account to check your progress.' })),

        family('call-booked', 'Calls & bookings', 'Call booked', 'The booking confirmation with calendar and manage actions.',
            'getCallBookedEmailHtml', 'Your call is booked', getCallBookedEmailHtml(call)),
        family('call-moved', 'Calls & bookings', 'Call rescheduled', 'The updated date and the same meeting link.',
            'getCallMovedEmailHtml', 'Your call has moved', getCallMovedEmailHtml({ ...call, dayLabel: 'Friday, November 13, 2026' })),
        family('call-reminder', 'Calls & bookings', 'Call reminder', 'Both the advance reminder and the soon-to-start reminder.',
            'getCallReminderEmailHtml', 'Your call reminder', getCallReminderEmailHtml({ ...call, kind: 'early', whenWord: 'Tomorrow', manage: { kind: 'tendso', url: call.manageUrl } }), [
                { id: 'soon', label: 'Starting soon', html: getCallReminderEmailHtml({ ...call, kind: 'soon', whenWord: 'Today', manage: { kind: 'tendso', url: call.manageUrl } }) },
            ]),
        family('call-cancelled', 'Calls & bookings', 'Call cancelled', 'Cancellation with the option to choose another time.',
            'getCallCancelledEmailHtml', 'Your call is cancelled', getCallCancelledEmailHtml({ ...call, bookUrl: 'https://example.com/sample-booking' })),
        family('call-out-of-hours', 'Calls & bookings', 'Booking correction', 'An out-of-hours booking was cancelled and needs a new time.',
            'getCallOutOfHoursEmailHtml', 'Please choose a new call time', getCallOutOfHoursEmailHtml({ ...call, bookUrl: 'https://example.com/sample-booking' })),

        family('otr-received', 'Off the Record', 'Application received', 'Eligibility and poster review; no payment requested.',
            'getGiveawayReceivedEmailHtml', 'Off the Record received your application', getGiveawayReceivedEmailHtml({ ...business, ...contact })),
        family('otr-approved', 'Off the Record', 'Application approved', 'The giveaway has been approved and the free website can be built.',
            'getGiveawayApprovedEmailHtml', 'Off the Record approved your application', getGiveawayApprovedEmailHtml({ ...business, ...contact })),
        family('otr-rejected', 'Off the Record', 'Application needs changes', 'The reviewer’s reason and the route to apply again.',
            'getGiveawayRejectedEmailHtml', 'Your Off the Record application', getGiveawayRejectedEmailHtml({ ...business, ...contact, reason: 'The poster photo is too dark to read. Please take a clear photo showing the Off the Record poster in your shop.', applyUrl: 'https://example.com/100-pages-giveaway' })),
        family('otr-live', 'Off the Record', 'Gifted website live', 'The published free website, credited to Off the Record.',
            'getGiveawayLiveEmailHtml', 'Your free website is live', getGiveawayLiveEmailHtml({ ...business, ...contact, websiteUrl })),
    ];
}
