# Tendso-App backend inventory (read-only, 2026-10-21, branch feat/landing-v2)

Repo: `/Volumes/SSD/New Coding Projects/Tendso-App`. Stack: Next.js 16 (app router) + Convex (`convex/`, ~25.7k lines) + Clerk auth + Cloudflare (R2, Workers/zones) + Resend email + Wise (payments in/out) + Groq (Whisper + copy) + Gemini (RAG) + Hyperagent "Tendso Studio" (AI image/copy agent) + Discord bot + Google Calendar/Drive + Hostinger (domains) + Outscraper/Google Places (leads). Also `apps/mobile` (Expo; shares the Convex deployment, hence many "cross-deploy safe" `v.string()` fields and "mobile-referenced, keep exported" comments).

Roles (`creators.role`, string): `creator` (or undefined = legacy creator), `admin`, `affiliate`. Owners are a SEPARATE table (`businessOwners`, passwordless Clerk). OTR giveaway reviewers are creators/Clerk subjects listed in env `OTR_GIVEAWAY_REVIEWER_IDS` (not a role). `creators.status`: `pending | active | suspended | deleted`. Creator certification: `quizPassedAt` (quiz done, awaiting approval) -> `certifiedAt` (admin approved) or `rejectedAt` (+reason).

Legend "Who": owner = business owner (anonymous or claimed), agent = field creator, admin, system = cron/webhook/scheduler.

---

## 1. Feature table (C-IDs), grouped by domain

### 1.1 Users / roles / verification
| ID | Feature | Files / functions | Who | What it does | External |
|---|---|---|---|---|---|
| C-001 | Creator account CRUD | `creators.ts`: create, update, getByClerkId/getById/getByEmail/getAll/getAllWithStats/count, deleteAccount (soft), isDeletedByEmail, updateLastActive, getMeForAuthInternal | agent / admin | Profile rows keyed by Clerk id; soft delete; stats join | Clerk |
| C-002 | Admin/role gate | `adminAccess.me`, `admin.isAdmin`, `lib/auth.ts` (requireAdmin, requireCreatorAccount, requireStaff, requireAccountOwner, giveaway reviewer access), `creators.updateRole`, `updateStatus` | system / admin | Central authz helpers used by every mutation | Clerk JWT (`auth.config.ts`) |
| C-003 | Certification quiz + approval | `creators.markQuizPassed` (agent) -> `approvals.createAndPost`; `approveCreator/rejectCreator/listPendingApproval/listRejected/requestRecertification`, `certify`; internal `approveCreatorInternal/rejectCreatorInternal` | agent, admin, system | Quiz pass puts creator in pending queue; admin (web) or Discord reaction approves/rejects; notification sent | Discord |
| C-004 | Discord approvals mirror | `approvals.ts`: claimForPost, createAndPost, seedReaction, pollPending (cron 2 min), listOpen, listPendingCreators; table `approvalRequests` | system | Posts pending creators to #pending-approvals; reads checkmark/cross reactions to certify/reject | Discord REST |
| C-005 | Referral code application | `creators.applyReferralCode/getByReferralCode`; `referrals.ts`: createFromSignup, qualifyByCreator, getByReferrer, getStats | agent / system | Links referred creator; REFERRAL_BONUS paid on first paid submission | - |
| C-006 | Business owner portal accounts | `businessOwners.ts`: me, getClaimToken, issueClaimTokenForEmail, issueClaimToken, claimWebsite, getMyWebsites, getMyWebsiteContent, updateMyWebsiteContent (UI removed; read-only now); tables `businessOwners`, `websiteOwnerships`, `ownerClaimTokens` (7-day tokens) | owner | Owner claims their site via emailed token, sees status/URL/leads. Edit UI was removed (edits are "requested via /contact") | Clerk, Resend |
| C-007 | Affiliates | `affiliates.ts`: publicPage, create, updatePage, sales, portal, list; `lib/affiliateOffer.ts`; app route `/a/[handle]` | admin / affiliate / owner | Affiliate role with public landing page and own sell price (clamped 999..4999); 50% commission | - |
| C-008 | Outreach tracker (separate repo, same deployment) | `outreach.ts` (checkPasscode, searchMembers, memberDetail, stats, recentActivity, logContact, undoLog), `outreachAuth.ts`, `discordMembers.ts` (syncGuildMembers cron 6h, syncNow, upsertMembers, deactivateStale) | admin team (Bryan/Joan) / system | Discord guild member list + outreach status log to avoid double-DMs | Discord |

### 1.2 Submissions & admin approval
| ID | Feature | Files / functions | Who | What it does | External |
|---|---|---|---|---|---|
| C-010 | Creator draft + interview capture | `submissions.ts`: create, update, getDraftByCreatorId, getById(+Internal/WithCreator), getByCreatorId, getAll(+WithCreator), getByStatus, remove (draft only), setDomainTier | agent | Draft with business info, photos[], video/audio R2 urls, transcript, price (`amount`, `websiteListPrice`), tier | R2 |
| C-011 | Submit | `submissions.submit` | agent | draft -> `submitted`; needs >=3 photos; creates/links `leads` row (Outscraper prospect conversion), bumps analytics, schedules `hyperagent.triggerStudioRender` | Hyperagent |
| C-012 | Owner self-serve intake (/start) | `ownerIntake.submitOwnerIntake` (public mutation) + `sendIntakeReceivedEmailAction`; table `ownerIntakeThrottle`; `app/start/*` | owner | Inserts submission directly at `submitted` (contentSource `owner_intake`, `interviewQa` 8 Q&A pairs), campaign/affiliate pricing frozen, giveaway reservation, throttle (global + per email/phone), optional custom-domain request | Resend, Hyperagent |
| C-013 | Voice answers in intake | `intakeVoice.transcribeAnswer` (+ `/api/transcribe`) | owner | Groq Whisper transcription of spoken answers | Groq |
| C-014 | Approve / reject | `admin.approveSubmission`, `rejectSubmission` -> `lib/submissionReview.ts` (approveReviewedSubmission / rejectReviewedSubmission) | admin (OTR reviewers for giveaway) | status `approved`/`rejected`, audit log, creator notification, analytics, Drive sync on approve | Drive, Resend (giveaway) |
| C-015 | Status transitions (manual) | `admin.markWebsiteGenerated`, `markDeployed`, `markEmailSent` (-> pending_payment), `markPaid`, `markComped`; `submissions.updateStatus/saveWebsite/markPaid/setUnpublished/markPayoutComplete` | admin | Each step of lifecycle is an admin button | - |
| C-016 | Admin dashboards | `admin.getDashboardStats/getPayoutStats/getPendingPayouts/getPromoStats/getAllSubmissionsWithCreators`, `analytics.ts` (creator/platform/website stats), `analyticsJobs.aggregateDailyToMonthly` (cron daily) | admin / system | Counts and revenue tiles; daily -> monthly rollup | - |
| C-017 | Audit log | `auditLogs.ts`: log, getByTarget, getRecent, getByAdmin, backfillFromSubmissions | system / admin | Append-only admin action log | - |
| C-018 | Cascading delete | `admin.deleteSubmissionRecords/deleteCreatorRecords` + `/api/delete-submission`, `/api/delete-creator` | admin | Removes Convex rows then R2 objects, Cloudflare Worker, Airtable record | R2, Cloudflare, Airtable |
| C-019 | Transcription pipeline | `transcription.ts` (+ duplicate `submissions.transcribeMedia`), `submissions.recordTranscriptionFromServer/updateTranscription*/failStalledTranscription`, `/api/transcribe`, `lib/mediaChunker.ts` | agent / system | Groq Whisper on audio/video; status in `transcriptionStatus` | Groq, R2 |
| C-020 | Google Drive sync | `drive.ts` syncSubmissionToDrive (on approve), syncSubmissionToDriveManual; `driveHelpers.ts`; fields `driveFolderId/driveSyncStatus` | system / admin | Per-submission folder with transcript/photos/media | Google Drive |
| C-021 | Airtable (legacy) | `airtable.ts` pushToAirtable, fetchEnhancedContentWithRetry, triggerAirtablePush, getSyncStatus; `/airtable-webhook` | system | Old AI step; kept as rollback, still used by delete flow | Airtable |

### 1.3 Sites / templates / hosting / deploy
| ID | Feature | Files / functions | Who | What it does | External |
|---|---|---|---|---|---|
| C-030 | AI photo enhance + copy (Tendso Studio) | `hyperagent.ts`: triggerStudioRender(+Public), `/hyperagent-callback` -> ingestStudioResult (downloads images to Convex storage), saveStudioContent; `lib/enhancedImages.ts`; photo role order headshot, interior_1, interior_2, exterior, product_1, product_2 | system / admin ("Enhance Images") | POSTs payload (photos, Q&A, business info) to agent webhook; agent returns enhanced images + hero/about/services copy + SEO layer into `generatedWebsites` | Hyperagent (webhook), R2 |
| C-031 | Site generation (build) | `POST /api/generate-website` (1,331 lines), `lib/astro-builder.ts`, `lib/templatePicker.ts`, `lib/derive-content-defaults.ts`, `lib/roleColors.ts`; `generatedWebsites.upsert/storeHtml`, `websiteContent.upsert` | admin | Groq extracts/cleans copy from transcript (fabricated-testimonial gate), picks template (`autoTemplateFor` by business type, hashed by submission id) unless admin picked one, runs Astro build via child process, stores HTML blob in Convex storage, status `draft` | Groq, Astro |
| C-032 | Editor save | `POST /api/save-content` -> regenerates via generate-website, republishes if live; `websiteContent.update/upsert`, `generatedWebsites.updatePublishingInfo` | admin | Single save = one rebuild | - |
| C-033 | Preview | `GET /api/preview/[id]`, `generate-website?preview` (build unsaved draft), `/website/[id]` page | admin | Serves stored/unsaved HTML for the iframe | - |
| C-034 | Publish | `POST /api/publish-website`; `generatedWebsites.publish/markOffline/unpublish/getPublishedBySlug/listSlugs/countPublished/listPublished`; `lib/siteSlug.ts`, `lib/publish-target.ts` | admin | Assigns permanent `slug`, sets `<slug>.sites.tendso.com`, submission -> `deployed` (never regresses payment statuses). Worker deploy only for custom-domain sites | Cloudflare |
| C-035 | Hosted site serving | `app/hosted/[slug]/route.ts` (rewritten from wildcard host by `proxy.ts`), `lib/site-seo.ts` (LocalBusiness JSON-LD, robots, sitemap), `lib/holding-page.ts` | public | Serves stored HTML per request; holding page when offline | Convex storage |
| C-036 | Unpublish / auto-unpublish | `/api/unpublish-website`, `unpublish.ts` (checkAndUnpublish cron hourly, takeWebsiteOffline, markSubmissionUnpublished), `generatedWebsites.unpublish` | admin / system | Auto-offline for `pending_payment` unpaid 3 days (replaces site with holding page) | Cloudflare |
| C-037 | Custom domain | `domains.ts` (checkDomainAvailability, purchaseDomainForSubmission, setupForSubmission, pollDomainSsl, migrateDomainToWorker, getSubmissionDomainInfo, getHostingerPaymentMethodStatus, renewal/live/in-progress emails); `lib/hostinger.ts`, `lib/cloudflare.ts`, `lib/fxRate.ts`; `/api/check-domain`, `/api/admin/*domain*`, `/api/admin/hostinger-status` | owner (request) / admin / system | domainStatus pipeline pending_payment -> registering -> configuring_dns -> provisioning_ssl -> live / failed; disables auto-renew after yr 1 | Hostinger, Cloudflare, frankfurter FX, Resend |
| C-038 | Website analytics | `analytics.upsertWebsiteStats/getWebsiteStats*`, table `websiteAnalytics` | system | Page views / contact clicks per site/day | - |
| C-039 | Poster / QR | `app/poster`, `lib/poster.ts` | admin | Printed tarpaulin/poster pages | - |

### 1.4 Payments (owner side)
| ID | Feature | Files / functions | Who | What it does | External |
|---|---|---|---|---|---|
| C-040 | Payment link + reference code | `paymentTokens.ts` (createPaymentToken, getByToken, getByReference, markUsed/Expired/Cancelled, recordEmailSent, listPending, getExpiringTokens), `/api/send-website-email`, page `/pay/[token]`, `lib/payments/referenceCode.ts` (`ND-XXXX-YYYY`), `lib/payment/config.ts` (30-day expiry) | admin sends, owner pays | Email with link; owner transfers to Wise account quoting the reference | Resend, Wise |
| C-041 | Auto payment match | `/wise-deposit-webhook` (http.ts) -> `payments.processDeposit` -> `creditCreatorForPayment`; `lib/payments/webhookParser.ts`; `paymentTokens.findPendingByAmount` | system | Wise deposit event matched by reference (or amount) to token; validates price band; marks `paid`, credits creator, referral bonus, starts domain purchase | Wise webhook |
| C-042 | Manual mark paid / comped | `/api/mark-paid`, `/api/mark-comped`, `admin.markPaid/markComped/logPaymentConfirmed`, `payments.creditCreatorForPayment` | admin | Same credit path; comped = free site, creator still paid | Resend |
| C-043 | Payment follow-ups | `followUp.ts` (cron :15 hourly; sends at 48-72h after email), `/api/send-payment-followup-email`, `creatorReminders.ts` + `/api/internal/send-creator-reminder` (creator can trigger owner reminder, 1/day max 3) | system / agent | Nudge emails before auto-unpublish | Resend |
| C-044 | Instalments | NONE FOUND. `grep` for instalment / payment plan / down payment returns nothing. Single payment only (`amount`, `paidAt`, one `paymentTokens` row per submission) | - | - | - |

### 1.5 Payouts / wallet (Wise)
| ID | Feature | Files / functions | Who | What it does | External |
|---|---|---|---|---|---|
| C-050 | Earnings ledger | `earnings.ts` (create, markWithdrawn, getByCreator/BySubmission/getSummary); creator `balance/totalEarnings/totalWithdrawn` | system / agent | Earnings rows type `submission_approved | referral_bonus | lead_bonus`, status pending/available/withdrawn | - |
| C-051 | Payout methods | `payoutMethods.ts` (save, update, setDefault, remove, getByCreator, getDefault) | agent | gcash / maya / bank_transfer / wise_email saved methods (only wise_email actually paid out) | - |
| C-052 | Withdrawal request + Wise transfer | `withdrawals.ts`: create, processWiseTransfer, adminRetry, updateStatus, refreshFromWise, checkProcessingStatusCron (cron :30), updateByWiseTransferId (webhook), email actions; `lib/wise.ts`; `/wise-webhook` (signature verify `lib/wiseWebhookVerify.ts`); `/api/internal/send-withdrawal-*-email` | agent requests, system pays, admin retries | pending -> processing (Wise recipient/quote/transfer created) -> completed on `outgoing_payment_sent`; unfunded alert to Discord | Wise API + webhook, Discord, Resend |
| C-053 | Manual payout marking | `admin.markPayoutPaid`, `bulkMarkPayoutsPaid`, `submissions.requestPayout/markPayoutComplete` | agent / admin | Legacy per-submission payout flow | - |
| C-054 | Wallet page | `app/wallet`, `lib/payouts/*` | agent | UI over above | - |

### 1.6 Campaigns / giveaways
| ID | Feature | Files / functions | Who | What it does | External |
|---|---|---|---|---|---|
| C-060 | OTR x Tendso 100 free websites giveaway | `giveaway.ts` (reviewerSession, reviewQueue, approveApplication, rejectApplication, giveawayStatus, giveawayReviewStatus, setEnabled, expireGiveaway), `lib/giveaway.ts` (cap 100 in `settings` key `giveaway` {enabled,cap,endsAt}; one per phone/email), `giveawayEmails.ts`, `/api/internal/send-giveaway-*-email`; pages `/100-pages-giveaway`, `/libre` (redirect), `/otr`, `/otr/review` | owner applies, OTR/admin reviews | Application = submission with `giveawayApplication=true`, amount 0; approval triggers first Studio render; then admin "gives away" via `markComped`; milestone alerts | Resend, Discord, Hyperagent |
| C-061 | Campaign discount | `packages/shared/pricing.ts` CAMPAIGN_DISCOUNTS `otr: 0.3`, code `OTR30`, `lib/campaign.ts`; stored on submission `campaign`/`source` | owner | 30% off ₱4,999 = ₱3,499, frozen at intake | - |
| C-062 | Announcements | `announcements.ts` (previewAudience, searchRecipients, send, list, resolveRecipients), `/api/internal/send-announcement-email`, `lib/announcements/audience.ts` | admin | Broadcast email + in-app notification to audience segments | Resend |

### 1.7 Leads / maps / prospects / calls
| ID | Feature | Files / functions | Who | What it does | External |
|---|---|---|---|---|---|
| C-070 | Leads CRM | `leads.ts` (create, update, updateStatus, getBy*, listForMobileCRM, listForMap, getDetail*, updateAdminContent, preview image upload, geocodePendingSubmissions), `leadNotes.ts` | agent / admin | Lead statuses new/contacted/qualified/converted/lost | OSM Nominatim, R2 |
| C-071 | Outscraper nearby scrape (legacy leads) | `outscraper.ts` (scrapeNearby, claimProspect, releaseProspect, listScrapedLeads, releaseStaleClaims cron :45 24h), `scrape.ts` | agent / system | Google Maps businesses as leads with 24h claim | Outscraper, Google Places |
| C-072 | Global prospect pool (new) | `prospects.ts` (searchNearby, reserve, markContacted/Qualified/Converted/Lost, releaseReservation, ingestScrapeResults, adjustInventory), `prospectsMigration.ts`, `lib/h3.ts`, `lib/quality.ts`; tables prospects, prospect_inventory, scrape_history, category_locales | agent / system | H3-indexed shared pool, state machine available -> reserved -> contacted -> qualified -> converted/lost | Outscraper |
| C-073 | Field-agent call booking | `booking.ts` (getAvailability, createBooking, reschedule/cancel by token, adopt calendar calls, sync cancelled, conference durations, reminders), `nativeBookings.ts`, `callReminders.ts`; crons :05 :10 :20 :50; pages `/field-agent/book`, `/field-agent/manage` | candidate / admin / system | 10-min intro calls on tendso.hr Google Calendar with Meet; attendance toggle | Google Calendar/Meet, Gmail send, TidyCal (legacy) |
| C-074 | Geocode | `/api/geocode`, `lib/geocode.ts`, `leads._patchSubmissionCoordinates` | owner / system | Address to lat/lng for map pin | Google Maps / Nominatim |

### 1.8 Training / certification content
| ID | Feature | Files / functions | Who | What it does |
|---|---|---|---|---|
| C-080 | Training + quiz | pages `/training`, `/training-lessons`, `/certification-quiz`, `/onboarding`; backend only `creators.markQuizPassed` (quiz content is client-side) | agent | Lessons then quiz then pending approval (C-003) |
| C-081 | Referrals/earn pages | `/referrals`, `/for-field-agents`, `/for-creators` | agent | Marketing/onboarding |

### 1.9 Knowledge base & AI
| ID | Feature | Files / functions | Who | What it does | External |
|---|---|---|---|---|---|
| C-090 | KB content | `knowledge.ts` (canAccessWiki, listCategories/Articles/Faqs, getArticleBySlug, recordFeedback, upsertCategory/Article/Faq), `knowledgeSeed.seedKnowledge`; workspaces `help` (public) and `wiki` (gated field-agent) | public / agent / admin | Help Center + internal wiki, block-typed article bodies | - |
| C-091 | Grounded Q&A (RAG) | `knowledgeAI.ts` (ask, answerQuery, rewriteAnswer, classifyOnTopic, generateEmbeddingForArticle, backfillEmbeddings), `kb.ts` (keyword-first search + vector), `knowledge.consumeRateLimit/logQuery` | public / agent | Keyword-first, then Gemini embeddings; walks Flash model chain; query log in `knowledgeQueries` | Gemini |
| C-092 | BYOK Gemini key pool | `aiKeys.ts` (addMyGeminiKey, listMyGeminiKeys, removeMyGeminiKey, pickActiveKey, reportKeyResult, poolStats, clearGeminiCooldowns), `lib/encryption.ts`; page `/connect-ai` | agent / admin | Creators donate free-tier keys; rotation with cooldown; encrypted at rest | Gemini |
| C-093 | Admin "Train AI" | `knowledgeTraining.ts` (enqueueTraining, trainQAPairs, processNextTrainingJob, listTrainingQA/Jobs, purge*, reEmbedPendingQA, listUnansweredQueries) | admin | Paste questions -> AI-drafted Q&A articles; scheduler-driven queue (`knowledgeTrainingJobs`) | Gemini |
| C-094 | Human escalation loop | `escalations.ts` (createAndPost, pollPending cron 2 min, notifyAsker, notifyFieldCoach), table `escalations` | system | Unanswerable question -> Discord thread -> reply becomes Q&A -> asker notified; relays to owner-engine Field Coach | Discord, Field Coach callback |
| C-095 | External KB API | `/kb/search`, `/kb/ask` in http.ts (secret headers KB_SEARCH_SECRET) | external bots (owner-engine) | Read-only grounded answers | Gemini |

### 1.10 Discord bot
| ID | Feature | Files / functions | Who | What it does |
|---|---|---|---|---|
| C-100 | `/ask` slash command | `discord.ts` (registerCommands, answerInteraction), `POST /discord/interactions` (Ed25519 verify, deferred reply) | field agents | Wiki RAG answer with sources |
| C-101 | Operational alerts | `discord.notifyGiveawayMilestone`, withdrawals unfunded alert, approvals + escalation posts | system | Channel messages via bot token |

### 1.11 Emails
All through `lib/email/service.ts` (Resend; env RESEND_API_KEY/RESEND_FROM_EMAIL/RESEND_REPLY_TO; nodemailer kept as rollback). Convex actions call Next routes `/api/internal/send-*-email` with `INTERNAL_API_SECRET`. Templates in `lib/email/templates.ts` and `giveawayTemplates.ts`. Emails: approval, payment link, payment follow-up, payment confirmation, promo website live, completed-website, domain live / setup in progress / renewal reminder, withdrawal requested/status, announcement, creator reminder, intake received, giveaway approved/rejected. Booking emails go via Gmail API as tendso.hr (`sendAsTendso`).

### 1.12 Notifications / push
| ID | Feature | Files | What it does |
|---|---|---|---|
| C-110 | In-app + push | `notifications.ts` (createAndSend, sendPushNotification, registerPushToken, getByCreator, getUnreadCount, markAsRead/AllAsRead, createForClient); table `notifications`, `pushTokens` | Creator notifications; push via Expo (`exp.host`) for mobile |

### 1.13 Crons (`convex/crons.ts`)
daily 00:00 UTC analytics rollup; hourly: :00 auto-unpublish unpaid, :05 call reminders, :10 adopt finished calendar calls, :15 payment follow-up, :20 Meet durations, :30 Wise withdrawal status, :45 release stale prospect claims, :50 release cancelled bookings; every 2 min: KB escalation poll, Discord approvals poll; every 6h: Discord member sync.

### 1.14 HTTP actions (`convex/http.ts`)
POST `/discord/interactions`, POST `/airtable-webhook`, POST `/wise-webhook` (withdrawal events), POST `/wise-deposit-webhook` (owner payments), POST `/hyperagent-callback` (header `X-Tendso-Secret`), POST `/kb/search`, POST `/kb/ask`, GET `/health`.

### 1.15 File storage
Two systems: Convex `_storage` (`files.ts`, `storage.ts`; generated HTML blobs, enhanced images) and Cloudflare R2 (`r2.ts` generateUploadUrl/getDownloadUrl/deleteFile/getStreamableUrl; `/api/upload-image`, `/api/download-media`). Submissions store R2 URLs for new uploads, legacy storage ids for old ones.

### 1.16 Settings
`settings.ts` get/getAll/set/remove (key/value; used for giveaway config, etc.).

---

## 2. Schema (`convex/schema.ts`, 40 tables)

| Table | Purpose | Key enums / status fields |
|---|---|---|
| creators | All accounts (creator/admin/affiliate) | role (string), status pending/active/suspended/deleted, certifiedAt, quizPassedAt, rejectedAt, affiliate* fields, balance/totalEarnings/totalWithdrawn; priceCeiling/priceUnlockedAt retired 2026-10-06 |
| submissions | The central order/job row | status (string): draft, submitted, in_review, approved, rejected, website_generated, deployed, pending_payment, paid, completed, unpublished (+ legacy pending). pricingMode paid|comped (absent = paid). submissionType standard|with_custom_domain. domainStatus not_requested/pending_payment/registering/configuring_dns/provisioning_ssl/live/failed. driveSyncStatus pending/creating/synced/failed. transcriptionStatus, airtableSyncStatus (reused for Studio render: pending_review, pending_push, pushed, synced, error). contentSource 'owner_intake'. giveawayApplication, giveawayReviewSource otr|admin. campaign, source, affiliateHandle, websiteListPrice, interviewQa |
| generatedWebsites | Built site per submission | templateName, status draft|published, offlineAt, slug, publishedUrl, customDomain, cfPagesProjectName, htmlStorageId, copy fields (hero*, about*, services...), SEO layer (seoTitle, metaDescription, structuredData, gbpDescription, imageAlt), enhancedImages, customizations (any) |
| websiteContent | Normalized editable content | content fields, visibility{...block toggles}, customizations{heroStyle, aboutStyle, servicesStyle, galleryStyle, contactStyle, colorScheme, fontPairing,...}, images{hero,about,services,featured,gallery} |
| auditLogs | Admin action trail | action, targetType/Id |
| earnings | Creator earnings ledger | type submission_approved/referral_bonus/lead_bonus; status pending/available/withdrawn |
| withdrawals | Wise payouts | status pending/processing/completed/failed; wise* ids; unfundedAlertAt |
| payoutMethods | Saved payout accounts | type gcash/maya/bank_transfer/wise_email |
| paymentTokens | Owner pay links | status pending/paid/expired/cancelled; referenceCode ND-XXXX-YYYY; amount; 30d expiry |
| businessOwners / websiteOwnerships / ownerClaimTokens | Owner portal | claim token pending/consumed/expired/cancelled |
| leads / leadNotes | CRM | status new/contacted/qualified/converted/lost; source website/qr_code/direct/outscraper |
| prospects / prospect_inventory / scrape_history / category_locales | Shared prospect pool | prospects.state available/reserved/contacted/qualified/converted/lost |
| native_bookings / call_reminders | Intro-call booking | status held/confirmed/failed/cancelled; attendance attended/no_show; origin page/tidycal/hr_pipeline/calendar |
| notifications / pushTokens / announcements | Messaging | announcements.status sending/sent/failed |
| referrals | Creator referrals | status pending/qualified/paid |
| analytics / websiteAnalytics | Rollups | periodType daily/monthly |
| settings | Key/value config | - |
| rateLimits / ownerIntakeThrottle | Throttles | - |
| knowledgeCategories / knowledgeArticles / knowledgeFaqs / knowledgeQueries / knowledgeTrainingJobs / aiKeys | KB + RAG | workspace help|wiki; article status draft|published; job status queued/processing/done/error |
| escalations | KB human loop | pending/answered/learned/delivered/expired/error |
| approvalRequests | Discord creator approvals | pending/approved/denied/conflict/expired/error |
| discordMembers / outreachLogs / outreachMeta | Outreach tracker | outreachStatus new/claimed/messaged/replied/not_interested/converted |

Relevant to the stated concerns:
- Build steps / progress: NO dedicated field or table. Progress is inferred from `submissions.status`, `generatedWebsites.status`, `airtableSyncStatus` (render), `transcriptionStatus`, `domainStatus`, `driveSyncStatus`. No percent/step timeline for owners.
- Chosen template/design: `generatedWebsites.templateName` (legacy 'astro'), `generatedWebsites.customizations` (any) and `websiteContent.customizations`; actual template id = `customizations.heroStyle` as `family:CODE` (e.g. `barbershop:BP`). Owner never chooses; admin or `autoTemplateFor` picks.
- Font/colour: `customizations.colorScheme` / `colorSchemeId` (default 'auto'), `fontPairing` / `fontPairingId` (default 'modern'), plus per-role colour overrides (`customizations.roleColors`, `lib/roleColors.ts`). Not tied to owner input in /start.
- Instalment plans: none (see C-044). Only `amount`, `domainChargedPHP`, `websiteListPrice`, `platformFee`, `creatorPayout`.

---

## 3. Next.js API routes (`app/api/**`)

| ID | Route | Purpose | External |
|---|---|---|---|
| A-001 | POST /api/generate-website | Build site (Groq copy + template pick + Astro build), save draft; `?preview` mode | Groq, Convex |
| A-002 | POST /api/save-content | Persist editor save, trigger rebuild, republish if live | Convex |
| A-003 | POST /api/publish-website | First publish: slug, hosted URL, submission -> deployed, Worker only for custom domains | Cloudflare |
| A-004 | POST /api/unpublish-website | Take offline, deploy holding page | Cloudflare |
| A-005 | GET /api/preview/[id] | Stored HTML for iframe | Convex |
| A-006 | POST /api/mark-paid | Admin mark paid + confirmation email | Resend |
| A-007 | POST /api/mark-comped | Give away free + promo email | Resend |
| A-008 | POST /api/send-website-email | Payment link email to owner | Resend, Wise (config) |
| A-009 | POST /api/send-payment-followup-email | Follow-up nudge (INTERNAL secret) | Resend |
| A-010 | POST /api/send-completed-website-email | Site-live email | Resend |
| A-011 | POST /api/send-approval-email | LEGACY (Supabase) | Supabase, Resend |
| A-012 | POST /api/internal/send-{announcement,creator-reminder,domain-live,giveaway-approved,giveaway-rejected,intake-received,withdrawal-requested,withdrawal-status}-email | Convex-to-Next email bridge, `INTERNAL_API_SECRET` | Resend |
| A-013 | POST /api/admin/send-test-email, GET /api/preview-email | Email template testing | Resend |
| A-014 | POST /api/check-domain, /api/admin/check-domain | Domain availability + price | Hostinger (via Convex) |
| A-015 | POST /api/admin/purchase-domain, GET /api/admin/hostinger-status | Buy domain / status | Hostinger |
| A-016 | POST /api/transcribe | Groq Whisper on submission media (maxDuration 180s) | Groq, R2 |
| A-017 | POST /api/upload-image | Image to R2 | R2 |
| A-018 | GET /api/download-media | Proxy download with URL validation | R2 |
| A-019 | GET /api/geocode | Address to coordinates | Google/OSM |
| A-020 | POST /api/delete-submission, /api/delete-creator | Cascade delete incl. R2, CF Pages/Workers, Airtable | R2, Cloudflare, Airtable |
| A-021 | GET /api/download-apk | Mobile APK download | Convex |
| A-022 | POST /api/process-submission, POST /api/extract-content, POST /api/submissions/[id]/mark-paid | LEGACY Supabase-era; still referenced by `hooks/useGroqProcessing.ts` and `app/admin/submissions/[id]/page.tsx` | Supabase, Groq |

Non-api route handlers: `app/hosted/[slug]/route.ts` (serves customer sites; reachable only via `*.sites.tendso.com` through `proxy.ts`), `app/libre/route.ts` (307 to /100-pages-giveaway).

---

## 4. packages/

`packages/shared` (`@tendso/shared`, export `./pricing` -> `pricing.ts`); root `lib/pricing.ts` re-exports it. `packages/convex-client` re-exports `api` from `convex/_generated/api.js` for the mobile app.

Exact constants (PHP):
```
BASE_PRICE        = 999      // lowest price a creator/affiliate may charge
PRICE_CEILING     = 4999     // highest
WEBSITE_PRICE     = PRICE_CEILING (4999)   // self-serve /start list price
COMMISSION_RATE   = 0.5      // creator/affiliate share of website sell price (domain excluded)
CUSTOM_DOMAIN_ADDON = 500    // flat add-on (registrar pass-through, not commissioned)
REFERRAL_BONUS    = 1000     // on referred creator's first paid submission
CAMPAIGN_DISCOUNTS = { otr: 0.3 }   // 30% off website only, never domain
CAMPAIGN_LIST_PRICES = { otr: PRICE_CEILING }   // OTR = 4999 -> 3499
CAMPAIGN_CODES    = { OTR30: 'otr' }
STANDARD_PRICE    = 999      // BASE_PRICE
CUSTOM_DOMAIN_PRICE = 1499   // BASE_PRICE + 500
PRICING_MODE_COMPED = 'comped' (isComped, ownerChargeFor -> 0 when comped)
```
Functions: commissionFor(p)=round(p*0.5) (999->500, 4999->2500); clampSellPrice; creatorDiscount (strike-through %); campaignSellPrice; domainAddOnFor; ownerTotal; formatPHP. Since 2026-10-06 there is no unlock: every creator prices 999..4999 from the first sale, starting at full list and discounting down. `validatePaymentPricing` (convex/lib/paymentPricing.ts) rejects any website price outside the band or payout above 50%.

---

## 5. Template pipeline (submission -> template fields -> hosted preview -> published)

1. Capture: creator `submissions.create/submit` (photos + audio/video + transcript) or owner `/start` -> `ownerIntake.submitOwnerIntake` (typed/voice 8-question Q&A, photos). Both land at `status: submitted` and schedule `hyperagent.triggerStudioRender`.
2. AI step: Hyperagent "Tendso Studio" webhook returns enhanced photos + copy + SEO into `generatedWebsites` via `/hyperagent-callback` -> `ingestStudioResult` -> `saveStudioContent`. (Giveaway rows wait for approval first.)
3. Admin approves in `/admin/submissions/[id]` (`approved`; Drive sync fires).
4. Admin clicks Generate: `/api/generate-website` merges Hyperagent copy + Groq extraction (with fabricated-testimonial gates) into the `contentWithContact` shape, picks template via `lib/templatePicker.ts` (trade-regex -> family; hash of submission id -> variant; full code like `generic:A`, bare letters upgraded), builds with Astro (`astro-site-template`, forked `build-worker.mjs`, ~30-60s) via `lib/astro-builder.ts`, stores HTML in Convex storage, `generatedWebsites.status='draft'`, `websiteContent` upserted.
5. Editor (`components/editor/SandboxEditorV3`, only mounted on the admin submission page): Design tab (swap among ~71 templates in 18 families via `templateCatalog.ts`, 15 colour schemes, 11 font pairings, per-role colours, block visibility toggles incl. 16 v01 blocks), Content tab (schema-driven fields from `genericContentSchema.ts`, filtered per template by `templateFieldPaths.generated.ts`; lists add/remove/reorder; links; click-to-jump from preview, safe in-iframe contenteditable), Media tab (image slots, upload to R2). Undo/redo + local draft recovery (`useEditorDraft`). Save = one rebuild (`/api/save-content`), "preview unsaved" builds without persisting. Owners cannot edit; edits are requested via /contact (portal form removed because it never reached the built HTML).
6. Template contract: every editable string in an Astro template carries `data-field` / `data-image-field` / `data-href-field` whose path starts with a declared ROOT (`scripts/gen-template-fields.mjs`). `npm run templates:sync` = gen-template-fields + gen-template-sections + build-template-previews (writes `components/editor/templateFieldPaths.generated.ts`, section order, `public/template-previews/*.html`, 76 files). `npm run check:templates` = field gen `--check` + field-root + block + parity + type-ladder guards (fails open otherwise; unknown roots silently uneditable). Authoring rules in `docs/MAKING-A-TEMPLATE.md` (gold standard `hospitality/PageBJ.astro`; scope CSS to `html[data-page=..]`; font sentinel `'modern'`). Source designs in `templates/` (Autoshop, Barbershop, Generic, Landing Pages v01..v03, v4, NEO LAB, Restaurant, SalonSpa, Shirt Store).
7. Publish: `/api/publish-website` assigns permanent slug, address `<slug>.sites.tendso.com`; `proxy.ts` rewrites wildcard host to `app/hosted/[slug]/route.ts`, which serves stored HTML (+ injected SEO/JSON-LD, robots, sitemap). No Worker per business (Cloudflare 100-script cap) except custom-domain sites. Submission -> `deployed`.
8. Money: admin emails pay link (`markEmailSent` -> `pending_payment`); Wise deposit webhook or manual mark paid -> `paid` -> creator credited; domain pipeline runs if purchased. Unpaid after 3 days -> auto-unpublish to holding page.
9. Reselling/regeneration never regresses payment statuses (`PAYMENT_LIFECYCLE_STATUSES` guard).
10. Gaps: no per-step build progress, no owner template/colour/font choice, no instalments, no owner self-edit.
