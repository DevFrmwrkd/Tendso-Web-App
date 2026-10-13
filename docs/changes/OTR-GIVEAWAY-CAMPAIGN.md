# Off the Record website giveaway

Off the Record is giving its community up to 100 free websites built by Tendso. This is a one-time campaign: the business displays an **Off the Record poster**, registers its business, and submits a photo showing the poster at the shop. OTR checks eligibility; Tendso builds, publishes, and delivers the website.

## Public links for the commercial

- `https://tendso.com/libre` — short giveaway address for the commercial. It forwards to the giveaway landing page with source attribution.
- `https://tendso.com/100-pages-giveaway` — giveaway landing page.
- `https://tendso.com/100-pages-giveaway-poster.pdf` — print-ready, single-page A4 OTR poster.
- `https://tendso.com/poster` — stable QR destination encoded in the poster. The existing operator-controlled redirect remains in place; its default points to the giveaway through `/libre?src=poster`.

`/otr` remains the existing **paid 30% offer**. Use `/libre` for the giveaway commercial; an old commercial QR that points to `/otr` still opens the paid offer.

The poster is generated from `scripts/generate-otr-giveaway-poster.mjs` with the supplied OTR mark, the Tendso logo, the self-hosted Unbounded and Bricolage Grotesque fonts, and a real QR. Rebuild with `node scripts/generate-otr-giveaway-poster.mjs`; Chrome is required, with `CHROME_PATH` available as an override. No external image service or runtime dependency was added.

The landing page and the poster share one campaign look: OTR black across the top, Tendso gold across the bottom, a tilted GIVEAWAY banner, the "Off the Record × Tendso" co-brand, and a "more than ₱300,000 in websites" sticker (`GIVEAWAY_VALUE_FLOOR` in `lib/giveaway.ts`, a round floor below 100 × the website price). The page's styles live in `app/giveaway.css`, scoped under `.gw`; change the page and the poster together.

## OTR review

Reviewers open **`https://tendso.com/otr/review`** and sign in using their designated Clerk account. They do not need a creator or affiliate profile and do not need access to the Tendso admin board.

Configure **`OTR_GIVEAWAY_REVIEWER_IDS` in the web app’s Convex deployment**, as a comma-separated list of exact Clerk user IDs. For example, `user_reviewer_one,user_reviewer_two`. This is server configuration, never a `NEXT_PUBLIC_` variable or a publicly editable setting. Use the production Clerk IDs for production. Existing eligible Tendso admins can also use the page. Deleted or suspended accounts are denied even if their ID remains in the list; remove an ID to revoke its invitation.

No reviewer IDs are guessed or provisioned by this change. The campaign coordinator must identify the reviewers before granting them access. A Clerk-only reviewer signs in on this review page rather than the creator onboarding route.

The screen provides the business, address, owner contact details, and submitted poster photo. The reviewer confirms that the OTR poster is visibly displayed at the business, then approves the free website. A rejection requires a specific reason, which is emailed to the owner. Reviewers cannot edit campaign settings, see ordinary submissions or account/wallet data, generate websites, publish, or mark payments. Every review query and mutation enforces this scope on the server.

## Reservation and delivery

1. A valid application reserves one slot. The server keeps the existing phone/email uniqueness checks and rejects submissions after the campaign closes or fills. The website price and commission are both zero; custom domains are excluded.
2. New giveaway submissions wait for poster review before paid Studio enhancement is scheduled. Approval schedules enhancement once and puts the submission into Tendso’s existing fulfillment queue. Existing applications that were already enhanced are not rendered again merely because they are approved.
3. Rejection releases the reservation atomically and schedules the existing rejection email. Another applicant can use the released slot if the campaign remains open. Opposite or repeated decisions from simultaneous reviewers cannot overwrite an already reviewed application through the OTR API.
4. Tendso’s existing admin workflow builds and publishes the website, then uses **Give Free** to settle it. The owner’s final email names **Off the Record** as the giver and Tendso as the website provider. The server enforces that name for giveaway applications even if a browser submits a different giver.

A reserved slot is not a website given away. The public closed state distinguishes fully reserved slots from all 100 websites marked free, and uses neutral copy when applications are paused or expired. The reviewer screen labels the settled count “Sites given”; it does not claim that email delivery has been confirmed. Owners receive an application receipt, a rejection reason if needed, and their live website email after delivery. This change does not add a separate approval email.

The existing Tendso admin availability toggle remains available for operating the campaign. OTR reviewers use their separate screen for eligibility decisions; Tendso admins retain fulfillment and campaign controls. No campaign counters, live records, or production availability settings are reset by this change.

## Launch

Merge the web PR, deploy Convex from the web repository, and let the existing Vercel production deployment finish. Set the reviewer IDs in production Convex and verify an invited reviewer can sign in to `/otr/review`. Confirm the commercial uses `/libre`, print the PDF at A4 size, and test its QR on a phone. The existing `poster_redirect_target` must point to the giveaway for this campaign.

No mobile source, schema fields, native build settings, owner payment collection, affiliate commission flow, or OTR30 campaign behavior changes. There is no mobile release or mobile Convex deployment for this web campaign.
