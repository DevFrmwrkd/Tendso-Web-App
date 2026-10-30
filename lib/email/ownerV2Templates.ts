/**
 * Owner app v2 emails. Pure functions (no Next, no Node APIs) so the Convex
 * runtime can render them: convex/ownerEmails.ts sends them through Resend.
 *
 * Kept apart from lib/email/templates.ts on purpose (another stream owns that
 * file's copy). Facts: the site is built in about 20 minutes; owners in the app
 * see it first and pay once to publish; agent-made sites are already live.
 *
 * Design: plain and short. Ink on white, the Tendso accent (#E4F222) only as a
 * button FILL with ink text, never as text colour. Every runtime string is
 * escaped (see ./escape).
 */
import { escapeHtml } from './escape';

const INK = '#0D0D0D';
const ACCENT = '#E4F222';
const BODY = '#2B2B2B';
const MUTED = '#5A5A5A';
const LINE = '#E7E7E2';
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";

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

function layout(title: string, paragraphs: string[], button?: { label: string; href: string }, footnote?: string): string {
    const ps = paragraphs
        .map((p) => `<p style="margin:0 0 16px;font-family:${SANS};font-size:17px;line-height:1.6;color:${BODY};">${p}</p>`)
        .join('');
    const btn = button
        ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 24px;"><tr>`
          + `<td style="background:${ACCENT};border-radius:999px;">`
          + `<a href="${escapeHtml(button.href)}" style="display:inline-block;padding:16px 28px;font-family:${SANS};font-size:17px;font-weight:700;color:${INK};text-decoration:none;">${escapeHtml(button.label)}</a>`
          + `</td></tr></table>`
        : '';
    const foot = footnote
        ? `<p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.5;color:${MUTED};">${footnote}</p>`
        : '';
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>`
        + `<body style="margin:0;padding:0;background:#F6F6F3;">`
        + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F6F6F3;"><tr><td align="center" style="padding:24px 12px;">`
        + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#FFFFFF;border:1px solid ${LINE};border-radius:20px;">`
        + `<tr><td style="padding:28px 28px 8px;font-family:${SANS};font-size:15px;font-weight:700;letter-spacing:0.5px;color:${INK};">Tendso</td></tr>`
        + `<tr><td style="padding:8px 28px 0;"><h1 style="margin:0 0 16px;font-family:${SANS};font-size:26px;line-height:1.25;color:${INK};">${title}</h1></td></tr>`
        + `<tr><td style="padding:0 28px 28px;">${ps}${btn}${foot}</td></tr>`
        + `</table></td></tr></table></body></html>`;
}

/** A field agent made their site: sign in with this email to see it. */
export function ownerInviteEmail(input: {
    ownerName?: string | null;
    businessName: string;
    email: string;
    appUrl: string;
}): OwnerEmail {
    const name = escapeHtml(firstName(input.ownerName));
    const shop = escapeHtml(input.businessName);
    const email = escapeHtml(input.email);
    const subject = `Your website for ${input.businessName}`;
    const html = layout(
        'Your website is here',
        [
            `Hi ${name},`,
            `Your website for <strong>${shop}</strong> is ready to see in the Tendso app.`,
            `Sign in with this email to see your website: <strong>${email}</strong>. We send you a code. No password.`,
        ],
        { label: 'Open Tendso', href: input.appUrl },
        'You get this because a Tendso field agent made a website for your shop.',
    );
    const text = `Hi ${firstName(input.ownerName)},\n\nYour website for ${input.businessName} is ready to see in the Tendso app.\nSign in with this email to see your website: ${input.email}. We send you a code. No password.\n\n${input.appUrl}`;
    return { subject, html, text };
}

/** Owner app: interview and photos are in, we are building (about 20 minutes). */
export function ownerBuildingEmail(input: { ownerName?: string | null; businessName: string; appUrl: string }): OwnerEmail {
    const name = escapeHtml(firstName(input.ownerName));
    const shop = escapeHtml(input.businessName);
    const subject = `We're building ${input.businessName}'s website`;
    const html = layout(
        'We are building your site',
        [
            `Hi ${name},`,
            `Thank you. We have your interview and photos for <strong>${shop}</strong>.`,
            `Your site is ready in about 20 minutes. We will tell you when.`,
            `${OWNER_V2_TAGLINE}`,
        ],
        { label: 'Open Tendso', href: input.appUrl },
    );
    const text = `Hi ${firstName(input.ownerName)},\n\nWe have your interview and photos for ${input.businessName}. Your site is ready in about 20 minutes. We will tell you when.\n\n${OWNER_V2_TAGLINE}\n\n${input.appUrl}`;
    return { subject, html, text };
}

/** Owner app: the private preview is ready to check. */
export function ownerPreviewReadyEmail(input: { ownerName?: string | null; businessName: string; appUrl: string; priceText: string }): OwnerEmail {
    const name = escapeHtml(firstName(input.ownerName));
    const shop = escapeHtml(input.businessName);
    const price = escapeHtml(input.priceText);
    const subject = `${input.businessName}: your site is ready to check`;
    const html = layout(
        'Your site is ready to check',
        [
            `Hi ${name},`,
            `The website for <strong>${shop}</strong> is ready. Only you can see it.`,
            `Look it over. Ask for a change, or tap <strong>Looks good</strong>.`,
            `${OWNER_V2_TAGLINE} ${price}, once. GCash, Maya or card.`,
        ],
        { label: 'See my site', href: input.appUrl },
    );
    const text = `Hi ${firstName(input.ownerName)},\n\nThe website for ${input.businessName} is ready. Only you can see it. Ask for a change, or tap Looks good.\n\n${OWNER_V2_TAGLINE} ${input.priceText}, once. GCash, Maya or card.\n\n${input.appUrl}`;
    return { subject, html, text };
}

/** Owner app: paid and published. */
export function ownerSiteLiveEmail(input: {
    ownerName?: string | null;
    businessName: string;
    websiteUrl: string;
    balanceText?: string | null;
}): OwnerEmail {
    const name = escapeHtml(firstName(input.ownerName));
    const shop = escapeHtml(input.businessName);
    const url = escapeHtml(input.websiteUrl);
    const subject = `${input.businessName} is live`;
    const paragraphs = [
        `Hi ${name},`,
        `Thank you for paying. <strong>${shop}</strong> is live at <a href="${url}" style="color:${INK};font-weight:700;">${url}</a>.`,
        `Share it with your customers.`,
    ];
    if (input.balanceText) paragraphs.push(`Balance left to pay: <strong>${escapeHtml(input.balanceText)}</strong>. You can pay it in the app.`);
    const html = layout('Your site is live', paragraphs, { label: 'Open my site', href: input.websiteUrl });
    const text = `Hi ${firstName(input.ownerName)},\n\nThank you for paying. ${input.businessName} is live at ${input.websiteUrl}.`
        + (input.balanceText ? `\nBalance left to pay: ${input.balanceText}. You can pay it in the app.` : '');
    return { subject, html, text };
}
