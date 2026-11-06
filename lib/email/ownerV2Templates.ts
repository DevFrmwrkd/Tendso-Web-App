/**
 * Owner app v2 emails. Pure functions (no Next, no Node APIs) so the Convex
 * runtime can render them: convex/ownerEmails.ts sends them through Resend.
 *
 * Kept apart from lib/email/templates.ts on purpose (another stream owns that
 * file's copy). Facts: the site is built in about 20 minutes; owners in the app
 * see it first and pay once to publish, including new agent-made sites.
 *
 * Design: purpose-led progress, private previews and publication notices in the
 * shared white, ink and lime email frame. Every runtime string is escaped.
 */
import { escapeHtml } from './escape';
import { EMAIL_COLORS, emailFeature, emailFrame, emailParagraph, emailSteps, type EmailFrameOptions } from './design';

export const OWNER_V2_TAGLINE = 'See it first. Pay once to publish.';

export interface OwnerEmail {
    subject: string;
    html: string;
    text: string;
}

function firstName(name: string | null | undefined): string {
    const first = (name ?? '').trim().split(/\s+/)[0];
    return first || 'there';
}

function layout(title: string, bodyHtml: string, options: Pick<EmailFrameOptions, 'variant' | 'status' | 'preheader' | 'introHtml' | 'heroHtml' | 'heroActions' | 'friendly' | 'recipientName'> & { footnote?: string } = {}): string {
    return emailFrame({
        title,
        eyebrow: 'Your business',
        heading: title,
        bodyHtml,
        variant: options.variant,
        status: options.status,
        preheader: options.preheader,
        introHtml: options.introHtml,
        heroHtml: options.heroHtml,
        heroActions: options.heroActions,
        friendly: options.friendly,
        recipientName: options.recipientName,
        footerHtml: options.footnote
            ? `<p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:${EMAIL_COLORS.muted};">${escapeHtml(options.footnote)}</p>`
            : undefined,
    });
}

/** A field agent made their site: sign in with this email to see it. */
export function ownerInviteEmail(input: {
    ownerName?: string | null;
    businessName: string;
    email: string;
    appUrl: string;
}): OwnerEmail {
    const shop = escapeHtml(input.businessName);
    const subject = `Your website for ${input.businessName}`;
    const html = layout(
        'Your business is on Tendso',
        emailParagraph('Sign in with this email to follow your website’s progress and see it when it is ready.'),
        {
            status: 'Invitation', recipientName: firstName(input.ownerName),
            preheader: `Follow ${input.businessName} in Tendso with your email.`,
            introHtml: emailParagraph(`A field agent has added <strong>${shop}</strong> to Tendso.`),
            heroHtml: emailFeature({ label: 'Your sign-in email', value: input.email, size: 'medium', tone: 'white', detailHtml: 'We send you a code. No password.' }),
            heroActions: [{ label: 'Open Tendso', href: input.appUrl, primary: true }],
            footnote: 'You get this because a Tendso field agent made a website for your shop.',
        },
    );
    const text = `Hi ${firstName(input.ownerName)},\n\nA field agent has added ${input.businessName} to Tendso.\nSign in with this email to follow your website’s progress and see it when it is ready: ${input.email}. We send you a code. No password.\n\n${input.appUrl}`;
    return { subject, html, text };
}

/** Owner app: interview and photos are in, we are building (about 20 minutes). */
export function ownerBuildingEmail(input: { ownerName?: string | null; businessName: string; appUrl: string }): OwnerEmail {
    const shop = escapeHtml(input.businessName);
    const subject = `We're building ${input.businessName}'s website`;
    const html = layout(
        'We are building your site',
        emailSteps([{ label: 'Interview & photos', state: 'done' }, { label: 'Building', state: 'current' }, { label: 'Your preview', state: 'upcoming' }])
        + emailParagraph(OWNER_V2_TAGLINE),
        {
            status: 'Building', recipientName: firstName(input.ownerName),
            preheader: `Your interview and photos are in. We are building ${input.businessName}.`,
            introHtml: emailParagraph(`Thank you. We have your interview and photos for <strong>${shop}</strong>.`),
            heroHtml: emailFeature({ label: 'Estimated build', value: 'About 20 minutes', size: 'medium', detailHtml: 'We will tell you when your site is ready.', tone: 'white' }),
            heroActions: [{ label: 'Open Tendso', href: input.appUrl, primary: true }],
        },
    );
    const text = `Hi ${firstName(input.ownerName)},\n\nWe have your interview and photos for ${input.businessName}. Your site is ready in about 20 minutes. We will tell you when.\n\n${OWNER_V2_TAGLINE}\n\n${input.appUrl}`;
    return { subject, html, text };
}

/** Owner app: the private preview is ready to check. */
export function ownerPreviewReadyEmail(input: { ownerName?: string | null; businessName: string; appUrl: string; priceText: string }): OwnerEmail {
    const shop = escapeHtml(input.businessName);
    const subject = `${input.businessName}: your site is ready to check`;
    const html = layout(
        'Your site is ready to check',
        emailSteps([{ label: 'Built', state: 'done' }, { label: 'Your review', state: 'current' }, { label: 'Publish', state: 'upcoming' }])
        + emailParagraph('Look it over. Ask for a change, or tap <strong>Looks good</strong>.')
        + emailFeature({ label: 'One-time website price', value: input.priceText, detailHtml: `Once. ${OWNER_V2_TAGLINE}`, tone: 'quiet' })
        + emailParagraph('Choose from the payment options available at checkout.'),
        {
            status: 'Private preview', recipientName: firstName(input.ownerName), friendly: true,
            preheader: `${input.businessName} is ready for your review. See it before you pay.`,
            introHtml: emailParagraph(`The website for <strong>${shop}</strong> is ready. Only you can see it.`),
            heroHtml: emailFeature({ label: 'Built for', value: input.businessName, size: 'medium', tone: 'white', detailHtml: 'Your private website preview.' }),
            heroActions: [{ label: 'See my site', href: input.appUrl, primary: true }],
        },
    );
    const text = `Hi ${firstName(input.ownerName)},\n\nThe website for ${input.businessName} is ready. Only you can see it. Ask for a change, or tap Looks good.\n\n${OWNER_V2_TAGLINE} ${input.priceText}, once. Choose from the payment options available at checkout.\n\n${input.appUrl}`;
    return { subject, html, text };
}

/** Owner app: paid and published. */
export function ownerSiteLiveEmail(input: {
    ownerName?: string | null;
    businessName: string;
    websiteUrl: string;
    balanceText?: string | null;
}): OwnerEmail {
    const shop = escapeHtml(input.businessName);
    const subject = `${input.businessName} is live`;
    const html = layout('Your site is live',
        emailSteps([{ label: 'Built', state: 'done' }, { label: 'Payment received', state: 'done' }, { label: 'Live', state: 'current' }])
        + emailParagraph('Share it with your customers.')
        + (input.balanceText ? emailFeature({ label: 'Balance left to pay:', value: input.balanceText, detailHtml: 'You can pay it in the app.', tone: 'quiet' }) : ''),
        {
            variant: 'success', status: 'Live', recipientName: firstName(input.ownerName), friendly: true,
            preheader: `${input.businessName} is online. Share your website with your customers.`,
            introHtml: emailParagraph(`Thank you for paying. <strong>${shop}</strong> is live.`),
            heroHtml: emailFeature({ label: 'Your website', value: input.websiteUrl, size: 'medium', tone: 'white' }),
            heroActions: [{ label: 'Open my site', href: input.websiteUrl, primary: true }],
        },
    );
    const text = `Hi ${firstName(input.ownerName)},\n\nThank you for paying. ${input.businessName} is live at ${input.websiteUrl}.`
        + (input.balanceText ? `\nBalance left to pay: ${input.balanceText}. You can pay it in the app.` : '');
    return { subject, html, text };
}
