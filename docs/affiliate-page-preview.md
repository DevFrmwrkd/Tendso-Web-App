# Affiliate page editor and public preview

Web My page is a section of the creator portal at `/v2/creators/portal/my-page`. It uses the same navigation, account identity and footer as the overview. The previous `/affiliates/dashboard/my-page` address redirects there. Both addresses retain the existing affiliate account gate; admin samples stay inside their protected preview routes. On mobile, Home → My page opens the unified editor directly, titled **My page**, with Page details, read-only Your offer, Sharing and Edit/Preview switching. There is no separate summary/menu screen; the old page-edit entry is a compatibility route to the same editor with an Edit title.

Mobile **My page** has Page details, Your offer and Sharing sections, plus Edit/Preview switching. Save page changes only public profile fields. Your offer is read-only: every creator code gives 30% off, so the shop pays ₱3,499, saves ₱1,500 and the creator's 50% commission is ₱1,750. There are no affiliate price inputs, sliders or Save price actions. Switching sections and previewing must preserve unsaved profile drafts. Sharing and QR materials use saved public details with this fixed offer.

`CREATOR_CODE_PRICE` and `CREATOR_CODE_DISCOUNT` are the shared policy constants. Older `affiliatePrice` values are ignored for current creator-code offers. Field-agent submission prices remain variable, and existing orders retain their captured price and commission.

## Printable posters

Sharing uses the selected **Bold offer** layout on both platforms. `lib/affiliatePoster.ts` builds the public print model and A4 scene from the saved name, photo, actual referral code and shop-page link, with the fixed 30% offer. The code stays independent of the handle. Missing photos use initials; missing codes are omitted without inventing a code from the handle. The website price remains ₱3,499 even for an account with a legacy custom price.

Web My page → Sharing → **Print A4 poster** prepares the images and fonts, then prints one A4 sheet or saves it through the browser's PDF option. Mobile My page → Sharing → **Share printable poster PNG** rasterizes the SVG at A4 print resolution, independently of the thumbnail size. It adjusts iOS point bounds for the device scale and removes temporary files after sharing. Neither export saves edits, changes the account or records a referral visit.

## Preview generation

Web and mobile render `ShopLinkView`, the same presentation used by the public shop link. Mobile bundles that view, its styles, fonts and example images in a standalone HTML document using the already-installed native WebView. No production preview URL, sign-in token or local-network connection is needed. An uploaded profile photo still needs its HTTPS image to be available.

After changing the public page, its assets or styles, run:

```powershell
npm.cmd run mobile:preview:build
npm.cmd run check:mobile-preview
```

Commit the generated `apps/mobile/generated/creatorPagePreview.ts` with its source changes. The normal root mobile bundle command rejects stale output. Direct Expo/EAS export workflows must run `check:mobile-preview` first too.

The WebView receives only the public creator-card fields and public app-store links through a versioned ready/render/acknowledgement bridge. It does not open the referral route or record attribution. API requests, forms, popups and outgoing navigation are blocked; HTTPS profile images may load and local page anchors can scroll. Old acknowledgements cannot replace the latest draft. Closing preview/account changes discards the document.

## Manual verification

1. Open mobile Home → My page → Page details. Change the name/message and preview them before saving.
2. Open Your offer: it must show the fixed 30% offer (₱3,499, saving ₱1,500, commission ₱1,750) without price controls. Return to Page details and preview; the profile draft should remain unchanged. Save page must send no price field.
3. Clear an optional social link back to its original empty value. The page should return to a clean state.
4. Check the full preview, including the portrait, creator code, app buttons and lower page sections. Links and Copy must stay inactive inside preview.
5. Check Sharing while profile drafts exist. Its link, QR and poster must use the saved public details and fixed 30% offer, including the actual saved creator code.
6. Check suspended, offline and admin-sample states. Preview may render, but saves/sharing stay locked. Keyboard dismissal and the save controls must not cover inputs or preview content.
7. On web, move between the portal overview and My page. Navigation order, identity and footer should remain consistent, with My page marked current in the editor.
