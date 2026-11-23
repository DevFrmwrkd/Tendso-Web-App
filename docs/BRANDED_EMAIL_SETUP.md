# Branded Tendso email

Customer support uses `support@tendso.com`. Web, mobile and customer email
templates share this contact through `packages/shared/contact.ts`.

The mailbox must be able to send and receive as `support@tendso.com` before
publishing the contact changes. Updating application code does not create a
mailbox or verify a sending domain.

## Setup status — 23 November 2026

- Resend Inbox `support@tendso.com` exists with display name **Tendso Support**.
- Resend reports sending SPF/DKIM and receiving MX verified. The root MX points
  to Resend inbound, and DMARC is configured with monitoring policy `p=none`.
- An internal message and reply were both received from
  `Tendso Support <support@tendso.com>`.
- Vercel Production and Preview have the From and Reply-To values below
  configured. The web contact changes are published; the existing Vercel API key
  was unchanged.
- Convex production `energetic-panther-693` has From/Reply-To and
  `RESEND_API_KEY` configured. Its new **Tendso owner emails — production** key
  has Sending Access limited to `tendso.com`. A connection test using this key
  and the branded sender was accepted with HTTP 200 and reached our own Support
  inbox.
- Convex development `diligent-ibex-454` has From/Reply-To configured but no
  `RESEND_API_KEY`; direct owner notifications remain off in development.
- Test owner invitations reached an external Gmail inbox, and a reply reached
  the Support inbox on 23 November 2026. This verifies transport and replies,
  not every automatic owner-email trigger. Forwarding is not configured.

## Receiving and team replies

IONOS account access is not required to set up Tendso email. The domain's
authoritative DNS is managed in Vercel, independently of `frmwrkd.com` mail.
Resend Inboxes is the selected receiving provider. The team accepted the
documented incoming-message classification as part of this choice. Confirm
account access, included capacity and domain verification before adding root MX
records or publishing the prepared contact changes.

### Selected provider: Resend Inboxes

Resend Inboxes provides a team interface for reading messages and sending
replies from the inbox address. This is separate from the legacy Receiving
API/webhooks and does not require building our own email client.

1. In the existing Resend account, confirm that Inboxes is available and check
   the account's remaining included inboxes and transactional email quota.
2. Add or select `tendso.com`, verify sending, and enable receiving using the
   exact records returned for that domain. Add those records in Vercel DNS.
3. Under **Inboxes → Create inbox**, create `support@tendso.com` with the display
   name **Tendso Support**. Do not enable autonomous sending or unrelated agents.
4. The team reads threads and uses **Reply** in that inbox. Messages are sent
   from the inbox address. Optional forwarding to Gmail does not replace using
   the Support inbox for replies.

Provider selection must account for Resend's documented automatic Anthropic
classification of incoming Inbox messages, even when no AI feature is enabled.
Normal outgoing messages through the Emails API have different processing.
Confirm that this receiving setup is accepted before routing customer mail to it.

### Alternative if needed: a dedicated mail host

Use a mailbox provider controlled by the team, such as Zoho Mail or Google
Workspace, if a separate conventional mailbox is preferred:

1. Add `tendso.com` to that provider, preserving Vercel as the DNS provider.
2. Add its supplied ownership verification record in Vercel.
3. Create `support@tendso.com`. Establish any new subscription price and obtain
   authorization before purchasing. The owner enters new mailbox credentials
   directly in the provider's setup screen.
4. Add the exact root MX, SPF and DKIM records supplied for the domain/account.
   A hostname must have only one SPF policy; combine authorized senders when
   providers share that hostname. Keep the website's existing DNS records.
5. Optional: forward a copy to `frmwrkd.media@gmail.com`, retaining a copy in
   Support. Send replies from Support's own mailbox or a connected mail client.

Forwarding alone does not change the sender on replies. Personal Gmail's
third-party "Send as" support is scheduled to end in January 2027, so it should
not be the long-term way the team sends Support replies.

## Automated app emails: Resend

1. Open the app's existing Resend account and add or select `tendso.com`.
2. Enable sending and add the exact DNS records supplied by Resend in Vercel.
   Root MX records must point to the selected receiving provider. Resend's
   sending return-path MX is separate from the Support mailbox's incoming mail;
   when using another mail host, do not replace its root MX with Resend inbound.
3. Wait until Resend reports the sending domain verified.
4. Set the following on the Vercel project that serves Tendso:

   ```dotenv
   RESEND_FROM_EMAIL="Tendso <support@tendso.com>"
   RESEND_REPLY_TO="support@tendso.com"
   ```

   Keep the existing `RESEND_API_KEY` in secret storage. Do not place mailbox
   passwords or API keys in source code, public environment variables or chat.
5. Deploy the contact changes with these environment values. Vercel environment
   changes take effect in a new deployment.

`lib/email/service.ts` reads these values for the From and Reply-To headers.
Its `onboarding@resend.dev` fallback is a test sender, not activation of branded
email. The admin email test endpoint exposes sender diagnostics without exposing
the API key.

Owner invitations and build/preview/live notifications also send directly from
`convex/ownerEmails.ts`. Configure the same `RESEND_FROM_EMAIL` and
`RESEND_REPLY_TO` on the intended Convex deployment; it has a separate
environment from Vercel. It also requires `RESEND_API_KEY`; without a configured
key, these messages are skipped. Vercel settings alone do not activate owner
email delivery.

Customer booking confirmations, reminders, reschedules and cancellations also
use Resend with the existing Convex `RESEND_API_KEY`. Their From and Reply-To
addresses use the shared `support@tendso.com` constant; the Calendar OAuth
account remains separate and internal. Do not change the Calendar credentials
to change the email sender. The booking transport change requires a Convex
code deployment. Verify a booking test after that deployment;
the owner-invitation test does not establish booking delivery.

Production `energetic-panther-693` now has all three settings. Use its
`tendso.com`-restricted Sending Access key for owner emails; keep the key in
Convex secret storage. The direct Resend API test was accepted with HTTP 200
and reached our own Support inbox. Later owner-invitation tests reached an
external Gmail inbox and its reply reached Support. These checks verify the
sending key, sender configuration and reply route; they do not verify every
owner journey trigger. Development
`diligent-ibex-454` intentionally has no sending key yet.

## Verify before rollout

- Confirm incoming mail reaches Support and any configured forwarded copy.
- Reply from the Support inbox and confirm recipients see
  `Tendso <support@tendso.com>` and replies return to Support.
- Check an authorized app test email's From, Reply-To and SPF/DKIM results.
- Publish the web changes after the mailbox and sender checks succeed.
- Release the mobile contact changes through the appropriate Expo update/build.
  Server sender configuration alone does not replace contact strings in installed
  mobile bundles.

Tests under `__tests__/email/supportContact.test.ts` keep customer help links
separate from Wise payment recipient fields and preserve payment-confirmation
instructions and agent payout destinations. The legacy approval email now uses
the same bank-transfer details and reference instructions as the modern payment
emails, instead of displaying the old Wise email as an Email/ID. This changes
the presentation only; `WISE_EMAIL`, `NEXT_PUBLIC_WISE_EMAIL`, payment processing
and payout destinations must remain unchanged.

## Separate account identities

This migration does not change `WISE_EMAIL`, `NEXT_PUBLIC_WISE_EMAIL`, Drive
OAuth identity, the internal Calendar OAuth identity (`tendso.hr@gmail.com`), or
app store publishing accounts. Customer booking mail uses Support independently
of that Calendar identity. Additional addresses such as `hello@tendso.com`,
`notifications@tendso.com` and `bookings@tendso.com` need their own setup and
activation; they are not provisioned by these code changes.

## Provider references

- [Resend: create inboxes](https://resend.com/docs/guides/inboxes/create-inboxes)
- [Resend: manual replies and threads](https://resend.com/docs/guides/inboxes/threads)
- [Resend: account limits and pricing](https://resend.com/pricing)
- [Resend: email content processing](https://resend.com/security)
- [Zoho: connect an existing domain](https://www.zoho.com/mail/help/adminconsole/add-domains.html)
- [Resend: verified domains](https://resend.com/docs/dashboard/domains/introduction)
- [Google: changes to third-party email account support](https://support.google.com/mail/answer/17101213?hl=en)
