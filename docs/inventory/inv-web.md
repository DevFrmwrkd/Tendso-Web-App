# Tendso web app: feature inventory (app/** excluding app/api/** and app/v2/**)

Read-only inventory of `/Volumes/SSD/New Coding Projects/Tendso-App`. Scope: every route under `app/`, plus `proxy.ts`, `next.config.ts`, the root layout and shared shells. Read from page files and their main components; nothing was run. Convex names are as called from the browser/server components in the route's tree (`api.<module>.<fn>`). "REDIRECT" means the route only forwards elsewhere. "DUP" means it overlaps another route.

Roles: visitor = anonymous public, owner = business owner (shop), agent = creator / field agent (Clerk + `creators` row), affiliate = `creators.role==="affiliate"`, staff = internal call-sitter (`role==="staff"`), admin.

### Public marketing

| ID | Feature | Route / file | Who uses it | What it does | Convex fns / external services |
|---|---|---|---|---|---|
| W-001 | Landing page (owner pitch) | `/` — `app/page.tsx` | visitor | Hero, real-sites strip, how-it-works, price (₱999/₱4,999 via `lib/pricing`), FAQ, closing CTA to `/start`; EN/TL toggle; ISR 300s. Primary owner funnel entrance. | `settings.get` (`featured_sites`, via `loadFeaturedSites`), Vercel Analytics |
| W-002 | "Real sites" proof grid with live iframes | `components/landing/RealSitesSection.tsx`, `LiveSitePreview.tsx` (on `/` and `/for-creators`) | visitor | Shows an admin-curated list of real client sites, each rendered as a live preview of its URL; links are server-rendered for crawlers. | `settings.get` `featured_sites` (curated in `/admin/featured-sites`); hardcoded `SHOWCASE_SITES` fallback |
| W-003 | Ask Tendso chatbot widget | `components/landing/ChatBot.tsx` (mounted on `/` and `/for-creators` only) | visitor | Floating pill that opens a RAG chat grounded in the public Help Center; keeps last 6 turns, shows sources, EN/TL copy. | `knowledgeAI.ask` (workspace `help`, source `chatbot`), Gemini RAG |
| W-004 | Creator recruitment page | `/for-creators` — `app/for-creators/page.tsx`, `_components/ForCreators.tsx` | visitor (prospective agent) | Pitch: keep 50% of each sale, 5-step process, needs, real sites, app store buttons, Discord invite, FAQ, jump-nav. CTAs: `/signup` and `/field-agent/book`. Has its own ChatBot variant. | `settings.get` (`play_store_url`, `app_store_url`, featured sites), Discord invite URL |
| W-005 | Affiliate programme pitch | `/affiliates` — `app/affiliates/page.tsx` | visitor | Static explainer (share link, set price ₱999–₱4,999, 50% commission, ₱ referral bonus) with "Become an affiliate" to `/affiliates/join`. Not in sitemap. | none (static) |
| W-006 | Privacy policy | `/privacy-policy` | visitor | Static legal page. | none |
| W-007 | Terms of service | `/terms-of-service` | visitor | Static legal page; references `/my-business` edit policy. | none |
| W-008 | /about | `/about` — `app/about/page.tsx` | visitor | REDIRECT to `/` (query kept). Legacy page merged into landing. | none |
| W-009 | /creators | `/creators` — `app/creators/page.tsx` | visitor | REDIRECT to `/for-creators` (query kept). Still whitelisted as public in `proxy.ts`. | none |
| W-010 | /for-field-agents | `/for-field-agents` — `app/for-field-agents/page.tsx` | visitor | REDIRECT to `/for-creators`. Long comment in `proxy.ts` still describes it as a standalone page. | none |
| W-011 | /contact | `/contact` | visitor | REDIRECT (308) to `/knowledge#contact`. Still linked from the public footer. | none |
| W-012 | /help-faq | `/help-faq` | visitor | REDIRECT (308) to `/knowledge#creator-faq`. | none |
| W-013 | /for-business | `next.config.ts` redirects() | visitor | REDIRECT (308) to `/`. No page file exists; still named in `proxy.ts` public list ("belt and braces"). | none |

### Auth & account

| ID | Feature | Route / file | Who uses it | What it does | Convex fns / external services |
|---|---|---|---|---|---|
| W-014 | Sign in | `/login` — `app/login/page.tsx` | agent, affiliate, staff, admin, owner | Email+password and Google sign-in; always lands on `/dashboard`, which routes each role onward. Ignores the `redirect_url` that `proxy.ts` appends. | Clerk (`useSignIn`, `useSignUp`, Google OAuth) |
| W-015 | Creator sign-up | `/signup` — `app/signup/page.tsx` | visitor (prospective agent) | Clerk `<SignUp>` in hash routing; after sign-up goes to `/onboarding`. `/otr` page copy says "web signup is being retired", yet `/for-creators` still sends people here. | Clerk |
| W-016 | Google OAuth callback | `/auth/sso-callback` | all signed-in roles | "Signing you in" screen wrapping Clerk's redirect callback; forces `/dashboard`. | Clerk `AuthenticateWithRedirectCallback` |
| W-017 | Forgot / reset password | `/forgot-password` | all | 2-step Clerk flow: email, then 6-digit code + new password; auto sign-in then `/dashboard`. | Clerk (`reset_password_email_code`) |
| W-018 | /reset-password | `/reset-password` | all | REDIRECT (308) to `/forgot-password` (query kept). | none |
| W-019 | Onboarding profile | `/onboarding` | new agent | Creates the `creators` row (first/middle/last name, phone, generated referral code, optional referred-by code) then starts certification. Has no branch for business owners. | `creators.create`, `creators.getByClerkId`, `creators.getByReferralCode`, Clerk |
| W-020 | Account page (all roles) | `/profile` — `app/profile/_components/AccountView.tsx` | agent, owner, staff, admin | One account screen in the viewer's own frame (CreatorShell / OwnerShell / AdminLayout): identity, sign-in facts (Google/password), payout (Wise) drawer, certificate, referral code, sign out. | `creators.getByClerkId`, `businessOwners.me`, `businessOwners.getMyWebsites`, `notifications.createForClient`, Clerk |
| W-021 | Edit profile drawer | `/profile?edit=profile` — `EditProfileDrawer.tsx` | agent | Edit name/phone/photo; photo upload to R2. | `creators.update`, `r2.generateUploadUrl` |
| W-022 | Change password drawer | `/profile?edit=password` — `PasswordDrawer.tsx` | agent | Change Clerk password in a drawer. | Clerk |
| W-023 | Bring-your-own Gemini key | `/profile?edit=ai#ai-key` — `AiKeyCard.tsx` | agent | Add / list (masked) / remove a personal Gemini API key that joins the RAG key pool; shows key health and cooldown. | `aiKeys.addMyGeminiKey`, `aiKeys.listMyGeminiKeys`, `aiKeys.removeMyGeminiKey` (AES-256-GCM at rest) |
| W-024 | /edit-profile | `/edit-profile` | agent | REDIRECT to `/profile?edit=profile`. | none |
| W-025 | /change-password | `/change-password` | agent | REDIRECT to `/profile?edit=password`. | none |
| W-026 | /connect-ai | `/connect-ai` | agent | REDIRECT to `/profile?edit=ai#ai-key`. Still in `robots.ts` disallow list. | none |
| W-027 | Notifications drawer | `/notifications` | agent | Drawer over Home listing in-app notifications; mark one/all read; closing returns Home. Only guard is signed-in. | `notifications.getByCreator`, `notifications.markAsRead`, `notifications.markAllAsRead`, `submissions.getByCreatorId` |

### Agent area

| ID | Feature | Route / file | Who uses it | What it does | Convex fns / external services |
|---|---|---|---|---|---|
| W-028 | Creator Home | `/dashboard` — `app/dashboard/_components/CreatorHome.tsx` | agent | "What should I do next?": state line, next-step picker, a shop to visit, referral card, recent activity; also the post-login router (admin to `/admin`, no row to `/onboarding`, uncertified to training via `creatorRedirect`). Touches `updateLastActive`. | `creators.getByClerkId`, `creators.updateLastActive`, `leads.listForMobileCRM`, `referrals.getStats`, `submissions.getByCreatorId`, `withdrawals.getByCreator` |
| W-029 | Certification: lessons | `/training` (guarded) — `app/training/_funnel/LearnPage.tsx` | agent (uncertified) | 5 lessons (lighting, audio, etc.) with tips and a "before you film" action; progress kept locally. | `creators.getByClerkId` |
| W-030 | Certification: lessons (unguarded copy) | `/training-lessons` | agent | DUP of `/training`: same `LearnPage` with `guarded={false}`; only Clerk middleware protects it. | `creators.getByClerkId` |
| W-031 | Certification quiz | `/certification-quiz` | agent (uncertified) | 5-question quiz, 4/5 to pass, unlimited retries; a pass writes `quizPassedAt` (awaiting admin approval, not auto-certified). | `creators.markQuizPassed`, `creators.getByClerkId` |
| W-032 | Pending approval gate | `/pending` | agent (quiz passed) | Locks the creator on "under review" until an admin acts, live via Convex; on approval shows the certificate (download) then "Go to Home". Only escape is sign out. | `creators.getByClerkId` |
| W-033 | Verification rejected | `/verification-rejected` | agent (rejected) | Shows the stored rejection reason, support email, sign out; auto-routes away if the admin clears it. No resubmission flow. | `creators.getByClerkId` |
| W-034 | Leads: ranked prospects + interviewed | `/leads` — `app/leads/_components/LeadsScreen.tsx` | agent | Tabs For you / Claimed by me / All shops (Google Maps prospects) and Interviewed (team-wide lead feed); filters, sort, distance. | `outscraper.listScrapedLeads`, `leads.listForMobileCRM`, `leads.geocodePendingSubmissions`, `creators.getByClerkId` |
| W-035 | Lead drawer (`?lead=<id>`) | `/leads?lead=` — `LeadDrawer.tsx` | agent | Contact, business, interviewers, curated card, notes, status change; for prospects: claim, release, start interview (prefilled submission). | `leads.getDetailForMobileCRM`, `leads.updateStatus`, `leadNotes.add`, `outscraper.getProspect`, `outscraper.claimProspect`, `outscraper.releaseProspect` |
| W-036 | Find a local business | `/leads?find=1` — `components/leads/FindLocalBusinessModal.tsx` | agent | Search nearby Google Maps businesses and reserve one as a prospect. | `prospects.searchNearby`, `prospects.reserve` |
| W-037 | Map: businesses to visit | `/leads/discover` | agent | Map of nearby prospect pins with radius/geolocation, popovers, links into lead drawer. | `outscraper.listScrapedLeads`, `prospects.searchNearby`, Carto tiles |
| W-038 | Map: live Tendso sites | `/leads/live` | agent | Same map component, showing live Tendso client sites near you. | `leads.listForMap` |
| W-039 | /leads/[leadId] | `/leads/[leadId]` | agent | REDIRECT to `/leads?lead=<id>` (kept for old email/app links). | none |
| W-040 | New submission: business info | `/submit/info` | agent | Step 1 of 4: business name/type/owner/contact/address, optionally prefilled from a prospect; creates or updates a draft. | `submissions.create`, `submissions.update`, `submissions.getDraftByCreatorId` |
| W-041 | New submission: photos | `/submit/photos` | agent | Step 2: 3-10 JPG/PNG photos (10 MB each) with a shot list; uploaded to R2. | `r2.generateUploadUrl`, `files.getMultipleUrls`, `submissions.update` |
| W-042 | New submission: owner interview | `/submit/interview` | agent | Step 3: record video/audio in-browser, or upload a file, against 5 scripted questions; pause/flip camera; transcribed. | `r2.generateUploadUrl`, `submissions.update`, `/api/transcribe` |
| W-043 | New submission: review and price | `/submit/review` | agent | Step 4: set sell price (₱999–₱4,999), shows creator commission and owner total, optional custom-domain tier with live availability check, then submit. | `submissions.setDomainTier`, `submissions.submit`, `submissions.getById`, `/api/check-domain` |
| W-044 | Submission success | `/submit/success` | agent | Confirmation with next steps; kicks off a transcription status; clears the draft id from sessionStorage. | `submissions.getById`, `/api/transcribe` |
| W-045 | My submissions list + drawer | `/submissions` | agent | Filter chips (All/In progress/Paid/Drafts/Rejected); drawer with photos, recording, transcript, status, payout, live site, pay-link copy, resume draft; "remind owner" to pay. | `submissions.getByCreatorId`, `files.getMultipleUrls`, `files.getUrlByString`, `generatedWebsites.getBySubmissionId`, `paymentTokens.getBySubmissionId`, `creatorReminders.sendReminder` |
| W-046 | /submissions/[id] | `/submissions/[id]` | agent | REDIRECT to `/submissions?open=<id>`. | none |
| W-047 | Wallet and withdrawals | `/wallet` | agent | Balance, one-line explanation, ledger of earnings and payouts, Wise-email setup and withdraw dialog (no minimum), totals, rules fold; referral link to Wise invite. | `earnings.getByCreator`, `earnings.getSummary`, `withdrawals.create`, `withdrawals.getByCreator`, `creators.update`, Wise |
| W-048 | Referrals | `/referrals` | agent | Shows own referral code and payout rule, people who joined with it, earnings, how-it-works fold, and "enter a referral code" for the invited. | `referrals.getByReferrer`, `referrals.getStats`, `creators.applyReferralCode` |
| W-049 | Book the 10-minute field-agent call | `/field-agent/book` | visitor (prospective agent) | 3-step native booking: pick a slot, name+email, ticket confirmation; honeypot; writes the shared tendso.hr Google Calendar. File comment says "Unlinked by design" but `/for-creators` and `/admin/bookings` link to it (stale comment). | `booking.getAvailability`, `booking.createBooking`, Google Calendar/Meet |
| W-050 | Reschedule / cancel booked call | `/field-agent/manage?t=<token>` | visitor (prospective agent) | Token-authenticated reschedule (keeps Meet link) or cancel; reached only from the confirmation email. | `nativeBookings.getForManage`, `booking.rescheduleByToken`, `booking.cancelByToken` |
| W-051 | Affiliate join | `/affiliates/join` | visitor (prospective affiliate) | Clerk sign-up, then profile (name, phone, unique page handle); account waits for admin approval; blocks creators/owners ("use a different email"). | `affiliates.create`, `creators.getByClerkId`, `businessOwners.me`, Clerk |
| W-052 | Affiliate dashboard: Home | `/affiliates/dashboard` | affiliate | Balance, pending commission, shortcuts, status. | `affiliates.portal` |
| W-053 | Affiliate dashboard: My page | `/affiliates/dashboard/my-page` | affiliate | Edit public page (photo, display name, message, social link), set sell price, share tools (copy link, QR download), referral code card. | `affiliates.updatePage`, `r2.generateUploadUrl` |
| W-054 | Affiliate dashboard: Sales | `/affiliates/dashboard/sales` | affiliate | Paged list of orders through the page with price and commission captured at sale. | `affiliates.sales` |
| W-055 | Affiliate dashboard: Wallet | `/affiliates/dashboard/wallet` | affiliate | Balance, Wise email setup, payout request (shares wallet components with creator `/wallet`). | `affiliates.portal`, `withdrawals.create`, `creators.update` |
| W-056 | Affiliate dashboard: Referrals | `/affiliates/dashboard/referrals` | affiliate | Creator referral code and creators referred. | `affiliates.portal` |
| W-057 | Affiliate dashboard: Account | `/affiliates/dashboard/account` | affiliate | Account status/identity; payouts disabled while suspended. | `affiliates.portal`, `adminAccess.me` |

### Owner area

| ID | Feature | Route / file | Who uses it | What it does | Convex fns / external services |
|---|---|---|---|---|---|
| W-058 | Owner intake funnel (shell + draft) | `/start` — `app/start/page.tsx`, `draft.ts` | owner (no account) | One URL, client-side steps; draft autosaved so nothing is lost; "Save and exit"; one write at the end; reads `?campaign=` / `?src=` / affiliate handle for attribution and pricing. 4 steps (5 for giveaway). | `ownerIntake.submitOwnerIntake`, `affiliates.publicPage`, `giveaway.giveawayStatus` |
| W-059 | /start step 1: basics | `app/start/_components/BasicsStep.tsx`, `MapPicker.tsx` | owner | Business name/type, owner name, PH phone, email, address with map pin picker (Nominatim geocode), optional custom domain request. | `/api/geocode` (rate-limited, Nominatim), Google Maps links |
| W-060 | /start step 2: voice interview | `InterviewStep.tsx`, `VoiceAnswer.tsx` | owner | Record or type answers one question at a time (Taglish); audio transcribed per answer. | `intakeVoice.transcribeAnswer`, `r2.generateUploadUrl` |
| W-061 | /start step 3: photos | `PhotosStep.tsx` | owner | Upload required photo slots (validated type/size) to R2. | `r2.generateUploadUrl` |
| W-062 | /start poster step (giveaway only) | `PosterStep.tsx`, `GiveawayPrize.tsx` | owner (giveaway applicant) | Extra step to upload proof photo of the OTR poster hung in the shop. | `r2.generateUploadUrl` |
| W-063 | /start review and submit | `ReviewStep.tsx`, `quote.ts` | owner | Shows quote (campaign/affiliate price re-derived server-side), confirms, submits once, clears draft, goes to thanks. | `ownerIntake.submitOwnerIntake` |
| W-064 | Intake thanks | `/start/thanks` | owner | Receipt page (email read from sessionStorage, not URL), what happens in 48–72 hours; separate GiveawayThanks variant. | none (sessionStorage) |
| W-065 | Affiliate landing | `/a/[handle]` — `AffiliateLanding.tsx` | owner (arrives from affiliate link) | Affiliate-branded offer: photo, message, price, included list, buy button to `/start`; remembers affiliate; store buttons. Public in `proxy.ts`. | `affiliates.publicPage`, `settings.get` |
| W-066 | Pay for your website | `/pay/[token]` | owner (no account) | Public tokenised payment page: pending / paid / expired / not found; "send by Wise in 3 steps" with copyable Wise email and reference code; overseas fold; "See my website" if signed in as owner. Live via Convex. | `paymentTokens.getByToken`, `submissions.getById`, Wise (manual transfer matched by webhook) |
| W-067 | My website (owner portal home) | `/my-business` | owner | Read-only list/card of claimed sites with status, live URL and payment state. | `businessOwners.getMyWebsites`, `businessOwners.me` |
| W-068 | My website detail | `/my-business/[submissionId]` | owner | Read-only detail of one site (name, status, live URL, lead count); edits are "requested", no self-serve editor. | `businessOwners.getMyWebsites` |
| W-069 | Owner claim link | `/my-business/claim` | owner | REDIRECT to `/my-business`; token dropped. HALF-BUILT: payment email still mints a claim token (`/api/send-website-email`) but nothing consumes it and no UI creates `businessOwners` rows, so new owners cannot reach the portal. | none (`businessOwners.claimWebsite` unused by UI) |

### Admin

| ID | Feature | Route / file | Who uses it | What it does | Convex fns / external services |
|---|---|---|---|---|---|
| W-070 | Admin access gate and frame | `app/admin/layout.tsx`, `components/AdminLayout.tsx`, `lib/admin-access.ts` | admin, staff | Server layout checks Clerk + Convex session and role; staff only reach `/admin`, `/admin/bookings`, `/admin/call-stats`; client gate re-checks live. Sidebar: Today, Submissions, Creators, Leads, Affiliates, Payouts, Calls, Announcements, Train AI, Site settings, Audit log. | `adminAccess.me`, Clerk |
| W-071 | "View as" bar | `components/AdminViewBar.tsx` | admin | Dropdown on every admin page to switch to Creator/Affiliate dashboard previews. | none |
| W-072 | Admin Today | `/admin` — `_components/AdminToday.tsx` | admin | "What needs me today?": counts of things waiting, money line (revenue, creator payouts, Hostinger costs, promo stats) in a fold, plus a one-click backfill of website URLs. | `submissions.getAllWithCreator`, `withdrawals.getByStatus`, `analytics.getAllAnalytics`, `admin.getPromoStats`, `admin.backfillWebsiteUrls`, `domains.getTotalHostingerDomainCostsPHP` |
| W-073 | Staff Today | `/admin` (staff view) — `StaffDashboard.tsx` | staff | Today's field-agent calls with Join buttons, plus a count of finished calls awaiting attendance answers. | `nativeBookings.listForAdmin`, `booking.listCalendarCalls` (via `useCallSchedule`), Google Calendar |
| W-074 | Submissions queue | `/admin/submissions` — `_queue/Queue.tsx` | admin | Status tabs with counts, search, custom-domain/owner/giveaway filters, sort; row drawer with facts + quality checklist; delete via More menu; giveaway open/close toggle and counts. | `submissions.getAllWithCreator`, `submissions.getByStatus`, `giveaway.giveawayReviewStatus`, `giveaway.setEnabled`, `/api/delete-submission` |
| W-075 | Submission review workspace | `/admin/submissions/[id]` (1,468 lines) | admin | Overview before generation; Generate site; then SandboxEditorV3 visual editor docked with details; Approve/Reject, send approval email, publish/unpublish, send website + payment emails and follow-up, mark paid, give free (comp), re-run transcription, enhance images, push to Studio render, sync to Drive, delete. | `/api/generate-website`, `/api/publish-website`, `/api/unpublish-website`, `/api/save-content`, `/api/send-approval-email`, `/api/send-website-email`, `/api/send-payment-followup-email`, `/api/mark-paid`, `/api/mark-comped`, `/api/transcribe`, `/api/delete-submission`; `admin.approveSubmission`, `admin.rejectSubmission`, `admin.markDeployed`, `admin.logImagesEnhanced`, `admin.logTranscriptionRegenerated`, `hyperagent.triggerStudioRenderPublic`, `drive.syncSubmissionToDriveManual`, `websiteContent.getBySubmissionId`, `generatedWebsites.getBySubmissionId`, Cloudflare/Astro build, Airtable/Studio |
| W-076 | Custom-domain fold | `?fold=domain` — `DomainFold.tsx` | admin | Hostinger card on file, domain setup state (registration, DNS, SSL), check alternatives, buy a domain behind a confirm dialog. | `/api/admin/check-domain`, `/api/admin/hostinger-status`, `/api/admin/purchase-domain`, Hostinger |
| W-077 | Emails-sent fold | `?fold=emails` | admin | List/preview of emails sent for the submission. | `/api/preview-email` |
| W-078 | /admin/submissions/[id]/domain | route | admin | REDIRECT to `/admin/submissions/<id>?fold=domain`. | none |
| W-079 | /admin/submissions/[id]/emails | route | admin | REDIRECT to `/admin/submissions/<id>?fold=emails`. | none |
| W-080 | Creators admin (3 tabs + drawer) | `/admin/creators` | admin | Waiting for approval / All / Rejected; drawer with approve ("Let X in"), reject with reason, change role, suspend/reactivate, delete. | `creators.getAllWithStats`, `creators.listPendingApproval`, `creators.listRejected`, `creators.approveCreator`, `creators.rejectCreator`, `creators.updateRole`, `creators.updateStatus`, `creators.getById`, `/api/send-approval-email`, `/api/delete-creator` |
| W-081 | /admin/creators/[id] | route | admin | REDIRECT to `/admin/creators?open=<id>`. | none |
| W-082 | /admin/creators/pending/[id] | route | admin | REDIRECT to `/admin/creators?view=pending&open=<id>`. | none |
| W-083 | /admin/pending-approvals | route | admin | REDIRECT to `/admin/creators?view=pending`. | none |
| W-084 | /admin/rejected-creators | route | admin | REDIRECT to `/admin/creators?view=rejected`. | none |
| W-085 | Leads admin: customer leads | `/admin/leads` — `CustomerLeadsView.tsx`, `LeadDrawer.tsx` | admin | Leads from live-site inquiries/QR scans; status, notes, edit, delete, "social card" curated for the mobile feed; Add lead drawer. | `leads.getAll`, `leads.create`, `leads.update`, `leads.updateStatus`, `leads.updateAdminContent`, `leads.remove`, `leads.generatePreviewImageUploadUrl`, `leadNotes.add`, `leadNotes.getByLead` |
| W-086 | Leads admin: prospects | `/admin/leads` (Prospects tab) — `ProspectsView.tsx` | admin | Google-Maps prospects creators pulled with Find a local business, with claim state. | `outscraper.listScrapedLeads`, Outscraper |
| W-087 | Affiliates admin | `/admin/affiliates` | admin | List affiliates (pending first); Approve / Suspend / Reactivate. | `affiliates.list`, `creators.updateStatus` |
| W-088 | Payouts | `/admin/payouts` | admin | Read-only view of creator withdrawals (Wise); filter by status; drawer with Open in Wise, Check Wise now, notify creator of failure; money fold + revenue chart. | `withdrawals.getAll`, `withdrawals.getByStatus`, `withdrawals.refreshFromWise`, `analytics.getAllAnalytics`, `admin.getPromoStats`, Wise |
| W-089 | /admin/withdrawals | route | admin | REDIRECT to `/admin/payouts?status=all`. | none |
| W-090 | Calls (field-agent bookings) | `/admin/bookings` (tab Calls) | admin, staff | Today's calls with Join + attendance answers, finished-unmarked calls, later bookings, archive, bookable hours editor, calendar sync (admin), out-of-hours cancel+email. | `nativeBookings.listForAdmin`, `nativeBookings.setAttendance`, `nativeBookings.getSlotConfig`, `nativeBookings.saveSlotConfig`, `booking.adoptCalendarCalls`, `booking.cancelOutOfHoursCall`, `booking.syncCancelledBookings`, `booking.syncConferenceDurations`, Google Calendar |
| W-091 | Call stats | `/admin/bookings?tab=stats` — `StatsTab.tsx` | admin, staff | Show-rate and volume stats for calls. | `nativeBookings.statsRows` |
| W-092 | /admin/call-stats | route | admin, staff | REDIRECT to `/admin/bookings?tab=stats`. | none |
| W-093 | Announcements | `/admin/announcements` | admin | Compose email + in-app notification to audience segments or named creators, with recipient search and preview; recent sends list. | `announcements.send`, `announcements.list`, `announcements.previewAudience`, `announcements.searchRecipients` |
| W-094 | Train AI (knowledge) | `/admin/knowledge` | admin | Answer unanswered help-AI questions, bulk paste Q&A (verbatim or AI-answered), review/delete trained Q&A, purge, re-embed, daily-limit reset, add own Gemini key and clear key cooldowns, edit articles. | `knowledgeTraining.*` (`listUnansweredQueries`, `trainQAPairs`, `enqueueTraining`, `listTrainingQA`, `deleteTrainingQA`, `purgeAllTrainedQA`, `purgeUngroundedQA`, `reEmbedPendingQA`, `listTrainingJobs`, `clearFinishedTrainingJobs`, `clearUnansweredQueries`, `resetTrainingDailyLimit`), `knowledge.upsertArticle`, `knowledge.listArticles`, `knowledge.listCategories`, `aiKeys.addMyGeminiKey`, `aiKeys.clearGeminiCooldowns`, `aiKeys.poolStats`, Gemini |
| W-095 | Site settings: featured sites | `/admin/featured-sites` (tab Featured) | admin | Curate, edit, reorder landing "Real sites" list; picks from published sites. | `settings.get`, `settings.set` (`featured_sites`), `generatedWebsites.listPublished` |
| W-096 | Site settings: app links | `/admin/featured-sites?tab=app` — `AppLinksPanel.tsx` | admin | Set Google Play and App Store URLs shown on `/otr` and `/for-creators`; one-time clean-up of old APK. | `settings.get`, `settings.set`, `r2.deleteFile` |
| W-097 | /admin/app-release | route | admin | REDIRECT to `/admin/featured-sites?tab=app`. | none |
| W-098 | Audit log | `/admin/audit` | admin | Newest-first sentence log of admin actions/system events, grouped by day, filter by type/actor/business, drawer with raw fields. | `auditLogs.getRecent`, `auditLogs.getByTarget` |
| W-099 | Creator dashboard preview | `/admin/preview/creator` | admin | Sample-data copy of the creator frame ("View as Creator"); links stay inside preview. | none (sample data) |
| W-100 | Affiliate dashboard preview | `/admin/preview/affiliate?section=` | admin | Sample-data affiliate dashboard (all six sections), edits discarded, payouts disabled. | none (sample data) |

### Hosted sites & previews

| ID | Feature | Route / file | Who uses it | What it does | Convex fns / external services |
|---|---|---|---|---|---|
| W-101 | Customer site hosting | `app/hosted/[slug]/route.ts` (reached only via `*.sites.tendso.com` rewrite) | visitor (shop's customers) | Route Handler serves the stored full-HTML site for the slug from the Host header; injects SEO/JSON-LD/canonical (custom domain wins); 404 noindex for unknown/extra paths; 503 when Convex is down. Replaces the old one-Cloudflare-Worker-per-site model. | `generatedWebsites.getPublishedBySlug`; `lib/site-seo`, `lib/siteSlug` |
| W-102 | Per-site robots.txt and sitemap.xml | same route, `/robots.txt` + `/sitemap.xml` on a site host | crawlers | Generated per site from its canonical URL; offline sites get `Disallow: /`. | `generatedWebsites.getPublishedBySlug` |
| W-103 | Offline holding page | same route | visitor | A site with `offlineAt` serves a themed holding page (200, noindex) instead of content. | `generatedWebsites.getPublishedBySlug` |
| W-104 | Site preview | `/preview/[id]` | agent (own submission), admin | Preview frame with Desktop/Tablet/Phone sizes for a generated site; refuses non-owners; link to live URL. `/api/process-submission` stores `websiteUrl=/preview/<id>`. | `generatedWebsites.getBySubmissionId`, `submissions.getById`, `creators.getByClerkId` |
| W-105 | Raw website render | `/website/[id]` | anyone with the id | Renders a generated site full-screen in an iframe (htmlUrl or inline srcDoc). Public in `proxy.ts` with NO ownership check and no inbound links found in the repo: legacy / possibly dead. | `generatedWebsites.getBySubmissionId` |

### Campaigns / giveaways

| ID | Feature | Route / file | Who uses it | What it does | Convex fns / external services |
|---|---|---|---|---|---|
| W-106 | OTR x Tendso landing | `/otr` — `app/otr/page.tsx`, `layout.tsx` | visitor (scanned the QR on Off The Record) | Phone-first offer page: 30% off (campaign price), two buttons: "Get my website" (carries campaign to `/start`, remembered 30 days) and "Earn" (store link / `/for-creators#app`); OTR chat/logo links and offer-end date from settings. | `settings.get` (`otr_chat_url`, `otr_logo_url`, `play_store_url`, `app_store_url`, `otr_offer_ends`) |
| W-107 | 100 free websites giveaway | `/100-pages-giveaway` | owner (applicant) | One-screen poster campaign: print poster (PDF), hang it, apply; Apply goes to `/start?campaign=giveaway&src=…`; remembers/clears campaign by open state. | `giveaway.giveawayStatus`; `/100-pages-giveaway-poster.pdf` |
| W-108 | Giveaway closed state | `_components/GiveawayClosed.tsx` | owner | Shows "Closed" or "All 100 given" copy and the ₱ standard-price alternative. | `giveaway.giveawayStatus` |
| W-109 | Giveaway review board | `/otr/review` | OTR reviewer (signed in) | Needs review / Approved / Rejected queue of giveaway applications with poster proof; approve or reject with reason (emails owner). noindex. | `giveaway.reviewerSession`, `giveaway.reviewQueue`, `giveaway.approveApplication`, `giveaway.rejectApplication` |
| W-110 | /libre | `/libre` (route handler) | visitor | REDIRECT (307, no-store) to `/100-pages-giveaway`, query kept. Short address printed on the poster; also the default QR target. | none |
| W-111 | /poster (QR redirector) | `/poster` (route handler) | visitor | 307 redirect to an admin-configurable destination (setting `poster_redirect_target`, default `/libre?src=poster`) so the printed QR can be repointed. No admin UI for that setting found in `app/admin`. | `settings.get` |

### Knowledge & AI

| ID | Feature | Route / file | Who uses it | What it does | Convex fns / external services |
|---|---|---|---|---|---|
| W-112 | Help Center home | `/knowledge` — `KnowledgeApp.tsx` | visitor, owner, agent | Categories, FAQs, contact card, search; server-renders public workspace for first paint then goes live; `?cat=` topics, `?q=` opens search. Old `?article=` links redirect to the article page. | `knowledge.listCategories`, `knowledge.listArticles`, `knowledge.listFaqs` |
| W-113 | Help article page | `/knowledge/[slug]` | visitor | Crawlable, statically generated article with JSON-LD, breadcrumbs, related items, feedback; ISR 1h. | `knowledge.getArticleBySlug`, `knowledge.listPublishedHelpSlugs`, `knowledge.recordFeedback` |
| W-114 | Creator wiki | `/knowledge?ws=wiki` (+ `cat=`, `article=`) | admin, certified agent | Internal creator playbooks; locked when signed out; noindex. | `knowledge.canAccessWiki`, `knowledge.listArticles`, `creators.getByClerkId` |
| W-115 | Ask Tendso AI / command palette | `CommandPalette.tsx`, `AnswerCard.tsx` (in Help Center shell) | visitor | Cmd-K search plus "ask in plain words" answer card with sources, grounded in the KB. | `knowledgeAI.ask`, Gemini RAG (BYOK key pool) |
| W-116 | Help Center shell | `app/knowledge/layout.tsx` — `HelpCenterShell.tsx` | visitor | Public header/footer and Cmd-K palette frame around every Help Center page. | none |

### Global / middleware

| ID | Feature | Route / file | Who uses it | What it does | Convex fns / external services |
|---|---|---|---|---|---|
| W-117 | Wildcard host rewrite | `proxy.ts` | visitor | Any `*.sites.tendso.com` host is rewritten to `/hosted/<slug>` (or `unknown`), forwarding the requested path in a header, skipping Clerk entirely. | `lib/siteSlug` |
| W-118 | Public-route allowlist | `proxy.ts` `isPublicRoute` | all | Routes reachable without sign-in: `/`, auth pages, `/affiliates` + `/affiliates/join`, `/a/*`, `/website/*`, `/preview/*`, legal, `/creators`, `/about`, `/for-creators`, `/v2`, `/for-field-agents`, `/field-agent`, `/pay/*`, `/for-business`, `/knowledge`, `/help-faq`, `/contact`, sitemap/robots, `/start`, `/otr`, giveaway/poster/libre, several `/api/*` (geocode, transcribe, internal, email senders). `/preview/*` and `/website/*` are public at the middleware level. | Clerk middleware |
| W-119 | Auth gate | `proxy.ts` | all | Everything else needs a Clerk `userId`, otherwise 307 to `/login?redirect_url=…` (explicit, because bare `auth.protect()` 404'd in Next 16). `/login` ignores `redirect_url`. | Clerk |
| W-120 | Admin path header | `proxy.ts` + `app/admin/layout.tsx` | admin, staff | Sets `x-tendso-admin-path` (overwriting any caller header) so the server layout can enforce role per route on direct visits. | Clerk, `adminAccess.me` |
| W-121 | Role router | `lib/creatorGate.ts` | agent, affiliate, staff, admin | Single source of where each lifecycle state goes: staff to `/admin`, affiliate to `/affiliates/dashboard`, rejected to `/verification-rejected`, quiz-passed to `/pending`, else `/training`. | none |
| W-122 | Root layout | `app/layout.tsx` | all | Clerk + Convex provider, site metadata and Organization JSON-LD graph, Sonner Toaster, Vercel Analytics, PWA manifest + icons. Default title/description still say "48–72 hours". No cookie/consent banner exists anywhere. | Clerk, Convex, `@vercel/analytics` |
| W-123 | Service worker | `public/sw.js`, registered in `app/layout.tsx` | all | Registers a no-op service worker (install/activate/claim, empty fetch handler) to make the site installable; no caching or offline. | none |
| W-124 | robots.txt | `app/robots.ts` | crawlers | Allows AI search crawlers (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Bingbot, Google-Extended), blocks Bytespider/CCBot, disallows private paths (`/admin/`, `/dashboard/`, `/wallet`, `/submit/`, `/connect-ai`, `/api/`); `/leads`, `/profile`, `/my-business` etc. not listed (some have per-page noindex). | none |
| W-125 | sitemap.xml | `app/sitemap.ts` | crawlers | `/`, `/for-creators`, `/knowledge`, each published help article, and curated featured-site homes; falls back to static-only if Convex fails; hourly. | `knowledge.listPublishedHelpSlugs`, `settings.get` |
| W-126 | Error boundary | `app/error.tsx` | all | Any render error (incl. a failing Convex query) shows the shared ErrorState with a reference id. | none |
| W-127 | Public header and footer | `components/r1/Public.tsx` | visitor | Nav: How it works, Real sites, Price, For creators, Help; ghost Sign in + primary "Get a website" (`/start`); footer links to contact, help, privacy, terms. | none |
| W-128 | Role shells | `components/shells/CreatorShell.tsx`, `OwnerShell.tsx`, `AdminLayout` | agent, owner, admin | Sidebar/tab-bar frames: creator (Home, Leads, Submissions, Learn, Referrals, Wallet, Account, Notifications with unread badge, New submission button); owner (My website, Payment, Help); admin sidebar. | `notifications.*`, `submissions.getByCreatorId`, `businessOwners.getMyWebsites` |
| W-129 | Legacy site header | `components/layout/header.tsx` | none | Old black-border header that hides itself on `/login`/`/signup`; no imports found anywhere under `app/` or `components/`: dead code. | none |
