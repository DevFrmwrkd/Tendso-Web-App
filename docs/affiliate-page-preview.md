# Affiliate page editor and public preview

Web My page is a section of the creator portal at `/v2/creators/portal/my-page`. It uses the same navigation, account identity and footer as the overview. The previous `/affiliates/dashboard/my-page` address redirects there. Both addresses retain the existing affiliate account gate; admin samples stay inside their protected preview routes.

Mobile **Edit your page** has Page details, Your offer and Sharing sections, plus Edit/Preview switching. Save page changes only the public profile fields; Save price changes only the website price for future orders. Switching sections and previewing must preserve unsaved drafts. Sharing and QR materials use saved values.

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

1. Open mobile My creator page → Edit page. Change the name/message and preview them before saving.
2. Change the offer, switch back to Page details, then preview. Both drafts should remain. Saving either section must leave the other draft untouched.
3. Clear an optional social link back to its original empty value. The page should return to a clean state.
4. Check the full preview, including the portrait, creator code, app buttons and lower page sections. Links and Copy must stay inactive inside preview.
5. Check Sharing while drafts exist. Its link, QR and poster must still describe the saved offer.
6. Check suspended, offline and admin-sample states. Preview may render, but saves/sharing stay locked. Keyboard dismissal and the docked footer must not cover inputs or preview content.
7. On web, move between the portal overview and My page. Navigation order, identity and footer should remain consistent, with My page marked current in the editor.
