jest.mock('@/lib/payment/config', () => ({ getPaymentConfig: () => ({ wiseEmail: 'configured@example.test' }) }));

import * as templates from '@/lib/email/templates';
import { EMAIL_BRAND_BUDDY, EMAIL_BRAND_MARK } from '@/lib/email/design';
import { load } from 'cheerio';

const shop = { businessName: 'Sample Shop', businessOwnerName: 'Sam' };
const websiteUrl = 'https://sample.example.test/site?a=1&b=2';
const date = Date.parse('2026-11-06T04:00:00Z');
const bank = { accountName: 'Sample Payee', accountNumber: '0000000000', bankName: 'Example Test Bank', wiseEmail: 'payments@example.test' };
const call = { firstName: 'Sam', dayLabel: 'Friday, November 6', timeLabel: '12:00 PM', meetUrl: 'https://meet.example.test/call?a=1&b=2', manageUrl: 'https://tendso.test/field-agent/manage?token=sample', calendarUrl: 'https://calendar.example.test/add?a=1&b=2' };
const basePayment = { ...shop, websiteUrl, amount: 2499, referenceCode: 'ND-SAMPLE-CODE' };
const visibleText = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map(match => match[1].replace(/&amp;/g, '&'));

describe('shared general email design', () => {
    it.each([
        ['payment received', () => templates.getPaymentConfirmationEmailHtml({ ...shop, websiteUrl, amount: 2499 })],
        ['gift', () => templates.getPromoWebsiteLiveEmailHtml({ ...shop, websiteUrl })],
        ['payment link', () => templates.getPaymentLinkEmailHtml(basePayment)],
        ['approval', () => templates.getApprovalEmailHtml({ ...shop, websiteUrl, amount: 2499, submissionId: 'sample-submission' })],
        ['domain live', () => templates.getDomainLiveEmailHtml({ ...shop, customDomain: 'sample.example.test', expiresAt: date })],
        ['domain setting up', () => templates.getDomainSetupInProgressEmailHtml({ ...shop, customDomain: 'sample.example.test' })],
        ['domain renewal', () => templates.getDomainRenewalReminderEmailHtml({ ...shop, customDomain: 'sample.example.test', expiresAt: date })],
        ['withdrawal status', () => templates.getWithdrawalStatusEmailHtml({ creatorName: 'Sam', creatorEmail: 'sam@example.test', amount: 2500, statusLabel: 'Processing', statusDescription: 'The transfer is processing.', isFinal: false, submittedAt: date })],
        ['payment reminder', () => templates.getPaymentFollowUpEmailHtml(basePayment)],
        ['intake receipt', () => templates.getIntakeReceivedEmailHtml({ ...shop, amount: 2499 })],
        ['withdrawal requested', () => templates.getWithdrawalRequestedEmailHtml({ creatorName: 'Sam', amount: 2500, wiseEmail: 'sam@example.test', requestedAt: date })],
        ['announcement', () => templates.getAnnouncementEmailHtml({ name: 'Sam', title: 'A team update', body: 'Some helpful news.' })],
        ['call booked', () => templates.getCallBookedEmailHtml(call)],
        ['call moved', () => templates.getCallMovedEmailHtml(call)],
        ['call reminder', () => templates.getCallReminderEmailHtml({ ...call, kind: 'soon', whenWord: 'Today' })],
        ['call cancelled', () => templates.getCallCancelledEmailHtml({ ...call, bookUrl: 'https://tendso.test/field-agent/book' })],
        ['call outside working hours', () => templates.getCallOutOfHoursEmailHtml({ ...call, bookUrl: 'https://tendso.test/field-agent/book' })],
    ] as const)('renders %s in the light Tendso shell', (_, render) => {
        const html = render();
        expect(html).toContain('class="t-email-heading"');
        expect(html).toContain('bgcolor="#FFFFFF"');
        expect(html).toContain(`src="${EMAIL_BRAND_MARK}"`);
        expect(html).toContain("'Onest'");
        expect(html).toContain('background:#F2F3F1');
        expect(html).not.toMatch(/linear-gradient|#E4B05E|#C89548|background(?:-color)?:\s*#(?:0a0a0a|0f0f0f|1a1a1a)/i);
    });

    it.each([templates.getPaymentLinkEmailHtml, templates.getPaymentFollowUpEmailHtml])('preserves real routing defaults and permits a fully fictional preview override', render => {
        const real = render(basePayment);
        expect(real).toContain('VONAS, OPC');
        expect(real).toContain('2006436346');
        expect(real).toContain('Wise Pilipinas Inc. (via InstaPay)');
        const preview = render({ ...basePayment, paymentDetails: bank });
        for (const value of Object.values(bank)) expect(preview).toContain(value);
        expect(preview).not.toMatch(/VONAS, OPC|2006436346|configured@example\.test/);
        expect(preview).toContain('ND-SAMPLE-CODE');
        expect(preview).toContain('team verification');
    });

    it('keeps a payment receipt separate from a gift and does not invent a payment on a free site', () => {
        const receipt = visibleText(templates.getPaymentConfirmationEmailHtml({ ...shop, websiteUrl, amount: 2499, customDomain: 'sample.example.test' }));
        expect(receipt).toContain('Amount paid');
        expect(receipt).toContain('₱2,499');
        expect(receipt).toContain('custom domain is being configured');
        const gift = visibleText(templates.getPromoWebsiteLiveEmailHtml({ ...shop, websiteUrl, creatorName: 'Sample Creator' }));
        expect(gift).toContain('Sample Creator');
        expect(gift).toContain('There is nothing for you to pay.');
        expect(gift).not.toMatch(/Amount paid|payment received|₱2,499/i);
    });

    it('preserves the owner claim action without presenting it as a website editor', () => {
        const claim = 'https://tendso.test/my-business/claim?token=sample&source=email';
        const html = templates.getPaymentLinkEmailHtml({ ...basePayment, editMyWebsiteUrl: claim });
        expect(hrefs(html)).toContain(claim);
        expect(visibleText(html)).toContain('Manage my business');
        expect(visibleText(html)).not.toContain('Edit my website');
    });

    it('keeps the frozen website/domain breakdown on a reminder after an uncharged domain upgrade', () => {
        const html = templates.getPaymentFollowUpEmailHtml({ ...basePayment, amount: 1999, customDomain: 'sample.example.test', domainCostPHP: 720, domainChargedPHP: 0, websiteListPrice: 4999 });
        expect(visibleText(html)).toContain('Website package');
        expect(visibleText(html)).toContain('Custom domain: sample.example.test');
        expect(html).toContain('₱0');
        expect(html).toContain('₱1,999');
        expect(html).not.toContain('₱1,279');
        expect(html).toContain('60% off');
    });

    it('labels payout timestamps in Philippine time on both request and status emails', () => {
        const afterMidnightInManila = Date.parse('2026-11-06T20:30:00Z');
        const emails = [
            templates.getWithdrawalRequestedEmailHtml({ creatorName: 'Sam', amount: 2500, wiseEmail: 'sam@example.test', requestedAt: afterMidnightInManila }),
            templates.getWithdrawalStatusEmailHtml({ creatorName: 'Sam', creatorEmail: 'sam@example.test', amount: 2500, statusLabel: 'Failed', statusDescription: 'The payment was returned.', isFinal: true, submittedAt: afterMidnightInManila }),
        ];
        for (const html of emails) {
            expect(visibleText(html)).toContain('November 7, 2026');
            expect(visibleText(html)).toContain('4:30 AM');
            expect(visibleText(html)).toContain('Philippine time');
        }
    });

    it('preserves automatic urgency but never gives a creator/manual reminder the final-day deadline', () => {
        const automatic = visibleText(templates.getPaymentFollowUpEmailHtml({ ...basePayment, hoursLeft: 7 }));
        expect(automatic).toContain('7 hours');
        expect(automatic).toContain('taken offline');
        for (const options of [{ isManual: true }, { fromCreator: 'Sample Creator', isManual: false }]) {
            const text = visibleText(templates.getPaymentFollowUpEmailHtml({ ...basePayment, hoursLeft: 7, ...options }));
            expect(text).not.toContain('taken offline');
            expect(text).not.toContain('7 hours');
        }
    });

    it('presents one invoice amount and one reference instead of repeating payment data in stacked boxes', () => {
        const html = templates.getPaymentLinkEmailHtml({ ...basePayment, paymentDetails: bank });
        const text = visibleText(html);
        expect(text.match(/₱2,499/g)).toHaveLength(1);
        expect(text.match(/ND-SAMPLE-CODE/g)).toHaveLength(1);
        expect(text.match(/0000000000/g)).toHaveLength(1);
        expect(text).toContain('Total amount to pay');
        expect(text).toContain('Include your reference');
        expect(text).toContain('team verification');
    });

    it('puts the saved invoice amount and available owner actions in the hero without moving bank details there', () => {
        const claim = 'https://tendso.test/my-business/claim?token=sample&source=email';
        const $ = load(templates.getPaymentLinkEmailHtml({ ...basePayment, editMyWebsiteUrl: claim, paymentDetails: bank }));
        const hero = $('.t-email-hero');
        expect(hero.text()).toContain('₱2,499');
        expect(hero.find('a').map((_, element) => $(element).attr('href')).get()).toEqual([websiteUrl, claim]);
        expect(hero.text()).not.toContain(bank.accountNumber);
        expect($.text()).toContain(bank.accountNumber);
        expect($.text()).toContain('ND-SAMPLE-CODE');
    });

    it('puts each domain and payout summary in the hero while keeping its actual state intact', () => {
        const domain = load(templates.getDomainLiveEmailHtml({ ...shop, customDomain: 'sample.example.test', expiresAt: date }));
        expect(domain('.t-email-hero').text()).toContain('sample.example.test');
        expect(domain('.t-email-hero a').attr('href')).toBe('https://sample.example.test');
        const payout = load(templates.getWithdrawalStatusEmailHtml({ creatorName: 'Sam', creatorEmail: 'sam@example.test', amount: 2500, statusLabel: 'Failed', statusDescription: 'The transfer was returned.', isFinal: true, submittedAt: date }));
        expect(payout('.t-email-hero').text()).toContain('₱2,500');
        expect(payout('.t-email-hero').text()).toContain('Failed');
        expect(payout('.t-email-hero').text()).toContain('The transfer was returned.');
    });

    it('uses the domain address as a prominent summary while retaining expiry and renewal information', () => {
        const html = templates.getDomainLiveEmailHtml({ ...shop, customDomain: 'sample.example.test', expiresAt: date });
        expect(html).toMatch(/class="t-email-feature(?:-text)?"[^>]*>sample\.example\.test<\/p>/);
        expect(hrefs(html)).toContain('https://sample.example.test');
        const text = visibleText(html);
        expect(text).toContain('November 6, 2026');
        expect(text).toContain('We do not auto-renew');
    });

    it('never treats the payout notification recipient as an unverified Wise destination', () => {
        const html = templates.getWithdrawalStatusEmailHtml({ creatorName: 'Sam', creatorEmail: 'delivery-only@example.test', amount: 2500, statusLabel: 'Processing', statusDescription: 'Wise is processing the transfer.', isFinal: false, submittedAt: date });
        expect(visibleText(html)).toContain('Wise transfer');
        expect(visibleText(html)).toContain('₱2,500');
        expect(visibleText(html)).toContain('Wise is processing the transfer.');
        expect(html).not.toContain('delivery-only@example.test');
    });

    it.each([
        ['Failed', true], ['Rejected', true], ['Processing', false], ['Completed', false],
    ] as const)('keeps the success mascot out of a %s payout (final=%s)', (statusLabel, isFinal) => {
        const html = templates.getWithdrawalStatusEmailHtml({ creatorName: 'Sam', creatorEmail: 'sam@example.test', amount: 2500, statusLabel, statusDescription: 'The actual transfer status appears here.', isFinal, submittedAt: date });
        expect(html).toContain(statusLabel);
        expect(html).toContain('₱2,500');
        expect(html).not.toContain(EMAIL_BRAND_BUDDY);
    });

    it('uses the friendly mascot for confirmed success, while unpaid requests remain neutral', () => {
        const complete = templates.getWithdrawalStatusEmailHtml({ creatorName: 'Sam', creatorEmail: 'sam@example.test', amount: 2500, statusLabel: 'Completed', statusDescription: 'The payout is complete.', isFinal: true, submittedAt: date });
        expect(complete).toContain(EMAIL_BRAND_BUDDY);
        expect(templates.getPromoWebsiteLiveEmailHtml({ ...shop, websiteUrl })).toContain(EMAIL_BRAND_BUDDY);
        expect(templates.getPaymentLinkEmailHtml(basePayment)).not.toContain(EMAIL_BRAND_BUDDY);
        expect(templates.getWithdrawalRequestedEmailHtml({ creatorName: 'Sam', amount: 2500, wiseEmail: 'sam@example.test', requestedAt: date })).not.toContain(EMAIL_BRAND_BUDDY);
    });

    it('escapes names, headings, status descriptions and bank overrides rather than accepting markup', () => {
        const attack = '<img src=x onerror="alert(1)">';
        const output = [
            templates.getPaymentLinkEmailHtml({ ...basePayment, businessName: attack, paymentDetails: { ...bank, accountName: attack } }),
            templates.getWithdrawalStatusEmailHtml({ creatorName: attack, creatorEmail: 'sam@example.test', amount: 1, statusLabel: attack, statusDescription: attack, isFinal: true, submittedAt: date }),
            templates.getAnnouncementEmailHtml({ name: attack, title: attack, body: `${attack}\n\nSecond paragraph.` }),
            templates.getCallReminderEmailHtml({ ...call, dayLabel: attack, timeLabel: attack, kind: 'soon', whenWord: attack }),
        ];
        for (const html of output) {
            expect(html).not.toContain(attack);
            expect(html).toContain('&lt;img');
        }
    });
});

describe('booking email actions', () => {
    it.each([templates.getCallBookedEmailHtml, templates.getCallMovedEmailHtml])('keeps the calendar, Meet and signed manage links with the new layout', render => {
        const html = render(call);
        const links = hrefs(html);
        expect(links).toContain(call.meetUrl);
        expect(links).toContain(call.calendarUrl);
        expect(links).toContain(call.manageUrl);
        expect(links).toContain(`${call.manageUrl}&action=cancel`);
        expect(visibleText(html)).toContain('Philippine time (Asia/Manila)');
        expect(visibleText(html)).toContain(call.dayLabel);
        expect(visibleText(html)).toContain(call.timeLabel);
    });

    it('makes the call time prominent and keeps reschedule/cancel as compact links', () => {
        const html = templates.getCallBookedEmailHtml(call);
        expect(html).toMatch(/class="t-email-feature"[^>]*>12:00 PM<\/p>/);
        for (const label of ['Reschedule', 'Cancel']) {
            const anchor = [...html.matchAll(/<a\b[^>]*>[^<]*<\/a>/g)].map(match => match[0]).find(value => value.endsWith(`>${label}</a>`));
            expect(anchor).toBeDefined();
            expect(anchor).toContain('text-decoration:underline');
        }
        expect(visibleText(html)).toContain('Join Google Meet');
        expect(visibleText(html)).toContain('Add to calendar');
    });

    it('places the schedule and Join/Calendar actions together in the hero while management stays secondary', () => {
        const $ = load(templates.getCallBookedEmailHtml(call));
        const hero = $('.t-email-hero');
        expect(hero.text()).toContain(call.dayLabel);
        expect(hero.text()).toContain(call.timeLabel);
        expect(hero.text()).toContain('Philippine time (Asia/Manila)');
        expect(hero.find('a').map((_, element) => $(element).attr('href')).get()).toEqual([call.meetUrl, call.calendarUrl]);
        expect(hero.text()).not.toContain('Reschedule');
        expect($('a').map((_, element) => $(element).attr('href')).get()).toContain(call.manageUrl);
    });

    it('keeps external bookings on their own management page and leaves unmanaged bookings reply-based', () => {
        const external = 'https://booking.example.test/manage?token=sample&action=choose';
        const externalHtml = templates.getCallReminderEmailHtml({ ...call, kind: 'soon', whenWord: 'Tomorrow', manage: { kind: 'external', url: external } });
        expect(hrefs(externalHtml)).toContain(external);
        expect(externalHtml).not.toContain(`${external}&amp;action=cancel`);
        expect(visibleText(externalHtml)).not.toContain('reply CANCEL');
        const unmanaged = templates.getCallReminderEmailHtml({ ...call, kind: 'early', whenWord: 'Tomorrow', manage: null });
        expect(visibleText(unmanaged)).toContain('reply CANCEL');
        expect(unmanaged).not.toContain('>Reschedule<');
    });

    it('preserves booking confirmation fallbacks and rebooking after cancellation', () => {
        const booked = visibleText(templates.getCallBookedEmailHtml({ ...call, meetUrl: null, manageUrl: null, calendarUrl: null }));
        expect(booked).toContain('send your Google Meet link shortly');
        expect(booked).toContain('reply CANCEL');
        const bookUrl = 'https://tendso.test/field-agent/book';
        const cancelled = templates.getCallCancelledEmailHtml({ ...call, bookUrl });
        expect(hrefs(cancelled)).toContain(bookUrl);
        expect(visibleText(cancelled)).toContain('that time is open again');
    });

    it('does not turn unsafe supplied website or Meet protocols into clickable email links', () => {
        const receipt = templates.getPaymentConfirmationEmailHtml({ ...shop, websiteUrl: 'javascript:alert(1)', amount: 2499 });
        const booking = templates.getCallBookedEmailHtml({ ...call, meetUrl: 'data:text/html,sample', calendarUrl: 'javascript:alert(1)' });
        expect(hrefs(receipt)).not.toContain('javascript:alert(1)');
        expect(hrefs(booking).some(href => /^(javascript|data):/.test(href))).toBe(false);
        expect(hrefs(booking)).toContain(call.manageUrl);
    });
});
