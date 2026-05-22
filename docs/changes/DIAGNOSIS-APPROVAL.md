# Diagnosis — Creator Verification & Signup Issues (2026-05-22)

> Hand this entire document to the web agent. It supplements [WEB-SYNC-MOBILE-FEATURES.md](./WEB-SYNC-MOBILE-FEATURES.md) with diagnoses for three live bugs found during mobile QA. Read both docs together. Where this doc says "fix on web side," that's your work.

---

## Three issues reported by mobile QA

### Issue #1 — Certificate appeared on mobile before admin verification ✅ FIXED on mobile

**Symptom:** After passing the onboarding quiz, the mobile app immediately rendered the certificate (with creator name, date, share/download buttons) on the success screen — before admin had approved.

**Root cause:** [`ndm/app/(app)/certification-quiz.tsx`](../../app/(app)/certification-quiz.tsx) was unconditionally rendering `<CertificateCard>` on the pass screen. The "Submit for review" button beneath it called `markQuizPassed` (which only sets `quizPassedAt`), but the certificate UI was already visible. Visually misleading — the user thought they were already certified.

**Fix (mobile, already shipped):**
- `<CertificateCard>` now only renders when `creator.certifiedAt` is set
- Until then, a "Your certificate is on its way / PENDING ADMIN APPROVAL" placeholder appears
- Share button in the header is hidden until certified
- Certificate remains accessible from the Profile tab AFTER admin approval

**Web-side action required:** None. This was a pure mobile UI bug.

---

### Issue #2 — Pending creators not appearing in admin "Pending Approval" queue 🚨 INVESTIGATE WEB SIDE

**Symptom:** Mobile QA passed the quiz on a test account → `quizPassedAt` should now be set on that creator → admin opens the web "Pending Approval" page → the creator doesn't appear. Multiple refreshes don't help.

**Mobile side verification (already passed):**

- ✅ Quiz pass calls `api.creators.markQuizPassed` ([certification-quiz.tsx:210](../../app/(app)/certification-quiz.tsx#L210))
- ✅ `markQuizPassed` mutation correctly sets `quizPassedAt: Date.now()` ([creators.ts:280-296](../../convex/creators.ts#L280-L296))
- ✅ The mobile creator IS routed to `/(app)/pending-review` after the quiz pass — visible proof that `quizPassedAt` propagated to the client

So the mobile is doing its part. The bug is on the web side or in the deployed prod state. **Run these diagnostics in order:**

#### Diagnostic 1 — Is the creator row actually showing `quizPassedAt` in prod Convex?

1. Open https://dashboard.convex.dev → switch deployment to `prod:energetic-panther-693`
2. **Data** tab → `creators` table
3. Filter by `email` = the test account's email
4. Inspect the row:
   - Is `quizPassedAt` set (a number, not null)?
   - Is `certifiedAt` null?
   - Is `isDeleted` null/false?

**If `quizPassedAt` is null or missing on the row →** the mobile-prod deploy is missing the `quizPassedAt` schema field. This means **Step 1c of WEB-SYNC-MOBILE-FEATURES.md was not applied** to the web repo's schema before the last prod deploy. Apply Step 1c, redeploy.

**If `quizPassedAt` IS set and `certifiedAt` IS null →** the data is correct; the bug is in the admin UI or the query. Continue to Diagnostic 2.

#### Diagnostic 2 — Does `listPendingApproval` exist on prod and return the right rows?

1. Convex dashboard → prod → **Functions** tab
2. Search for `creators:listPendingApproval`

**If it's not listed →** Step 8 of WEB-SYNC-MOBILE-FEATURES.md was not deployed. Apply, then deploy.

**If it IS listed →** click into it → **Run function** with args `{}`. You must be signed in as an admin (Clerk ID in `ADMIN_CLERK_IDS` env var on the prod deployment).

- **If you get "Forbidden: admin access required" →** the env var `ADMIN_CLERK_IDS` doesn't include your Clerk ID on the prod deployment. Set via:
  ```
  npx convex env set ADMIN_CLERK_IDS "user_abc,user_xyz,..." --prod
  ```
  Comma-separated, no spaces. Include every admin Clerk ID.
- **If it returns `[]`** but you saw a `quizPassedAt`-set creator in the Data tab → check the filter logic:
  ```typescript
  all.filter((c) => c.quizPassedAt && !c.certifiedAt && !c.isDeleted)
  ```
  If your test creator has `isDeleted: true` (from a previous test cycle), the filter excludes them. Clear the `isDeleted` field in the Data tab or test with a fresh creator.
- **If it returns the test creator** → the data + backend are correct. Bug is in the web admin UI — see Diagnostic 3.

#### Diagnostic 3 — Is the web admin UI actually calling `listPendingApproval`?

Open the admin Pending Approval page → DevTools → Network tab. Look for the Convex websocket request that should send `query: "creators:listPendingApproval"`.

- **If the call is missing →** the UI was wired to a different function (maybe an older `getByStatus` or `getAllWithStats`). Re-wire to the new query per [WEB-SYNC § Step 10 Surface A](./WEB-SYNC-MOBILE-FEATURES.md).
- **If the call returns 200 with the test creator in the array →** the data IS arriving; the UI just isn't rendering it. Check that the page renders each row from `data?.leads` (or whatever variable holds the result) and isn't filtering it out client-side.

#### Diagnostic 4 — Reactive update vs cached stale data

If admin opens the page BEFORE the mobile creator passes the quiz, then mobile passes — the page should auto-update within ~1s (Convex queries are reactive). If it doesn't:

- The admin's Convex client may not be subscribed. Verify the admin web is using `useQuery(api.creators.listPendingApproval, {})` (not `convex.query(...)` in a useEffect, which is one-shot).
- Hard refresh (`Ctrl+Shift+R`) should always fix it — if not, the data isn't actually in prod.

#### Most likely cause based on the symptom

Given the user said "tried multiple refresh page nothing appears" with no errors mentioned, the most likely cause is **either**:
- **A. Step 1c of WEB-SYNC was never applied** — `quizPassedAt` field doesn't exist in the deployed schema, so mobile's mutation silently no-ops (or the dashboard Data tab doesn't show the field)
- **B. Step 8 was never applied** — `listPendingApproval` function doesn't exist in prod
- **C. `ADMIN_CLERK_IDS` env var not set** on prod — every admin call returns "Forbidden"

Run Diagnostic 1 + 2 to pinpoint which.

---

### Issue #3 — New signups appear in Clerk but NOT in Convex `creators` table

**Symptom:** Mobile QA creates a new account via the signup page → Clerk dashboard shows the user → Convex `creators` table does NOT have the row → admin "Creator Management" page doesn't show the new creator.

#### Three signup paths to consider

The mobile signup flow has **three** entry points, each with different Convex-creation behavior:

| Path | Convex create call site | Before fix | After fix (today) |
|---|---|---|---|
| **A. Email/password** | `handleVerify` after Clerk verifies the 6-digit code | ✅ Calls `createCreator` (could silently fail) | ✅ Still calls `createCreator` + logs failures to console |
| **B. Google OAuth** | None | ❌ Never calls `createCreator` | ✅ Now calls `createCreator` from Google profile data |
| **C. TikTok OAuth** | None directly — TikTok modal collects fields then... | ⚠️ Likely incomplete | ⚠️ Out of scope for today's fix (TikTok is feature-flagged off in production) |

Plus a **safety net**: `(tabs)/index.tsx:97-117` auto-creates the creator when home screen mounts and `creator === null`. This catches BOTH paths if anything slips through.

#### Fixes shipped (mobile)

**Path A (email/password):**
- `createCreator` call wrapped in try/catch so failures don't silently kill the rest of the verification flow
- Failures logged to console with `[SignUp] createCreator failed AFTER Clerk verification` prefix so QA sees them in Sentry/console
- User is still signed in via `setActive` — the home-screen auto-create useEffect will retry

**Path B (Google OAuth):**
- Now extracts `clerkId`, `email`, `firstName`, `lastName` from the Clerk SSO result
- Calls `createCreator` BEFORE `setActive` (best-effort, doesn't block sign-in)
- Failures logged the same way

#### Why this might still need web-side action

If the mobile creator creation is now firing but Convex STILL doesn't have the row, the failure is happening server-side. Likely causes:

##### Cause 1 — Schema mismatch causes `creators.create` mutation to throw on prod

The mutation does `ctx.db.insert("creators", {...})` ([creators.ts:68-93](../../convex/creators.ts#L68-L93)). If the prod schema is stricter than mobile expects (e.g., a field mobile passes as `undefined` but prod requires non-null), the insert throws and the mobile catch block logs it silently.

**Diagnosis:**
1. Convex dashboard → prod → **Logs** tab
2. Filter for `Failed to insert document into table 'creators'`
3. The error tells you which field is failing

##### Cause 2 — `createCreator` mutation itself is missing from prod

Less likely (it's an existing function) but worth checking: prod Functions tab → confirm `creators:create` is listed.

##### Cause 3 — Mobile creator is being created on **dev** Convex, not prod

If mobile QA is running against the dev deployment (`dev:diligent-ibex-454`) but admin is checking prod (`prod:energetic-panther-693`), the data won't show on the admin side.

**Diagnosis:**
- Check `ndm/.env.production` → confirm `EXPO_PUBLIC_CONVEX_URL=https://energetic-panther-693.convex.cloud`
- Mobile QA must have been testing the **release-built APK** (which uses `.env.production`) — NOT the `npm start` dev session (which uses `.env.local` → dev deployment).
- If QA was using dev, that's why prod admin doesn't see the data. Build a release APK and re-test.

##### Cause 4 — Admin "Creator Management" UI is filtering out new accounts

Some admin UIs filter by `certifiedAt != null` (only show "active" creators). A brand-new account has neither `quizPassedAt` nor `certifiedAt` set — it'd be filtered out.

**Diagnosis:** check the web admin's query — is it using `creators:getAllWithStats` or a custom one? If it filters by `status === "active"` or excludes non-certified, the new account won't show even though it's in the DB.

**Fix:** the admin page should show ALL creators (or have an "Uncertified" filter tab) so new signups are visible immediately, not just after they've completed quiz + admin approval.

---

## What the mobile team has done (summary)

| Change | File | Behavior |
|---|---|---|
| Certificate gated behind `certifiedAt` | [certification-quiz.tsx](../../app/(app)/certification-quiz.tsx) | Cert + share button hidden until admin approves |
| "Pending review" placeholder added | [certification-quiz.tsx](../../app/(app)/certification-quiz.tsx) | Editorial yellow card explaining 24h review window |
| Google SSO now creates Convex creator | [signup.tsx:238-310](../../app/(auth)/signup.tsx#L238-L310) | Best-effort; logs failures clearly |
| Email/password create failures surfaced | [signup.tsx:190-225](../../app/(auth)/signup.tsx#L190-L225) | try/catch around `createCreator`; loud console error |

The home-screen auto-create remains as a safety net for all paths.

## What the web team needs to do

### Critical (fixes Issue #2)

- [ ] Verify Step 1c of [WEB-SYNC-MOBILE-FEATURES.md](./WEB-SYNC-MOBILE-FEATURES.md) was applied (`quizPassedAt` field on `creators`)
- [ ] Verify Step 8 was deployed (`listPendingApproval`, `markQuizPassed`, `approveCreator` functions exist in prod)
- [ ] Verify `ADMIN_CLERK_IDS` env var is set on prod and includes the admin Clerk ID
- [ ] Run Diagnostic 1, 2, 3 from the Issue #2 section to pinpoint where the chain breaks
- [ ] Once data confirmed in Convex, ensure the admin Pending Approval page uses `useQuery(api.creators.listPendingApproval, {})` for reactive updates

### Critical (fixes Issue #3)

- [ ] Check prod Logs for `Failed to insert document into table 'creators'` after a fresh signup
- [ ] Verify QA was testing against the **release APK** (which targets prod), not the `npm start` dev session
- [ ] Audit the admin Creator Management page query — confirm it lists ALL creators, not just `certifiedAt` ones. New signups should appear immediately on the admin page even before they've taken the quiz.

### Nice-to-have

- [ ] On the admin Creator Management page, add a column or badge showing certification state per creator:
  - **"Not started"** = neither `quizPassedAt` nor `certifiedAt`
  - **"Pending approval"** = `quizPassedAt` set, `certifiedAt` null (link to Pending Approval queue)
  - **"Certified"** = `certifiedAt` set
  - **"Deleted"** = `isDeleted` true
- [ ] Sort the Pending Approval queue by `quizPassedAt` ASC (oldest first) so admins handle the longest-waiting first
- [ ] Show a count badge in the admin sidebar nav when `listPendingApproval` count > 0

## Quick sanity test after web fixes

Run this end-to-end after deploying the web fixes:

1. **Mobile (release APK):** sign up a fresh email/password account → user appears in Clerk + Convex `creators` table immediately
2. **Mobile:** complete training → take quiz → pass → click "Submit for review" → routed to `/pending-review`
3. **Mobile:** Convex `creators` row now has `quizPassedAt` set, `certifiedAt` null
4. **Web admin:** open Pending Approval page → the test creator appears in the queue within 1s (no refresh needed)
5. **Web admin:** click Approve → `certifiedAt` is set → notification sent to the creator
6. **Mobile:** the `/pending-review` screen auto-navigates to home (the reactive query detected `certifiedAt`)
7. **Mobile:** Profile → tap "View Certificate" → certificate is now visible AND shareable

All seven steps green = both issues fixed end-to-end.

## Files referenced in this diagnosis

- [WEB-SYNC-MOBILE-FEATURES.md](./WEB-SYNC-MOBILE-FEATURES.md) — full sync prompt with all schema + function additions
- [ndm/convex/creators.ts](../../convex/creators.ts) — `create`, `markQuizPassed`, `approveCreator`, `listPendingApproval`
- [ndm/convex/schema.ts](../../convex/schema.ts) — creators table with new `quizPassedAt` field
- [ndm/app/(app)/certification-quiz.tsx](../../app/(app)/certification-quiz.tsx) — quiz pass flow, certificate gating
- [ndm/app/(auth)/signup.tsx](../../app/(auth)/signup.tsx) — three signup paths
- [ndm/app/(app)/(tabs)/index.tsx](../../app/(app)/(tabs)/index.tsx) — home screen auto-create safety net + routing gate
