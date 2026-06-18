# GEO/SEO Plan — Reality-Check & Scoped P0

**Date:** 2026-06-18
**Re:** ClickUp 86ca9u21z — "Tendso GEO + SEO Strategy & Implementation Plan (AI IDEA — UNVERIFIED)"
**This doc is:** the first deliverable the ticket asked for — a codebase-verified reality check on the AI plan, OQ recommendations, and a scoped P0 sprint. **Not** an endorsement of the whole flywheel.

> Method: every load-bearing technical claim in the plan was checked against the real code (file:line). Verdicts below. Where the plan and reality disagree, reality wins — as the ticket instructed.

---

## 1. Verdict on the plan's own codebase claims (C1–C6)

The plan already flagged these as "corrections from an audit." My independent check against the code:

| # | Plan's corrected claim | My verdict | Evidence |
|---|---|---|---|
| **C1** | No shared Astro `<head>`; 15 page components each emit their own `<!DOCTYPE>/<head>`; BaseLayout unused | ✅ **TRUE** | 15 variants (PageA–O) in `astro-site-template/src/`; `index.astro:24-25` explicitly says they "do not compose with BaseLayout"; `BaseLayout.astro` is orphaned. The `<SiteHead>` refactor (P0.8) is real and is **15 files**, not one. |
| **C2** | Deployed Worker ignores the request, serves ONE HTML string for all paths | ✅ **TRUE** | `app/api/publish-website/route.ts:179-191` — Worker embeds one `const html` and returns it for every request; Astro builds `output: 'static'` → single `index.html`. Per-site `robots.txt`/`sitemap.xml`/`llms.txt`/IndexNow-key files would all 404-to-homepage. |
| **C3** | `generatedWebsites` has no `slug`; city/category/coords live on `submissions`; `listPublished` is a full-scan + N+1 join | ✅ **TRUE** | `convex/schema.ts:193-269` (no slug); `generatedWebsites.ts:123-149` (`.filter()` no index = full scan; `ctx.db.get(submissionId)` in the loop = N+1). |
| **C4** | KB queries are `api.knowledge.listArticles({workspace})`; `by_slug` index exists; no public `getBySlug` | ✅ **TRUE** | `convex/knowledge.ts:74-93`; `by_slug` index at `schema.ts:892`; no `getArticleBySlug` export. |
| **C5** | KB `body` is a typed `kbBlock[]` (not HTML); no `faqs` field; `updatedAt` exists | ✅ **TRUE** | `schema.ts:8-17` (kbBlock union), `:876` (body array), no `faqs` on the article (separate `knowledgeFaqs` table at `:906`), `updatedAt` at `:883`. |
| **C6** | Sites deploy as one Worker per business on `*.workers.dev`; no wildcard `*.tendso.ph` router | ✅ **TRUE** | `publish-website/route.ts:74-84` → `https://{worker}.{subdomain}.workers.dev`. No wildcard router exists. |

**Bottom line: the plan's C1–C6 corrections are all accurate.** The AI plan is unusually self-aware — it already caught its own worst factual errors. That raises my confidence in proceeding, *carefully*.

## 2. Extra facts the audit surfaced (things the plan assumes but didn't fully verify)

| Assumption in the plan | Reality | Impact on the plan |
|---|---|---|
| Reuse existing 768-dim Gemini vectors for the uniqueness gate | ✅ **Exists** — `knowledgeArticles.by_embedding` vector index (768d), `knowledgeAI.ts:46`. **But** it's wired for KB articles, not generated sites. | The embedding *infra* is proven (we just used it for the KB). Reusing it for site-uniqueness (P0.10) means a **new** vector index on generated-site content + the embed pipeline — not free, but the pattern is established. |
| `googlePlaceId` available for `aggregateRating` matching (P1.6) | ⚠️ **Only on `prospects` and `leads` tables**, not `submissions`/`generatedWebsites`. | The submissions↔prospects fuzzy-match (P1.6) is required, not optional — there's no direct join. Confirms the plan's ≤50m matcher is real work. |
| `services` for schema `hasOfferCatalog` | On `generatedWebsites` (`:255`), **not** `submissions`. | Fine, but the directory denormalization (C3) must pull from both tables. |
| Zero existing structured data | ✅ **TRUE** — grep for `application/ld+json` / `schema.org` / `LocalBusiness` = **0 hits** anywhere. | Greenfield. Nothing to migrate; also nothing to break. |
| No `robots.ts` / `sitemap.ts` / `/knowledge/[slug]` route today | ✅ **TRUE** — `/knowledge` is a single client SPA page; no dynamic article route. | P0.2/P0.3/P0.11 are all net-new files. Low regression risk. |

**One correction to the plan itself:** the plan calls C2 a problem to "fix." It's not a bug — it's a deliberate single-page static design. The right read (which the plan's C2 row actually lands on): **don't try to serve per-site SEO files from the Worker; serve robots/IndexNow-key from the platform domain only.** Agreed.

## 3. The honest strategic assessment (pressure-testing the bet)

The ticket asked me to pressure-test the *big bet*, not just the file paths. My take:

**What's genuinely strong and low-risk — do it regardless of the flywheel:**
- **KB SSR conversion (P0.11).** The KB is a client-side SPA today → invisible to every AI crawler (they don't run JS). We *just* seeded 23 articles + embeddings. Converting to SSR is pure upside, no scaled-content risk (it's real human/RAG content on one domain), and it directly serves the "how do I get my barbershop online" queries. **Highest ROI, lowest risk item in the entire plan.**
- **Platform schema + robots + sitemap + OG (P0.2–P0.7).** Standard hygiene on `tendso.app`. Greenfield, additive, can't backfire. The plan's per-engine bot allowlist (allow GPTBot/OAI-SearchBot/ClaudeBot/Google-Extended/PerplexityBot/Bingbot; block Bytespider/CCBot) is sound.
- **Astro `<SiteHead>` schema bake (P0.8).** Genuine multiplier — fixes every future site once. But it's a **15-component refactor (XL)**, confirmed by C1. Not a quick win.

**What is bet-the-company risky and must NOT ship naively:**
- **The "1000s of unique AI sites build authority" core bet.** This is *exactly* the scaled-content pattern Google's enforcement targets. It only survives behind the **content gate (P0.10)** — completeness + embedding-uniqueness + owner-verified facts + structural variation. **My position: the gate is not a feature of this plan, it is the precondition for shipping any of the site-generation SEO at all.** Without it, baking schema into 1000s of near-dup sites *accelerates* a penalty rather than helping.
- **The directory (P1.2).** Empty/thin city pages are doorway content by definition. The plan's "gate go-live on ≥20 real businesses/city" is correct and non-negotiable. We don't have that inventory yet, so **P1.2 is not a near-term item regardless of sprint capacity.**
- **The footer backlink (P1.3).** `nofollow sponsored`, homepage-only, rotated anchors — the plan is right that a dofollow exact-match variant across thousands of sites is a textbook PBN trigger. Easy to get wrong; cheap to get right.

**What I'd deprioritize / not build yet:**
- **Wikidata (P2.1)** — premature; needs independent coverage first (OQ-11). The plan agrees.
- **AI-citation dashboard (P2.5)** — the plan itself flags the unit economics are unvalidated and tooling may cost more than the ₱1,500 tier. Don't build before the 5-business pilot.
- **`*.tendso.ph` migration (P0.1)** — this is an **architecture rewrite of `publish-website`** (C6: per-site Workers → wildcard router Worker reading `Host`), plus Cloudflare-for-SaaS SSL cost. It's a real project, not a toggle. It gates the *client-site* authority work but **not** the platform/KB work.

## 4. The key insight that reorders the plan

**The plan's critical path front-loads P0.1 (the domain/router rewrite) because "every `@id` depends on it."** That's true for *client sites*. But it's the single biggest, riskiest piece — and it does **not** block the highest-ROI work (KB SSR + platform schema, which live on `tendso.app`, already a real domain post-migration).

So I'd **split the plan into two independent tracks** rather than one P0.1-gated chain:

- **Track A — Platform & KB (ship now, zero architecture risk):** KB SSR, platform schema/robots/sitemap/OG, GSC/Bing setup. None of this touches the Worker rewrite. Delivers the "people + AI find Tendso" goal (Goal A) on its own.
- **Track B — Client-site SEO (gated on the hard prerequisites):** the `<SiteHead>` refactor, the content gate, and the `*.tendso.ph` migration. This is where the bet-the-company risk lives; it should not start until OQ-1/2/4/5 are decided and the content gate is built.

This lets us capture the safe wins immediately while the risky architecture decisions get made deliberately.

---

## 5. Recommended answers to the Open Questions

| OQ | Question | My recommendation |
|---|---|---|
| **OQ-1** | Canonical platform domain: `tendso.app` vs `tendso.ph`? | **`tendso.com`** — *neither of the plan's options.* You just migrated the whole platform to **`tendso.com`** (Vercel + Clerk + DNS, done this week). The plan assumed `tendso.app`, which doesn't reflect reality. Platform `@id`s should be `https://tendso.com/#...`. **This is the most important correction in this whole note** — the plan hard-codes the wrong domain everywhere. |
| **OQ-2** | Client-site domain + serving architecture | `<slug>.tendso.ph` subdomains via a **single wildcard router Worker** (reads `Host`, serves HTML from Convex/KV). Avoids per-client SSL cost. Defer client custom-domain (Cloudflare-for-SaaS) to a paid upsell. **But** confirm you own/want `tendso.ph` as the client-site domain vs a subdomain of `tendso.com` (e.g. `<slug>.sites.tendso.com`) — a subpath/subdomain of the domain you already control sidesteps a second DNS+SSL setup entirely. **Recommend `<slug>.sites.tendso.com`** unless there's a reason to keep `.ph`. |
| **OQ-3** | Gate the directory? | Public, but PDPA-check publishing owner NAP. Moot until inventory exists. |
| **OQ-4** | Cloudflare spend | The wildcard-router model (one cert) avoids the per-host SSL blowup. Approve Workers Paid; defer Cloudflare-for-SaaS until custom-domain upsell is real. |
| **OQ-5** | Migrate existing `*.workers.dev` sites? | How many live paid sites exist today? If few (likely, given launch stage), **net-new on the new domain + 301 the handful of existing ones.** Decide with the real count. |
| **OQ-10** | Content language per region | We just built EN/Tagalog landing localization. The plan's point stands: **Cebu/Lapu-Lapu are Cebuano, not Tagalog** — don't assert `fil` for Visayan businesses. Map region→locale from `submissions.city`/`province`. |
| **OQ-11** | Independent coverage of Tendso exists? | Almost certainly **no** (pre-launch). → Wikidata (P2.1) is premature. Skip for now. |
| OQ-6/7/8/9/12 | rating-match threshold / IndexNow throughput / faqs backfill / PR owner / governance owners | All P1+ — decide when those phases are scoped, not now. |

---

## 6. Scoped P0 sprint (what I'd actually build first)

Ordered by **(safe + high-ROI) first**, deferring the architecture rewrite:

**Sprint 1 — Platform & KB visibility (Track A, all low-risk, all on `tendso.com`):**
1. **`app/robots.ts`** — allow the 6 AI bots, block Bytespider/CCBot, disallow `/api`/`/admin`/`/connect-ai`/`/dashboard`. (S)
2. **Organization + WebSite JSON-LD** in `app/layout.tsx`, `@id` = `https://tendso.com/#...`. (S)
3. **`convex/knowledge.getArticleBySlug`** (public query; `by_slug` index exists). (S)
4. **`app/knowledge/[slug]/page.tsx`** — SSR per-article + `kbBlock`→React renderer + Article/Breadcrumb JSON-LD. *The highest-ROI item.* (L)
5. **`app/sitemap.ts`** — static + KB articles (defer business profiles until slug exists). (M)
6. **GSC + Bing Webmaster** verification for `tendso.com` + submit sitemap + AI-citation baseline probes. (S, manual)
7. SoftwareApplication/Offer + OG/Twitter/canonical sweep. (S/M)

**Sprint 2+ — gated on decisions (Track B):**
- OQ-1/2/4/5 decided → P0.1 router-Worker rewrite + `slug` field.
- Content gate (P0.10) — **before** any site-schema scaling.
- `<SiteHead>` 15-component refactor (P0.8).
- Then directory/profiles/IndexNow (P1) once inventory + migration exist.

**Do NOT start Track B before the content gate exists and the domain architecture is decided.** That's the line between a flywheel and a de-indexed link farm.

---

## 7. Open questions back to Theo/Steven (blockers for Track B)

1. **Domain reality:** the plan says `tendso.app`; you migrated to **`tendso.com`**. Confirm `tendso.com` is canonical, and decide the client-site domain (`<slug>.tendso.ph` vs `<slug>.sites.tendso.com`). *Blocks every `@id`.*
2. **How many live paid client sites exist on `*.workers.dev` today?** Determines migrate-vs-net-new (OQ-5).
3. **Do we own `tendso.ph`?** (Affects OQ-2.)
4. **Is the SEO/GEO push even the priority right now** vs finishing the owner portal / pricing mobile parity / the dead-Gemini-key fix? This is a large multi-sprint program; sequencing it against the other open work is a product call, not an engineering one.

**My recommendation:** approve **Sprint 1 (Track A)** now — it's safe, high-ROI, and mostly net-new files with near-zero regression risk. Hold **Track B** until OQ-1/2/4/5 are decided and the content gate is designed. Don't let the XL architecture rewrite (P0.1) block the easy KB/platform wins.

---

## 8. ✅ Track A — IMPLEMENTED (2026-06-18)

Built, typechecked, and production-build-verified. All on `tendso.com`, all net-new files (near-zero regression risk).

| File | What it does |
|---|---|
| `lib/seo.ts` | `SITE_URL` (canonical `https://tendso.com` — overrides the plan's wrong `tendso.app`), + Organization/WebSite/Article/Breadcrumb/SoftwareApplication JSON-LD builders. |
| `components/JsonLd.tsx` | Renders JSON-LD as a native `<script type="application/ld+json">` in the **server HTML** (so JS-less AI crawlers read it). |
| `app/robots.ts` | Allows GPTBot, OAI-SearchBot, ClaudeBot/anthropic-ai/claude-web, Google-Extended, PerplexityBot, Bingbot; **blocks** Bytespider + CCBot; disallows `/api`,`/admin`,`/connect-ai`,`/dashboard`,`/wallet`,`/submit`. |
| `app/layout.tsx` | Injects the Organization+WebSite `@graph` on every page; adds `metadataBase`, canonical, OG/Twitter defaults. |
| `convex/knowledge.ts` | `getArticleBySlug` (public, workspace-gated) + `listPublishedHelpSlugs` (for static params/sitemap). |
| `app/knowledge/[slug]/page.tsx` | **SSR per-article route** (ISR 3600s) — server-rendered body + Article/Breadcrumb JSON-LD + per-article canonical/OG. Converts the KB from invisible-SPA → crawlable. |
| `app/sitemap.ts` | static marketing pages + published KB articles (business profiles deferred to Track B). |

**Verification (done):**
- `tsc --noEmit` → clean.
- `next build` → exit 0; routes built: `/knowledge/[slug]` (ƒ dynamic), `/robots.txt` (○), `/sitemap.xml` (ƒ).
- **Runtime curl of a KB article (no JS) confirms the raw HTML carries**: `"@type":"Article"`, `"@type":"BreadcrumbList"`, the real `<h1>`, `<link rel="canonical" href="https://tendso.com/...">`, and the full body text. **This is the core win — the KB is now AI-crawler-visible.**

**Known caveat:** `/robots.txt` and `/sitemap.xml` 404 under a local `next start` (Next 16/Turbopack metadata-route quirk — the `.next/server/app/robots.txt.body` artifact builds correctly). They serve fine on **Vercel**, which routes metadata files natively. Verify post-deploy with `curl https://tendso.com/robots.txt`.

**Still manual (not code) — do post-deploy:**
- Verify `tendso.com` in **Google Search Console** + **Bing Webmaster Tools** ("Import from GSC" to bulk-verify); submit `sitemap.xml`.
- Capture an **AI-citation baseline** (prompt ChatGPT/Perplexity/Gemini with the target query set) so the 4–8 week lift is measurable.
- Add SoftwareApplication/Offer schema to the home/pricing page (`softwareApplicationGraph()` is built in `lib/seo.ts`, just not yet wired into `app/page.tsx` — left out to avoid touching the landing page mid-localization work).
- The `manifest.json` 404 seen in console is pre-existing/unrelated; add a real `public/manifest.json` when convenient.

---

## 9. Track B (D/E/F) — DETAILED, FOR LATER

This is the bet-the-company half. **Do NOT start until the four blockers in §7 are answered.** Detailed scope so it's ready to pick up:

### D — Generated client-site template (the SEO multiplier)
**Blocked on:** client-site domain decision (OQ-2).

- **D1 · Shared `<SiteHead>` Astro partial.** There is NO shared head today — all **15** PageA–O components emit their own `<!DOCTYPE>/<head>` (audited, C1). Build `astro-site-template/src/components/SiteHead.astro` with title/meta/OG/Twitter/canonical + the LocalBusiness `@graph` + a FAQPage block, and import it into all 15. Thread inputs through `src/data/site-data.json` (the runtime builder reads this). **Effort: XL — it's 15 files, not one.**
- **D2 · `buildLocalBusinessSchema()` + `categoryToSchemaType()` helpers.** Map `businessType` → Schema.org subtype (HairSalon, Restaurant, BeautySalon, Dentist, Store, …). Phone → `+63` (strip leading 0). Geo ≥4 decimals. Every `@id` → the **permanent client-site domain** (decided in OQ-2), never `workers.dev`.
- **D3 · Image SEO in the template.** Groq-generate business-specific alt text (`{businessName, service, city}`), descriptive filenames, WebP, explicit width/height (CLS). Free uniqueness signal across sites.
- **D4 · Region→language (OQ-10).** Cebuano/Bisaya for Central Visayas (Cebu/Lapu-Lapu are NOT Tagalog), Tagalog for NCR/Luzon; emit correct `inLanguage`/hreflang. Map from `submissions.city`/`province`.
- **Data note (audited):** `services` lives on `generatedWebsites`, `city`/`province`/`barangay`/`coordinates`/`businessType` on `submissions` — the builder must join both. `googlePlaceId` is on `prospects`/`leads` only (drives D's optional rating via E).

### E — The guardrails (the anti-penalty layer — the real risk)
**Blocked on:** domain-migration decision (OQ-1/2/4/5) + content-gate threshold decisions.

- **E1 · `*.workers.dev` → permanent-domain migration (P0.1, XL architecture rewrite).** Today = one Worker per business on its own `*.workers.dev` subdomain serving ONE html string for all paths (audited, C2/C6). Target = a **single wildcard router Worker** reading the `Host` header and serving `generatedWebsites.htmlContent` from Convex/KV. This is a rewrite of `app/api/publish-website/route.ts deployAsWorker`, plus a Cloudflare cost model (Workers Paid covers compute; client custom domains would need Cloudflare-for-SaaS SSL — defer to a paid upsell). **Add + backfill `generatedWebsites.slug` and `canonicalUrl` here.** Decide migrate-existing vs net-new (OQ-5) — needs the live-site count.
- **E2 · Content gate before publish (P0.10 — the single most important guardrail).** Block publish unless: completeness (`businessName + category + city + barangay + ≥1 photo + ≥3 services + contact + hours + ≥300-word body`) **AND** uniqueness (embedding-cosine near-dup check vs already-published sites — reuse the proven 768d Gemini embed pipeline from `knowledgeAI.ts`, but on a NEW vector index over generated-site content) **AND** owner-verified facts (hours/services/NAP confirmed by a human before publish — Groq hallucinates these) **AND** structural variation (don't ship identical FAQ-4 + section order across 1000s of sites). Failing records → `noindex` "coming soon", excluded from `listPublished`/sitemap/directory. New fields: `contentComplete`, `wordCount`, `dupScore`, `ownerVerified`. Gate lives in `/api/generate-website` (pre-store) + `/api/publish-website` (pre-deploy). **Threshold decisions are policy, not code — need sign-off.**
- **E3 · Conditional real `aggregateRating` (P1.6).** Inject ONLY when a matched `prospects.googlePlaceId` has real review data AND the page visibly renders a "Reviews from Google" block. Fuzzy-match `submissions`↔`prospects` on name + lat/lng (≤50m, H3 overlap). Never fabricate stars.
- **E4 · Attribution footer (P1.3).** ONE homepage-only `rel="nofollow sponsored"` link, rotated non-keyword anchors by category, link on logo only. **No dofollow variant, ever** (dofollow exact-match across 1000s of sites = textbook PBN trigger). Changing it across existing sites = a backfill rebuild job.
- **E5 · De-index kill-switch (P2.7).** A named, owned alert: if GSC "Crawled–not indexed" on client URLs crosses a threshold, **auto-pause the generation pipeline**. Decide threshold + who gets paged.

### F — The flywheel (directory + profiles + listicles)
**Blocked on:** ≥~20 published businesses per target city (inventory, not engineering).

- **F1 · Public business profiles `app/businesses/[slug]/page.tsx`.** SSR profile per published business — the **dofollow** node Tendso links FROM. ~150-word unique neighborhood intro (NOT a dup of the client site's copy), services, hours, map, WhatsApp CTA, dofollow link to the live client site, LocalBusiness+Breadcrumb schema, self-canonical. Needs `slug` (E1).
- **F2 · Directory hubs `app/businesses/[city]` + `[category]/[city]` (GATE ON INVENTORY).** 300–500 words of genuinely unique, human-reviewed local editorial per page; ItemList + FAQPage + Breadcrumb. **Do NOT launch a city until ≥~20 quality businesses exist there** — empty hubs are doorway content that drags the whole domain. Denormalize `city`/`category`/`slug` + add `by_city`/`by_category_city` indexes (the audited N+1 in `listPublished` will not scale). Paginate.
- **F3 · IndexNow on publish (P1.5).** After deploy, fire IndexNow (Bing/Perplexity consume it; Google does NOT). Serve the key file from `tendso.com` (the single-string Worker can't serve it — C2). **Sequence AFTER E1** (don't IndexNow-submit throwaway `workers.dev` URLs).
- **F4 · Internal-linking loop + KB listicles (P1.4/P1.8).** Client sites → KB articles → directory → profiles, with a keyword→canonical-surface map to prevent cannibalization. "Best [category] in [city]" KB listicles citing real listed businesses (Article + ItemList).
- **F5 · Lifecycle/governance (P2.7).** 410/redirect + sitemap removal on churned/closed businesses (avoid soft-404 drag); named owners for the schema template, gate thresholds, and bot allowlist; regression snapshot test on generated HTML.

### Mobile impact of Track B
Only **E2 (content gate)** touches mobile, and only because it lives in the shared Convex publish flow the APK also calls: when the gate ships, **mobile submissions get gated server-side automatically**. The only mobile UI work is surfacing a "pending review / needs more info" state instead of assuming instant publish. Everything else in D/E/F is web/Astro/Convex — no APK change.
