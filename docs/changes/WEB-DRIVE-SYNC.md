# Web-side fix — Google Drive per-submission folder sync

> **Single self-contained brief for the web agent.** Hand this entire document to the agent / developer working in the web repo. Goal: get the Drive sync (folders + files per approved submission) working end-to-end in production. Currently folders are being created but files fail to upload — root cause is split across one code bug (fixable) and one Google policy constraint (architectural — requires a decision).
>
> **Created 2026-06-01.** Mobile team owns this brief; web team owns the deploy. As with every other Convex change, mobile must NOT run `npx convex deploy`. All deploys go through the web repo.

---

## TL;DR

1. **One real bug, fixable today:** `convex/drive.ts` was calling `fetch()` directly on Convex storage IDs (e.g. `"images/175...av801pum.jpg"`), which throws `Failed to parse URL from images/...`. Mobile team patched `ndm/convex/drive.ts` with a `resolveFetchableUrl()` helper that distinguishes raw storage IDs from full URLs and calls `ctx.storage.getUrl()` for the former. **Web agent: port this change to the web repo's `convex/drive.ts` and deploy.**

2. **One Google policy blocker — DECISION MADE: implement Path B (OAuth user delegation).** Google service accounts have zero personal storage quota and cannot upload files to a free Gmail's "My Drive." Project owner has chosen the free path: do an OAuth flow once as `frmwrkd.media@gmail.com`, store the refresh token in Convex env, use the user's identity for all Drive uploads. Files land in the user's 15 GB free quota. **Full implementation steps for the web agent are in the "🟢 Path B — chosen implementation (project owner has decided)" section below.** Paths A and C are kept in the doc as fallback context if Path B ever needs to be revisited.

---

## Bug 1 — Convex storage ID → URL resolution (READY TO DEPLOY)

### Symptom (from prod logs)

```
driveSyncError "Partial:
photo-01.jpg: Fetch images/1780282669962-av801pum.jpg: Failed to parse URL from images/1780282669962-av801pum.jpg;
photo-02.jpg: Fetch images/1780282674032-80uaj51d.jpg: Failed to parse URL from ...;
photo-03.jpg: Fetch images/1780282675257-j2mv0nd6.jpg: Failed to parse URL from ..."
```

### Root cause

Submissions store photos/video/audio as raw Convex storage IDs in fields `photoUrls: string[]`, `videoUrl: string | null`, `audioUrl: string | null`. The IDs look like `images/1780282669962-av801pum.jpg` — NOT full URLs.

The pre-2026-06-01 `drive.ts` called `fetch(url)` directly on these strings:

```typescript
// ❌ BROKEN — fetch can't parse a raw storage ID
const buf = await fetchToArrayBuffer(url);
```

`fetch()`'s URL parser requires a scheme (`https://...`). Storage IDs lack a scheme. Result: `Failed to parse URL from images/...`, thrown as a `TypeError`, caught by the per-file try/catch, logged as "Drive sync: photo N failed", and the file silently skipped.

### Fix (already applied in `ndm/convex/drive.ts`)

Added a `resolveFetchableUrl(ctx, urlOrStorageId)` helper that:
- If the string starts with `http://` or `https://`, return it unchanged
- Otherwise, treat it as a Convex storage ID and call `await ctx.storage.getUrl(id)` to convert it to a signed fetchable URL
- Throws a clear error if the storage ID can't be resolved (so future debugging takes seconds, not hours)

The helper is called before every `fetchToArrayBuffer()` call in the photos, video, and audio upload sites.

### Web agent action

1. Open mobile's `ndm/convex/drive.ts` and the web repo's `convex/drive.ts` side by side.
2. Find the section that creates `resolveFetchableUrl` (in mobile's file, search for `// 2026-06-01 — Resolve a submission's photo/video/audio reference`).
3. Copy the entire helper function (~25 lines) into the web repo's `convex/drive.ts`, placed just after `fetchToArrayBuffer`.
4. Also add the import line near the top: `import type { Id } from "./_generated/dataModel";`
5. In the web repo's `syncSubmissionToDrive` action, find the three upload sites (photos loop, video block, audio block). For each, replace:
   ```typescript
   const buf = await fetchToArrayBuffer(url);
   ```
   with:
   ```typescript
   const fetchUrl = await resolveFetchableUrl(ctx, ref);
   const buf = await fetchToArrayBuffer(fetchUrl);
   ```
   (and rename the loop variable from `url` → `ref` if needed to make the intent clear). Full diff is in mobile's `ndm/convex/drive.ts` — copy verbatim.

6. `npx convex deploy --prod` from the web repo.

### Verification after deploy

1. Approve a fresh submission (or re-run sync on an existing one via `outscraper.syncSubmissionToDriveManual` if the admin UI exposes it)
2. Convex prod logs should NOT show `Failed to parse URL` errors anymore
3. **But files still won't appear in Drive** until Bug 2 is also fixed — only the photos error category goes away. The transcript and `index.html` will still hit `Service Accounts do not have storage quota`.

---

## Bug 2 — Google service account cannot upload to free Gmail Drive

### Symptom (from same error log)

```
transcript.txt: Service Accounts do not have storage quota.
  Leverage shared drives (https://developers.google.com/workspace/drive/api/guides/about-shareddrives),
  or use OAuth delegation (http://support.google.com/a/answer/7281227) instead.

index.html: Service Accounts do not have storage quota. (same error)
```

### Root cause — this is a Google policy, NOT a code bug

Google service accounts (the `*.iam.gserviceaccount.com` identity we use to call Drive API without a human signing in) have **no personal storage quota**. They CAN:
- ✅ Create folders inside a folder you've shared with them
- ✅ Read files from anywhere they have read access
- ✅ Manage permissions on files owned by others

They CANNOT:
- ❌ Upload files that would count against quota in a personal "My Drive"

The current project setup uses the free Gmail account `frmwrkd.media@gmail.com`. Free Gmail accounts give a personal "My Drive" with 15 GB shared with email + photos. Service accounts can't put files there, period.

This is documented at:
- https://developers.google.com/workspace/drive/api/guides/about-shareddrives
- https://support.google.com/a/answer/7281227

### Bug 2 — 🟢 DECISION: Path B (OAuth user delegation)

> **Project owner has chosen Path B.** This was decided on 2026-06-01 and is the path the web agent must implement. Paths A and C below are kept for context only — do NOT implement them unless the owner reverses the decision. Skip ahead to the "🟢 Path B — chosen implementation" section for the full step-by-step.

#### Path A — Subscribe to Google Workspace, use a Shared Drive (~$6/user/month)

**Cost:** Google Workspace Business Starter at ~$6/user/month, billed per organization. One seat is enough for the service account scenario (the SA itself doesn't need a seat — only one human admin does).

**Effort:** Low. ~30 minutes total.

1. Subscribe at workspace.google.com (requires a domain — `negosyo-digital.com` or similar). If no domain is owned, register one (~$12/year).
2. In Google Drive, click "Shared drives" → "+ New" → name it "Negosyo Digital".
3. Open the new Shared Drive's settings → Members → Add the service account email (`negosyo-digital@negosyo-digital-ea2d00095fcd.iam.gserviceaccount.com` or whatever it is — find it in `negosyo-digital-ea2d00095fcd.json` under `client_email`). Grant **Content Manager** role.
4. Copy the Shared Drive's folder ID from the URL (after `/drive/folders/`).
5. Update Convex env:
   ```
   npx convex env set GOOGLE_DRIVE_PARENT_FOLDER_ID <new-shared-drive-folder-id> --prod
   ```
6. Code change: every Drive API call needs `supportsAllDrives=true` query param. In `convex/drive.ts`:
   - `driveCreateFolder`: append `?supportsAllDrives=true` to the POST URL
   - `driveUploadFile`: append `&supportsAllDrives=true` to the upload URL (already has `?uploadType=multipart&fields=id`)
   - Any other Drive API call: add `supportsAllDrives=true`

   Search for `DRIVE_API_BASE` and `DRIVE_UPLOAD_BASE` to find all call sites.

**Pros:** Files land in a proper team-managed Shared Drive that doesn't count against any individual's 15 GB. Workspace-side benefits (custom domain email, etc.) come along.

**Cons:** Ongoing cost (~$72/year minimum). Requires domain ownership.

#### Path B — OAuth user delegation (free, but capped at 15 GB)

Instead of using a service account, do an interactive OAuth flow once with `frmwrkd.media@gmail.com`, store the refresh token in Convex env, and use the user's identity for all Drive uploads. Files land in the user's My Drive and count against their 15 GB free quota.

**Cost:** $0.

**Effort:** Medium. ~3–4 hours of dev time.

1. Set up a Google Cloud OAuth consent screen (External, testing mode is fine for one user)
2. Create an OAuth Client ID (Web application type)
3. Build a one-time auth URL, sign in as `frmwrkd.media@gmail.com`, accept Drive scope
4. Capture the authorization code, exchange for a refresh token
5. Store the refresh token in Convex env: `npx convex env set GOOGLE_DRIVE_USER_REFRESH_TOKEN <token> --prod`
6. Rewrite `getAccessToken()` in `convex/drive.ts` to use the refresh token instead of the SA JWT exchange. Token endpoint: `https://oauth2.googleapis.com/token`, grant_type: `refresh_token`.
7. Delete the SA-related code paths (JWT signing, etc.) — keep them if you want to support both modes via env-var toggle.
8. Files now count against the user's 15 GB. If each submission archive is ~50 MB (10 photos + 1 video + 1 audio + transcript), you can store ~300 submissions before hitting the cap.

**Pros:** Free. Existing free Gmail account works.

**Cons:** 15 GB cap (~300 submissions). Refresh tokens expire if unused for 6 months — you'd need to re-auth periodically. If `frmwrkd.media@gmail.com` ever locks out (password change, 2FA reset), the sync breaks until re-auth.

#### Path C — Drop Drive entirely, use Convex storage + a custom browse UI

Stop uploading to Drive. Keep the files in Convex storage (where they already are). Build a simple admin web page that:
- Lists submissions
- For each, links to a virtual "folder" view that shows the photos, video, audio, transcript with download buttons
- Optionally generates a downloadable ZIP per submission on demand (Convex action that streams a zip back)

**Cost:** $0 incremental (you're already paying for Convex storage).

**Effort:** Medium-high. ~1–2 days of dev time to build the browse UI + ZIP download. But it eliminates the entire Drive integration (delete `convex/drive.ts`, env vars, OAuth setup).

**Pros:** No external dependency on Google policy. No 15 GB cap. No subscription cost. Files stay in one system.

**Cons:** Loses the "open in Google Drive on my phone" convenience. Admin team has to use the new web UI to access archives.

### Recommended decision matrix

| If you want | Pick |
|---|---|
| Folders/files visible in Google Drive UI, willing to pay ~$6/mo | Path A (Shared Drive) |
| Folders/files visible in Google Drive UI, free, OK with 15 GB cap and re-auth burden | Path B (OAuth user) |
| Self-contained system, no Google dependency, control the UX | Path C (Convex + custom browse) |

**Mobile team's recommendation: Path B if you want this working THIS WEEK for free; Path A if you can absorb $72/year and want to forget about it.** Path C is the "right long-term" answer but is the most work.

### Web agent action

**Decision is already made — Path B.** Skip ahead to the implementation section below. Paths A and C are kept for reference but should not be implemented unless the project owner explicitly reverses Path B.

---

## 🟢 Path B — chosen implementation (project owner has decided)

This is the path the web agent will implement. Three things have to happen on the web side:

1. A one-time OAuth setup in Google Cloud Console (~15 min, web agent does this with help from project owner for the sign-in step)
2. A code rewrite of `getAccessToken()` in `convex/drive.ts` to use the user refresh token instead of the SA JWT exchange (~30 lines of code, replaces ~60 existing lines)
3. Deploy + verify

### Step B.1 — Google Cloud Console OAuth setup

The project likely already has a Google Cloud project (the existing service account `negosyo-digital-ea2d00095fcd@*.iam.gserviceaccount.com` lives there, and the Google Maps API key `AIzaSyAt-knwNJgQ-Nx5ZY5aZUC-T8sj8D3QZ7U` is also bound to it). **Use the SAME Google Cloud project** — don't create a new one.

1. Open https://console.cloud.google.com → select project `negosyo-digital` (or whatever name matches the existing SA's project)
2. Left nav → **APIs & Services** → **OAuth consent screen**
3. If not already set up, configure:
   - User Type: **External**
   - App name: `Negosyo Digital Drive Sync`
   - User support email: `frmwrkd.media@gmail.com`
   - Developer contact: `frmwrkd.media@gmail.com`
   - Save → continue
4. Scopes → click "Add or remove scopes" → search for and add:
   - `https://www.googleapis.com/auth/drive` (full Drive read/write — needed because the sync creates folders AND uploads files)
   - You can use `auth/drive.file` if you want a tighter scope (only files the app creates), but `auth/drive` is simpler given we manage the folder hierarchy
5. Save and continue. Skip "Test users" for now (we'll add `frmwrkd.media@gmail.com` in the next step if app is in testing mode, or publish it to skip the test-user requirement).
6. Back to **APIs & Services** → **Credentials** → **+ Create credentials** → **OAuth client ID**
7. Application type: **Web application**
8. Name: `Negosyo Digital OAuth`
9. **Authorized redirect URIs** — add one:
   - `http://localhost:3000/oauth/drive/callback` — for the one-time auth flow
   - (We're not building a permanent OAuth login UI. Localhost is fine because we'll only sign in once to capture the refresh token.)
10. Create → copy the **Client ID** and **Client Secret** — save them somewhere temporarily (we'll put them in Convex env in Step B.3)

### Step B.2 — Capture the refresh token (one-time, manual)

This is a one-time manual flow. The project owner does this ONCE on their laptop. After this, the refresh token lives in Convex env and the sync uses it automatically forever (or until 6 months of dormancy, at which point re-auth).

Two equivalent ways to do this:

**Option B.2.a — Use Google's OAuth 2.0 Playground (easiest)**

1. Open https://developers.google.com/oauthplayground
2. Top-right gear icon → check "Use your own OAuth credentials" → paste the Client ID + Client Secret from Step B.1
3. Step 1 left panel → scroll to "Drive API v3" → check `https://www.googleapis.com/auth/drive`
4. Click **Authorize APIs** → sign in as `frmwrkd.media@gmail.com` → consent
5. You'll be redirected back. Step 2 panel now shows an "Authorization code". Click **Exchange authorization code for tokens**
6. Step 2 panel now shows `Access token` AND `Refresh token`. **Copy the refresh token** — it's a long string starting with `1//`
7. The access token expires in 1 hour. We only need the refresh token.

**Option B.2.b — Do it manually with curl (alternative)**

```bash
# Open this URL in browser, sign in as frmwrkd.media@gmail.com, accept Drive scope:
# Replace CLIENT_ID with the one from Step B.1
https://accounts.google.com/o/oauth2/v2/auth?client_id=CLIENT_ID&redirect_uri=http://localhost:3000/oauth/drive/callback&response_type=code&scope=https://www.googleapis.com/auth/drive&access_type=offline&prompt=consent

# You'll be redirected to a localhost URL that won't load (no server running). That's fine.
# Copy the `code=...` value from the failed URL.

# Exchange the code for a refresh token:
curl -X POST https://oauth2.googleapis.com/token \
  -d "code=AUTHORIZATION_CODE_FROM_ABOVE" \
  -d "client_id=CLIENT_ID" \
  -d "client_secret=CLIENT_SECRET" \
  -d "redirect_uri=http://localhost:3000/oauth/drive/callback" \
  -d "grant_type=authorization_code"

# Response includes refresh_token. Copy it.
```

> ⚠️ **`prompt=consent` is required** for Google to issue a refresh token on subsequent auths. Without it, you only get an access token (1-hour) and no refresh capability.
>
> ⚠️ **`access_type=offline` is also required.** Without it, no refresh token.

### Step B.3 — Set Convex env vars

```bash
npx convex env set GOOGLE_DRIVE_OAUTH_CLIENT_ID <Client ID from B.1> --prod
npx convex env set GOOGLE_DRIVE_OAUTH_CLIENT_SECRET <Client Secret from B.1> --prod
npx convex env set GOOGLE_DRIVE_USER_REFRESH_TOKEN <refresh token from B.2> --prod
```

The existing `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` env var becomes unused — keep it for now in case we need to roll back, but the new `getAccessToken()` will ignore it.

The existing `GOOGLE_DRIVE_PARENT_FOLDER_ID` env var stays as-is — it's still the ID of the "Negosyo Digital" folder in `frmwrkd.media@gmail.com`'s My Drive.

### Step B.4 — Rewrite `getAccessToken()` in `convex/drive.ts`

Find the current `getAccessToken()` function (around line 45). Replace its entire body with the OAuth-refresh flow:

```typescript
let _cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Cached token is still valid? Return it. (Tokens last ~1 hour; refresh
  // 60s early to avoid edge cases.)
  if (_cachedToken && _cachedToken.expiresAt > Date.now() + 60_000) {
    return _cachedToken.token;
  }

  const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_USER_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Drive OAuth env vars not configured. Need GOOGLE_DRIVE_OAUTH_CLIENT_ID, " +
      "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET, and GOOGLE_DRIVE_USER_REFRESH_TOKEN. " +
      "See WEB-FIX-DRIVE-SYNC-2026-06-01.md Step B for the one-time setup.",
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Drive OAuth refresh failed: ${res.status} ${body.slice(0, 300)}. ` +
      `The refresh token may have expired (6+ months dormant) or been revoked. ` +
      `Re-run the manual auth in WEB-FIX-DRIVE-SYNC-2026-06-01.md Step B.2.`,
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  _cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}
```

**Lines that can be DELETED after this change:**
- The `ServiceAccountKey` type (~5 lines)
- The `signServiceAccountJwt` function and any RSA/crypto helpers (entire SA JWT codepath, possibly 80+ lines)
- The original `getAccessToken` body that parsed `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` and signed JWTs

Search for `signServiceAccountJwt` and `ServiceAccountKey` in the file to find all the SA-specific code. Delete it all — Path B doesn't use any of it.

### Step B.5 — Sanity check the file structure

After the rewrite, `convex/drive.ts` should be SHORTER than before (the OAuth-refresh path is ~30 lines vs. SA JWT which is ~80+). The exports stay the same:
- `syncSubmissionToDriveManual` (admin-only action — unchanged)
- `syncSubmissionToDrive` (internal action — unchanged behavior, just uses the new auth)
- `getSubmissionForSync` (internal query — unchanged)
- `setDriveStatus` (internal mutation — unchanged)

### Step B.6 — Deploy + verify

```bash
# From the web repo
npx convex dev          # sanity-check against dev deployment
npx convex deploy --prod
```

After deploy:
1. Have an admin approve a fresh submission (the one for "VoltTone Guitars" can be re-synced manually if `syncSubmissionToDriveManual` is wired into an admin UI button; otherwise trigger via the Convex dashboard's "Run Function" panel).
2. Check Convex prod logs for `drive:syncSubmissionToDrive` — should succeed (~5–60s depending on file count). No more `Service Accounts do not have storage quota` errors.
3. Open https://drive.google.com signed in as `frmwrkd.media@gmail.com` → navigate to "Negosyo Digital" → open the submission's folder → photos/video/audio/transcript should all be there.

### Step B.7 — Monitor for token expiry

The refresh token persists indefinitely **as long as it's used at least once every 6 months**. With actual submission approval traffic, this won't be an issue. But if the sync goes dormant for 6+ months:

- The next sync attempt will fail with `Drive OAuth refresh failed: 400 invalid_grant`
- Recovery: re-run Step B.2 to get a new refresh token, then re-set `GOOGLE_DRIVE_USER_REFRESH_TOKEN`

Also worth knowing:
- The user (project owner) can revoke this app's access at any time via https://myaccount.google.com/permissions. If they ever do that by accident, sync breaks until re-auth.
- Storage cap: 15 GB shared with Gmail + Photos. At ~50 MB/submission, that's ~300 submissions before hitting the cap. Monitor with `https://drive.google.com/settings/storage`.

### Step B.8 — Optional: add admin alert when token nears expiry

Not required for v1. Worth doing eventually — a Convex cron that calls `getAccessToken()` once a month would refresh the token and keep it warm indefinitely.

---

## Other things the web agent must NOT do

- ❌ **Do NOT run `npx convex deploy` from the mobile repo** — same rule that applies to `outscraper.ts`. Mobile repo's `convex/drive.ts` is the source of truth for the code changes, but deploys ONLY happen from the web repo. If the web repo's `convex/drive.ts` has diverged from mobile (e.g., web added a "Website" subfolder structure with numbered prefixes `01 · Photos / 02 · Video / 03 · Audio / 04 · Transcript / 05 · Website`), preserve those web additions while incorporating mobile's `resolveFetchableUrl` fix.
- ❌ **Do NOT delete the existing folder hierarchy code** — it works. Folders are appearing in Drive correctly. The only thing missing is the file upload step.
- ❌ **Do NOT change the trigger pattern** — `approveSubmission` schedules `syncSubmissionToDrive` via `ctx.scheduler.runAfter(0, ...)`. If `approveSubmission` doesn't actually schedule it yet (mobile team grepped and didn't find the wiring), add that wiring too. Mobile's `ndm/convex/admin.ts` does NOT have this scheduling line currently — that's a separate bug to address.

---

## Deploy checklist for the web agent

In order. Each step is independently verifiable.

1. ✅ **Apply Bug 1 fix** — port `resolveFetchableUrl` from mobile's `ndm/convex/drive.ts`, update the three upload sites
2. ✅ **Path B — Google Cloud OAuth setup (Step B.1)** — create OAuth client ID + secret in the existing GCP project (same project as the SA and Maps API key)
3. ✅ **Path B — capture refresh token (Step B.2)** — project owner signs in once as `frmwrkd.media@gmail.com` via OAuth playground OR curl flow, captures the refresh token
4. ✅ **Path B — set Convex env vars (Step B.3)** — `GOOGLE_DRIVE_OAUTH_CLIENT_ID`, `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`, `GOOGLE_DRIVE_USER_REFRESH_TOKEN`
5. ✅ **Path B — rewrite `getAccessToken()` (Step B.4)** — replace the SA JWT codepath with OAuth refresh-token flow; delete the unused SA helpers (`signServiceAccountJwt`, `ServiceAccountKey`, etc.)
6. ✅ **Verify `approveSubmission` actually schedules `syncSubmissionToDrive`** — grep `convex/admin.ts` for `internal.drive.syncSubmissionToDrive`. If absent, add: `await ctx.scheduler.runAfter(0, internal.drive.syncSubmissionToDrive, { submissionId: args.submissionId });` at the END of the approveSubmission handler (after the existing patch + audit log + notification scheduling)
7. ✅ **Deploy** — `npx convex deploy --prod` from the web repo
8. ✅ **End-to-end test (Step B.6)** — submit a fresh submission via mobile, have an admin approve it, check Drive within 60 seconds. Photos/video/audio/transcript should appear inside the auto-created folders signed in as `frmwrkd.media@gmail.com`. Convex logs should show no errors during the sync action.
9. ⚪ **Optional — monitor token expiry (Step B.7-B.8)** — at a minimum, document that the refresh token requires re-auth if dormant 6+ months. Bonus: add a monthly cron that calls `getAccessToken()` to keep the token warm.

---

## Reference — what the mobile-side fixed file looks like

The patched `ndm/convex/drive.ts` adds:

1. New import: `import type { Id } from "./_generated/dataModel";`
2. New helper between `fetchToArrayBuffer` and `safeFileName`:
   ```typescript
   async function resolveFetchableUrl(
     ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } },
     urlOrStorageId: string,
   ): Promise<string> {
     if (/^https?:\/\//.test(urlOrStorageId)) {
       return urlOrStorageId;
     }
     const resolved = await ctx.storage.getUrl(urlOrStorageId as Id<"_storage">);
     if (!resolved) {
       throw new Error(
         `Could not resolve storage reference "${urlOrStorageId}" to a URL. ` +
           `Either the storage ID is invalid, or this is meant to be a full URL that's missing its scheme.`,
       );
     }
     return resolved;
   }
   ```
3. Three call-site updates in `syncSubmissionToDrive` (photos loop, video block, audio block) — each replaces a direct `fetchToArrayBuffer(url)` with `fetchToArrayBuffer(await resolveFetchableUrl(ctx, ref))`

Diff is small. Copy verbatim.

---

## Mobile source

- `ndm/convex/drive.ts` — patched source of truth for the Drive sync code changes
- Mobile team's submission flow at `ndm/app/(app)/submit/*` writes Convex storage IDs to `submission.photoUrls / videoUrl / audioUrl`. The IDs look like `images/1780282669962-av801pum.jpg`. Drive sync resolves these to fetchable URLs at upload time.

---

## Decisions already made (2026-06-01)

1. ✅ **Path B — OAuth user delegation** — picked. Free, uses `frmwrkd.media@gmail.com`'s 15 GB free Drive quota. ~300 submissions of headroom before the cap.
2. ✅ **Re-auth posture** — accepted. If the refresh token ever expires (6+ months dormancy or revoke), project owner re-runs Step B.2 to mint a new one.
3. ✅ **Long-term migration to Path A or C** — explicitly NOT a v1 concern. Revisit only if/when the 15 GB cap is approached, or if Workspace adoption happens for other reasons.

The web agent has full implementation authority on Path B per the "🟢 Path B — chosen implementation" section. No further product input is needed unless something in Steps B.1-B.6 turns out to be blocked by an unexpected Google Cloud Console behavior.
